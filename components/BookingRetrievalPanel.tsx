
import React, { useState } from 'react';
import { Ticket, Race } from '../types';
import { BETTING_CUTOFF_MS } from '../utils';

interface BookingRetrievalPanelProps {
  allTickets: Ticket[];
        onPayForBooking: (bookingCode: string) => Promise<{ success: boolean; message: string; ticket?: Ticket }>;
  onPrintBookingSlip: (ticket: Ticket) => void;
  races: Race[];
  effectiveTime: Date;
}

export const BookingRetrievalPanel: React.FC<BookingRetrievalPanelProps> = ({ allTickets, onPayForBooking, onPrintBookingSlip, races, effectiveTime }) => {
  const [bookingCode, setBookingCode] = useState('');
  const [foundTicket, setFoundTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleFindBooking = () => {
    setMessage('');
    setFoundTicket(null);
    setIsSuccess(false);
    if (!bookingCode) {
        setMessage('Please enter a Booking Code.');
        return;
    }
    const normalizedCode = bookingCode.trim().toUpperCase();
    const ticket = allTickets.find(t => t.bookingCode?.toUpperCase() === normalizedCode && t.status === 'Booked');
    if (ticket) {
        setFoundTicket(ticket);
    } else {
        setMessage('Booking code not found or has already been processed.');
    }
  };

  const handlePay = async () => {
      if (!foundTicket?.bookingCode) return;
      
      const result = await onPayForBooking(foundTicket.bookingCode.trim().toUpperCase());
      setMessage(result.message);
      setIsSuccess(result.success);

      if(result.success) {
          if (result.ticket) {
              onPrintBookingSlip(result.ticket);
          }
          setFoundTicket(null);
          setBookingCode('');
      }
  }

  // Check if ticket is expired based on race time
  const isTicketExpired = () => {
      if (!foundTicket) return false;
      const now = effectiveTime.getTime();
      return foundTicket.selections.some(selection => {
          const race = races.find(r => r.id === selection.raceId);
          if (!race) return true; // Safety: if race not found, assume unpayable
          const timeRemaining = race.endDate.getTime() - now;
          return timeRemaining <= BETTING_CUTOFF_MS;
      });
  };

  const expired = isTicketExpired();

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-transparent hover:border-blue-100 transition-colors">
      <h3 className="text-xl font-bold text-betese-dark mb-4">Retrieve & Pay Booking</h3>
      <div className="space-y-4">
                <p className="text-xs text-gray-600 font-semibold bg-blue-50 border border-blue-200 rounded-md p-2">
                    ACTION: Enter the Transaction Code in the box below, then click Find Ticket.
                </p>
                <label htmlFor="transaction-code-input" className="block text-sm font-black text-gray-700 uppercase tracking-wide">
                    Transaction Code (Booking Code)
                </label>
        <div className="flex gap-2">
            <input
                        id="transaction-code-input"
            type="text"
            value={bookingCode}
            onChange={(e) => setBookingCode(e.target.value)}
                        placeholder="Enter Transaction Code"
            className="flex-grow p-3 border-2 border-gray-300 rounded-lg uppercase font-bold text-lg tracking-widest focus:border-betese-green focus:ring-0"
            />
            <button
                onClick={handleFindBooking}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md"
            >
                                Find Ticket
            </button>
        </div>

        {message && <p className={`text-center text-sm p-3 font-bold rounded-md ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</p>}
        
        {foundTicket && (
            <div className={`mt-4 p-4 rounded-lg border-2 shadow-sm ${expired ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                {expired && (
                    <div className="mb-4 p-3 bg-red-600 text-white rounded text-center shadow">
                        <p className="font-black text-lg uppercase flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            BOOKING EXPIRED
                        </p>
                        <p className="text-xs font-medium mt-1">The race has already started (or is about to start). Payment cannot be accepted.</p>
                    </div>
                )}

                <div className="text-sm space-y-1 mb-3">
                    <p className="flex justify-between"><span>Customer:</span> <span className="font-bold">{foundTicket.vendorName}</span></p>
                    <p className="flex justify-between"><span>Booked At:</span> <span className="font-mono">{foundTicket.timestamp.toLocaleTimeString()}</span></p>
                    <div className="flex justify-between items-center pt-2 border-t border-black/10 mt-2">
                        <span className="text-gray-600">Amount Due:</span>
                        <span className="font-black text-2xl text-betese-dark">{foundTicket.totalCost.toFixed(2)} GMD</span>
                    </div>
                </div>
                
                <div className="text-xs space-y-1 mb-4 max-h-24 overflow-y-auto bg-white/60 p-2 rounded">
                     {foundTicket.selections.map((sel, i) => (
                        <div key={i} className="border-b last:border-0 pb-1 mb-1 border-gray-200">
                            <span className="font-bold">{sel.raceName}</span>
                            <span className="block text-gray-600">{sel.betType}: {sel.xCount > 0 && `${'X '.repeat(sel.xCount)}`}{sel.numbers.join(', ')}</span>
                        </div>
                     ))}
                </div>

                 <div className="flex flex-col gap-3">
                    <button
                        onClick={handlePay}
                        disabled={expired}
                        className={`w-full px-4 py-3 text-white font-bold rounded-lg shadow-md flex justify-center items-center gap-2 transition-all ${
                            expired 
                            ? 'bg-gray-400 cursor-not-allowed opacity-70' 
                            : 'bg-betese-green hover:bg-green-700 transform active:scale-95'
                        }`}
                    >
                        {expired ? (
                            <>⛔ CANNOT PAY (RACE STARTED)</>
                        ) : (
                            <>
                                <img src="https://images.unsplash.com/photo-1554672408-730436b60dde?w=48&h=48&fit=crop&q=80" alt="money" className="w-6 h-6 rounded object-cover inline-block" /> CONFIRM PAYMENT &amp; PRINT
                            </>
                        )}
                    </button>
                    
                    <button
                        onClick={() => onPrintBookingSlip(foundTicket)}
                        className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-xs"
                    >
                        Re-Print Booking Slip (Not Valid for Bet)
                    </button>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};
