
import React, { useState } from 'react';
import { Ticket } from '../types';

interface TicketCheckPanelProps {
  allTickets: Ticket[];
  onPayoutTicket: (ticketId: string) => void;
}

export const TicketCheckPanel: React.FC<TicketCheckPanelProps> = ({ allTickets, onPayoutTicket }) => {
  const [ticketId, setTicketId] = useState('');
  const [foundTicket, setFoundTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState('');

  const handleCheckTicket = () => {
    setMessage('');
    setFoundTicket(null);
    if (!ticketId) {
        setMessage('Please enter a Ticket ID.');
        return;
    }
    // Search both local and full list
    const ticket = allTickets.find(t => t.id === ticketId || t.bookingCode === ticketId.toUpperCase());
    if (ticket) {
        setFoundTicket(ticket);
    } else {
        setMessage('Ticket not found in current database.');
    }
  };

  const handlePayout = () => {
    if (foundTicket) {
      onPayoutTicket(foundTicket.id);
      setFoundTicket(null);
      setTicketId('');
      setMessage('Payout successful!');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-orange-500">
      <h3 className="text-xl font-black text-gray-800 uppercase mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" /></svg> Scan &amp; Payout
      </h3>
      <div className="space-y-4">
        <div className="flex gap-2">
            <input
                type="text"
                autoFocus
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="Scan or Type Ticket ID"
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
                    <p className="text-gray-500 font-bold uppercase text-[10px]">ID:</p>
                    <p className="font-black text-right font-mono">{foundTicket.id}</p>
                    <p className="text-gray-500 font-bold uppercase text-[10px]">Status:</p>
                    <p className={`font-black text-right uppercase ${foundTicket.status === 'Winning' ? 'text-blue-600' : 'text-gray-800'}`}>{foundTicket.status}</p>
                    <p className="text-gray-500 font-bold uppercase text-[10px]">Cost:</p>
                    <p className="font-black text-right">{foundTicket.totalCost.toFixed(2)}</p>
                </div>

                {foundTicket.status === 'Winning' && (
                    <div className="p-4 bg-blue-600 text-white rounded-xl text-center shadow-inner">
                        <p className="text-xs font-bold uppercase opacity-80">Winning Amount</p>
                        <p className="text-4xl font-black leading-none my-1">{foundTicket.winnings?.toFixed(2)}</p>
                        <p className="text-[10px] font-bold uppercase mt-2">GMD</p>
                    </div>
                )}

                {foundTicket.status === 'Winning' ? (
                    <button
                        onClick={handlePayout}
                        className="w-full py-4 bg-green-600 text-white font-black text-lg rounded-xl hover:bg-green-700 shadow-lg active:scale-95 transition-all uppercase"
                    >
                        Confirm Payout
                    </button>
                ) : (
                    <div className="text-center p-2 bg-gray-200 rounded-lg text-xs font-bold text-gray-600">
                        {foundTicket.status === 'Paid' ? 'ALREADY PAID' : 'NOT A WINNING TICKET'}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};
