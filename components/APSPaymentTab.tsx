import React, { useState, useMemo } from 'react';
import { User } from '../types';
import { APSLogo } from './APSLogo';

interface Props {
  customers: User[];
  onDeposit: (customerId: string, amount: number, method: 'Cash' | 'Wave' | 'AfriMoney' | 'APS' | 'Correction', transactionId?: string) => Promise<{ success: boolean; bonusApplied: number | null }>;
}

const generateRef = () => `BETESE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const APSPaymentTab: React.FC<Props> = ({ customers, onDeposit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return [];
    return customers.filter(c =>
      c.phone?.includes(searchTerm) ||
      c.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!selectedCustomer) { setMessage({ ok: false, text: 'Please select a customer.' }); return; }
    if (!phone.trim()) { setMessage({ ok: false, text: 'Please enter APS Wallet phone number.' }); return; }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) { setMessage({ ok: false, text: 'Please enter a valid amount.' }); return; }

    setLoading(true);
    try {
      const externalRef = generateRef();
      const cleanPhone = phone.replace(/^\+220/, '').replace(/\D/g, '');

      const res = await fetch('/api/aps-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerPhone: cleanPhone,
          amount: numAmount,
          externalRef,
          customerName: selectedCustomer.name
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        const result = await onDeposit(selectedCustomer.id, numAmount, 'APS', externalRef);
        if (result.success) {
          setMessage({
            ok: true,
            text: `Payment of ${numAmount.toFixed(2)} GMD successful! Wallet credited.${result.bonusApplied ? ` Bonus: ${result.bonusApplied.toFixed(2)} GMD` : ''}`
          });
          setAmount('');
          setPhone('');
          setSelectedCustomer(null);
          setSearchTerm('');
        } else {
          setMessage({ ok: false, text: 'Payment sent but wallet credit failed. Contact admin.' });
        }
      } else {
        setMessage({ ok: false, text: data.error || 'APS payment failed. Please try again.' });
      }
    } catch {
      setMessage({ ok: false, text: 'Network error. Please check connection.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <APSLogo height={26} />
          <h4 className="text-lg font-black text-indigo-900">APS Wallet Direct Payment</h4>
        </div>
        <p className="text-sm text-indigo-700 mb-4">
          Customer will receive a prompt on their phone to confirm payment with their APS Wallet PIN.
        </p>

        {message && (
          <div className={`p-3 rounded-lg mb-4 font-bold text-sm ${message.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Find Customer</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); if (selectedCustomer) setSelectedCustomer(null); }}
                placeholder="Search by name or phone..."
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              {searchTerm && !selectedCustomer && filteredCustomers.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                  {filteredCustomers.map(c => (
                    <li key={c.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                      onClick={() => { setSelectedCustomer(c); setSearchTerm(`${c.name} (${c.phone})`); }}>
                      <span className="font-bold">{c.name}</span> <span className="text-gray-500">({c.phone})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {selectedCustomer && (
            <div className="bg-white border-2 border-indigo-300 rounded-lg p-3">
              <p className="text-sm text-gray-600">Selected Customer:</p>
              <p className="font-black text-lg">{selectedCustomer.name}</p>
              <p className="text-sm">Wallet: <span className="font-bold">{selectedCustomer.walletBalance?.toFixed(2)} GMD</span></p>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Customer APS Wallet Phone</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 7701234567"
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Amount (GMD)</label>
            <input
              type="number"
              value={amount === '' ? '' : amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Enter amount"
              className="w-full p-2 border border-gray-300 rounded-md"
              min="1"
              step="0.01"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-800 text-white font-black rounded-xl hover:bg-indigo-900 disabled:opacity-50 text-lg"
          >
            {loading ? 'Processing...' : 'Send APS Payment Request'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Customer will receive a confirmation request on their APS Wallet account.
          </p>
        </form>
      </div>
    </div>
  );
};
