import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from 'firebase-functions';

/**
 * Thin Modem Pay REST client. We deliberately avoid the official `modem-pay`
 * SDK so the function bundle stays small and we can run on Cloud Functions
 * without surprises from third-party dependencies.
 *
 * All requests are signed with the secret key (`MODEMPAY_SECRET_KEY`); the
 * public key (`MODEMPAY_PUBLIC_KEY`) is forwarded as `X-Public-Key` for the
 * endpoints that require it.
 */

export type ModemPayMethod = 'wave' | 'aps' | 'afrimoney' | 'qmoney' | 'card';

export const MODEMPAY_METHODS: ReadonlyArray<ModemPayMethod> = [
  'wave', 'aps', 'afrimoney', 'qmoney', 'card',
];

export function isModemPayMethod(v: unknown): v is ModemPayMethod {
  return typeof v === 'string' && (MODEMPAY_METHODS as ReadonlyArray<string>).includes(v.toLowerCase());
}

function baseUrl(): string {
  return process.env.MODEMPAY_BASE_URL || 'https://api.modempay.com';
}

function secretKey(): string {
  const k = process.env.MODEMPAY_SECRET_KEY;
  if (!k) throw new Error('MODEMPAY_SECRET_KEY is not configured');
  return k;
}

function publicKey(): string {
  return process.env.MODEMPAY_PUBLIC_KEY || '';
}

interface ModemFetchOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export async function modemFetch<T = unknown>(opts: ModemFetchOptions): Promise<{ ok: boolean; status: number; data: T }> {
  const url = new URL(`${baseUrl().replace(/\/+$/, '')}${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: opts.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secretKey()}`,
      'X-Public-Key': publicKey(),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

// -----------------------------------------------------------------------------
// Checkout sessions
// -----------------------------------------------------------------------------

export interface CreateCheckoutInput {
  method: ModemPayMethod;
  amount: number;
  currency?: string;
  externalRef: string;
  description?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(input: CreateCheckoutInput) {
  const dataPayload: Record<string, unknown> = {
    amount: input.amount,
    currency: input.currency || 'GMD',
    from_sdk: false,
    return_url: input.successUrl,
    cancel_url: input.cancelUrl || input.successUrl,
    title: input.description || 'Wallet top-up',
    description: input.description,
    metadata: {
      source: 'betese-pmu',
      method: input.method,
      external_reference: input.externalRef,
      ...(input.metadata || {}),
    },
  };

  if (input.customer?.name) dataPayload.customer_name = input.customer.name;
  if (input.customer?.email) dataPayload.customer_email = input.customer.email;
  if (input.customer?.phone) dataPayload.customer_phone = input.customer.phone;

  const { ok, status, data } = await modemFetch({
    method: 'POST',
    path: '/v1/payments',
    body: { data: dataPayload },
  });

  const envelope = data as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  const inner = envelope.data || (data as Record<string, unknown>);
  const checkoutUrl =
    (inner.payment_link as string | undefined) ||
    (inner.checkout_url as string | undefined) ||
    (inner.url as string | undefined) ||
    (inner.payment_url as string | undefined);

  const sessionId =
    (inner.payment_intent_id as string | undefined) ||
    (inner.id as string | undefined) ||
    null;

  const apiOk = ok && envelope.status !== false && !!checkoutUrl;

  return { ok: apiOk, status, checkoutUrl, sessionId, raw: data };
}

// -----------------------------------------------------------------------------
// Transfers / payouts (used to settle vendor withdrawals)
// -----------------------------------------------------------------------------

export interface CreateTransferInput {
  amount: number;
  currency?: string;
  recipient: {
    name?: string;
    phone: string;
    method: ModemPayMethod;
  };
  reason?: string;
  externalRef: string;
  metadata?: Record<string, string>;
}

export async function createTransfer(input: CreateTransferInput) {
  const payload = {
    amount: input.amount,
    currency: input.currency || 'GMD',
    recipient: input.recipient,
    description: input.reason,
    external_reference: input.externalRef,
    metadata: {
      source: 'betese-pmu',
      ...(input.metadata || {}),
    },
  };
  return modemFetch({ method: 'POST', path: '/v1/transfers', body: payload });
}

// -----------------------------------------------------------------------------
// Refunds
// -----------------------------------------------------------------------------

export interface CreateRefundInput {
  transactionId: string;
  amount?: number;
  reason?: string;
}

export async function createRefund(input: CreateRefundInput) {
  return modemFetch({
    method: 'POST',
    path: `/v1/transactions/${encodeURIComponent(input.transactionId)}/refund`,
    body: { amount: input.amount, reason: input.reason },
  });
}

// -----------------------------------------------------------------------------
// Balances + transactions
// -----------------------------------------------------------------------------

export function retrieveBalances() {
  return modemFetch({ method: 'GET', path: '/v1/balances' });
}

export function retrieveTransaction(id: string) {
  return modemFetch({ method: 'GET', path: `/v1/transactions/${encodeURIComponent(id)}` });
}

// -----------------------------------------------------------------------------
// Webhook signature verification (HMAC-SHA512 over raw body)
// -----------------------------------------------------------------------------

export function verifyWebhookSignature(rawBody: string, providedSignature: string): boolean {
  const secret = process.env.MODEMPAY_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('MODEMPAY_WEBHOOK_SECRET is not configured — rejecting webhook');
    return false;
  }
  if (!providedSignature || typeof providedSignature !== 'string') return false;

  const computed = createHmac('sha512', secret).update(rawBody).digest('hex');
  if (computed.length !== providedSignature.length) return false;

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(providedSignature));
  } catch {
    return false;
  }
}
