import { Ticket } from '../types';
import {
  DEFAULT_COLS_58MM,
  escPosCut,
  escPosDivider,
  escPosFeed,
  escPosInit,
  escPosLine,
  escPosRow,
  escPosConcat,
  wrapText,
} from './escpos';

/**
 * Build the printable ESC/POS payload for a placed ticket. Layout mirrors the
 * desired sample (BETESE banner, ticket ref, big serial, agent, race details,
 * Pronostic numbers, total, footer with serial).
 *
 * Column width defaults to 32 for 58 mm thermal paper (≈ 48 mm printable).
 */
export const buildTicketEscPos = (ticket: Ticket, cols: number = DEFAULT_COLS_58MM): Uint8Array => {
  const ticketDate = ticket.timestamp.toLocaleDateString([], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const ticketTime24 = ticket.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const ticketTime = ticket.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const agent = (ticket.vendorName || ticket.vendorId || 'BETESE').toUpperCase();
  const ref = `#${ticketDate.replace(/\//g, '')}-${agent}-${ticket.id}`;

  const parts: Uint8Array[] = [];

  parts.push(escPosInit());

  // Big inverted BETESE banner — width 3, height 3 reverse video
  parts.push(escPosLine(' BETESE ', { size: 3, align: 'center', reverse: true, bold: true }));
  parts.push(escPosFeed(1));

  // Ticket reference & serial
  parts.push(escPosLine(`Ticket ${ref}`, { align: 'center', bold: true }));
  parts.push(escPosLine(String(ticket.id), { size: 4, align: 'center', bold: true }));
  parts.push(escPosLine(`${ticketDate} ${ticketTime24}`, { align: 'center', bold: true }));
  parts.push(escPosLine(`Agent ${agent}`, { align: 'center', bold: true }));

  parts.push(escPosDivider(cols));

  // Each leg of the bet
  ticket.selections.forEach((sel, idx) => {
    parts.push(escPosLine(sel.raceName, { size: 2, align: 'center', bold: true }));
    parts.push(escPosLine(ticketTime, { align: 'center', bold: true }));
    parts.push(escPosLine(sel.betType, { size: 2, align: 'center', bold: true }));
    parts.push(escPosLine(`${sel.multiplier} ticket(s)`, { align: 'center', bold: true }));
    parts.push(
      escPosLine(`Amount ${(sel.cost * sel.multiplier).toFixed(0)} GMD`, {
        align: 'center',
        bold: true,
      }),
    );

    parts.push(escPosLine('Pronostic', { align: 'center', bold: true }));

    const numbersText =
      sel.pattern && sel.pattern.length > 0
        ? sel.pattern.join('  ')
        : ((sel.xCount > 0 ? Array(sel.xCount).fill('X').join('  ') + '  ' : '') +
            sel.numbers.join('  ')).trim();

    // Numbers are HUGE — size 2 width / 3 height, wrapped to 16 cols (cols / 2).
    const wrappedNumberLines = wrapText(numbersText, Math.max(1, Math.floor(cols / 2)));
    for (const ln of wrappedNumberLines) {
      parts.push(escPosLine(ln, { size: 2, align: 'center', bold: true }));
    }

    if (idx < ticket.selections.length - 1) {
      parts.push(escPosDivider(cols, '-'));
    }
  });

  parts.push(escPosDivider(cols));

  // Total — size 2 reverse for emphasis
  parts.push(
    escPosLine(`TOTAL ${ticket.totalCost.toFixed(0)} GMD`, {
      size: 2,
      align: 'center',
      bold: true,
    }),
  );

  parts.push(escPosDivider(cols, '-'));

  // Footer
  parts.push(escPosLine('*** Valid for 7 days ***', { align: 'center', bold: true }));
  parts.push(escPosLine(ref, { align: 'center', bold: true }));

  parts.push(escPosFeed(4));
  parts.push(escPosCut());

  return escPosConcat(parts);
};

/** Build ESC/POS payload for a paid receipt (smaller layout). */
export const buildPaidReceiptEscPos = (
  ticket: Ticket,
  cols: number = DEFAULT_COLS_58MM,
): Uint8Array => {
  const parts: Uint8Array[] = [];
  parts.push(escPosInit());
  parts.push(escPosLine(' PAID RECEIPT ', { size: 2, align: 'center', reverse: true, bold: true }));
  parts.push(escPosFeed(1));
  parts.push(escPosLine(`REF: #${ticket.id}`, { align: 'center', bold: true }));
  parts.push(escPosLine('PAID', { size: 4, align: 'center', bold: true, reverse: true }));
  parts.push(escPosLine('Do Not Pay Again', { align: 'center', bold: true }));
  parts.push(escPosDivider(cols));
  parts.push(escPosLine('Winning Amount Paid:', { align: 'center', bold: true }));
  parts.push(
    escPosLine(`GMD ${(ticket.winnings || 0).toFixed(0)}`, {
      size: 3,
      align: 'center',
      bold: true,
    }),
  );
  parts.push(escPosDivider(cols));
  parts.push(
    escPosRow(
      `By:${(ticket.paidByName || ticket.paidById || 'SYSTEM').slice(0, 12)}`,
      ticket.paidAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '',
      cols,
      { bold: true },
    ),
  );
  parts.push(
    escPosLine(
      `Date: ${ticket.paidAt?.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }) || 'N/A'}`,
      { bold: true },
    ),
  );
  parts.push(escPosFeed(4));
  parts.push(escPosCut());
  return escPosConcat(parts);
};
