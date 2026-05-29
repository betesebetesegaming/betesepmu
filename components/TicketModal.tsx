
import React from 'react';
import { Ticket, Race } from '../types';
import { formatWinningNumbersForDisplay, triggerPrint } from '../utils';
import { buildThermerHandoffUrl } from '../lib/printerBridge';
import { buildThermerTicketEntries, buildThermerPaidReceiptEntries } from '../lib/thermerReceipt';

interface TicketModalProps {
  ticket: Ticket;
  onClose: () => void;
  showPrintButton: boolean;
  races?: Race[];
}

export const TicketModal: React.FC<TicketModalProps> = ({ ticket, onClose, showPrintButton, races }) => {
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [printStatus, setPrintStatus] = React.useState('');
  const autoPrintStartedRef = React.useRef(false);

  const buildEntries = React.useCallback(() => {
    return ticket.status === 'Paid'
      ? buildThermerPaidReceiptEntries(ticket)
      : buildThermerTicketEntries(ticket);
  }, [ticket]);

  const manualHandoffUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    try {
      return buildThermerHandoffUrl(buildEntries());
    } catch {
      return '';
    }
  }, [buildEntries]);

  const handlePrint = React.useCallback(async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintStatus('Sending to printer…');
    // Single unified path for PC, Sunmi V2 Pro, and any other ePOS:
    // triggerPrint() cascades through Sunmi built-in printer → NativePrint
    // → Bluetooth thermal → Mate BT → RawBT, and falls back to window.print()
    // when none of those are available. The Thermer custom-scheme handoff is
    // still offered as a manual fallback link below the button.
    try {
      triggerPrint(`ticket-receipt-${ticket.id}`);
      setPrintStatus('Sent to printer ✓');
    } catch (err) {
      console.error('Print failed:', err);
      setPrintStatus((err as Error)?.message || 'Print failed');
    } finally {
      setTimeout(() => setIsPrinting(false), 1200);
    }
  }, [isPrinting, ticket.id]);

  React.useEffect(() => {
    if (!showPrintButton) return;
    if (autoPrintStartedRef.current) return;
    autoPrintStartedRef.current = true;
    let cancelled = false;
    setPrintStatus('Auto print starting…');
    const timer = window.setTimeout(() => {
      if (!cancelled) handlePrint();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showPrintButton, handlePrint]);

  const isPaid = ticket.status === 'Paid';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${ticket.id}`;
  const raceResultLines = Array.from(new Set(ticket.selections.map(sel => sel.raceId))).map((raceId) => {
    const race = races?.find(r => r.id === raceId);
    if (!race) return `${raceId}: Pending`;
    const numbers = formatWinningNumbersForDisplay(race.result?.winningNumbers);
    return `${race.name}: ${numbers === 'N/A' ? 'Pending' : numbers}`;
  });

  const ticketDateUS = ticket.timestamp.toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  });
  const ticketTime12 = ticket.timestamp.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const ticketSerial = (ticket.id || '').toString();
  const agentLabel = (ticket.vendorName || ticket.vendorId || 'BETESE').toUpperCase();

  const renderStandardTicket = () => (
    <div className="text-black bg-white leading-tight overflow-hidden px-1 py-1" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
      {/* BETESE PMU banner */}
      <div className="c banner bg-black text-white py-1 mb-1 text-center uppercase tracking-widest">BETESE PMU</div>

      {/* Meta block */}
      <div className="b text-black">REF: #{ticketSerial}</div>
      <div className="b text-black">{ticketDateUS} {ticketTime12}</div>
      <div className="b text-black uppercase">VENDOR: {agentLabel}</div>

      <div className="solid" />

      {/* Race selections */}
      {ticket.selections.map((sel, i) => {
        const numbersText = sel.pattern && sel.pattern.length > 0
          ? sel.pattern.join('-')
          : ((sel.xCount > 0 ? Array(sel.xCount).fill('X').join('-') + '-' : '') + sel.numbers.join('-'));
        const stake = (sel.cost * sel.multiplier).toFixed(0);
        return (
          <div key={i} className="mb-1">
            <div className="b text-black uppercase mt-1">{sel.raceName} {sel.betType}</div>
            <div className="box c huge text-black border-2 border-black px-1 py-0.5 my-1">{numbersText}</div>
            <div className="b text-black uppercase">STAKE X{sel.multiplier} GMD {stake}</div>
          </div>
        );
      })}

      <div className="solid" />

      {/* Total */}
      <div className="c huge text-black">Total {ticket.totalCost.toFixed(0)} GMD</div>

      {/* Footer */}
      <div className="c b text-black mt-1">*** Valid for 7 days ***</div>

      <div className="text-center mt-1">
        <img src={qrUrl} alt="QR" />
      </div>
    </div>
  );

  const renderPaidReceipt = () => (
    <div className="text-black bg-white c font-mono leading-tight text-center">
      <div className="text-sm b border-b-2 border-black py-1 uppercase bg-black text-white">Paid Receipt</div>
      <p className="b text-xs text-black my-0.5">REF: #{ticket.id}</p>
      
      <div className="my-1 border-2 border-black bg-black text-white py-1 rounded-none">
        <p className="text-lg b tracking-widest leading-none">PAID</p>
        <p className="text-[7px] font-bold uppercase">Do Not Pay Again</p>
      </div>
      
      <div className="my-1 border border-black p-1 bg-white rounded-none">
        <p className="b text-[7px] text-black uppercase">Winning Amount Paid:</p>
        <p className="text-base b text-black">GMD {(ticket.winnings || 0).toFixed(0)}</p>
      </div>

      <div className="text-left text-[7px] border border-black p-1 bg-white rounded-none">
        <p className="b uppercase mb-0.5 text-center text-black">Result Numbers</p>
        {raceResultLines.map((line, idx) => (
          <p key={idx} className="truncate text-black">{line}</p>
        ))}
      </div>

      <div className="flex b text-[7px] mt-1 px-1 justify-between text-black">
        <span>PAID BY:{ticket.paidByName || ticket.paidById || 'SYSTEM'}</span>
        <span>{ticket.paidAt?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>
      <div className="b text-[7px] px-1 text-left uppercase text-black">
        Date: {ticket.paidAt?.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' }) || 'N/A'}
      </div>

      <div className="border-b border-black mt-1 mb-1"></div>
      <img src={qrUrl} alt="QR" className="w-[45px] h-[45px] mx-auto" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-[320px] flex flex-col animate-fade-in my-auto">
          <div className="p-2 border-b flex justify-between items-center bg-gray-100 rounded-t-xl">
              <span className="font-black text-[10px] text-gray-500 uppercase tracking-widest">Printer View (58mm)</span>
              <button onClick={onClose} className="text-gray-400 text-2xl leading-none">&times;</button>
          </div>

          <div className="p-2 bg-gray-200">
            <div id={`p-box-${ticket.id}`} className="bg-white p-2 shadow-inner mx-auto border border-gray-300" style={{ width: '58mm' }}>
                <div id={`ticket-receipt-${ticket.id}`}>
                  {isPaid ? renderPaidReceipt() : renderStandardTicket()}
                </div>
            </div>
          </div>
          
          <div className="p-4 bg-white border-t rounded-b-xl space-y-2">
            {showPrintButton && (
              <>
                <button
                  onClick={() => handlePrint()}
                  onTouchEnd={(e) => { e.preventDefault(); handlePrint(); }}
                  disabled={isPrinting}
                  className="w-full py-4 bg-betese-green text-white font-black text-2xl rounded-lg shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2 border-b-4 border-black/20 disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="4" width="10" height="5"/><rect x="5" y="9" width="14" height="8" rx="2"/><rect x="8" y="14" width="8" height="6"/></svg>
                  {isPrinting ? 'PRINTING…' : 'PRINT TICKET'}
                </button>
                <div className="text-center text-xs font-semibold text-gray-600 py-1 min-h-[1.25rem]">
                  {printStatus || 'Prints via the Thermer app on your device.'}
                </div>
                {manualHandoffUrl && (
                  <a
                    href={manualHandoffUrl}
                    className="block w-full py-2 text-center text-xs font-bold uppercase tracking-widest text-betese-green underline"
                  >
                    Open in print app manually
                  </a>
                )}
              </>
            )}
            <button onClick={onClose} className="w-full py-2 text-gray-500 font-bold text-xs uppercase tracking-widest bg-gray-50 rounded-lg">Close</button>
          </div>
        </div>
      </div>
  );
};
