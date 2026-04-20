import React from 'react';
import { WithdrawalRequest } from '../types';

interface WithdrawalCodeModalProps {
  request: WithdrawalRequest;
  onClose: () => void;
}

export const WithdrawalCodeModal: React.FC<WithdrawalCodeModalProps> = ({ request, onClose }) => {
  
  const handleCopy = () => {
    navigator.clipboard.writeText(request.code);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center transform transition-all animate-fade-in-up">
        <div className="text-5xl mb-4">💸</div>
        <h2 className="text-2xl font-bold text-betese-dark">Withdrawal Requested</h2>
        <p className="text-gray-600 mt-2">Take this code to any Betese vendor to receive your cash.</p>
        
        <div className="my-6 p-4 bg-green-50 rounded-lg border-2 border-green-200">
            <p className="text-lg font-medium text-gray-700">Your Withdrawal Code</p>
            <p 
                className="text-4xl font-extrabold text-betese-dark tracking-widest my-2 cursor-pointer"
                title="Click to copy"
                onClick={handleCopy}
            >
                {request.code}
            </p>
        </div>
        
        <p className="text-sm text-gray-500">
            Withdrawal Amount: <strong className="text-betese-dark">{request.amount.toFixed(2)} GMD</strong>.
        </p>

        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-transform transform hover:scale-105"
          >
            Done
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fade-in-up {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};
