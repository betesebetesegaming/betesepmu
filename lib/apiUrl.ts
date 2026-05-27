/**
 * Maps legacy route paths (e.g. `/modempay-checkout`) to individual Firebase
 * Cloud Function export names. Each endpoint is its own function:
 *
 *   https://<region>-<project-id>.cloudfunctions.net/<exportName>
 *
 * Set NEXT_PUBLIC_API_BASE_URL in Vercel (and in `.env.local` for `next dev`).
 */

import { getApiBaseUrl } from './env/publicConfig';

/** Legacy kebab-case route → Cloud Function export name. */
const ROUTE_TO_FUNCTION: Record<string, string> = {
  '/send-otp': 'sendOtp',
  '/verify-otp': 'verifyOtp',
  '/modempay-checkout': 'modempayCheckout',
  '/wave-payment': 'wavePayment',
  '/aps-payment': 'apsPayment',
  '/afrimoney-payment': 'afrimoneyPayment',
  '/qmoney-payment': 'qmoneyPayment',
  '/card-payment': 'cardPayment',
  '/modempay-payout': 'modempayPayout',
  '/modempay-refund': 'modempayRefund',
  '/modempay-balances': 'modempayBalances',
  '/modempay-webhook': 'modempayWebhook',
  '/modempay-reconcile-deposit': 'modempayReconcileDeposit',
  '/print-receipt': 'printReceipt',
  '/program-media-upload': 'programMediaUpload',
  '/program-media-insert': 'programMediaInsert',
  '/calculate-pmu-payouts': 'calculatePmuPayouts',
  '/support-ai': 'supportAi',
  '/authenticate-user': 'authenticateUser',
};

/**
 * Compose an absolute backend URL. Accepts either a leading slash or not, and
 * tolerates the legacy `/api/` prefix the front-end used when the API routes
 * lived inside Next.js — that prefix is stripped so it doesn't get duplicated.
 */
export function apiUrl(path: string): string {
  let p = String(path || '').trim();
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.startsWith('/api/')) p = p.slice(4);

  const base = getApiBaseUrl();

  const txMatch = p.match(/^\/modempay-transactions\/(.+)$/);
  if (txMatch) {
    return `${base}/modempayTransactions/${encodeURIComponent(txMatch[1])}`;
  }

  const fn = ROUTE_TO_FUNCTION[p];
  if (!fn) {
    throw new Error(`Unknown API route: ${p}`);
  }
  return `${base}/${fn}`;
}
