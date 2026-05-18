
import { Race, Ticket, BetTypeOption, Payouts, WinningsBreakdown, BetSelection } from './types';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativePrintPlugin {
    printHtml(options: { html: string; jobName?: string }): Promise<{ success: boolean }>;
}

interface BluetoothThermalPrintPlugin {
    listPairedPrinters(): Promise<{ printers: Array<{ name: string; address: string }> }>;
    printText(options: { text: string; address?: string; cut?: boolean }): Promise<{ success: boolean; printerName?: string; printerAddress?: string }>;
}

interface RawBtPrintPlugin {
    isInstalled(): Promise<{ installed: boolean }>;
    printText(options: { text: string }): Promise<{ success: boolean; launched?: boolean }>;
}

interface SunmiPrintPlugin {
    printText(options: { text: string }): Promise<{ success: boolean }>;
    printBitmap(options: { base64: string; width: number }): Promise<{ success: boolean }>;
    cutPaper(): Promise<{ success: boolean }>;
}

interface MateBTPrintPlugin {
    printText(options: { text: string; address?: string }): Promise<{ success: boolean; printerName?: string }>;
    listPrinters(): Promise<{ printers: Array<{ name: string; address: string }> }>;
}

const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint');
const BluetoothThermalPrint = registerPlugin<BluetoothThermalPrintPlugin>('BluetoothThermalPrint');
const RawBtPrint = registerPlugin<RawBtPrintPlugin>('RawBtPrint');
const SunmiPrint = registerPlugin<SunmiPrintPlugin>('SunmiPrint');
const MateBTPrint = registerPlugin<MateBTPrintPlugin>('MateBTPrint');
import { BET_PRICING } from './constants';

// Returns the price for ONE base combination unit (e.g. 30 for CoupleGagnant, 25 for Tiercé)
const getBetBasePrice = (betType: BetTypeOption): number => {
    const pricing = BET_PRICING[betType];
    if (!pricing) return 0;
    return pricing.basePrice ?? pricing.perHorsePrice ?? 0;
};

export const formatWinningNumbersForDisplay = (numbers: number[] | undefined): string => {
    if (!numbers || numbers.length === 0) return 'N/A';
    return numbers.join('-');
};

export const formatWinningNumbersForInput = (numbers: number[] | undefined): string => {
    if (!numbers) return '';
    return numbers.join(', ');
};

export const parseWinningNumbersFromString = (str: string): number[] => {
    return str.split(/[\s,\/-]+/)
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));
};

export const normalizeGambiaPhone = (input: string): string | null => {
    const raw = String(input || '').trim();
    if (!raw) return null;

    const digits = raw.replace(/\D/g, '');
    // Gambia: allow both +220XXXXXXX and local 7-digit XXXXXX.
    if (digits.startsWith('220') && digits.length === 10) {
        const local = digits.slice(3);
        if (!/^\d{7}$/.test(local)) return null;
        return `+220${local}`;
    }

    if (digits.length === 7) {
        if (!/^\d{7}$/.test(digits)) return null;
        return `+220${digits}`;
    }

    // Senegal: international format only, +221 followed by 9 digits.
    if (digits.startsWith('221') && digits.length === 12) {
        const local = digits.slice(3);
        if (!/^\d{9}$/.test(local)) return null;
        return `+221${local}`;
    }

    return null;
};

export const isValidGambiaPhone = (input: string): boolean => {
    return normalizeGambiaPhone(input) !== null;
};

export const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;
export const BETTING_CUTOFF_MS = 120000; // Strict 2 Minutes

const PRINT_PAPER_MODE_KEY = 'betese_print_paper_mode';
const PRINT_PAPER_WIDTH_MM_KEY = 'betese_print_paper_width_mm';

type PrintPaperMode = 'auto' | 'fixed';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const getPrintPaperMode = (): PrintPaperMode => {
    const raw = localStorage.getItem(PRINT_PAPER_MODE_KEY);
    return raw === 'fixed' ? 'fixed' : 'auto';
};

export const setPrintPaperMode = (mode: PrintPaperMode): void => {
    localStorage.setItem(PRINT_PAPER_MODE_KEY, mode === 'fixed' ? 'fixed' : 'auto');
};

export const getPrintPaperWidthMm = (): number => {
    const raw = Number(localStorage.getItem(PRINT_PAPER_WIDTH_MM_KEY) || '57');
    if (!Number.isFinite(raw)) return 57;
    return clamp(Math.round(raw), 48, 112);
};

export const setPrintPaperWidthMm = (widthMm: number): void => {
    const normalized = clamp(Math.round(Number(widthMm) || 57), 48, 112);
    localStorage.setItem(PRINT_PAPER_WIDTH_MM_KEY, String(normalized));
};

export const getEffectiveTicketStatus = (ticket: Ticket, now: Date): Ticket['status'] | 'Expired' => {
  const ticketAge = now.getTime() - ticket.timestamp.getTime();
  if (['Winning', 'Active'].includes(ticket.status) && ticketAge > SEVEN_DAYS_IN_MS) {
    return 'Expired';
  }
  return ticket.status;
};

interface TriggerPrintOptions {
        direct57x40?: boolean;
}

/**
 * STABLE PMU PRINT ENGINE (V5 - FINAL PRODUCTION)
 * This is based on the 'Copy of Copy' version that works perfectly.
 */
export const triggerPrint = (elementId: string, options: TriggerPrintOptions = {}): void => {
    const sourceElement = document.getElementById(elementId);
    if (!sourceElement) {
        console.error("PRINT ERROR: Element not found", elementId);
        return;
    }
    const isTicketPrint = elementId.startsWith('ticket-receipt-');

    const isAndroidTerminal = /android|sunmi/i.test(navigator.userAgent || '');
    const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    const isSunmiTerminal = /sunmi/i.test(navigator.userAgent || '') ||
        /sunmi/i.test((window as any).SunmiModelName || '') ||
        typeof (window as any).SunmiInnerPrinter !== 'undefined';

    const pxPerMm = 96 / 25.4;
    const sourceRect = sourceElement.getBoundingClientRect();
    const measuredSourceWidthPx = Math.max(sourceElement.scrollWidth || 0, Math.ceil(sourceRect.width || 0));
    const measuredContentWidthMm = Math.ceil(measuredSourceWidthPx / pxPerMm) + 4;
    const paperMode = getPrintPaperMode();
    const fixedPaperWidthMm = getPrintPaperWidthMm();
    const minimumPaperWidthMm = isAndroidTerminal ? 57 : 48;
    const requestedPaperWidthMm = paperMode === 'fixed'
        ? clamp(fixedPaperWidthMm, minimumPaperWidthMm, 112)
        : clamp(measuredContentWidthMm, minimumPaperWidthMm, 112);
    // Android terminal print services are most stable at ISO C8-equivalent 57mm width.
    const paperWidthMm = isAndroidTerminal ? 57 : requestedPaperWidthMm;
    const paperHeightMm = options.direct57x40 ? 40 : null;
    const pageSize = paperHeightMm ? `${paperWidthMm}mm ${paperHeightMm}mm` : `${paperWidthMm}mm auto`;
    const stagePaddingMm = paperHeightMm ? 1 : 2;
    const qrWidthMm = clamp(Math.round(paperWidthMm * (isTicketPrint ? 0.56 : 0.68)), 26, 72);
    const textColumns = clamp(Math.round(paperWidthMm * (32 / 58)), 24, 64);
    const baseFontPx = isTicketPrint ? 18 : 18;
    const baseLineHeight = isTicketPrint ? 1.3 : 1.4;
    const hugeFontPx = isTicketPrint ? 34 : 32;

    const oldStage = document.getElementById('betese-print-stage');
    if (oldStage) oldStage.remove();
    const oldStyle = document.getElementById('betese-print-style');
    if (oldStyle) oldStyle.remove();

    const printStyle = document.createElement('style');
    printStyle.id = 'betese-print-style';
    printStyle.textContent = `
        #betese-print-stage {
            position: fixed;
            left: -10000px;
            top: 0;
            width: ${paperWidthMm}mm;
            ${paperHeightMm ? `height: ${paperHeightMm}mm; max-height: ${paperHeightMm}mm; overflow: hidden;` : ''}
            padding: 0;
            margin: 0;
            background: #fff;
            z-index: 2147483647;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
        }
        #betese-print-stage * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
            font-weight: 900 !important;
        }
        #betese-print-stage .c { text-align: center !important; }
        #betese-print-stage .b { font-weight: 900 !important; font-size: ${baseFontPx}px !important; }
        #betese-print-stage .huge { font-size: ${hugeFontPx}px !important; font-weight: 900 !important; letter-spacing: -1px; line-height: 1.1; margin: 4px 0; }
        #betese-print-stage .solid { border-top: 2px solid black !important; margin: 5px 0 !important; }
        #betese-print-stage .dashed { border-top: 1px dashed black !important; margin: 5px 0 !important; }
        #betese-print-stage .flex { display: flex !important; justify-content: space-between !important; align-items: center !important; }
        #betese-print-stage img { display: block !important; margin: 5px auto !important; max-width: ${qrWidthMm}mm !important; }
        #betese-print-stage, #betese-print-stage * { visibility: visible !important; }
        #betese-print-stage { page: receipt !important; }
        @media print {
            html, body {
                width: ${paperWidthMm}mm !important;
                min-width: ${paperWidthMm}mm !important;
                max-width: ${paperWidthMm}mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
            }
            body > *:not(#betese-print-stage):not(script):not(style) {
                display: none !important;
            }
            #betese-print-stage {
                position: static !important;
                left: 0 !important;
                width: ${paperWidthMm}mm !important;
                min-height: 0 !important;
                ${paperHeightMm ? `height: ${paperHeightMm}mm !important; max-height: ${paperHeightMm}mm !important;` : 'height: auto !important;'}
                margin: 0 !important;
                padding: ${stagePaddingMm}mm !important;
                overflow: ${paperHeightMm ? 'hidden' : 'visible'} !important;
                font-family: 'Courier New', Courier, monospace !important;
                font-size: ${baseFontPx}px !important;
                font-weight: 900 !important;
                line-height: ${baseLineHeight} !important;
                color: #000 !important;
                text-shadow: 0 0 0 #000 !important;
                page-break-before: avoid !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
                break-inside: avoid-page !important;
            }
            @page receipt { margin: 0; size: ${pageSize}; }
            @page { margin: 0; size: ${pageSize}; }
        }
    `;
    document.head.appendChild(printStyle);

    const stage = document.createElement('div');
    stage.id = 'betese-print-stage';
    stage.innerHTML = sourceElement.outerHTML;
    // Strip off-screen / hidden styles from the cloned root so print isn't blank
    const clonedRoot = stage.firstElementChild as HTMLElement | null;
    if (clonedRoot) {
        clonedRoot.style.visibility = 'visible';
        clonedRoot.style.position = 'static';
        clonedRoot.style.left = '0';
        clonedRoot.style.top = '0';
        clonedRoot.style.opacity = '1';
        // Also remove Tailwind off-screen classes that survive the clone
        clonedRoot.classList.remove('absolute', 'pointer-events-none');
        clonedRoot.classList.forEach(cls => {
            if (cls.startsWith('left-[') || cls.startsWith('-left-')) clonedRoot.classList.remove(cls);
        });
    }
    document.body.appendChild(stage);

    const cleanup = () => {
        const s = document.getElementById('betese-print-stage');
        if (s) s.remove();
        const st = document.getElementById('betese-print-style');
        if (st) st.remove();
    };

    const waitForImages = () => {
        const images = Array.from(stage.querySelectorAll('img')) as HTMLImageElement[];
        if (images.length === 0) return Promise.resolve();

        return Promise.race([
            Promise.all(images.map((img) => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>((resolve) => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            })),
            new Promise<void>((resolve) => setTimeout(resolve, 1200))
        ]);
    };

    const doPrint = () => {
        const afterPrintHandler = () => {
            cleanup();
            window.removeEventListener('afterprint', afterPrintHandler);
        };
        window.addEventListener('afterprint', afterPrintHandler);

        try {
            window.focus();
            window.print();
        } catch (e) {
            console.error('PRINT ERROR:', e);
        }

        // Fallback cleanup in case Android WebView does not fire afterprint.
        setTimeout(cleanup, 8000);
    };

    const buildPrintableHtml = (): string => {
        return `
            <!doctype html>
            <html>
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <meta name="thermal-paper-width" content="${paperWidthMm}mm" />
                    ${paperHeightMm ? `<meta name="thermal-paper-height" content="${paperHeightMm}mm" />` : ''}
                    <style>${printStyle.textContent || ''}</style>
                </head>
                <body>
                    ${stage.outerHTML}
                </body>
            </html>
        `;
    };

    const buildPrintableText = (): string => {
        // Scale character width with configured paper width.
        const W = textColumns;
        const divider = (ch = '-') => ch.repeat(W);
        const center = (s: string) => {
            const padded = s.slice(0, W);
            const totalPad = W - padded.length;
            const left = Math.floor(totalPad / 2);
            return ' '.repeat(left) + padded;
        };
        const split = (l: string, r: string) => {
            const left = l.slice(0, W - r.length - 1).padEnd(W - r.length - 1);
            return `${left} ${r}`;
        };

        const lines: string[] = [];

        const walk = (el: Element) => {
            const tag = el.tagName;
            // Skip images (QR handled separately)
            if (tag === 'IMG') {
                lines.push(''); // blank line placeholder
                return;
            }
            const cls = (el.className || '') + ' ' + (el.getAttribute('class') || '');
            const kids = Array.from(el.children);

            // Two-column flex row → left / right
            if ((cls.includes('flex') || cls.includes('justify-between')) && kids.length === 2) {
                const l = (kids[0].textContent || '').replace(/\s+/g, ' ').trim();
                const r = (kids[1].textContent || '').replace(/\s+/g, ' ').trim();
                lines.push(split(l, r));
                return;
            }

            // Leaf node with text
            if (kids.length === 0) {
                const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
                if (!txt) return;
                if (cls.includes(' c') || tag === 'DIV' && cls.includes('text-center')) {
                    lines.push(center(txt));
                } else {
                    lines.push(txt);
                }
                return;
            }

            // Divider-like elements (borders)
            if (cls.includes('border-t') || cls.includes('border-b') || cls.includes('border-y')) {
                lines.push(divider('-'));
            }

            for (const child of kids) walk(child);
        };

        walk(sourceElement);

        // De-duplicate consecutive dividers and blank lines
        const out: string[] = [];
        for (const line of lines) {
            const last = out[out.length - 1] ?? null;
            if (line === last && (line === divider('-') || line === '')) continue;
            out.push(line);
        }

        // Ensure 3 blank feed lines at end for paper cut
        return out.join('\n') + '\n\n\n';
    };

    const tryAndroidBrowserPopupPrint = (): boolean => {
        if (isNativeAndroid || !isAndroidTerminal) return false;

        const popup = window.open('', '_blank');
        if (!popup) return false;

        const html = buildPrintableHtml();
        popup.document.open();
        popup.document.write(`
            ${html}
            <script>
                (function () {
                    var run = function () {
                        // Give guide a moment to render, then open print dialog
                        setTimeout(function () {
                            try { window.focus(); window.print(); } catch (e) {}
                        }, 400);
                    };
                    if (document.readyState === 'complete') run();
                    else window.addEventListener('load', run);
                })();
            <\/script>
        `);
        popup.document.close();

        // Main page cleanup once popup has taken over the print rendering.
        cleanup();
        return true;
    };

    const tryNativeAndroidPrint = async (): Promise<boolean> => {
        if (!isNativeAndroid) return false;
        // On Sunmi, avoid Android print spooler UI; use Sunmi/BT paths instead.
        if (isSunmiTerminal) return false;
        try {
            await NativePrint.printHtml({
                html: buildPrintableHtml(),
                jobName: 'Betese Ticket'
            });
            cleanup();
            return true;
        } catch (e) {
            console.warn('Native print unavailable, fallback to web print', e);
            return false;
        }
    };

    const tryNativeBluetoothThermalPrint = async (): Promise<boolean> => {
        if (!isNativeAndroid) return false;
        try {
            const preferredAddress = localStorage.getItem('betese_bt_printer_address') || undefined;
            await BluetoothThermalPrint.printText({
                text: buildPrintableText(),
                address: preferredAddress,
                cut: true
            });
            cleanup();
            return true;
        } catch (e) {
            console.warn('Bluetooth thermal print unavailable, fallback to next print mode', e);
            return false;
        }
    };

    const tryRawBtPrint = async (): Promise<boolean> => {
        // Disabled by default to avoid Play Store/licensing popups on terminals.
        return false;
    };

    // Mate Technologies Bluetooth Printer (third-party APK support)
    const tryMateBTPrint = async (): Promise<boolean> => {
        if (!isNativeAndroid) return false;
        try {
            const preferredAddress = localStorage.getItem('betese_mate_bt_printer_address') || undefined;
            const result = await MateBTPrint.printText({
                text: buildPrintableText(),
                address: preferredAddress
            });
            if (result.success) {
                console.log('Mate BT printer success:', result.printerName);
                cleanup();
                return true;
            }
            return false;
        } catch (e) {
            console.warn('Mate BT print unavailable, fallback to next print mode', e);
            return false;
        }
    };

    // Sunmi built-in printer via Sunmi Print AIDL service (direct, no Bluetooth needed)
    const trySunmiBuiltinPrint = async (): Promise<boolean> => {
        if (!isNativeAndroid) return false;
        if (!isSunmiTerminal) return false;
        try {
            const text = buildPrintableText();
            await SunmiPrint.printText({ text });
            try { await SunmiPrint.cutPaper(); } catch {}
            cleanup();
            return true;
        } catch (e) {
            console.warn('Sunmi built-in print unavailable, falling back', e);
            return false;
        }
    };

    if (isAndroidTerminal) {
        // Android browser mode should keep a simple web-print path for terminals.
        // This matches the original behavior users rely on.

        if (!isNativeAndroid) {
            // Use dedicated popup print page so only ticket content is printed (not the full modal/screen).
            const popupPrinted = tryAndroidBrowserPopupPrint();
            if (popupPrinted) return;
            doPrint();
            return;
        }

        // Print chain: Sunmi built-in → BT thermal → Mate BT → NativePrint (non-Sunmi) → RawBT (non-Sunmi) → web print
        void trySunmiBuiltinPrint().then((sunmiPrinted) => {
            if (sunmiPrinted) return;
            void tryNativeBluetoothThermalPrint().then((btPrinted) => {
                if (btPrinted) return;
                void tryMateBTPrint().then((matePrinted) => {
                    if (matePrinted) return;
                    void tryNativeAndroidPrint().then((printed) => {
                        if (printed) return;
                        void tryRawBtPrint().then((rawBtPrinted) => {
                            if (!rawBtPrinted) doPrint();
                        });
                    });
                });
            });
        });
        return;
    }

    waitForImages().then(() => {
        setTimeout(doPrint, 120);
    });
};

export const listPairedThermalPrinters = async (): Promise<Array<{ name: string; address: string }>> => {
    if (!(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')) return [];
    try {
        const result = await BluetoothThermalPrint.listPairedPrinters();
        return result?.printers || [];
    } catch {
        return [];
    }
};

export const listMateBTPrinters = async (): Promise<Array<{ name: string; address: string }>> => {
    if (!(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')) return [];
    try {
        const result = await MateBTPrint.listPrinters();
        return result?.printers || [];
    } catch {
        return [];
    }
};

export const saveMateBluetoothPrinterAddress = (address: string): void => {
    localStorage.setItem('betese_mate_bt_printer_address', address);
};

export const getMateBluetoothPrinterAddress = (): string | null => {
    return localStorage.getItem('betese_mate_bt_printer_address');
};

export interface WinSummary {
    [key: string]: { count: number; stake: number; units: number; };
}

export const WIN_CATEGORY_ORDER = [
    'Simple Gagnant', 'Simple Placé', 'Couplé Gagnant', 'Couplé Placé',
    'Tiercé Ordre', 'Tiercé Désordre', 'Quarté+ Ordre', 'Quarté+ Désordre', 'Quarté+ Bonus 3',
    'Quinté+ Ordre', 'Quinté+ Désordre', 'Quinté+ Bonus 4', 'Quinté+ Bonus 3',
    'Multi 4', 'Multi 5', 'Multi 6', 'Multi 7'
];

export function calculateWinSummary(race: Race, winningNumbers: number[], tickets: Ticket[]): WinSummary {
    const summary: WinSummary = {};
    if (!winningNumbers.length) return summary;
    const first = winningNumbers[0];
    const second = winningNumbers[1];
    const add = (cat: string, stake: number, units: number) => {
        if (!summary[cat]) summary[cat] = { count: 0, stake: 0, units: 0 };
        summary[cat].count++;
        summary[cat].stake += stake;
        summary[cat].units += units;
    };
    tickets.forEach(t => {
        if (t.status === 'Canceled') return;
        t.selections.forEach(sel => {
            if (sel.raceId !== race.id) return;
            const stake = sel.cost * sel.multiplier;
            const units = Number(sel.multiplier || 0);
            if (sel.betType === BetTypeOption.SimpleGagnant && sel.numbers[0] === first) add('Simple Gagnant', stake, units);
            if (
                sel.betType === BetTypeOption.CoupleGagnant &&
                first !== undefined &&
                second !== undefined &&
                sel.numbers.includes(first) &&
                sel.numbers.includes(second)
            ) {
                add('Couplé Gagnant', stake, units);
            }
        });
    });
    return summary;
}

export const validateSelectionFormula = (sel: BetSelection): { valid: boolean; message?: string } => {
    const pricing = BET_PRICING[sel.betType];
    if (!pricing) return { valid: false, message: `Unknown bet type: ${sel.betType}` };

    const xCount = sel.xCount || 0;
    const numberCount = sel.numbers.length;
    const totalSlots = numberCount + xCount;

    if (xCount < 0) return { valid: false, message: `${sel.betType}: wildcard count cannot be negative` };
    if (numberCount < 0) return { valid: false, message: `${sel.betType}: number count cannot be negative` };
    if (totalSlots < pricing.minHorses) return { valid: false, message: `${sel.betType}: minimum horses not met` };

    const uniqueNumbers = new Set(sel.numbers);
    if (uniqueNumbers.size !== sel.numbers.length) return { valid: false, message: `${sel.betType}: duplicate horse numbers are not allowed` };

    if (pricing.perHorsePrice !== undefined) {
        if (xCount > 0) return { valid: false, message: `${sel.betType}: wildcard X is not allowed` };
        const expected = pricing.perHorsePrice * numberCount;
        // Also accept the legacy 25 GMD price for SimpleGagnant/SimplePlace so old tickets
        // placed before the price change to 30 GMD still settle correctly.
        const legacyExpected = 25 * numberCount;
        const costOk = Math.abs((sel.cost || 0) - expected) < 0.001 ||
                       Math.abs((sel.cost || 0) - legacyExpected) < 0.001;
        if (!costOk) {
            return { valid: false, message: `${sel.betType}: invalid cost` };
        }
        return { valid: true };
    }

    let expected: number | undefined;
    if (xCount > 0) {
        expected = pricing.xPriceMap?.[xCount]?.[numberCount];
    } else {
        expected = pricing.priceMap?.[totalSlots];
    }

    if (expected === undefined) return { valid: false, message: `${sel.betType}: invalid formula structure` };
    if (Math.abs((sel.cost || 0) - expected) >= 0.001) return { valid: false, message: `${sel.betType}: invalid cost` };
    return { valid: true };
};

export const validateTicketForPlacement = (ticketLike: { selections: BetSelection[]; totalCost: number }): { valid: boolean; message?: string } => {
    if (!ticketLike.selections?.length) return { valid: false, message: 'No selections in ticket' };
    for (const sel of ticketLike.selections) {
        const check = validateSelectionFormula(sel);
        if (!check.valid) return check;
    }
    const computedTotal = ticketLike.selections.reduce((sum, sel) => sum + (sel.cost * sel.multiplier), 0);
    if (Math.abs(computedTotal - (ticketLike.totalCost || 0)) >= 0.01) {
        return { valid: false, message: 'Ticket total cost mismatch' };
    }
    return { valid: true };
};

export const validateTicketAgainstRaceState = (
    selections: BetSelection[],
    races: Array<Pick<Race, 'id' | 'name' | 'horseCount' | 'nonRunners' | 'disabledBetTypes'>>
): { valid: boolean; message?: string } => {
    const raceMap = new Map(races.map(r => [r.id, r]));

    for (const sel of selections || []) {
        const race = raceMap.get(sel.raceId);
        if (!race) {
            return { valid: false, message: `Race not found for selection ${sel.raceId}.` };
        }

        const maxHorse = Number(race.horseCount || 0);
        const nonRunners = new Set((race.nonRunners || []).map(n => Number(n)).filter(n => Number.isFinite(n)));

        for (const n of sel.numbers || []) {
            const horseNo = Number(n);
            if (!Number.isFinite(horseNo) || horseNo <= 0 || horseNo > maxHorse) {
                return { valid: false, message: `${race.name}: horse ${horseNo} is outside valid range 1-${maxHorse}.` };
            }
            if (nonRunners.has(horseNo)) {
                return { valid: false, message: `${race.name}: horse ${horseNo} is marked NP and cannot be played.` };
            }
        }

        if ((race.disabledBetTypes || []).includes(sel.betType)) {
            return { valid: false, message: `${race.name}: ${sel.betType} is disabled for this race.` };
        }
    }

    return { valid: true };
};

export function calculateTicketWinnings(ticket: Ticket, allRaces: Race[]): { totalWinnings: number; breakdown: WinningsBreakdown[] } {
    const combinations = (numbers: number[], size: number): number[][] => {
        if (size <= 0 || numbers.length < size) return [];
        if (size === 1) return numbers.map((n) => [n]);
        const output: number[][] = [];
        const walk = (start: number, current: number[]) => {
            if (current.length === size) {
                output.push([...current]);
                return;
            }
            for (let i = start; i < numbers.length; i += 1) {
                current.push(numbers[i]);
                walk(i + 1, current);
                current.pop();
            }
        };
        walk(0, []);
        return output;
    };

    const setsMatch = (a: number[], b: number[]) => a.length === b.length && a.every((value) => b.includes(value));
    const intersectionCount = (a: number[], b: number[]) => a.filter((value) => b.includes(value)).length;
    const sourceList = (race: Race) => {
        const result = race.result;
        if (!result) return [] as Array<{ source: 'Primary' | 'Bracket 1' | 'Bracket 2'; winningNumbers: number[]; payouts: Payouts }>;
        const sources: Array<{ source: 'Primary' | 'Bracket 1' | 'Bracket 2'; winningNumbers: number[]; payouts: Payouts }> = [];
        // Settlement must follow the visible main result only.
        // Hidden tie/bracket pages caused confusing/incorrect wins in production.
        if (result.winningNumbers?.length) {
            sources.push({ source: 'Primary', winningNumbers: result.winningNumbers, payouts: result.payouts || {} });
        }
        return sources;
    };

    const matchesOrderedPattern = (pattern: string[] | undefined, target: number[]) => {
        if (!pattern || pattern.length !== target.length) return false;
        return pattern.every((slot, index) => slot === 'X' || Number(slot) === target[index]);
    };

    const coversTargetWithWildcards = (selected: number[], wildcardCount: number, target: number[]) => {
        const matched = selected.filter((num) => target.includes(num)).length;
        return matched + wildcardCount >= target.length;
    };

    let grandTotalWinnings = 0;
    const finalBreakdown: WinningsBreakdown[] = [];

    ticket.selections.forEach((sel, index) => {
        // Strict PMU formula validation for all bet types.
        // Invalid structure/cost cannot be settled as win.
        if (!validateSelectionFormula(sel).valid) {
            finalBreakdown.push({ selectionIndex: index, status: 'Loss' });
            return;
        }

        const race = allRaces.find((r) => r.id === sel.raceId);
        // Do not settle as loss until official winning numbers are published.
        if (!race?.result?.winningNumbers?.length) {
            finalBreakdown.push({ selectionIndex: index, status: 'Pending' });
            return;
        }

        let selectionTotal = 0;
        const winningCombinationList: number[][] = [];
        let winType: string | undefined;
        let payoutPerCombination = 0;
        let winningBasePrice = 0;
        let source: 'Primary' | 'Bracket 1' | 'Bracket 2' | undefined;

        for (const resultSource of sourceList(race)) {
            const positions = resultSource.winningNumbers;
            const payouts = resultSource.payouts || {};
            const top2 = positions.slice(0, 2);
            const top3 = positions.slice(0, 3);
            const top4 = positions.slice(0, 4);
            const top5 = positions.slice(0, 5);
            let matchedCombos: number[][] = [];
            let unitPayout = 0;
            let matchedType: string | undefined;

            switch (sel.betType) {
                case BetTypeOption.SimpleGagnant:
                    if (sel.numbers.includes(positions[0])) {
                        matchedCombos = [[positions[0]]];
                        unitPayout = Number(payouts.simpleGagnant || 0);
                        matchedType = 'Simple Gagnant';
                    }
                    break;
                case BetTypeOption.SimplePlace: {
                    const placeHits: Array<{ combo: number[]; payout: number; label: string }> = [];
                    if (sel.numbers.includes(top3[0]) && Number(payouts.simplePlaceA || 0) > 0) placeHits.push({ combo: [top3[0]], payout: Number(payouts.simplePlaceA), label: 'Simple Placé A' });
                    if (sel.numbers.includes(top3[1]) && Number(payouts.simplePlaceB || 0) > 0) placeHits.push({ combo: [top3[1]], payout: Number(payouts.simplePlaceB), label: 'Simple Placé B' });
                    if (sel.numbers.includes(top3[2]) && Number(payouts.simplePlaceC || 0) > 0) placeHits.push({ combo: [top3[2]], payout: Number(payouts.simplePlaceC), label: 'Simple Placé C' });
                    if (placeHits.length > 0) {
                        matchedCombos = placeHits.map((item) => item.combo);
                        unitPayout = placeHits.reduce((sum, item) => sum + item.payout, 0);
                        matchedType = 'Simple Placé';
                    }
                    break;
                }
                case BetTypeOption.CoupleGagnant:
                    if (coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top2)) {
                        matchedCombos = [top2];
                        unitPayout = Number(payouts.ordreGagnant ?? payouts.desordreGagnant ?? 0);
                        matchedType = 'Couplé Gagnant';
                    }
                    break;
                case BetTypeOption.CouplePlace: {
                    const pairPayouts: Array<{ combo: number[]; payout: number; label: string }> = [
                        { combo: [top3[0], top3[1]], payout: Number(payouts.coupleA || 0), label: 'Couplé Placé A' },
                        { combo: [top3[0], top3[2]], payout: Number(payouts.coupleB || 0), label: 'Couplé Placé B' },
                        { combo: [top3[1], top3[2]], payout: Number(payouts.coupleC || 0), label: 'Couplé Placé C' }
                    ].filter((item) => item.combo.every((value) => Number.isFinite(value)));
                    const hits = pairPayouts.filter((item) => coversTargetWithWildcards(sel.numbers, sel.xCount || 0, item.combo) && item.payout > 0);
                    if (hits.length > 0) {
                        matchedCombos = hits.map((item) => item.combo);
                        unitPayout = hits.reduce((sum, item) => sum + item.payout, 0);
                        matchedType = 'Couplé Placé';
                    }
                    break;
                }
                case BetTypeOption.Tierce:
                    if (matchesOrderedPattern(sel.pattern, top3) || coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top3)) {
                        matchedCombos = [top3];
                        unitPayout = matchesOrderedPattern(sel.pattern, top3)
                            ? Number(payouts.tierceOrdre ?? payouts.tierceDesordre ?? 0)
                            : Number(payouts.tierceDesordre ?? payouts.tierceOrdre ?? 0);
                        matchedType = matchesOrderedPattern(sel.pattern, top3) ? 'Tiercé Ordre' : 'Tiercé Désordre';
                    }
                    break;
                case BetTypeOption.Quarte: {
                    const orderHit = matchesOrderedPattern(sel.pattern, top4);
                    const disorderHit = coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4);
                    const bonusHit = intersectionCount(sel.numbers, top4) + (sel.xCount || 0) >= 3;
                    if (orderHit && Number(payouts.quarteOrdre || 0) > 0) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.quarteOrdre || 0);
                        matchedType = 'Quarté+ Ordre';
                    } else if (disorderHit && Number(payouts.quarteDesordre || 0) > 0) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.quarteDesordre || 0);
                        matchedType = 'Quarté+ Désordre';
                    } else if (bonusHit && Number(payouts.quarteBonus3 || 0) > 0) {
                        matchedCombos = combinations(top4.filter((value) => sel.numbers.includes(value)), 3).slice(0, 1);
                        unitPayout = Number(payouts.quarteBonus3 || 0);
                        matchedType = 'Quarté+ Bonus 3';
                    }
                    break;
                }
                case BetTypeOption.Quinte: {
                    const orderHit = matchesOrderedPattern(sel.pattern, top5);
                    const disorderHit = coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top5);
                    const hits = intersectionCount(sel.numbers, top5) + (sel.xCount || 0);
                    if (orderHit && Number(payouts.quinteOrdre || 0) > 0) {
                        matchedCombos = [top5];
                        unitPayout = Number(payouts.quinteOrdre || 0);
                        matchedType = 'Quinté+ Ordre';
                    } else if (disorderHit && Number(payouts.quinteDesordre || 0) > 0) {
                        matchedCombos = [top5];
                        unitPayout = Number(payouts.quinteDesordre || 0);
                        matchedType = 'Quinté+ Désordre';
                    } else if (hits >= 4 && Number(payouts.quinteBonus4 || 0) > 0) {
                        matchedCombos = combinations(top5.filter((value) => sel.numbers.includes(value)), 4).slice(0, 1);
                        unitPayout = Number(payouts.quinteBonus4 || 0);
                        matchedType = 'Quinté+ Bonus 4';
                    } else if (hits >= 3 && Number(payouts.quinteBonus3 || 0) > 0) {
                        matchedCombos = combinations(top5.filter((value) => sel.numbers.includes(value)), 3).slice(0, 1);
                        unitPayout = Number(payouts.quinteBonus3 || 0);
                        matchedType = 'Quinté+ Bonus 3';
                    }
                    break;
                }
                case BetTypeOption.Multi4:
                    // Multi bets (4/5/6/7): win when the first 4 finishers are covered
                    // by selected horses/wildcards, in any order.
                    if ((sel.numbers.length + (sel.xCount || 0)) === 4 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi4 || 0);
                        matchedType = 'Multi 4';
                    }
                    break;
                case BetTypeOption.Multi5:
                    if ((sel.numbers.length + (sel.xCount || 0)) === 5 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi5 || 0);
                        matchedType = 'Multi 5';
                    }
                    break;
                case BetTypeOption.Multi6: {
                    if ((sel.numbers.length + (sel.xCount || 0)) === 6 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi6 || 0);
                        matchedType = 'Multi 6';
                    }
                    break;
                }
                case BetTypeOption.Multi7: {
                    if ((sel.numbers.length + (sel.xCount || 0)) === 7 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi7 || 0);
                        matchedType = 'Multi 7';
                    }
                    break;
                }
            }

            if (matchedCombos.length > 0 && unitPayout > 0) {
                // Correct PMU payout formula: Rapport × Multiplier (number of tickets played).
                // The rapport entered by admin IS the total payout for 1 ticket.
                // Base price (e.g. 25 GMD) is the COST per ticket, NOT a multiplier on winnings.
                // Example: Rapport 500 × 1 ticket = 500 GMD. Rapport 500 × 25 tickets = 12,500 GMD.
                const totalForSource = unitPayout * sel.multiplier;
                selectionTotal += totalForSource;
                winningCombinationList.push(...matchedCombos);
                payoutPerCombination = unitPayout;
                winningBasePrice = getBetBasePrice(sel.betType);
                winType = matchedType;
                source = resultSource.source;
            }
        }

        if (selectionTotal > 0) {
            grandTotalWinnings += selectionTotal;
            finalBreakdown.push({
                selectionIndex: index,
                status: 'Win',
                totalPayout: selectionTotal,
                winType,
                winningCombinations: winningCombinationList.length,
                winningCombinationList,
                payoutPerCombination,
                basePrice: winningBasePrice,
                multiplier: sel.multiplier,
                source
            });
        } else {
            finalBreakdown.push({ selectionIndex: index, status: 'Loss' });
        }
    });

    return { totalWinnings: grandTotalWinnings, breakdown: finalBreakdown };
}
