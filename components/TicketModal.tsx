
import React from 'react';
import { Ticket, Race } from '../types';
import { triggerPrint, formatWinningNumbersForDisplay } from '../utils';

interface TicketModalProps {
  ticket: Ticket;
  onClose: () => void;
  showPrintButton: boolean;
  races?: Race[];
}

export const TicketModal: React.FC<TicketModalProps> = ({ ticket, onClose, showPrintButton, races }) => {
  
  const handlePrint = () => {
    triggerPrint(`ticket-receipt-${ticket.id}`);
  };

  const isPaid = ticket.status === 'Paid';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${ticket.id}`;
  const raceResultLines = Array.from(new Set(ticket.selections.map(sel => sel.raceId))).map((raceId) => {
    const race = races?.find(r => r.id === raceId);
    if (!race) return `${raceId}: Pending`;
    const numbers = formatWinningNumbersForDisplay(race.result?.winningNumbers);
    return `${race.name}: ${numbers === 'N/A' ? 'Pending' : numbers}`;
  });

  const renderStandardTicket = () => (
    <div className="text-black bg-white font-mono leading-tight overflow-hidden px-1 py-1">
      {/* Header */}
      <div className="c b text-base border-b-2 border-black text-center pb-1 uppercase bg-black text-white py-0.5">Betese PMU</div>

      {/* Reference & Vendor Info */}
      <div className="border-b border-black py-1 mb-1">
        <div className="c b text-xs text-black">REF: #{ticket.id}</div>
        <div className="c b text-xs text-black">
          {ticket.timestamp.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} {ticket.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
        </div>
        <div className="c b text-sm mt-0.5 text-black uppercase">VENDOR: {ticket.vendorName || ticket.vendorId || 'N/A'}</div>
      </div>

      {/* Race Selections */}
      <div className="space-y-1.5">
        {ticket.selections.map((sel, i) => (
          <div key={i} className="border-b border-black pb-1.5">
            <div className="c b text-xs text-black uppercase">{sel.raceName} {sel.betType}</div>
            
            {/* Print-safe high-contrast number box for sharper thermal output */}
            <div className="c b text-xl bg-white text-black border-2 border-black rounded-none px-1 py-1.5 my-1 text-center font-black tracking-tight leading-none">
              {sel.pattern && sel.pattern.length > 0
                ? sel.pattern.join('-')
                : (sel.xCount > 0 ? 'X-'.repeat(sel.xCount) : '') + sel.numbers.join('-')}
            </div>
            
            <div className="c b text-xs text-black">STAKE X{sel.multiplier} GMD {(sel.cost * sel.multiplier).toFixed(0)}</div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="border-t-2 border-black mt-1.5 pt-1 bg-white">
        <div className="c b text-base text-black font-black text-center">Total {ticket.totalCost.toFixed(0)} GMD</div>
      </div>

      {/* Footer */}
      <div className="c b text-xs text-black mt-1 text-center">*** Valid for 7 days ***</div>
      <div className="text-center mt-1 pb-0.5">
        <img src={qrUrl} alt="QR" className="w-[50px] h-[50px] mx-auto block" />
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
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-[280px] flex flex-col animate-fade-in my-auto">
          <div className="p-2 border-b flex justify-between items-center bg-gray-100 rounded-t-xl">
              <span className="font-black text-[10px] text-gray-500 uppercase tracking-widest">Printer View</span>
              <button onClick={onClose} className="text-gray-400 text-2xl leading-none">&times;</button>
          </div>

          <div className="p-2 bg-gray-200">
            <div id={`p-box-${ticket.id}`} className="bg-white p-1.5 shadow-inner mx-auto border border-gray-300 w-[195px]">
                <div id={`ticket-receipt-${ticket.id}`}>
                  {isPaid ? renderPaidReceipt() : renderStandardTicket()}
                </div>
            </div>
          </div>
          
          <div className="p-4 bg-white border-t rounded-b-xl space-y-2">
            {showPrintButton && (
                <button
                    onClick={handlePrint}
                    className="w-full py-4 bg-betese-green text-white font-black text-2xl rounded-lg shadow-xl active:scale-95 transition-all flex justify-center items-center gap-2 border-b-4 border-black/20"
                >
                    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="4" width="10" height="5"/><rect x="5" y="9" width="14" height="8" rx="2"/><rect x="8" y="14" width="8" height="6"/></svg> PRINT TICKET
                </button>
            )}
            <button onClick={onClose} className="w-full py-2 text-gray-500 font-bold text-xs uppercase tracking-widest bg-gray-50 rounded-lg">Close</button>
          </div>
        </div>
      </div>
  );
};
