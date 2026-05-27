/**
 * Thermer-only print bridge.
 *
 * The user's V2 Pro / Sunmi handhelds have a Browser-Print thermal app
 * installed (Thermer / Bluetooth Mini Thermal Printer). Printing is one
 * URL hand-off, no Bluetooth pairing, no picker:
 *
 *   1. Build a JSON payload of print entries (lib/thermerReceipt.ts).
 *   2. Base64-encode it and put it in /api/print-receipt?data=<base64>.
 *      That URL is the "Response URL" the print app fetches.
 *   3. Click a link with the custom-scheme URL whose `msg=` param is
 *      that Response URL. Android hands the link to the print app, which
 *      fetches the JSON and prints it on whatever printer it's
 *      configured to use.
 *
 * IMPORTANT: we use a synthesised <a> click — never a window.location
 * change and never an intent:// URL with a `package=` fallback. Both of
 * those forms cause Android Chrome to bounce the user to the Play Store
 * if the scheme isn't recognised. With a plain anchor click, an
 * unrecognised scheme just stays on our page silently.
 */

import { apiUrl } from './apiUrl';
import { ThermerEntry, encodeThermerPayload } from './thermerReceipt';

export type PrintResult = {
  ok: boolean;
  transport: 'thermer' | 'none';
  message?: string;
};

const buildResponseUrl = (entries: ThermerEntry[]): string => {
  if (typeof window === 'undefined') {
    throw new Error('printViaThermer must be called in the browser');
  }
  const data = encodeThermerPayload(entries);
  return `${apiUrl('/print-receipt')}?data=${encodeURIComponent(data)}`;
};

const buildBluetoothPrintUrl = (responseUrl: string): string =>
  // Action keyword `print` (vs `msg`) tells the app to fire its print
  // pipeline immediately on receipt, instead of opening preview mode.
  `bluetoothprint:print?msg=${encodeURIComponent(responseUrl)}`;

/**
 * Click a synthetic anchor tag pointing at the custom scheme. Android's
 * link handler picks this up and either opens the registered app or does
 * nothing. Critically, an unhandled scheme on an <a> click does NOT
 * bounce to the Play Store the way `window.location.href = 'foo:'` or an
 * intent:// URL with a `package=` fallback would.
 */
const clickHandoffLink = (url: string): void => {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener noreferrer';
  // Some Android versions need the link to be in the DOM for the click to
  // be honoured by the OS link handler.
  a.style.position = 'fixed';
  a.style.left = '-9999px';
  a.style.opacity = '0';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    window.setTimeout(() => {
      try { document.body.removeChild(a); } catch {}
    }, 1000);
  }
};

/**
 * Hand the entries off to the Thermer app. Resolves once the link has
 * been clicked — we can't observe whether the app actually accepted it
 * (that's between the user, the app, and the printer). If the scheme
 * isn't registered the browser stays on our page silently; we never
 * redirect to the Play Store.
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

  clickHandoffLink(buildBluetoothPrintUrl(responseUrl));
  return { ok: true, transport: 'thermer' };
};

/** Build the Thermer hand-off URL without navigating — useful when the
 *  caller wants to render a real `<a href>` for the user to tap manually. */
export const buildThermerHandoffUrl = (entries: ThermerEntry[]): string =>
  buildBluetoothPrintUrl(buildResponseUrl(entries));
