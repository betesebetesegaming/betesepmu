import type { Request, Response } from 'express';
import { logger } from 'firebase-functions';
import {
  createCheckoutSession,
  createTransfer,
  createRefund,
  retrieveBalances,
  retrieveTransaction,
  verifyWebhookSignature,
  isModemPayMethod,
  isModemPayPayoutNetwork,
  type ModemPayMethod,
  type ModemPayPayoutNetwork,
} from '../modempay';
import { adminDb } from '../admin';

const MERCHANT_NAME = process.env.MODEMPAY_MERCHANT_NAME || 'Betese PMU';

interface CheckoutBody {
  provider?: string;
  method?: string;
  amount?: number | string;
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  externalRef?: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

/**
 * POST /api/modempay-checkout
 *
 * Creates a Modem Pay hosted-checkout session for any of the five supported
 * methods (wave, aps, afrimoney, qmoney, card). Front-end posts amount,
 * customer info, and a unique externalRef; we return the checkoutUrl which the
 * front-end opens in a new tab.
 */
export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as CheckoutBody;

  const provider = String(body.method || body.provider || '').toLowerCase();
  if (!isModemPayMethod(provider)) {
    res.status(400).json({ error: 'method must be one of wave, aps, afrimoney, qmoney, card' });
    return;
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }
  if (!body.externalRef) {
    res.status(400).json({ error: 'externalRef is required' });
    return;
  }

  try {
    const result = await createCheckoutSession({
      method: provider as ModemPayMethod,
      amount,
      externalRef: body.externalRef,
      description: `${MERCHANT_NAME} wallet top-up`,
      customer: {
        id: body.customerId,
        name: body.customerName,
        email: body.customerEmail,
        phone: body.customerPhone,
      },
      successUrl: body.returnUrl,
      cancelUrl: body.cancelUrl || body.returnUrl,
      metadata: body.metadata,
    });

    if (!result.ok || !result.checkoutUrl) {
      logger.warn('ModemPay checkout creation failed', { status: result.status, raw: result.raw });
      res.status(502).json({
        error: 'ModemPay checkout creation failed',
        upstreamStatus: result.status,
        details: result.raw,
      });
      return;
    }

    // Persist a pending checkout marker so the webhook can reconcile it later.
    await adminDb.collection('modempay_checkouts').doc(body.externalRef).set({
      external_ref: body.externalRef,
      session_id: result.sessionId,
      method: provider,
      amount,
      customer_id: body.customerId || null,
      customer_phone: body.customerPhone || null,
      customer_name: body.customerName || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }, { merge: true }).catch(err => logger.warn('Checkout marker write failed', err));

    res.json({
      ok: true,
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      provider,
      externalRef: body.externalRef,
    });
  } catch (err) {
    logger.error('Checkout error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Convenience wrappers — keep the dedicated /api/wave-payment etc. paths the
 * front-end already uses; they forward to checkoutHandler with the provider
 * pinned. This lets us add per-method validation later without touching the UI.
 */
function makeMethodWrapper(method: ModemPayMethod) {
  return async function methodHandler(req: Request, res: Response): Promise<void> {
    const body = (req.body || {}) as CheckoutBody;
    if (!body.customerPhone || !body.amount || !body.externalRef) {
      res.status(400).json({ error: 'customerPhone, amount and externalRef are required' });
      return;
    }
    req.body = { ...body, method };
    return checkoutHandler(req, res);
  };
}

export const wavePaymentHandler      = makeMethodWrapper('wave');
export const apsPaymentHandler       = makeMethodWrapper('aps');
export const afrimoneyPaymentHandler = makeMethodWrapper('afrimoney');
export const qmoneyPaymentHandler    = makeMethodWrapper('qmoney');
export const cardPaymentHandler      = makeMethodWrapper('card');

/**
 * POST /api/modempay-payout
 *
 * Initiates a Modem Pay mobile-money transfer (Wave / AfriMoney).
 * Deducts the customer wallet immediately, then sends funds via ModemPay.
 * Webhook `transfer.succeeded` marks the request Completed; failures refund the hold.
 */
interface PayoutBody {
  amount?: number | string;
  recipientPhone?: string;
  recipientName?: string;
  method?: string;
  network?: string;
  externalRef?: string;
  customerId?: string;
  withdrawalRequestId?: string;
  withdrawalCode?: string;
  processedById?: string;
  processedByName?: string;
  reason?: string;
  metadata?: Record<string, string>;
}

export async function payoutHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as PayoutBody;
  const method = String(body.method || body.network || '').toLowerCase();
  if (!isModemPayPayoutNetwork(method)) {
    res.status(400).json({ error: 'method must be wave or afrimoney for mobile money payout' });
    return;
  }

  const requestId = String(body.withdrawalRequestId || body.externalRef || '').trim();
  if (!requestId) {
    res.status(400).json({ error: 'withdrawalRequestId (or externalRef) is required' });
    return;
  }

  let customerId = String(body.customerId || '').trim();
  let amount = Number(body.amount);
  let recipientPhone = String(body.recipientPhone || '').trim();
  let recipientName = String(body.recipientName || '').trim();
  let withdrawalCode = String(body.withdrawalCode || '').trim();

  try {
    const requestRef = adminDb.collection('withdrawal_requests').doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      res.status(404).json({ error: 'Withdrawal request not found' });
      return;
    }
    const requestData = requestSnap.data() as {
      user_id?: string;
      user_name?: string;
      amount?: number;
      status?: string;
      code?: string;
      recipient_phone?: string;
    };

    if (requestData.status !== 'Pending') {
      res.status(409).json({ error: `Withdrawal request is already ${requestData.status}` });
      return;
    }

    if (withdrawalCode && requestData.code && withdrawalCode !== requestData.code) {
      res.status(403).json({ error: 'Withdrawal code mismatch' });
      return;
    }

    customerId = customerId || String(requestData.user_id || '');
    if (!Number.isFinite(amount) || amount <= 0) amount = Number(requestData.amount || 0);
    recipientPhone = recipientPhone || String(requestData.recipient_phone || '');
    recipientName = recipientName || String(requestData.user_name || 'Customer');

    if (!customerId) {
      res.status(400).json({ error: 'customerId is required' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' });
      return;
    }
    if (!recipientPhone) {
      res.status(400).json({ error: 'recipientPhone is required' });
      return;
    }

    const cleanPhone = recipientPhone.replace(/\D/g, '').replace(/^220/, '');
    const processedById = body.processedById || 'MODEMPAY_PAYOUT';
    const processedByName = body.processedByName || 'ModemPay Payout';
    const payoutLabel = method === 'wave' ? 'Wave' : 'AfriMoney';

    // Hold wallet balance before calling ModemPay.
    const holdOk = await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection('users').doc(customerId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error('Customer not found');
      const walletBalance = Number((userSnap.data() as { wallet_balance?: number }).wallet_balance || 0);
      if (walletBalance < amount) throw new Error('Insufficient wallet balance');

      tx.update(userRef, {
        wallet_balance: Number((walletBalance - amount).toFixed(2)),
      });
      tx.update(requestRef, {
        status: 'Processing',
        payout_method: payoutLabel,
        payout_network: method,
        recipient_phone: cleanPhone,
        external_ref: requestId,
        processed_by: processedById,
        processed_by_name: processedByName,
        processing_at: new Date().toISOString(),
      });
      return true;
    }).catch((err) => {
      logger.warn('Withdrawal hold failed', { requestId, err });
      return false;
    });

    if (!holdOk) {
      res.status(400).json({ error: 'Could not hold wallet balance for withdrawal' });
      return;
    }

    const result = await createTransfer({
      amount,
      recipient: {
        name: recipientName,
        phone: cleanPhone,
        method: method as ModemPayPayoutNetwork,
      },
      reason: body.reason || `${MERCHANT_NAME} withdrawal`,
      externalRef: requestId,
      metadata: {
        customer_id: customerId,
        withdrawal_request_id: requestId,
        ...(body.metadata || {}),
      },
    });

    const transfer = result.data as Record<string, unknown>;
    const transferId = (transfer.id as string | undefined) || null;
    const transferStatus = String(transfer.status || '').toLowerCase();

    if (!result.ok) {
      const upstreamMessage = result.errorMessage || 'ModemPay transfer rejected';
      await refundWithdrawalHold(requestId, customerId, amount, upstreamMessage);
      res.status(502).json({
        error: upstreamMessage,
        upstreamStatus: result.status,
        details: result.data,
        hint: /balance/i.test(upstreamMessage)
          ? 'The ModemPay payout wallet has insufficient funds. Top up payout balance in your ModemPay dashboard before sending withdrawals.'
          : undefined,
      });
      return;
    }

    await requestRef.set({
      provider_transfer_id: transferId,
      provider_status: transferStatus || 'processing',
      updated_at: new Date().toISOString(),
    }, { merge: true });

    if (transferStatus === 'completed') {
      await markWithdrawalSettled(requestId, transfer);
    }

    res.json({
      ok: true,
      transferId,
      status: transferStatus || 'processing',
      withdrawalRequestId: requestId,
    });
  } catch (err) {
    logger.error('Payout error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * POST /api/modempay-refund
 */
interface RefundBody {
  transactionId?: string;
  amount?: number | string;
  reason?: string;
}

export async function refundHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as RefundBody;
  if (!body.transactionId) {
    res.status(400).json({ error: 'transactionId is required' });
    return;
  }
  const amount = body.amount !== undefined ? Number(body.amount) : undefined;
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }
  try {
    const result = await createRefund({ transactionId: body.transactionId, amount, reason: body.reason });
    if (!result.ok) {
      res.status(result.status || 502).json({ error: 'Refund failed', details: result.data });
      return;
    }
    res.json({ ok: true, refund: result.data });
  } catch (err) {
    logger.error('Refund error', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * GET /api/modempay-balances
 */
export async function balancesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const result = await retrieveBalances();
    if (!result.ok) {
      res.status(result.status || 502).json({ error: 'Could not fetch balances', details: result.data });
      return;
    }
    res.json({ ok: true, balances: result.data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * GET /api/modempay-transactions/:id
 */
export async function transactionHandler(req: Request, res: Response): Promise<void> {
  const id = req.params.id || String(req.query.id || '').trim();
  if (!id) {
    res.status(400).json({ error: 'transaction id is required' });
    return;
  }
  try {
    const result = await retrieveTransaction(id);
    if (!result.ok) {
      res.status(result.status || 502).json({ error: 'Could not fetch transaction', details: result.data });
      return;
    }
    res.json({ ok: true, transaction: result.data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// -----------------------------------------------------------------------------
// Webhook (POST /api/modempay-webhook)
// -----------------------------------------------------------------------------

interface ModemPayEvent {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Modem Pay POSTs JSON events here. We:
 *   1. Verify the x-modem-signature header (HMAC-SHA512 over the raw body).
 *   2. Log the raw event to Firestore (modempay_events) for audit.
 *   3. Update business state for the headline events:
 *        charge.succeeded   -> credit customer wallet, mark deposit completed
 *        charge.cancelled / expired -> mark deposit failed
 *        transfer.succeeded -> finalise withdrawal
 *        transfer.failed / reversed / cancelled -> refund withdrawal hold
 *   4. Respond 200 fast so Modem Pay does not retry.
 */
export async function webhookHandler(req: Request, res: Response): Promise<void> {
  const signature = String(req.headers['x-modem-signature'] || '');
  // express raw middleware places the original Buffer on req.body; falls back
  // to JSON-stringified body if the route runs without raw parsing.
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body.toString('utf-8')
    : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {});

  if (!signature) {
    res.status(400).json({ message: 'Signature missing' });
    return;
  }
  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ message: 'Invalid signature' });
    return;
  }

  let event: ModemPayEvent;
  try {
    event = JSON.parse(rawBody) as ModemPayEvent;
  } catch (err) {
    res.status(400).json({ message: 'Invalid event data', error: err instanceof Error ? err.message : String(err) });
    return;
  }

  // Always 200 immediately — Modem Pay retries on non-2xx. We finish the
  // business logic in the background.
  res.status(200).json({ ok: true });

  try {
    await processModemPayEvent(event);
  } catch (err) {
    logger.error('Async modempay webhook processing failed', { event: event.event, err });
  }
}

async function processModemPayEvent(event: ModemPayEvent): Promise<void> {
  const eventType = String(event?.event || '');
  const payload = (event?.payload || {}) as Record<string, unknown>;

  // 1. Persist raw event for audit.
  await adminDb.collection('modempay_events').add({
    event_type: eventType,
    payload,
    received_at: new Date().toISOString(),
  }).catch(err => logger.warn('Failed to log modempay event', err));

  const externalRef = extractExternalRef(payload);

  switch (eventType) {
    case 'charge.succeeded':
    case 'payment_intent.successful':
    case 'payment_intent.succeeded':
    case 'payment.succeeded': {
      if (!externalRef) {
        logger.warn(`${eventType} missing externalRef`, payload);
        return;
      }
      await markDepositCompleted(externalRef, payload);
      return;
    }

    case 'charge.cancelled':
    case 'charge.expired':
    case 'payment_intent.cancelled':
    case 'payment_intent.expired':
    case 'payment_intent.failed':
    case 'payment.failed': {
      if (externalRef) await markDepositFailed(externalRef, eventType, payload);
      return;
    }

    case 'transfer.succeeded': {
      const transferRef = externalRef || extractExternalRef(payload);
      if (transferRef) await markWithdrawalSettled(transferRef, payload);
      return;
    }

    case 'transfer.failed':
    case 'transfer.reversed':
    case 'transfer.cancelled':
    case 'transfer.flagged': {
      const transferRef = externalRef || extractExternalRef(payload);
      if (transferRef) await markWithdrawalFailed(transferRef, eventType, payload);
      return;
    }

    case 'customer.created':
    case 'customer.updated':
    case 'customer.deleted':
    case 'payment_intent.created':
    case 'payment_intent.cancelled':
    case 'payment_intent.expired':
    case 'charge.created':
    case 'charge.updated':
      // Informational — already audited above.
      return;

    default:
      logger.info('Unhandled modempay event', { eventType });
  }
}

async function markDepositCompleted(externalRef: string, payload: Record<string, unknown>) {
  const payloadAmount = Number(payload.amount ?? payload.paid_amount ?? payload.total_amount ?? 0);

  await adminDb.runTransaction(async (tx) => {
    const checkoutRef = adminDb.collection('modempay_checkouts').doc(externalRef);
    const checkoutSnap = await tx.get(checkoutRef);
    if (!checkoutSnap.exists) {
      logger.warn('No checkout marker found for externalRef', { externalRef });
      return;
    }
    const checkout = checkoutSnap.data() as {
      status?: string;
      amount?: number;
      customer_id?: string | null;
      customer_name?: string | null;
      customer_phone?: string | null;
      method?: string;
    };
    if (checkout.status === 'completed') return; // idempotent

    const creditAmount = Number(
      (payloadAmount > 0 ? payloadAmount : checkout.amount) || 0,
    );
    if (creditAmount <= 0) {
      logger.warn('markDepositCompleted: no credit amount', { externalRef, payload });
      return;
    }

    const completedAt = new Date().toISOString();
    const providerTxnId = payload.id || payload.transaction_id || null;
    const methodLabel = mapModemPayMethodLabel(checkout.method || payload.payment_method);

    tx.update(checkoutRef, {
      status: 'completed',
      credited_amount: creditAmount,
      provider_transaction_id: providerTxnId,
      completed_at: completedAt,
      raw_payload: payload,
    });

    const depositReqRef = adminDb.collection('deposit_requests').doc(externalRef);
    const depositReqSnap = await tx.get(depositReqRef);
    if (depositReqSnap.exists) {
      tx.update(depositReqRef, {
        status: 'Approved',
        processed_by: 'MODEMPAY_WEBHOOK',
        processed_by_name: 'ModemPay',
        processed_at: completedAt,
        verification_status: 'Verified',
        verification_source: 'webhook',
        verification_message: 'Payment confirmed by ModemPay.',
        verified_at: completedAt,
      });
    }

    const depositLogRef = adminDb.collection('deposit_logs').doc(externalRef);
    tx.set(depositLogRef, {
      id: externalRef,
      external_ref: externalRef,
      customer_id: checkout.customer_id || null,
      customer_name: checkout.customer_name || null,
      customer_phone: checkout.customer_phone || null,
      amount: creditAmount,
      method: methodLabel,
      status: 'completed',
      provider_transaction_id: providerTxnId,
      timestamp: completedAt,
      processed_by_id: 'MODEMPAY_WEBHOOK',
      processed_by_name: 'ModemPay',
      transaction_id: providerTxnId,
    }, { merge: true });

    if (checkout.customer_id) {
      const userRef = adminDb.collection('users').doc(checkout.customer_id);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        const userData = userSnap.data() as {
          wallet_balance?: number;
          total_deposited_amount?: number;
          first_deposit_at?: string | null;
        };
        const currentWallet = Number(userData.wallet_balance || 0);
        const currentDeposited = Number(userData.total_deposited_amount || 0);
        tx.update(userRef, {
          wallet_balance: Number((currentWallet + creditAmount).toFixed(2)),
          total_deposited_amount: Number((currentDeposited + creditAmount).toFixed(2)),
          ...(userData.first_deposit_at ? {} : { first_deposit_at: completedAt }),
        });
      }
    }
  });
}

function extractExternalRef(payload: Record<string, unknown>): string | undefined {
  const metadata = payload.metadata as Record<string, unknown> | undefined;
  const nested = payload.data as Record<string, unknown> | undefined;
  const nestedMeta = nested?.metadata as Record<string, unknown> | undefined;
  const candidates = [
    payload.external_reference,
    payload.externalReference,
    payload.transaction_reference,
    metadata?.external_reference,
    metadata?.externalReference,
    nested?.external_reference,
    nestedMeta?.external_reference,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function mapModemPayMethodLabel(method: unknown): string {
  const value = String(method || '').toLowerCase();
  switch (value) {
    case 'wave': return 'Wave';
    case 'aps': return 'APS';
    case 'afrimoney': return 'AfriMoney';
    case 'qmoney': return 'QMoney';
    case 'card': return 'Card';
    default: return value || 'unknown';
  }
}

async function markDepositFailed(externalRef: string, reason: string, payload: Record<string, unknown>) {
  const failedAt = new Date().toISOString();
  const checkoutRef = adminDb.collection('modempay_checkouts').doc(externalRef);
  await checkoutRef.set({
    status: 'failed',
    failure_reason: reason,
    raw_payload: payload,
    failed_at: failedAt,
  }, { merge: true }).catch(err => logger.warn('Failed to mark deposit failed', err));

  await adminDb.collection('deposit_requests').doc(externalRef).set({
    status: 'Rejected',
    processed_by: 'MODEMPAY_WEBHOOK',
    processed_by_name: 'ModemPay',
    processed_at: failedAt,
    verification_status: 'VerificationFailed',
    verification_source: 'webhook',
    verification_message: reason,
    verified_at: failedAt,
  }, { merge: true }).catch(err => logger.warn('Failed to mark deposit request failed', err));
}

async function markWithdrawalSettled(externalRef: string, payload: Record<string, unknown>) {
  const completedAt = new Date().toISOString();
  const ref = adminDb.collection('withdrawal_requests').doc(externalRef);
  await ref.set({
    status: 'Completed',
    provider_transfer_id: payload.id || null,
    provider_status: payload.status || 'completed',
    completed_at: completedAt,
    raw_payload: payload,
  }, { merge: true }).catch(err => logger.warn('Failed to settle withdrawal', err));
}

async function refundWithdrawalHold(requestId: string, customerId: string, amount: number, reason: string) {
  await adminDb.runTransaction(async (tx) => {
    const userRef = adminDb.collection('users').doc(customerId);
    const userSnap = await tx.get(userRef);
    if (userSnap.exists) {
      const walletBalance = Number((userSnap.data() as { wallet_balance?: number }).wallet_balance || 0);
      tx.update(userRef, {
        wallet_balance: Number((walletBalance + amount).toFixed(2)),
      });
    }
    tx.update(adminDb.collection('withdrawal_requests').doc(requestId), {
      status: 'Failed',
      failure_reason: reason,
      failed_at: new Date().toISOString(),
    });
  }).catch(err => logger.warn('Failed to refund withdrawal hold', { requestId, err }));
}

async function markWithdrawalFailed(externalRef: string, reason: string, payload: Record<string, unknown>) {
  const ref = adminDb.collection('withdrawal_requests').doc(externalRef);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.warn('Withdrawal request not found for failure', { externalRef });
    return;
  }
  const data = snap.data() as { user_id?: string; amount?: number; status?: string };
  if (data.status === 'Failed' || data.status === 'Canceled') return;

  const customerId = String(data.user_id || '');
  const amount = Number(data.amount || 0);
  if (customerId && amount > 0 && data.status === 'Processing') {
    await refundWithdrawalHold(externalRef, customerId, amount, reason);
    return;
  }

  await ref.set({
    status: 'Failed',
    failure_reason: reason,
    failed_at: new Date().toISOString(),
    raw_payload: payload,
  }, { merge: true }).catch(err => logger.warn('Failed to mark withdrawal failed', err));
}
