
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
    triggerPrint(`p-box-${ticket.id}`);
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
    <div className="text-black bg-white font-mono leading-[0.85] overflow-hidden">
      <div className="c b text-base border-b border-black text-center pb-0.5 uppercase">Betese PMU</div>
      
      {/* 75% Layout: Reference and Time merged */}
      <div className="flex b text-[8px] my-0.5 justify-between px-0.5">
        <span>REF:#{ticket.id}</span>
        <span>{ticket.timestamp.toLocaleDateString([], {day:'2-digit', month:'2-digit'})} {ticket.timestamp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
      <div className="flex b text-[7px] my-0.5 justify-between px-0.5 uppercase">
        <span>VENDOR:</span>
        <span className="truncate ml-2">{ticket.vendorName || ticket.vendorId || 'N/A'}</span>
      </div>

      <div className="border-t border-b border-black py-0.5">
        {ticket.selections.map((sel, i) => (
          <div key={i} className="mb-0.5 last:mb-0">
            <div className="flex b text-[7.5px] justify-between uppercase leading-none px-0.5">
              <span>{sel.raceName.slice(0,14)}</span>
              <span>{sel.betType}</span>
            </div>
            
            <div className="c bg-black text-white px-1 my-0.5 text-center">
                {/* Massive Bold Numbers for Thermal Sharpness */}
                <div className="huge b tracking-tighter py-0.5">
                {sel.pattern && sel.pattern.length > 0 
                    ? sel.pattern.join('-') 
                    : (sel.xCount > 0 ? 'X-'.repeat(sel.xCount) : '') + sel.numbers.join('-')
                }
                </div>
            </div>

            <div className="flex text-[8px] justify-between px-0.5 leading-none">
              <span className="opacity-80 uppercase font-bold">STAKE x{sel.multiplier}</span>
              <span className="b">GMD {(sel.cost * sel.multiplier).toFixed(0)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Merged Total row */}
      <div className="flex justify-between items-center b mt-1 px-1">
        <span className="text-[7.5px] uppercase">T.COST:</span>
        <span className="text-lg leading-none">GMD {ticket.totalCost.toFixed(0)}</span>
      </div>

      <div className="text-center b uppercase text-[5.5px] border-y border-black py-0.5 my-1">
        No Refund. Official Betese Receipt.
      </div>

      <div className="text-center pb-0.5">
        <img src={qrUrl} alt="QR" className="w-[42px] h-[42px] mx-auto block" />
      </div>
    </div>
  );

  const renderPaidReceipt = () => (
    <div className="text-black bg-white c font-mono leading-tight text-center">
      <div className="text-base b border-y border-black py-0.5 uppercase">Paid Receipt</div>
      <p className="b text-[8px] my-0.5">REF: #{ticket.id}</p>
      
      <div className="my-1 border border-black p-1 bg-gray-50">
        <p className="b text-[7px] uppercase">Winning Amount Paid:</p>
        <p className="text-xl b">GMD {(ticket.winnings || 0).toFixed(0)}</p>
      </div>

      <div className="text-left text-[7px] border border-black p-1 bg-white">
        <p className="b uppercase mb-0.5 text-center">Result Numbers</p>
        {raceResultLines.map((line, idx) => (
          <p key={idx} className="truncate">{line}</p>
        ))}
      </div>

      <div className="flex b text-[7px] mt-1 px-1 justify-between">
        <span>PAID BY:{ticket.paidByName || ticket.paidById || 'SYSTEM'}</span>
        <span>{ticket.paidAt?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>

      <div className="border-b border-dashed border-black mt-1 mb-1"></div>
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
                {isPaid ? renderPaidReceipt() : renderStandardTicket()}
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
