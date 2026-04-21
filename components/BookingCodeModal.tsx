
import React from 'react';
import { Ticket } from '../types';
import { triggerPrint } from '../utils';
import { Logo } from './Logo';

interface BookingCodeModalProps {
  ticket: Ticket;
  onClose: () => void;
}

export const BookingCodeModal: React.FC<BookingCodeModalProps> = ({ ticket, onClose }) => {
  if (!ticket.bookingCode) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(ticket.bookingCode ?? '');
  };

  return (
    <>
      <style>{`
        @keyframes fade-in-up {
            0% {
                opacity: 0;
                transform: translateY(20px);
            }
            100% {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
        }
       `}</style>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center transform transition-all animate-fade-in-up">
          <div id={`booking-print-${ticket.bookingCode}`}>
            <div className="printable-content">
              <div className="flex justify-center mb-4 print:hidden">
                <div className="w-16 h-16 rounded-2xl bg-betese-green flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-white">
                    <rect x="3" y="7" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                    <path d="M3 11h18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
                    <circle cx="8" cy="14.5" r="1.2" fill="currentColor"/>
                    <path d="M11 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <div className="print:text-black print:bg-white bg-white">
                  <div className="text-center mb-4 border-b-2 border-dashed border-black pb-2">
                    <div className="flex justify-center"><Logo className="text-4xl" /></div>
                    <h2 className="text-2xl font-bold text-betese-dark">Bet Booking Confirmation</h2>
                  </div>
                  <p className="text-gray-600 mt-2">Pay Cash at any Betese vendor using this code to print your official ticket.</p>
                  
                  <div className="my-6 p-4 bg-yellow-100 rounded-lg border-2 border-yellow-300">
                      <p className="text-lg font-medium text-gray-700">Your Booking Code</p>
                      <p 
                          className="text-4xl font-extrabold text-betese-dark tracking-widest my-2 cursor-pointer"
                          title="Click to copy"
                          onClick={handleCopy}
                      >
                          {ticket.bookingCode}
                      </p>
                  </div>
                  
                  <p className="text-lg">
                      Total Cost: <strong className="text-betese-dark font-black">{ticket.totalCost.toFixed(2)} GMD</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-4">
                      Booked by: {ticket.vendorName} on {ticket.timestamp.toLocaleString('en-GB')}
                  </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-4 print:hidden">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
