import React, { useMemo, useState } from 'react';
import { WithdrawalRequest, User } from '../types';

interface ProcessWithdrawalPanelProps {
  onProcessWithdrawal: (code: string, payoutMethod?: 'Cash' | 'Wave', payoutReference?: string) => Promise<boolean>;
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
  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Wave'>('Cash');
  const [payoutReference, setPayoutReference] = useState('');
  const [customerOtpCode, setCustomerOtpCode] = useState('');

  const recentWavePayouts = useMemo(() => {
    return (withdrawalRequests || [])
      .filter(r => r.status === 'Completed' && String(r.processedByName || '').includes('[Wave'))
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(0, 10);
  }, [withdrawalRequests]);

  const resetState = () => {
    setCode('');
    setMessage('');
    setIsSuccess(false);
    setStep('find');
    setFoundRequest(null);
    setCustomer(null);
    setNewBalance(null);
    setPayoutMethod('Cash');
    setPayoutReference('');
    setCustomerOtpCode('');
  };

  const handleFindRequest = () => {
    setMessage('');
    const search = code.trim();
    if (!search) {
        setMessage('Please enter withdrawal code, customer ID, or customer phone number.');
        setIsSuccess(false);
        return;
    }

    const pendingRequests = (withdrawalRequests || []).filter(r => r.status === 'Pending');
    const upperSearch = search.toUpperCase();

    // First priority: exact withdrawal code
    let request = pendingRequests.find(r => r.code.toUpperCase() === upperSearch);

    // Fallback: customer ID or phone number (for quick finding by staff)
    if (!request) {
      const normalizedSearchDigits = search.replace(/\D/g, '');
      const matchedCustomers = customers.filter(c => {
        const customerId = String(c.id || '').toUpperCase();
        const customerPhoneDigits = String(c.phone || '').replace(/\D/g, '');
        const idMatch = customerId === upperSearch;
        const phoneMatch = normalizedSearchDigits.length >= 6 && customerPhoneDigits.endsWith(normalizedSearchDigits);
        return idMatch || phoneMatch;
      });

      if (matchedCustomers.length > 0) {
        const customerIds = new Set(matchedCustomers.map(c => c.id));
        request = pendingRequests
          .filter(r => customerIds.has(r.customerId))
          .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())[0];
      }
    }

    if (request) {
        const reqCustomer = customers.find(c => c.id === request.customerId);
        if (reqCustomer) {
            setFoundRequest(request);
            setCustomer(reqCustomer);
            setStep('confirm');
            if (request.code.toUpperCase() !== upperSearch) {
              setMessage(`Found pending request for ${reqCustomer.name}. Confirm withdrawal code from customer before payout.`);
              setIsSuccess(true);
            }
        } else {
            setMessage('Could not find customer associated with this request.');
            setIsSuccess(false);
        }
    } else {
      setMessage('No pending withdrawal found for that code, customer ID, or phone.');
      setIsSuccess(false);
    }
  };

  const handleProcess = async () => {
    if (!foundRequest || !customer) return;

    const normalizedOtp = customerOtpCode.trim().toUpperCase();
    const expectedOtp = foundRequest.code.trim().toUpperCase();
    if (!normalizedOtp) {
      setMessage('Enter customer withdrawal code confirmation before payout.');
      setIsSuccess(false);
      return;
    }
    if (normalizedOtp !== expectedOtp) {
      setMessage('Code mismatch. Ask customer for the exact withdrawal code from WhatsApp.');
      setIsSuccess(false);
      return;
    }

    if (payoutMethod === 'Wave' && !payoutReference.trim()) {
      setMessage('Enter Wave transfer reference/receipt before completing payout.');
      setIsSuccess(false);
      return;
    }

    const success = await onProcessWithdrawal(foundRequest.code, payoutMethod, payoutReference.trim());
    if (success) {
      const updatedBalance = (customer.walletBalance ?? 0) - foundRequest.amount;
      setNewBalance(updatedBalance);
      setMessage(
        payoutMethod === 'Wave'
          ? `Winning payout of ${foundRequest.amount.toFixed(2)} GMD completed by Wave for ${customer.name}.`
          : `Withdrawal of ${foundRequest.amount.toFixed(2)} GMD completed successfully for ${customer.name}.`
      );
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
              <p className="text-sm text-yellow-900"><strong>Security check:</strong> Ask the customer to read their withdrawal code (shared via WhatsApp). Do not proceed without a matching code.</p>
             </div>
             <div className="mt-4 p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
              <p className="text-sm font-bold text-blue-900">Payout Method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayoutMethod('Cash')}
                  className={`px-3 py-2 rounded-lg font-bold text-sm ${payoutMethod === 'Cash' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-700'}`}
                >
                  Cash at Desk
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod('Wave')}
                  className={`px-3 py-2 rounded-lg font-bold text-sm ${payoutMethod === 'Wave' ? 'bg-blue-700 text-white' : 'bg-white border border-blue-300 text-blue-700'}`}
                >
                  Pay by Wave
                </button>
              </div>
              {payoutMethod === 'Wave' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-blue-800 mb-1">Wave transfer reference</label>
                  <input
                    type="text"
                    value={payoutReference}
                    onChange={(e) => setPayoutReference(e.target.value)}
                    placeholder="Paste Wave transfer ref / receipt id"
                    className="w-full p-2 border border-blue-300 rounded-md"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-blue-800 mb-1">Customer withdrawal code</label>
                <input
                  type="text"
                  value={customerOtpCode}
                  onChange={(e) => setCustomerOtpCode(e.target.value)}
                  placeholder="Enter customer code from SMS/WhatsApp"
                  className="w-full p-2 border border-blue-300 rounded-md uppercase"
                />
              </div>
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
              <p><strong>Paid By:</strong> {payoutMethod === 'Wave' ? <span className="font-bold text-blue-700">Wave ✓</span> : <span className="font-bold text-gray-800">Cash</span>}</p>
              {payoutMethod === 'Wave' && payoutReference && (
                <p><strong>Wave Ref:</strong> <span className="font-bold text-blue-700">{payoutReference}</span></p>
              )}
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
        <p className="text-sm text-gray-600">Find by withdrawal code, customer ID, or phone. Before payout, confirm the code the customer shares via WhatsApp.</p>
        <div className="flex gap-2">
            <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter code, customer ID, or phone"
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

        <div className="pt-2 border-t border-gray-200">
          <h4 className="text-sm font-black uppercase tracking-widest text-blue-700 mb-2">Recent Wave Winning Payouts</h4>
          {recentWavePayouts.length === 0 ? (
            <p className="text-xs text-gray-500">No completed Wave payouts yet.</p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {recentWavePayouts.map(req => (
                <div key={req.id} className="p-2 rounded border border-blue-200 bg-blue-50">
                  <p className="text-sm font-bold text-blue-900">{req.customerName} - {Number(req.amount || 0).toFixed(2)} GMD</p>
                  <p className="text-xs text-blue-800">Winning paid by Wave ✓ by {req.processedByName || 'System'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};