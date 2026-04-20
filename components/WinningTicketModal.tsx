
import React from 'react';
import { Ticket } from '../types';

interface WinningTicketModalProps {
  ticket: Ticket;
  onClose: () => void;
}

export const WinningTicketModal: React.FC<WinningTicketModalProps> = ({ ticket, onClose }) => {
  // Display the actual winnings from the ticket object
  const winnings = ticket.winnings ?? 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center relative overflow-hidden transform transition-all animate-fade-in-up">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-green-500"></div>
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-betese-dark">Congratulations!</h2>
        <p className="text-gray-600 mt-2">You've won on ticket #{ticket.id.slice(-6)}!</p>
        
        <div className="my-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <p className="text-lg font-medium text-gray-700">Amount Won</p>
            <p className="text-4xl font-extrabold text-betese-green my-2">
                {winnings.toFixed(2)} GMD
            </p>
        </div>
        
        <p className="text-sm text-gray-500">
            Your winnings have been automatically credited to your wallet balance.
        </p>

        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105"
          >
            Awesome!
          </button>
        </div>
      </div>
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
    </div>
  );
};
