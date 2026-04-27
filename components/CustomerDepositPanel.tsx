
import React, { useState, useMemo, useEffect } from 'react';
import { User, DepositLog, DepositRequest, Role } from '../types';

interface CustomerDepositPanelProps {
  customers: User[];
    onDeposit: (customerId: string, amount: number, method: 'Cash' | 'Wave' | 'AfriMoney' | 'Correction', transactionId?: string) => Promise<{ success: boolean; bonusApplied: number | null }>;
  depositLogs: DepositLog[];
  depositRequests?: DepositRequest[];
  onApproveDepositRequest?: (requestId: string) => void;
  onRejectDepositRequest?: (requestId: string) => void;
  currentUserRole: Role; // Added to control visibility
}

export const CustomerDepositPanel: React.FC<CustomerDepositPanelProps> = ({ customers, onDeposit, depositLogs, depositRequests = [], onApproveDepositRequest, onRejectDepositRequest, currentUserRole }) => {
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
  
  // Correction Mode Toggle
  const [isCorrectionMode, setIsCorrectionMode] = useState(false);

  // Ensure Vendors never see the requests tab even if state drifts
  useEffect(() => {
      if (currentUserRole === 'Vendor' && activeTab === 'requests') {
          setActiveTab('manual');
      }
  }, [currentUserRole, activeTab]);

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

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-betese-dark mb-4">Customer Deposits</h3>
      
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
                                    <p className="text-sm">Request: <span className="font-bold">{req.amount} GMD</span> via {req.method}</p>
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
                            <button
                                type="button"
                                onClick={() => setIsCorrectionMode(true)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${isCorrectionMode ? 'bg-red-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                - CORRECTION
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleDeposit} className="flex gap-2">
                        <input 
                            type="number"
                            value={amount}
                            onChange={e => setAmount(Number(e.target.value))}
                            placeholder={isCorrectionMode ? "Amount to Remove" : "Amount to Deposit"}
                            className={`flex-grow p-2 border rounded-md font-bold text-lg ${isCorrectionMode ? 'border-red-300 text-red-700' : 'border-green-300 text-green-700'}`}
                            min="1"
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
                                    <span className="ml-2 text-gray-500">({log.method})</span>
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
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                  <span className="text-sm font-bold text-gray-700">Filter Type:</span>
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
              </div>

              <div className="overflow-x-auto">
                  <table className="min-w-full bg-white text-sm">
                      <thead className="bg-gray-200">
                          <tr>
                              <th className="text-left py-2 px-3">Time</th>
                              <th className="text-left py-2 px-3">Customer</th>
                              <th className="text-right py-2 px-3">Amount</th>
                              <th className="text-left py-2 px-3">Method</th>
                              <th className="text-left py-2 px-3">Processed By</th>
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
                                  <td className="py-2 px-3">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${log.method === 'Correction' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                                          {log.method}
                                      </span>
                                  </td>
                                  <td className="py-2 px-3 font-bold text-betese-dark">{log.processedByName}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};
