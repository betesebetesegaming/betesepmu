/**
 * Auto-print bridge for thermal printers.
 *
 * Tries, in order:
 *   1. Sunmi WebView JS bridge (`window.SunmiInnerPrinter`) — if the page is
 *      loaded inside a Sunmi browser/WebView that exposes the inner printer
 *      directly to JS. No pairing needed.
 *   2. Web Bluetooth (Chromium-based browsers): reuses the printer paired on
 *      a previous visit via `navigator.bluetooth.getDevices()` so the user
 *      doesn't see the picker again.
 *   3. Web Bluetooth picker (one-time pairing). Caches the printer by
 *      device id in localStorage so subsequent prints reuse it silently.
 *
 * Throws a `PrinterUnavailableError` if no transport works — caller should
 * fall back to CSS print.
 */

const REMEMBERED_PRINTER_KEY = 'betese_bt_printer_id';

// Common GATT services advertised by 58mm/80mm thermal printers and Sunmi
// inner printers when they're exposed over BLE. Different brands use
// different UUIDs, so we accept any of these.
const PRINTER_SERVICE_UUIDS: BluetoothServiceUUID[] = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic thermal "Printer Service"
  '0000ff00-0000-1000-8000-00805f9b34fb', // Goojprt / common BLE thermal
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Sunmi BLE
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HC-05/HC-06 SPP-over-BLE
  '0000ffb0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '00001101-0000-1000-8000-00805f9b34fb', // Classic SPP
  '0000fff0-0000-1000-8000-00805f9b34fb',
];

export class PrinterUnavailableError extends Error {
  constructor(message = 'No thermal printer available') {
    super(message);
    this.name = 'PrinterUnavailableError';
  }
}

type SunmiBridge = {
  printerInit?: () => void;
  setAlignment?: (n: 0 | 1 | 2) => void;
  setFontSize?: (size: number) => void;
  printText?: (s: string) => void;
  printerFeedPaper?: (n: number) => void;
  cutpaper?: () => void;
  /** Some Sunmi builds expose a raw byte channel. */
  sendRAWData?: (base64: string) => void;
};

type CapacitorSunmiPrint = {
  printText: (opts: { text: string }) => Promise<unknown>;
  cutPaper?: () => Promise<unknown>;
};

type CapacitorLike = {
  Plugins?: { SunmiPrint?: CapacitorSunmiPrint; [key: string]: unknown };
  isNativePlatform?: () => boolean;
};

const getSunmiBridge = (): SunmiBridge | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SunmiInnerPrinter?: SunmiBridge };
  return w.SunmiInnerPrinter ?? null;
};

const getCapacitorSunmi = (): CapacitorSunmiPrint | null => {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
  return cap?.Plugins?.SunmiPrint ?? null;
};

/** Convert Uint8Array to base64 (browser-safe). */
const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
};

const isWebBluetoothSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator && !!navigator.bluetooth;

let cachedDevice: BluetoothDevice | null = null;
let cachedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

const findWritableCharacteristic = async (
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic | null> => {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    let characteristics: BluetoothRemoteGATTCharacteristic[] = [];
    try {
      characteristics = await service.getCharacteristics();
    } catch {
      continue;
    }
    for (const ch of characteristics) {
      if (ch.properties.writeWithoutResponse || ch.properties.write) {
        return ch;
      }
    }
  }
  return null;
};

const connectToDevice = async (
  device: BluetoothDevice,
): Promise<BluetoothRemoteGATTCharacteristic> => {
  if (!device.gatt) throw new PrinterUnavailableError('Printer has no GATT server');
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) {
    throw new PrinterUnavailableError('Printer has no writable characteristic');
  }
  cachedDevice = device;
  cachedCharacteristic = characteristic;
  try {
    localStorage.setItem(REMEMBERED_PRINTER_KEY, device.id);
  } catch {}
  return characteristic;
};

const tryReuseRememberedDevice = async (): Promise<BluetoothRemoteGATTCharacteristic | null> => {
  if (cachedCharacteristic && cachedDevice?.gatt?.connected) return cachedCharacteristic;

  if (!isWebBluetoothSupported()) return null;
  const bt = navigator.bluetooth as Bluetooth & {
    getDevices?: () => Promise<BluetoothDevice[]>;
  };
  if (typeof bt.getDevices !== 'function') return null;

  let rememberedId: string | null = null;
  try {
    rememberedId = localStorage.getItem(REMEMBERED_PRINTER_KEY);
  } catch {}

  let devices: BluetoothDevice[] = [];
  try {
    devices = await bt.getDevices();
  } catch {
    return null;
  }
  if (devices.length === 0) return null;

  const candidate =
    (rememberedId && devices.find((d) => d.id === rememberedId)) ||
    devices[0];
  if (!candidate) return null;

  try {
    return await connectToDevice(candidate);
  } catch {
    return null;
  }
};

/** Trigger the OS pair/picker dialog. Must be called inside a user gesture. */
const requestNewBluetoothDevice = async (): Promise<BluetoothRemoteGATTCharacteristic> => {
  if (!isWebBluetoothSupported()) {
    throw new PrinterUnavailableError(
      'Web Bluetooth is not supported in this browser. Use Chrome or Edge on Android/Desktop.',
    );
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });
  return connectToDevice(device);
};

const writeChunked = async (
  characteristic: BluetoothRemoteGATTCharacteristic,
  bytes: Uint8Array,
): Promise<void> => {
  // Most BLE thermal printers cap MTU around 180-244 bytes. 150 is safe.
  const CHUNK = 150;
  const useNoResponse = !!characteristic.properties.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK);
    if (useNoResponse) {
      await characteristic.writeValueWithoutResponse(slice);
    } else {
      await characteristic.writeValue(slice);
    }
    // Tiny breathing room so slow printers don't drop bytes.
    await new Promise((r) => setTimeout(r, 8));
  }
};

const printViaSunmiBridge = (bytes: Uint8Array): boolean => {
  const bridge = getSunmiBridge();
  if (bridge?.sendRAWData) {
    try {
      bridge.sendRAWData(toBase64(bytes));
      bridge.printerFeedPaper?.(3);
      bridge.cutpaper?.();
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

const printViaCapacitorSunmi = async (bytes: Uint8Array): Promise<boolean> => {
  const sp = getCapacitorSunmi();
  if (!sp || typeof sp.printText !== 'function') return false;
  try {
    // The Capacitor plugin in this app forwards the string to Sunmi's AIDL
    // printText, which honours embedded ESC/POS escape sequences. We pass
    // the raw bytes as a Latin-1 string so each byte survives unchanged.
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    await sp.printText({ text: s });
    if (typeof sp.cutPaper === 'function') {
      try { await sp.cutPaper(); } catch {}
    }
    return true;
  } catch {
    return false;
  }
};

const printViaBluetooth = async (bytes: Uint8Array, allowPair = true): Promise<boolean> => {
  if (!isWebBluetoothSupported()) return false;
  let characteristic = await tryReuseRememberedDevice();
  if (!characteristic) {
    if (!allowPair) return false;
    try {
      characteristic = await requestNewBluetoothDevice();
    } catch (err) {
      if ((err as Error)?.name === 'NotFoundError') {
        // User cancelled the picker.
        return false;
      }
      throw err;
    }
  }
  await writeChunked(characteristic, bytes);
  return true;
};

export type PrintResult = {
  ok: boolean;
  transport: 'sunmi-bridge' | 'capacitor-sunmi' | 'web-bluetooth' | 'none';
  message?: string;
};

/**
 * Print the given ESC/POS bytes silently using the best available transport.
 * If `allowPair` is true (the default), the first call may show a one-time
 * Bluetooth pairing dialog. Subsequent calls reuse the remembered printer.
 */
export const printEscPos = async (
  bytes: Uint8Array,
  options: { allowPair?: boolean } = {},
): Promise<PrintResult> => {
  const allowPair = options.allowPair ?? true;

  // 1. Sunmi WebView JS bridge — instant, no pairing.
  if (printViaSunmiBridge(bytes)) {
    return { ok: true, transport: 'sunmi-bridge' };
  }

  // 2. Capacitor Sunmi plugin — instant, no pairing (only inside the app).
  if (await printViaCapacitorSunmi(bytes)) {
    return { ok: true, transport: 'capacitor-sunmi' };
  }

  // 3. Web Bluetooth — silent reuse if we've paired before, dialog otherwise.
  try {
    if (await printViaBluetooth(bytes, allowPair)) {
      return { ok: true, transport: 'web-bluetooth' };
    }
  } catch (err) {
    return {
      ok: false,
      transport: 'web-bluetooth',
      message: (err as Error)?.message || 'Bluetooth print failed',
    };
  }

  return {
    ok: false,
    transport: 'none',
    message:
      'No printer detected. Pair a Bluetooth thermal printer with this device, then tap PRINT again.',
  };
};

/** Forget the cached printer so the next print shows the picker again. */
export const forgetPairedPrinter = (): void => {
  cachedDevice = null;
  cachedCharacteristic = null;
  try {
    localStorage.removeItem(REMEMBERED_PRINTER_KEY);
  } catch {}
};

/** True if any silent print transport is currently usable. */
export const hasSilentPrintTransport = async (): Promise<boolean> => {
  if (getSunmiBridge()?.sendRAWData) return true;
  if (getCapacitorSunmi()) return true;
  const ch = await tryReuseRememberedDevice();
  return !!ch;
};
