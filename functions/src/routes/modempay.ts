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
  type ModemPayMethod,
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
 * Initiates a Modem Pay transfer to a customer's mobile wallet — used to
 * settle vendor-approved withdrawal requests.
 */
interface PayoutBody {
  amount?: number | string;
  recipientPhone?: string;
  recipientName?: string;
  method?: string;
  externalRef?: string;
  reason?: string;
  metadata?: Record<string, string>;
}

export async function payoutHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as PayoutBody;
  const method = String(body.method || '').toLowerCase();
  if (!isModemPayMethod(method)) {
    res.status(400).json({ error: 'method must be one of wave, aps, afrimoney, qmoney, card' });
    return;
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }
  if (!body.recipientPhone) {
    res.status(400).json({ error: 'recipientPhone is required' });
    return;
  }
  if (!body.externalRef) {
    res.status(400).json({ error: 'externalRef is required' });
    return;
  }

  try {
    const result = await createTransfer({
      amount,
      recipient: {
        name: body.recipientName,
        phone: body.recipientPhone,
        method: method as ModemPayMethod,
      },
      reason: body.reason || `${MERCHANT_NAME} withdrawal`,
      externalRef: body.externalRef,
      metadata: body.metadata,
    });
    if (!result.ok) {
      res.status(result.status || 502).json({ error: 'ModemPay transfer failed', details: result.data });
      return;
    }
    res.json({ ok: true, transfer: result.data });
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

  const externalRef = (payload.external_reference as string | undefined)
    || (payload.transaction_reference as string | undefined)
    || ((payload.metadata as Record<string, unknown> | undefined)?.external_reference as string | undefined);

  switch (eventType) {
    case 'charge.succeeded': {
      if (!externalRef) {
        logger.warn('charge.succeeded missing externalRef', payload);
        return;
      }
      await markDepositCompleted(externalRef, payload);
      return;
    }

    case 'charge.cancelled':
    case 'charge.expired': {
      if (externalRef) await markDepositFailed(externalRef, eventType, payload);
      return;
    }

    case 'transfer.succeeded': {
      if (externalRef) await markWithdrawalSettled(externalRef, payload);
      return;
    }

    case 'transfer.failed':
    case 'transfer.reversed':
    case 'transfer.cancelled':
    case 'transfer.flagged': {
      if (externalRef) await markWithdrawalFailed(externalRef, eventType, payload);
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
      method?: string;
    };
    if (checkout.status === 'completed') return; // idempotent

    tx.update(checkoutRef, {
      status: 'completed',
      provider_transaction_id: payload.id || null,
      completed_at: new Date().toISOString(),
      raw_payload: payload,
    });

    // Mirror into deposit_logs for the cashier dashboards.
    const depositRef = adminDb.collection('deposit_logs').doc(externalRef);
    tx.set(depositRef, {
      id: externalRef,
      external_ref: externalRef,
      customer_id: checkout.customer_id || null,
      amount: checkout.amount || Number(payload.amount) || 0,
      method: checkout.method || (payload.payment_method as string | undefined) || 'unknown',
      status: 'completed',
      provider_transaction_id: payload.id || null,
      created_at: new Date().toISOString(),
    }, { merge: true });

    // Credit wallet if we know the customer.
    if (checkout.customer_id) {
      const userRef = adminDb.collection('users').doc(checkout.customer_id);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) {
        const currentBalance = Number((userSnap.data() as { balance?: number }).balance || 0);
        const delta = Number(checkout.amount || payload.amount || 0);
        tx.update(userRef, { balance: currentBalance + delta });
      }
    }
  });
}

async function markDepositFailed(externalRef: string, reason: string, payload: Record<string, unknown>) {
  const checkoutRef = adminDb.collection('modempay_checkouts').doc(externalRef);
  await checkoutRef.set({
    status: 'failed',
    failure_reason: reason,
    raw_payload: payload,
    failed_at: new Date().toISOString(),
  }, { merge: true }).catch(err => logger.warn('Failed to mark deposit failed', err));
}

async function markWithdrawalSettled(externalRef: string, payload: Record<string, unknown>) {
  const ref = adminDb.collection('withdrawal_requests').doc(externalRef);
  await ref.set({
    status: 'settled',
    provider_transfer_id: payload.id || null,
    settled_at: new Date().toISOString(),
    raw_payload: payload,
  }, { merge: true }).catch(err => logger.warn('Failed to settle withdrawal', err));
}

async function markWithdrawalFailed(externalRef: string, reason: string, payload: Record<string, unknown>) {
  const ref = adminDb.collection('withdrawal_requests').doc(externalRef);
  await ref.set({
    status: 'failed',
    failure_reason: reason,
    failed_at: new Date().toISOString(),
    raw_payload: payload,
  }, { merge: true }).catch(err => logger.warn('Failed to mark withdrawal failed', err));
}
