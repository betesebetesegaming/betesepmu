
import React, { useEffect, useState } from 'react';
import { Ticket } from '../types';

interface TicketCheckPanelProps {
  allTickets: Ticket[];
  onPayoutTicket: (ticketId: string) => void;
  onCancelTicket?: (ticketId: string) => void;
  onReprintTicket?: (ticket: Ticket) => void;
}

export const TicketCheckPanel: React.FC<TicketCheckPanelProps> = ({ allTickets, onPayoutTicket, onCancelTicket, onReprintTicket }) => {
  const [ticketId, setTicketId] = useState('');
  const [foundTicket, setFoundTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState('');
  const [scanMode, setScanMode] = useState(true);

  const lookupTicket = (rawRef: string): Ticket | null => {
    const normalized = (rawRef || '').replace(/[\r\n]/g, '').trim();
    if (!normalized) return null;
    const upper = normalized.toUpperCase();
    return allTickets.find((t) => t.id === normalized || t.bookingCode?.toUpperCase() === upper) || null;
  };

  const handleCheckTicket = () => {
    setMessage('');
    setFoundTicket(null);
    const normalized = (ticketId || '').replace(/[\r\n]/g, '').trim();
    if (!normalized) {
      setMessage('Please enter Ticket Serial Number.');
        return;
    }
    const ticket = lookupTicket(normalized);
    if (ticket) {
        setFoundTicket(ticket);
    } else {
      setMessage('Ticket not found in backoffice database.');
    }
  };

  useEffect(() => {
    if (!scanMode) return;
    const normalized = (ticketId || '').replace(/[\r\n]/g, '').trim();
    if (!normalized) return;

    const looksLikeSerial = /^\d{7,}$/.test(normalized);
    const looksLikeBooking = /^B[A-Z0-9]{4,}$/i.test(normalized);
    if (!looksLikeSerial && !looksLikeBooking) return;

    const timer = setTimeout(() => {
      const ticket = lookupTicket(normalized);
      if (ticket) {
        setFoundTicket(ticket);
        setMessage('');
      }
    }, 160);

    return () => clearTimeout(timer);
  }, [ticketId, scanMode, allTickets]);

  const handlePayout = () => {
    if (foundTicket) {
      onPayoutTicket(foundTicket.id);
      setFoundTicket(null);
      setTicketId('');
      setMessage('Payout successful!');
    }
  };

  const handleCancel = () => {
    if (!foundTicket || !onCancelTicket) return;
    onCancelTicket(foundTicket.id);
    setFoundTicket(null);
    setTicketId('');
    setMessage('Cancel request sent.');
  };

  const handlePrint = () => {
    if (!foundTicket || !onReprintTicket) return;
    onReprintTicket(foundTicket);
  };

  const getStatusLabel = (status: Ticket['status']) => {
    if (status === 'Active') return 'Awaiting Result';
    if (status === 'Winning') return 'Awaiting Cashier Payout';
    if (status === 'Booked') return 'Booking Pending Payment';
    if (status === 'Paid') return 'Paid';
    if (status === 'Lost') return 'Lost';
    if (status === 'Canceled') return 'Canceled';
    return status;
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-orange-500">
      <h3 className="text-xl font-black text-gray-800 uppercase mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" /></svg> Scan &amp; Payout
      </h3>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-600">Backoffice Ticket Rescue: use ticket serial number (manual or scanner). You can also paste booking code.</p>
        <button
          type="button"
          onClick={() => setScanMode((prev) => !prev)}
          className={`px-3 py-1 text-[11px] font-black rounded-lg uppercase ${scanMode ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
        >
          Scan Mode: {scanMode ? 'On' : 'Off'}
        </button>
      </div>
      <div className="space-y-4">
        <div className="flex gap-2">
            <input
                type="text"
                autoFocus
                value={ticketId}
                onChange={(e) => {
                  const cleaned = (e.target.value || '').replace(/[\r\n]/g, '');
                  setTicketId(cleaned);
                }}
                placeholder="Scan/Type Serial No or Booking Code"
                className="flex-grow p-4 border-2 border-gray-200 rounded-xl font-black text-lg focus:border-orange-500 transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && handleCheckTicket()}
            />
            <button
                onClick={handleCheckTicket}
                className="px-6 py-2 bg-orange-600 text-white font-black rounded-xl hover:bg-orange-700 shadow-md active:scale-95 transition-all uppercase"
            >
                Check
            </button>
        </div>

        {message && <p className={`text-center text-sm font-bold p-3 rounded-lg ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>{message}</p>}
        
        {foundTicket && (
            <div className="mt-4 p-4 bg-gray-50 border-2 border-orange-200 rounded-2xl space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-gray-500 font-bold uppercase text-[10px]">Serial No:</p>
                    <p className="font-black text-right font-mono">{foundTicket.id}</p>
                  <p className="text-gray-500 font-bold uppercase text-[10px]">Booking Code:</p>
                  <p className="font-black text-right font-mono">{foundTicket.bookingCode || '---'}</p>
                    <p className="text-gray-500 font-bold uppercase text-[10px]">Status:</p>
                    <p className={`font-black text-right uppercase ${foundTicket.status === 'Winning' ? 'text-blue-600' : foundTicket.status === 'Lost' ? 'text-red-600' : 'text-gray-800'}`}>{getStatusLabel(foundTicket.status)}</p>
                    <p className="text-gray-500 font-bold uppercase text-[10px]">Cost:</p>
                    <p className="font-black text-right">{foundTicket.totalCost.toFixed(2)}</p>
                    {foundTicket.status === 'Paid' && (foundTicket.paidByName || foundTicket.paidById) && (
                      <>
                        <p className="text-gray-500 font-bold uppercase text-[10px]">Paid By:</p>
                        <p className="font-black text-right text-purple-700">{foundTicket.paidByName || foundTicket.paidById}</p>
                      </>
                    )}
                </div>

                <div className="mt-1 p-2 rounded-lg bg-white border text-xs">
                  <p className="font-bold text-gray-600 uppercase mb-1">Bet Combinations</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {foundTicket.selections.map((selection, index) => (
                      <div key={`${foundTicket.id}-sel-${index}`} className="flex justify-between gap-2">
                        <span className="font-semibold">{selection.betType}</span>
                        <span className="font-mono text-right">
                          {selection.pattern && selection.pattern.length > 0
                            ? selection.pattern.join('-')
                            : `${selection.xCount > 0 ? 'X-'.repeat(selection.xCount) : ''}${selection.numbers.join('-')}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {foundTicket.status === 'Winning' && (
                    <div className="p-4 bg-blue-600 text-white rounded-xl text-center shadow-inner">
                        <p className="text-xs font-bold uppercase opacity-80">Winning Amount</p>
                        <p className="text-4xl font-black leading-none my-1">{foundTicket.winnings?.toFixed(2)}</p>
                        <p className="text-[10px] font-bold uppercase mt-2">GMD</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {onReprintTicket && (
                    <button
                      onClick={handlePrint}
                      className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-xl hover:bg-blue-700 shadow-lg active:scale-95 transition-all uppercase"
                    >
                      View / Print
                    </button>
                  )}
                  {foundTicket.status === 'Winning' && !foundTicket.customerId ? (
                    <button
                      onClick={handlePayout}
                      className="w-full py-4 bg-green-600 text-white font-black text-lg rounded-xl hover:bg-green-700 shadow-lg active:scale-95 transition-all uppercase"
                    >
                      Confirm Payout
                    </button>
                  ) : (
                    <div className="text-center p-2 bg-gray-200 rounded-lg text-xs font-bold text-gray-600 flex items-center justify-center">
                      {foundTicket.customerId
                        ? 'ONLINE TICKET - AUTO PAID BY SYSTEM'
                        : foundTicket.status === 'Paid'
                        ? `ALREADY PAID${(foundTicket.paidByName || foundTicket.paidById) ? ` BY ${String(foundTicket.paidByName || foundTicket.paidById).toUpperCase()}` : ''}`
                        : 'NOT A WINNING TICKET'}
                    </div>
                  )}
                  {onCancelTicket && ['Active', 'Booked'].includes(foundTicket.status) && (
                    <button
                      onClick={handleCancel}
                      className="w-full py-4 bg-red-600 text-white font-black text-lg rounded-xl hover:bg-red-700 shadow-lg active:scale-95 transition-all uppercase"
                    >
                      Cancel Ticket
                    </button>
                  )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
