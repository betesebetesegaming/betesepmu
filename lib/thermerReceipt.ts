/**
 * Build print entries for the Thermer (Bluetooth Mini Thermal Printer)
 * "Browser / Website Print" service.
 *
 * Spec — verified against the official iOS integration guide
 * (https://github.com/tussharmate/ios-thermer-custom-schema), which uses
 * identical JSON shapes to the Android Browser Print response endpoint:
 *
 *   Text    : { type:0, content, bold:0|1, align:0|1|2, format:0..4 }
 *               format: 0=normal, 1=double height, 2=double H+W,
 *                       3=double width, 4=small
 *   Image   : { type:1, path, align }
 *   Barcode : { type:2, value, height (10..80), align }
 *   QR      : { type:3, value, size (>=40 mm), align }
 *
 * Thermer's "Short Codes" (#day_no#, #year#, #date1#, etc.) are filled in
 * by the app at print time. We mostly avoid them and write real values so
 * the printed ticket reflects when the bet was actually placed.
 */

import { Ticket } from '../types';

export type ThermerEntry =
  | {
      type: 0;
      content: string;
      bold: 0 | 1;
      align: 0 | 1 | 2;
      format: 0 | 1 | 2 | 3 | 4;
    }
  | { type: 1; path: string; align: 0 | 1 | 2 }
  | { type: 2; value: string; height: number; align: 0 | 1 | 2 }
  | { type: 3; value: string; size: number; align: 0 | 1 | 2 };

const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;
const ALIGN_RIGHT = 2;

const FMT_NORMAL = 0;
const FMT_DOUBLE_H = 1;
const FMT_DOUBLE_HW = 2;
const FMT_DOUBLE_W = 3;
const FMT_SMALL = 4;

const text = (
  content: string,
  opts: {
    bold?: boolean;
    align?: 0 | 1 | 2;
    format?: 0 | 1 | 2 | 3 | 4;
  } = {},
): ThermerEntry => ({
  type: 0,
  content,
  bold: opts.bold ? 1 : 0,
  align: opts.align ?? ALIGN_LEFT,
  format: opts.format ?? FMT_NORMAL,
});

const blank = (): ThermerEntry => text(' ');

export const buildThermerTicketEntries = (ticket: Ticket): ThermerEntry[] => {
  const entries: ThermerEntry[] = [];

  const ticketDateUS = ticket.timestamp.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const ticketTime12 = ticket.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const agent = (ticket.vendorName || ticket.vendorId || 'BETESE').toUpperCase();

  // BETESE PMU banner
  entries.push(text('BETESE PMU', { bold: true, align: ALIGN_CENTER, format: FMT_DOUBLE_HW }));
  entries.push(blank());

  // Meta block (left aligned like the reference)
  entries.push(text(`REF: #${ticket.id}`, { bold: true, align: ALIGN_LEFT }));
  entries.push(text(`${ticketDateUS} ${ticketTime12}`, { bold: true, align: ALIGN_LEFT }));
  entries.push(text(`VENDOR: ${agent}`, { bold: true, align: ALIGN_LEFT }));
  entries.push(text('--------------------------------', { align: ALIGN_LEFT }));

  // Each leg of the bet
  ticket.selections.forEach((sel) => {
    const numbersText =
      sel.pattern && sel.pattern.length > 0
        ? sel.pattern.join('-')
        : (
            (sel.xCount > 0 ? Array(sel.xCount).fill('X').join('-') + '-' : '') +
            sel.numbers.join('-')
          );
    const stake = (sel.cost * sel.multiplier).toFixed(0);

    entries.push(
      text(`${sel.raceName} ${sel.betType}`.toUpperCase(), {
        bold: true,
        align: ALIGN_LEFT,
      }),
    );
    // Approximate the boxed-number look from the reference with dashed
    // dividers above and below. The Thermer payload format has no native
    // border-drawing primitive.
    entries.push(text('--------------------------------', { align: ALIGN_LEFT }));
    entries.push(
      text(numbersText, { bold: true, align: ALIGN_CENTER, format: FMT_DOUBLE_HW }),
    );
    entries.push(text('--------------------------------', { align: ALIGN_LEFT }));
    entries.push(
      text(`STAKE X${sel.multiplier} GMD ${stake}`, { bold: true, align: ALIGN_LEFT }),
    );
  });

  entries.push(text('--------------------------------', { align: ALIGN_LEFT }));

  // Total
  entries.push(
    text(`Total ${ticket.totalCost.toFixed(0)} GMD`, {
      bold: true,
      align: ALIGN_CENTER,
      format: FMT_DOUBLE_W,
    }),
  );

  // Footer
  entries.push(text('*** Valid for 7 days ***', { bold: true, align: ALIGN_CENTER }));

  // QR code with the ticket reference for staff to scan on payout
  entries.push({
    type: 3,
    value: String(ticket.id),
    size: 40,
    align: ALIGN_CENTER,
  });

  entries.push(blank());
  entries.push(blank());

  return entries;
};

export const buildThermerPaidReceiptEntries = (ticket: Ticket): ThermerEntry[] => {
  const entries: ThermerEntry[] = [];
  const paidAt = ticket.paidAt
    ? `${ticket.paidAt.toLocaleDateString([], {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} ${ticket.paidAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })}`
    : 'N/A';

  entries.push(text('PAID RECEIPT', { bold: true, align: ALIGN_CENTER, format: FMT_DOUBLE_HW }));
  entries.push(blank());
  entries.push(text(`REF #${ticket.id}`, { bold: true, align: ALIGN_CENTER }));
  entries.push(text('PAID', { bold: true, align: ALIGN_CENTER, format: FMT_DOUBLE_HW }));
  entries.push(text('Do Not Pay Again', { bold: true, align: ALIGN_CENTER }));
  entries.push(text('--------------------------------', { align: ALIGN_LEFT }));
  entries.push(text('Winning Amount Paid:', { bold: true, align: ALIGN_CENTER }));
  entries.push(
    text(`GMD ${(ticket.winnings || 0).toFixed(0)}`, {
      bold: true,
      align: ALIGN_CENTER,
      format: FMT_DOUBLE_HW,
    }),
  );
  entries.push(text('--------------------------------', { align: ALIGN_LEFT }));
  entries.push(
    text(`By ${(ticket.paidByName || ticket.paidById || 'SYSTEM').toUpperCase()}`, {
      bold: true,
      align: ALIGN_CENTER,
    }),
  );
  entries.push(text(paidAt, { bold: true, align: ALIGN_CENTER }));
  entries.push(blank());
  entries.push(blank());
  return entries;
};

/** Encode the entries as the base64-of-JSON payload our /api/print-receipt route expects. */
export const encodeThermerPayload = (entries: ThermerEntry[]): string => {
  const json = JSON.stringify(entries);
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(json)));
  }
  // Node fallback (only used for tests)
  return Buffer.from(json, 'utf-8').toString('base64');
};
