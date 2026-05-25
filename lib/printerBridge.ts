/**
 * Direct print bridge for the device's built-in thermal printer.
 *
 * No Bluetooth pairing, no picker dialog, no redirection. The ESC/POS bytes
 * are pushed straight into the on-device thermal printer service (Sunmi AIDL
 * via the SunmiPrint Capacitor plugin, or the SunmiInnerPrinter WebView JS
 * bridge if the page is hosted inside a Sunmi browser).
 *
 * If neither transport is reachable (e.g. running on a desktop browser for
 * QA), the caller can fall back to CSS print.
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

interface SunmiPrintPlugin {
  /** Send raw ESC/POS bytes (base64) straight to the AIDL printer service. */
  sendRaw(options: { base64: string }): Promise<{ success: boolean; bytes?: number }>;
  /** Forward plain text (honours embedded ESC/POS commands). */
  printText(options: { text: string }): Promise<{ success: boolean }>;
  /** Feed + partial cut. */
  cutPaper(): Promise<{ success: boolean }>;
}

const SunmiPrint = registerPlugin<SunmiPrintPlugin>('SunmiPrint');

type SunmiWebBridge = {
  sendRAWData?: (base64: string) => void;
  printerInit?: () => void;
  printerFeedPaper?: (n: number) => void;
  cutpaper?: () => void;
};

const getSunmiWebBridge = (): SunmiWebBridge | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SunmiInnerPrinter?: SunmiWebBridge };
  return w.SunmiInnerPrinter ?? null;
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
};

export type PrintResult = {
  ok: boolean;
  transport: 'sunmi-aidl' | 'sunmi-webview' | 'none';
  message?: string;
};

/**
 * Push ESC/POS bytes to the built-in thermal printer.
 *
 * No dialogs, no pairing — if a thermal print service is on the device the
 * paper comes out immediately. Returns `{ok:false, transport:'none'}` when
 * we're running off-device (e.g. a desktop browser); the caller can then
 * trigger a regular CSS print as a last-resort fallback.
 */
export const printEscPos = async (bytes: Uint8Array): Promise<PrintResult> => {
  const base64 = toBase64(bytes);

  // 1. Native AIDL via Capacitor plugin — fastest, byte-perfect, no dialog.
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await SunmiPrint.sendRaw({ base64 });
      if (res?.success) {
        return { ok: true, transport: 'sunmi-aidl' };
      }
    } catch (err) {
      const message = (err as Error)?.message || 'Sunmi printer not available';
      // Sunmi service refused (probably not a Sunmi device). Try the JS
      // bridge in case the page runs inside a non-Capacitor Sunmi WebView.
      const bridge = getSunmiWebBridge();
      if (bridge?.sendRAWData) {
        try {
          bridge.printerInit?.();
          bridge.sendRAWData(base64);
          bridge.printerFeedPaper?.(3);
          bridge.cutpaper?.();
          return { ok: true, transport: 'sunmi-webview' };
        } catch {
          /* fall through */
        }
      }
      return { ok: false, transport: 'none', message };
    }
  }

  // 2. Sunmi WebView JS bridge (page running inside a Sunmi browser shell).
  const bridge = getSunmiWebBridge();
  if (bridge?.sendRAWData) {
    try {
      bridge.printerInit?.();
      bridge.sendRAWData(base64);
      bridge.printerFeedPaper?.(3);
      bridge.cutpaper?.();
      return { ok: true, transport: 'sunmi-webview' };
    } catch (err) {
      return {
        ok: false,
        transport: 'sunmi-webview',
        message: (err as Error)?.message || 'Sunmi WebView print failed',
      };
    }
  }

  return {
    ok: false,
    transport: 'none',
    message: 'No on-device thermal printer service detected.',
  };
};

/** True if a built-in thermal printer service is reachable from this page. */
export const hasThermalService = (): boolean => {
  if (Capacitor.isNativePlatform()) return true;
  return !!getSunmiWebBridge()?.sendRAWData;
};
