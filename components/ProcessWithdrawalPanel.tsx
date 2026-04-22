import React, { useState } from 'react';
import { WithdrawalRequest, User } from '../types';

interface ProcessWithdrawalPanelProps {
  onProcessWithdrawal: (code: string) => Promise<boolean>;
  withdrawalRequests: WithdrawalRequest[];
  customers: User[];
}

export const ProcessWithdrawalPanel: React.FC<ProcessWithdrawalPanelProps> = ({ onProcessWithdrawal, withdrawalRequests, customers }) => {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [step, setStep] = useState<'find' | 'confirm' | 'done'>('find');
  const [foundRequest, setFoundRequest] = useState<WithdrawalRequest | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const resetState = () => {
    setCode('');
    setMessage('');
    setIsSuccess(false);
    setStep('find');
    setFoundRequest(null);
    setCustomer(null);
    setNewBalance(null);
  };

  const handleFindRequest = () => {
    setMessage('');
    if (!code) {
        setMessage('Please enter a withdrawal code.');
        setIsSuccess(false);
        return;
    }
    const request = withdrawalRequests.find(r => r.code.toUpperCase() === code.toUpperCase() && r.status === 'Pending');
    if (request) {
        const reqCustomer = customers.find(c => c.id === request.customerId);
        if (reqCustomer) {
            setFoundRequest(request);
            setCustomer(reqCustomer);
            setStep('confirm');
        } else {
            setMessage('Could not find customer associated with this request.');
            setIsSuccess(false);
        }
    } else {
      setMessage('Withdrawal code not found, already processed, or expired.');
      setIsSuccess(false);
    }
  };

  const handleProcess = async () => {
    if (!foundRequest || !customer) return;

    const success = await onProcessWithdrawal(code);
    if (success) {
      const updatedBalance = (customer.walletBalance ?? 0) - foundRequest.amount;
      setNewBalance(updatedBalance);
      setMessage(`Withdrawal of ${foundRequest.amount.toFixed(2)} GMD completed successfully for ${customer.name}.`);
      setIsSuccess(true);
      setStep('done');
    } else {
      setMessage('An error occurred while processing the withdrawal. Please try again.');
      setIsSuccess(false);
    }
  };
  
  if (step === 'confirm' && foundRequest && customer) {
     return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
             <h3 className="text-xl font-bold text-betese-dark mb-4">Confirm Withdrawal</h3>
             <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg space-y-2 text-lg">
                <p><strong>Customer:</strong> {customer.name}</p>
                <p><strong>Amount to Withdraw:</strong> <span className="font-bold text-2xl text-red-600">{foundRequest.amount.toFixed(2)} GMD</span></p>
                <p><strong>Current Balance:</strong> {(customer.walletBalance ?? 0).toFixed(2)} GMD</p>
             </div>
              <div className="mt-6 flex gap-4">
                <button onClick={resetState} className="w-full px-4 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400">Cancel</button>
                <button onClick={handleProcess} className="w-full px-4 py-3 bg-betese-green text-white font-bold rounded-lg hover:bg-green-700">Confirm & Pay</button>
             </div>
        </div>
     )
  }
  
  if (step === 'done' && foundRequest && customer) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-green-700 mb-4">Withdrawal Complete</h3>
            {message && <p className={`text-center text-sm p-3 rounded-md mb-4 ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</p>}
             <div className="p-4 bg-green-50 border border-green-300 rounded-lg space-y-2 text-lg">
                <p><strong>Customer:</strong> {customer.name}</p>
                <p><strong>Amount Paid:</strong> <span className="font-bold text-red-600">{foundRequest.amount.toFixed(2)} GMD</span></p>
                <p><strong>Previous Balance:</strong> {(customer.walletBalance ?? 0).toFixed(2)} GMD</p>
                <p><strong>New Balance:</strong> <span className="font-bold text-betese-green">{newBalance?.toFixed(2)} GMD</span></p>
             </div>
             <div className="mt-6">
                <button onClick={resetState} className="w-full px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Next Customer</button>
             </div>
        </div>
      );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-betese-dark mb-4">Process Withdrawal</h3>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Enter the customer's withdrawal code to process their payment.</p>
        <div className="flex gap-2">
            <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter Withdrawal Code"
                className="flex-grow p-2 border border-gray-300 rounded-md uppercase"
            />
            <button
                onClick={handleFindRequest}
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
                Find Request
            </button>
        </div>
        {message && <p className={`text-center text-sm p-2 rounded-md ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message}</p>}
      </div>
    </div>
  );
};