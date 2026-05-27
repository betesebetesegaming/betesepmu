/**
 * Maps legacy route paths (e.g. `/modempay-checkout`) to individual Firebase
 * Cloud Function names. Each endpoint is its own function:
 *
 *   https://<region>-<project-id>.cloudfunctions.net/<functionName>
 *
 * Set NEXT_PUBLIC_API_BASE_URL in Vercel (and in `.env.local` for `next dev`)
 * to the functions root (no trailing `/api`). Emulator example:
 *
 *   http://localhost:5001/<project-id>/us-central1
 */

const DEFAULT_BASE = 'https://us-central1-betesepmu-4ffc7.cloudfunctions.net';

/** Legacy kebab-case route → camelCase Cloud Function export name. */
const ROUTE_TO_FUNCTION: Record<string, string> = {
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
  '/print-receipt': 'printReceipt',
  '/program-media-upload': 'programMediaUpload',
  '/program-media-insert': 'programMediaInsert',
  '/calculate-pmu-payouts': 'calculatePmuPayouts',
  '/support-ai': 'supportAi',
  '/authenticate-user': 'authenticateUser',
};

function getBase(): string {
  const fromEnv =
    (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) || '';
  let base = (fromEnv || DEFAULT_BASE).trim();
  // Strip legacy `/api` suffix from older configs.
  base = base.replace(/\/api\/?$/, '');
  return base.replace(/\/+$/, '');
}

/**
 * Compose an absolute backend URL. Accepts either a leading slash or not, and
 * tolerates the legacy `/api/` prefix the front-end used when the API routes
 * lived inside Next.js — that prefix is stripped so it doesn't get duplicated.
 */
export function apiUrl(path: string): string {
  let p = String(path || '').trim();
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.startsWith('/api/')) p = p.slice(4);

  const txMatch = p.match(/^\/modempay-transactions\/(.+)$/);
  if (txMatch) {
    return `${getBase()}/modempayTransactions/${encodeURIComponent(txMatch[1])}`;
  }

  const fn = ROUTE_TO_FUNCTION[p];
  if (!fn) {
    throw new Error(`Unknown API route: ${p}`);
  }
  return `${getBase()}/${fn}`;
}
