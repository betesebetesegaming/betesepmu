import React, { useMemo, useState } from 'react';
import { WithdrawalRequest, User } from '../types';

const WAVE_LOGO = '/payment-logos/wave.png';
const AFRIMONEY_LOGO = '/payment-logos/afrimoney.png';

interface ProcessWithdrawalPanelProps {
  onProcessWithdrawal: (
    code: string,
    payoutMethod?: 'Cash' | 'Wave' | 'AfriMoney',
    payoutReference?: string,
    recipientPhone?: string,
  ) => Promise<boolean>;
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
  const [payoutMethod, setPayoutMethod] = useState<'Cash' | 'Wave' | 'AfriMoney'>('Cash');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [customerOtpCode, setCustomerOtpCode] = useState('');
  const [busy, setBusy] = useState(false);

  const recentMobilePayouts = useMemo(() => {
    return (withdrawalRequests || [])
      .filter(r => r.status === 'Completed' && (r.payoutMethod === 'Wave' || r.payoutMethod === 'AfriMoney'))
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
    setRecipientPhone('');
    setCustomerOtpCode('');
    setBusy(false);
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

    let request = pendingRequests.find(r => r.code.toUpperCase() === upperSearch);

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
            const defaultPhone = request.recipientPhone || reqCustomer.phone?.replace(/^\+220/, '') || '';
            setRecipientPhone(defaultPhone);
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

    if (payoutMethod !== 'Cash' && !recipientPhone.trim()) {
      setMessage('Enter the customer mobile money phone number before ModemPay payout.');
      setIsSuccess(false);
      return;
    }

    setBusy(true);
    const success = await onProcessWithdrawal(
      foundRequest.code,
      payoutMethod,
      undefined,
      recipientPhone.trim() || undefined,
    );
    setBusy(false);

    if (success) {
      const updatedBalance = (customer.walletBalance ?? 0) - foundRequest.amount;
      setNewBalance(updatedBalance);
      setMessage(
        payoutMethod === 'Cash'
          ? `Withdrawal of ${foundRequest.amount.toFixed(2)} GMD completed successfully for ${customer.name}.`
          : `${foundRequest.amount.toFixed(2)} GMD sent via ModemPay ${payoutMethod} to ${recipientPhone.trim()}.`
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
              <div className="grid grid-cols-3 gap-2">
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
                  aria-label="Wave"
                  className={`flex items-center justify-center px-3 py-3 rounded-lg border-2 ${payoutMethod === 'Wave' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'bg-white border-gray-300'}`}
                >
                  <img src={WAVE_LOGO} alt="Wave" className="h-7 w-auto object-contain" />
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod('AfriMoney')}
                  aria-label="AfriMoney"
                  className={`flex items-center justify-center px-3 py-3 rounded-lg border-2 ${payoutMethod === 'AfriMoney' ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200' : 'bg-white border-gray-300'}`}
                >
                  <img src={AFRIMONEY_LOGO} alt="AfriMoney" className="h-7 w-auto object-contain" />
                </button>
              </div>
              {payoutMethod !== 'Cash' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-blue-800 mb-1">Mobile money phone</label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="7-digit Gambian number"
                    className="w-full p-2 border border-blue-300 rounded-md"
                  />
                  <p className="text-xs text-blue-800 mt-1">Funds are sent automatically via ModemPay. Wallet is deducted immediately; failed transfers are refunded.</p>
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
                <button onClick={resetState} disabled={busy} className="w-full px-4 py-3 bg-gray-300 text-gray-800 font-bold rounded-lg hover:bg-gray-400 disabled:opacity-60">Cancel</button>
                <button onClick={handleProcess} disabled={busy} className="w-full px-4 py-3 bg-betese-green text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-60">
                  {busy ? 'Processing…' : payoutMethod === 'Cash' ? 'Confirm & Pay Cash' : `Send via ${payoutMethod}`}
                </button>
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
              <p><strong>Paid By:</strong> {payoutMethod === 'Cash'
                ? <span className="font-bold text-gray-800">Cash</span>
                : <span className="font-bold text-blue-700">ModemPay {payoutMethod} ✓</span>}
              </p>
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
        <p className="text-sm text-gray-600">Find by withdrawal code, customer ID, or phone. Pay cash at the desk or send funds via ModemPay Wave / AfriMoney.</p>
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
          <h4 className="text-sm font-black uppercase tracking-widest text-blue-700 mb-2">Recent ModemPay Payouts</h4>
          {recentMobilePayouts.length === 0 ? (
            <p className="text-xs text-gray-500">No completed mobile money payouts yet.</p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {recentMobilePayouts.map(req => (
                <div key={req.id} className="p-2 rounded border border-blue-200 bg-blue-50">
                  <p className="text-sm font-bold text-blue-900">{req.customerName} - {Number(req.amount || 0).toFixed(2)} GMD</p>
                  <p className="text-xs text-blue-800">Paid via ModemPay {req.payoutMethod} by {req.processedByName || 'System'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
