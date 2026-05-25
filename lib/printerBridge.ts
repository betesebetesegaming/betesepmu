/**
 * Thermer-only print bridge.
 *
 * The user's V2 Pro / Sunmi handhelds have the Thermer app
 * (`mate.bluetoothprint`, "Bluetooth Mini Thermal Printer") installed with
 * Browser-Print enabled. Printing is a single URL hand-off:
 *
 *   1. We build a JSON payload of print entries (lib/thermerReceipt.ts).
 *   2. We base64-encode it and put it in the URL of our Next.js route
 *      `/api/print-receipt?data=<base64>` — the Response URL.
 *   3. We navigate to a custom-scheme URL whose `msg=` param is that
 *      Response URL. Android hands the link to the Thermer app, which
 *      fetches the JSON and prints it on whichever printer it has
 *      configured (the V2 Pro's internal printer — no Bluetooth, no
 *      pairing, no picker).
 *
 * Public docs strip the literal scheme; the most-cited candidate is
 * `bluetoothprint:msg?msg=<URL>`. We try that first, and if Android
 * doesn't pick it up within a short window we fall back to the
 * intent:// form with the package pinned to `mate.bluetoothprint`.
 *
 * No Bluetooth, no AIDL, no Web Bluetooth, no pairing — by design.
 */

import { ThermerEntry, encodeThermerPayload } from './thermerReceipt';

const THERMER_PACKAGE = 'mate.bluetoothprint';

export type PrintResult = {
  ok: boolean;
  transport: 'thermer' | 'thermer-intent' | 'none';
  message?: string;
};

const buildResponseUrl = (entries: ThermerEntry[]): string => {
  if (typeof window === 'undefined') {
    throw new Error('printEscPos must be called in the browser');
  }
  const data = encodeThermerPayload(entries);
  const origin = window.location.origin.replace(/\/$/, '');
  return `${origin}/api/print-receipt?data=${encodeURIComponent(data)}`;
};

const buildBluetoothPrintUrl = (responseUrl: string): string =>
  `bluetoothprint:msg?msg=${encodeURIComponent(responseUrl)}`;

const buildIntentUrl = (responseUrl: string): string =>
  `intent://msg?msg=${encodeURIComponent(responseUrl)}` +
  `#Intent;scheme=bluetoothprint;package=${THERMER_PACKAGE};end`;

const navigateTo = (url: string): void => {
  // Using window.location is the most reliable cross-browser way to fire a
  // custom-scheme URL on Android. window.open and <a target=_blank> are
  // sometimes blocked or break the handoff.
  window.location.href = url;
};

/**
 * Send the entries to Thermer. Resolves immediately after firing the URL —
 * we can't observe whether the app actually printed; that's between the
 * user, the app, and the printer. The promise resolves with `ok:false` only
 * when we can't even attempt the navigation (e.g. SSR).
 */
export const printViaThermer = async (entries: ThermerEntry[]): Promise<PrintResult> => {
  if (typeof window === 'undefined') {
    return { ok: false, transport: 'none', message: 'Not running in a browser' };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, transport: 'none', message: 'Nothing to print' };
  }

  let responseUrl: string;
  try {
    responseUrl = buildResponseUrl(entries);
  } catch (err) {
    return {
      ok: false,
      transport: 'none',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const primary = buildBluetoothPrintUrl(responseUrl);
  const intentUrl = buildIntentUrl(responseUrl);

  // Mark that we attempted a handoff. If the page is still visible after a
  // moment we assume the primary scheme wasn't recognised and try the
  // intent:// form, which Android Chrome resolves to the specific Thermer
  // package even if the custom scheme isn't registered system-wide.
  const startedAt = Date.now();
  let handedOff = false;
  const onVisibilityChange = () => {
    if (document.hidden) handedOff = true;
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  navigateTo(primary);

  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 700);
  });

  document.removeEventListener('visibilitychange', onVisibilityChange);

  if (handedOff || Date.now() - startedAt > 1500) {
    return { ok: true, transport: 'thermer' };
  }

  // Browser is still on our page — the custom scheme didn't resolve. Try
  // the intent fallback, which forces Android to dispatch to the Thermer
  // package directly.
  navigateTo(intentUrl);
  return { ok: true, transport: 'thermer-intent' };
};

/** Build the Thermer Response URL without navigating — useful for "open in
 *  app" buttons that the user taps themselves. */
export const buildThermerHandoffUrl = (entries: ThermerEntry[]): string =>
  buildBluetoothPrintUrl(buildResponseUrl(entries));
