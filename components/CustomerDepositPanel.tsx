
import React, { useState, useMemo, useEffect } from 'react';
import { User, DepositLog, DepositRequest, Role } from '../types';
import { TableScrollNavigator } from './TableScrollNavigator';
import { AfriMoneyLogo } from './AfriMoneyLogo';

interface CustomerDepositPanelProps {
  customers: User[];
    onDeposit: (customerId: string, amount: number, method: 'Cash' | 'Wave' | 'AfriMoney' | 'Correction', transactionId?: string) => Promise<{ success: boolean; bonusApplied: number | null }>;
    onAdminAdjustBalance?: (customerId: string, walletDelta: number, bonusDelta: number, note: string) => Promise<{ success: boolean; message: string }>;
  depositLogs: DepositLog[];
  depositRequests?: DepositRequest[];
  onApproveDepositRequest?: (requestId: string) => void;
  onRejectDepositRequest?: (requestId: string) => void;
  currentUserRole: Role; // Added to control visibility
}

export const CustomerDepositPanel: React.FC<CustomerDepositPanelProps> = ({ customers, onDeposit, onAdminAdjustBalance, depositLogs, depositRequests = [], onApproveDepositRequest, onRejectDepositRequest, currentUserRole }) => {
  // If Vendor, default to 'manual', otherwise 'requests'
  const [activeTab, setActiveTab] = useState<'requests' | 'manual' | 'history'>(
      currentUserRole === 'Vendor' ? 'manual' : 'requests'
  );
  
  // Manual Deposit State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [amount, setAmount] = useState<number | ''>('');
  const [successMessage, setSuccessMessage] = useState('');
  const [methodFilter, setMethodFilter] = useState<'All' | 'Cash' | 'Wave' | 'AfriMoney' | 'Correction'>('All');
    const [trackingCustomerId, setTrackingCustomerId] = useState('');
    const [walletAdjustment, setWalletAdjustment] = useState<number | ''>('');
    const [bonusAdjustment, setBonusAdjustment] = useState<number | ''>('');
    const [adjustmentNote, setAdjustmentNote] = useState('');
    const [approvalPin, setApprovalPin] = useState('');
    const [adjustmentMessage, setAdjustmentMessage] = useState<{ ok: boolean; text: string } | null>(null);
  
  // Correction Mode Toggle
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);
    const canUseCorrection = currentUserRole === 'Admin';

  // Ensure Vendors never see the requests tab even if state drifts
  useEffect(() => {
      if (currentUserRole === 'Vendor' && activeTab === 'requests') {
          setActiveTab('manual');
      }
  }, [currentUserRole, activeTab]);

  useEffect(() => {
      if (!canUseCorrection && isCorrectionMode) {
          setIsCorrectionMode(false);
      }
  }, [canUseCorrection, isCorrectionMode]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return [];
    return customers.filter(c => c.phone?.includes(searchTerm));
  }, [customers, searchTerm]);
  
  const customerDepositHistory = useMemo(() => {
    if (!selectedCustomer) return [];
    return depositLogs.filter(log => log.customerId === selectedCustomer.id).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [depositLogs, selectedCustomer]);

  const pendingRequests = useMemo(() => {
      return depositRequests.filter(req => req.status === 'Pending').sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [depositRequests]);

  const fullHistory = useMemo(() => {
      let logs = [...depositLogs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      if (methodFilter !== 'All') {
          logs = logs.filter(log => log.method === methodFilter);
      }
      return logs;
  }, [depositLogs, methodFilter]);

  const trackingStats = useMemo(() => {
      const onlineApproved = (depositRequests || []).filter(req => req.status === 'Approved');
      const terminal = (depositLogs || []).filter(log => log.method === 'Cash');
      const corrections = (depositLogs || []).filter(log => log.method === 'Correction');
      return {
          onlineCount: onlineApproved.length,
          onlineAmount: onlineApproved.reduce((sum, req) => sum + Number(req.amount || 0), 0),
          terminalCount: terminal.length,
          terminalAmount: terminal.reduce((sum, log) => sum + Number(log.amount || 0), 0),
          correctionCount: corrections.length,
          correctionWalletImpact: corrections.reduce((sum, log) => sum + Number(log.amount || 0), 0),
          correctionBonusImpact: corrections.reduce((sum, log) => sum + Number(log.bonusAdjustment || 0), 0)
      };
  }, [depositLogs, depositRequests]);

  const onlineRequestAudit = useMemo(() => {
      return (depositRequests || [])
          .slice()
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 20);
  }, [depositRequests]);

  const correctionRisk = useMemo(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      const recent = (depositLogs || []).filter(log => log.method === 'Correction' && log.timestamp.getTime() >= cutoff);
      const walletAbs = recent.reduce((sum, log) => sum + Math.abs(Number(log.amount || 0)), 0);
      const bonusAbs = recent.reduce((sum, log) => sum + Math.abs(Number(log.bonusAdjustment || 0)), 0);
      const isHigh = recent.length >= 5 || walletAbs >= 5000 || bonusAbs >= 3000;
      return { count: recent.length, walletAbs, bonusAbs, isHigh };
  }, [depositLogs]);

    const getMethodLabel = (method: DepositLog['method'] | DepositRequest['method']) => {
            if (method === 'Cash') return 'Manual Cash (Vendor/Desk)';
            if (method === 'Correction') return 'Correction (Admin)';
            return method;
    };

  const trackingCustomer = useMemo(
      () => (customers || []).find(c => c.id === trackingCustomerId) || null,
      [customers, trackingCustomerId]
  );

  useEffect(() => {
      if (selectedCustomer) {
          const updatedCustomer = customers.find(c => c.id === selectedCustomer.id);
          if (updatedCustomer) {
              setSelectedCustomer(updatedCustomer);
          }
      }
  }, [customers, selectedCustomer?.id]);


    const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    const numericAmount = Number(amount);

        if (isCorrectionMode && !canUseCorrection) {
            setSuccessMessage('Error: only Admin can remove money from customer wallet.');
            return;
        }
    
    if (selectedCustomer && numericAmount > 0) {
      // If correction mode, flip amount to negative and set method to 'Correction'
      const finalAmount = isCorrectionMode ? -numericAmount : numericAmount;
      const method = isCorrectionMode ? 'Correction' : 'Cash';

    const result = await onDeposit(selectedCustomer.id, finalAmount, method);
      
      if (result.success) {
        let message = '';
        if (isCorrectionMode) {
            message = `Correction Applied: ${numericAmount.toFixed(2)} GMD debited from account.`;
        } else {
            message = `Successfully deposited ${numericAmount.toFixed(2)} GMD.`;
            if(result.bonusApplied) {
                message += ` A bonus of ${result.bonusApplied.toFixed(2)} GMD was applied!`;
            }
        }
        setSuccessMessage(message);
        setAmount('');
      } else {
          if(isCorrectionMode) {
              setSuccessMessage("Error: Insufficient funds for this debit operation.");
          }
      }
    }
  };
  
  const selectCustomer = (customer: User) => {
      setSelectedCustomer(customer);
      setSearchTerm(customer.phone ?? '');
      setSuccessMessage('');
  }

  const handleBalanceAdjustment = async (e: React.FormEvent) => {
      e.preventDefault();
      setAdjustmentMessage(null);
      if (currentUserRole !== 'Admin') {
          setAdjustmentMessage({ ok: false, text: 'Only admin can adjust wallet/bonus.' });
          return;
      }
      if (!trackingCustomerId || !onAdminAdjustBalance) {
          setAdjustmentMessage({ ok: false, text: 'Select customer first.' });
          return;
      }

      const walletDelta = walletAdjustment === '' ? 0 : Number(walletAdjustment);
      const bonusDelta = bonusAdjustment === '' ? 0 : Number(bonusAdjustment);
      if (!Number.isFinite(walletDelta) || !Number.isFinite(bonusDelta)) {
          setAdjustmentMessage({ ok: false, text: 'Invalid wallet/bonus values.' });
          return;
      }
      if (walletDelta === 0 && bonusDelta === 0) {
          setAdjustmentMessage({ ok: false, text: 'Enter wallet or bonus adjustment.' });
          return;
      }

      const result = await onAdminAdjustBalance(trackingCustomerId, walletDelta, bonusDelta, adjustmentNote.trim(), approvalPin);
      if (!result.success) {
          setAdjustmentMessage({ ok: false, text: result.message });
          return;
      }

      setAdjustmentMessage({ ok: true, text: result.message });
      setWalletAdjustment('');
      setBonusAdjustment('');
      setAdjustmentNote('');
      setApprovalPin('');
  };

  const exportHistoryCsv = () => {
      const headers = ['Time', 'Customer', 'Amount', 'BonusAdjustment', 'Method', 'ProcessedBy', 'Note'];
      const escape = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
      const rows = fullHistory.map(log => [
          log.timestamp.toISOString(),
          log.customerName,
          Number(log.amount || 0).toFixed(2),
          Number(log.bonusAdjustment || 0).toFixed(2),
          log.method,
          log.processedByName,
          log.note || ''
      ]);
      const csv = [headers, ...rows].map(row => row.map(cell => escape(String(cell))).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deposit-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-betese-dark mb-4">Customer Deposits</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-700 uppercase">Online Total</p>
              <p className="text-lg font-black text-blue-900">{trackingStats.onlineAmount.toFixed(2)} GMD</p>
              <p className="text-xs text-blue-700">{trackingStats.onlineCount} approved</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-bold text-green-700 uppercase">Terminal Total</p>
              <p className="text-lg font-black text-green-900">{trackingStats.terminalAmount.toFixed(2)} GMD</p>
              <p className="text-xs text-green-700">{trackingStats.terminalCount} cash deposits</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-bold text-orange-700 uppercase">Corrections</p>
              <p className="text-sm font-black text-orange-900">Wallet {trackingStats.correctionWalletImpact >= 0 ? '+' : ''}{trackingStats.correctionWalletImpact.toFixed(2)} GMD</p>
              <p className="text-sm font-black text-orange-900">Bonus {trackingStats.correctionBonusImpact >= 0 ? '+' : ''}{trackingStats.correctionBonusImpact.toFixed(2)} GMD</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-bold text-red-700 uppercase">Pending Online</p>
              <p className="text-lg font-black text-red-900">{pendingRequests.length}</p>
              <p className="text-xs text-red-700">needs approval/reject</p>
          </div>
      </div>
      
      <div className="flex mb-4 border-b">
          {/* HIDE ONLINE REQUESTS FOR VENDORS */}
          {currentUserRole !== 'Vendor' && (
            <button 
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-2 text-center font-bold text-sm ${activeTab === 'requests' ? 'border-b-4 border-betese-green text-betese-green' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Online Requests {pendingRequests.length > 0 && <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs animate-pulse">{pendingRequests.length}</span>}
            </button>
          )}
          <button 
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 text-center font-bold text-sm ${activeTab === 'manual' ? 'border-b-4 border-betese-green text-betese-green' : 'text-gray-500 hover:text-gray-700'}`}
          >
              Manual Transaction (Cash)
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-center font-bold text-sm ${activeTab === 'history' ? 'border-b-4 border-betese-green text-betese-green' : 'text-gray-500 hover:text-gray-700'}`}
          >
              Transaction History
          </button>
      </div>

      {activeTab === 'requests' && currentUserRole !== 'Vendor' && (
          <div className="space-y-6 animate-fade-in">
              <div>
                  <h4 className="text-lg font-bold text-red-600 mb-3 flex items-center gap-2">
                      Action Required (Pending)
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-normal">{pendingRequests.length}</span>
                  </h4>
                  {pendingRequests.length === 0 ? (
                      <div className="text-center text-gray-500 py-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                          <p>✅ All caught up! No pending requests.</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          {pendingRequests.map(req => (
                                <div key={req.id} className={`p-4 border-l-8 rounded-r-lg shadow-sm bg-gray-50 border-gray-300`}>
                                    <p className="font-bold text-lg">{req.customerName}</p>
                                    <p className="text-sm flex items-center gap-1">Request: <span className="font-bold">{req.amount} GMD</span> via {req.method === 'AfriMoney' ? <AfriMoneyLogo height={16} /> : <span className="font-bold">{req.method}</span>}</p>
                                    <p className="text-xs text-gray-500">Phone: {req.transactionId}</p>
                                    <div className="flex gap-2 mt-3">
                                        {onApproveDepositRequest && <button onClick={() => onApproveDepositRequest(req.id)} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-green-700">Approve & Credit</button>}
                                        {onRejectDepositRequest && <button onClick={() => onRejectDepositRequest(req.id)} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-red-700">Reject</button>}
                                    </div>
                                </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'manual' && (
        <div className="space-y-4 animate-fade-in">
            {successMessage && <p className={`text-center text-sm p-3 rounded-md font-bold ${successMessage.includes('Error') ? 'bg-red-100 text-red-800' : (isCorrectionMode ? 'bg-red-50 text-red-800' : 'bg-green-100 text-green-800')}`}>{successMessage}</p>}
            
            <div>
                <label htmlFor="customer-search" className="block text-sm font-medium text-gray-700">Find Customer by Phone</label>
                <div className="relative">
                    <input
                        id="customer-search"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if(selectedCustomer) setSelectedCustomer(null);
                            setSuccessMessage('');
                        }}
                        placeholder="Enter phone number..."
                        className="w-full p-2 mt-1 border border-gray-300 rounded-md"
                    />
                    {searchTerm && !selectedCustomer && filteredCustomers.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                            {filteredCustomers.map(c => (
                                <li 
                                    key={c.id} 
                                    className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                                    onClick={() => selectCustomer(c)}
                                >
                                    <span className="font-bold">{c.name}</span> <span className="text-gray-500">({c.phone})</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {selectedCustomer && (
                <div className={`p-4 border-2 rounded-lg space-y-4 transition-colors ${isCorrectionMode ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-gray-600">Selected Customer:</p>
                            <p className="font-bold text-lg">{selectedCustomer.name}</p>
                            <p className="text-sm">Wallet Balance: <span className="font-bold">{selectedCustomer.walletBalance?.toFixed(2)} GMD</span></p>
                        </div>
                        
                        {/* MODE TOGGLE */}
                        <div className="flex bg-white rounded-lg border p-1 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setIsCorrectionMode(false)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!isCorrectionMode ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                + DEPOSIT
                            </button>
                            {canUseCorrection && (
                                <button
                                    type="button"
                                    onClick={() => setIsCorrectionMode(true)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isCorrectionMode ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                                >
                                    - CORRECTION (ADMIN)
                                </button>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleDeposit} className="flex gap-2">
                        <input 
                            type="number"
                            value={amount === '' ? '' : amount}
                            onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder={isCorrectionMode ? "Amount to Remove" : "Amount to Deposit"}
                            className={`flex-grow p-2 border rounded-md font-bold text-lg ${isCorrectionMode ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}`}
                            min="1"
                            step="0.01"
                            required
                        />
                        <button 
                            type="submit" 
                            className={`px-6 py-2 text-white font-bold rounded-lg shadow-md transition-transform active:scale-95 ${isCorrectionMode ? 'bg-red-600 hover:bg-red-700' : 'bg-betese-green hover:bg-green-700'}`}
                        >
                            {isCorrectionMode ? 'DEBIT ACCOUNT' : 'DEPOSIT CASH'}
                        </button>
                    </form>
                    
                    {isCorrectionMode && (
                        <p className="text-xs text-red-600 font-bold text-center animate-pulse">
                            ⚠️ Warning: This will deduct funds from the customer's wallet.
                        </p>
                    )}

                    <div>
                        <h4 className="text-sm font-semibold text-betese-dark mb-2">Recent History (This Customer)</h4>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 text-xs">
                            {customerDepositHistory.length > 0 ? customerDepositHistory.slice(0, 5).map(log => (
                            <div key={log.id} className="bg-white p-2 rounded-md border flex justify-between items-center">
                                <div>
                                    <span className={`font-bold ${log.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                        {log.amount > 0 ? '+' : ''}{log.amount.toFixed(2)} GMD
                                    </span>
                                    <span className="ml-2 text-gray-500">({getMethodLabel(log.method)})</span>
                                    {/* ADDED PROCESSOR NAME VISIBILITY HERE */}
                                    <span className="ml-2 text-xs text-blue-600 font-semibold">By: {log.processedByName}</span>
                                </div>
                                <span className="text-gray-400">{log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                            </div>
                            )) : (
                            <p className="text-gray-500 text-center">No deposit history.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-700 uppercase">Online Deposits</p>
                      <p className="text-xl font-black text-blue-900">{trackingStats.onlineAmount.toFixed(2)} GMD</p>
                      <p className="text-xs text-blue-700">{trackingStats.onlineCount} transactions</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-green-700 uppercase">Terminal Deposits</p>
                      <p className="text-xl font-black text-green-900">{trackingStats.terminalAmount.toFixed(2)} GMD</p>
                      <p className="text-xs text-green-700">{trackingStats.terminalCount} transactions</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-orange-700 uppercase">Corrections</p>
                      <p className="text-sm font-black text-orange-900">Wallet {trackingStats.correctionWalletImpact >= 0 ? '+' : ''}{trackingStats.correctionWalletImpact.toFixed(2)} GMD</p>
                      <p className="text-sm font-black text-orange-900">Bonus {trackingStats.correctionBonusImpact >= 0 ? '+' : ''}{trackingStats.correctionBonusImpact.toFixed(2)} GMD</p>
                      <p className="text-xs text-orange-700">{trackingStats.correctionCount} adjustments</p>
                  </div>
              </div>

              {correctionRisk.isHigh && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3">
                      <p className="text-sm font-black text-red-800 uppercase">Correction Risk Alert</p>
                      <p className="text-xs text-red-700">Last 24h: {correctionRisk.count} corrections | Wallet impact {correctionRisk.walletAbs.toFixed(2)} GMD | Bonus impact {correctionRisk.bonusAbs.toFixed(2)} GMD</p>
                  </div>
              )}

              {currentUserRole === 'Admin' && (
                  <form onSubmit={handleBalanceAdjustment} className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 space-y-3">
                      <h4 className="text-sm font-black text-yellow-800 uppercase">Tracking Box: Fix Wallet/Bonus</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Customer</label>
                              <select
                                  value={trackingCustomerId}
                                  onChange={(e) => setTrackingCustomerId(e.target.value)}
                                  className="w-full p-2 border rounded bg-white"
                                  required
                              >
                                  <option value="">Select customer</option>
                                  {(customers || []).map(c => (
                                      <option key={c.id} value={c.id}>{c.name} ({c.phone || c.id})</option>
                                  ))}
                              </select>
                              {trackingCustomer && (
                                  <p className="text-xs text-gray-600 mt-1">Current: Wallet {(trackingCustomer.walletBalance || 0).toFixed(2)} | Bonus {(trackingCustomer.bonusBalance || 0).toFixed(2)}</p>
                              )}
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Reason</label>
                              <input
                                  type="text"
                                  value={adjustmentNote}
                                  onChange={(e) => setAdjustmentNote(e.target.value)}
                                  placeholder="ex: wrong bonus fixed"
                                  className="w-full p-2 border rounded"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Approval PIN</label>
                              <input
                                  type="password"
                                  value={approvalPin}
                                  onChange={(e) => setApprovalPin(e.target.value)}
                                  placeholder="Admin PIN"
                                  className="w-full p-2 border rounded"
                                  required
                              />
                          </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Wallet Adjustment (+/-)</label>
                              <input
                                  type="number"
                                  step="0.01"
                                  value={walletAdjustment === '' ? '' : walletAdjustment}
                                  onChange={(e) => setWalletAdjustment(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full p-2 border rounded"
                                  placeholder="0.00"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-700 mb-1">Bonus Adjustment (+/-)</label>
                              <input
                                  type="number"
                                  step="0.01"
                                  value={bonusAdjustment === '' ? '' : bonusAdjustment}
                                  onChange={(e) => setBonusAdjustment(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full p-2 border rounded"
                                  placeholder="0.00"
                              />
                          </div>
                      </div>
                      <button type="submit" className="px-4 py-2 bg-yellow-600 text-white font-bold rounded hover:bg-yellow-700">Apply Fix</button>
                      {adjustmentMessage && <p className={`text-xs font-bold ${adjustmentMessage.ok ? 'text-green-700' : 'text-red-700'}`}>{adjustmentMessage.text}</p>}
                  </form>
              )}

              <div className="bg-white border rounded-lg p-3">
                  <h5 className="text-sm font-black text-gray-800 uppercase mb-1">Online Request Audit (Latest 20)</h5>
                  <p className="text-[11px] text-gray-500 mb-2">This table is online customer requests only (Wave/AfriMoney). Manual vendor deposits are tracked in Transaction History as Manual Cash.</p>
                  <TableScrollNavigator className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                          <thead className="bg-gray-100">
                              <tr>
                                  <th className="text-left px-2 py-1">Time</th>
                                  <th className="text-left px-2 py-1">Customer</th>
                                  <th className="text-right px-2 py-1">Amount</th>
                                  <th className="text-left px-2 py-1">Method</th>
                                  <th className="text-left px-2 py-1">Status</th>
                                  <th className="text-left px-2 py-1">Processed By</th>
                              </tr>
                          </thead>
                          <tbody>
                              {onlineRequestAudit.map(req => (
                                  <tr key={req.id} className="border-t">
                                      <td className="px-2 py-1 whitespace-nowrap">{req.timestamp.toLocaleString()}</td>
                                      <td className="px-2 py-1">{req.customerName}</td>
                                      <td className="px-2 py-1 text-right font-bold">{Number(req.amount || 0).toFixed(2)}</td>
                                      <td className="px-2 py-1">
                                          {req.method === 'AfriMoney' ? <AfriMoneyLogo height={14} /> : getMethodLabel(req.method)}
                                      </td>
                                      <td className="px-2 py-1">
                                          <span className={`px-2 py-0.5 rounded-full font-bold ${req.status === 'Approved' ? 'bg-green-100 text-green-700' : req.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                              {req.status}
                                          </span>
                                      </td>
                                      <td className="px-2 py-1">{req.processedByName || '-'}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </TableScrollNavigator>
              </div>

              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                                    <span className="text-sm font-bold text-gray-700">Filter Type:</span>
                                    <div className="flex items-center gap-2">
                                            <select 
                                                value={methodFilter} 
                                                onChange={(e) => setMethodFilter(e.target.value as any)}
                                                className="p-2 border rounded bg-white text-sm font-medium"
                                            >
                                                    <option value="All">All Types</option>
                                                    <option value="Cash">Cash Deposits</option>
                                                    <option value="Wave">Wave</option>
                                                    <option value="AfriMoney">AfriMoney</option>
                                                    <option value="Correction">Corrections (Debits)</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={exportHistoryCsv}
                                                className="px-3 py-2 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-800"
                                            >
                                                Export CSV
                                            </button>
                                    </div>
              </div>

              <TableScrollNavigator className="overflow-x-auto">
                  <table className="min-w-full bg-white text-sm">
                      <thead className="bg-gray-200">
                          <tr>
                              <th className="text-left py-2 px-3">Time</th>
                              <th className="text-left py-2 px-3">Customer</th>
                              <th className="text-right py-2 px-3">Amount</th>
                              <th className="text-right py-2 px-3">Bonus Adj</th>
                              <th className="text-left py-2 px-3">Method</th>
                              <th className="text-left py-2 px-3">Processed By</th>
                              <th className="text-left py-2 px-3">Note</th>
                          </tr>
                      </thead>
                      <tbody>
                          {fullHistory.map(log => (
                              <tr key={log.id} className="border-b hover:bg-gray-50">
                                  <td className="py-2 px-3 whitespace-nowrap text-xs">{log.timestamp.toLocaleString()}</td>
                                  <td className="py-2 px-3 font-medium">{log.customerName}</td>
                                  <td className={`py-2 px-3 text-right font-bold ${log.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>
                                      {log.amount.toFixed(2)} GMD
                                      {log.bonusAwarded ? <span className="block text-xs text-yellow-600 font-normal">+ {log.bonusAwarded} Bonus</span> : null}
                                  </td>
                                  <td className={`py-2 px-3 text-right font-bold ${Number(log.bonusAdjustment || 0) < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                                      {Number(log.bonusAdjustment || 0) === 0 ? '-' : `${Number(log.bonusAdjustment || 0) > 0 ? '+' : ''}${Number(log.bonusAdjustment || 0).toFixed(2)}`}
                                  </td>
                                  <td className="py-2 px-3">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${log.method === 'Correction' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                                          {getMethodLabel(log.method)}
                                      </span>
                                  </td>
                                  <td className="py-2 px-3 font-bold text-betese-dark">{log.processedByName}</td>
                                  <td className="py-2 px-3 text-xs text-gray-600">{log.note || '-'}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </TableScrollNavigator>
          </div>
      )}
    </div>
  );
};
