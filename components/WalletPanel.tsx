
import React, { useEffect, useMemo, useState } from 'react';
import { User, WithdrawalRequest, DepositRequest, Ticket } from '../types';
import { useLanguage } from '../LanguageContext';
import { WithdrawalCodeModal } from './WithdrawalCodeModal';
import { PaymentSheet } from './PaymentSheet';
import { Smartphone, Hash, Phone, Banknote, ArrowDownToLine, Loader2, AlertCircle } from 'lucide-react';

const WAVE_LOGO = '/payment-logos/wave.png';
const AFRIMONEY_LOGO = '/payment-logos/afrimoney.png';

interface WalletPanelProps {
  user: User;
    onWithdrawalRequest: (amount: number) => Promise<WithdrawalRequest | null>;
  onMobileWithdrawal?: (amount: number, method: 'Wave' | 'AfriMoney', phone: string) => Promise<WithdrawalRequest | null>;
  withdrawalRequests: WithdrawalRequest[];
  onWalletFlash: () => void;
  onDepositRequest: (amount: number, method: 'Wave' | 'AfriMoney' | 'APS' | 'QMoney' | 'Card', transactionId: string, externalRef?: string) => void;
  depositRequests: DepositRequest[];
    tickets: Ticket[];
  onCancelWithdrawal?: (requestId: string) => void; // New Prop
}

const getStatusChipStyle = (status: string) => {
    switch(status) {
        case 'Pending': return 'bg-yellow-200 text-yellow-800';
        case 'Processing': return 'bg-blue-200 text-blue-800';
        case 'Approved':
        case 'Completed': return 'bg-green-200 text-green-800';
        case 'Failed': return 'bg-red-200 text-red-800';
        case 'Rejected': return 'bg-red-200 text-red-800';
        case 'Canceled': return 'bg-gray-200 text-gray-700';
        default: return '';
    }
}

const getVerificationBadge = (request: DepositRequest) => {
    if (request.verificationStatus === 'PendingProviderConfirmation') {
        return <span className="inline-flex mt-1 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">{request.method} — waiting for payment</span>;
    }
    if (request.method !== 'Wave') return null;
    if (request.verificationStatus === 'Verified' && (request.processedBy === 'SYSTEM' || request.processedByName === 'Wave Direct Deposit')) {
        return <span className="inline-flex mt-1 items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-blue-700">Wave Direct - Instant Credit</span>;
    }
    if (request.verificationStatus === 'Verified') {
        return <span className="inline-flex mt-1 items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-green-700">Wave Verified</span>;
    }
    if (request.verificationStatus === 'VerificationFailed') {
        return <span className="inline-flex mt-1 items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-700">Wave Verification Failed</span>;
    }
    return null;
};

export const WalletPanel: React.FC<WalletPanelProps> = ({ user, onWithdrawalRequest, onMobileWithdrawal, withdrawalRequests, onWalletFlash, onDepositRequest, depositRequests, tickets, onCancelWithdrawal }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Payment sheet
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);

  // Withdrawal Form State
  const [withdrawMode, setWithdrawMode] = useState<'cash' | 'mobile'>('mobile');
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('');
  const [withdrawPhone, setWithdrawPhone] = useState(user.phone?.replace(/^\+220/, '') || '');
  const [withdrawMethod, setWithdrawMethod] = useState<'Wave' | 'AfriMoney'>('Wave');
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
    const [latestWithdrawalRequest, setLatestWithdrawalRequest] = useState<WithdrawalRequest | null>(null);
  const { t } = useLanguage();

    useEffect(() => {
        if (!latestWithdrawalRequest) return;
        const timer = window.setTimeout(() => setLatestWithdrawalRequest(null), 8000);
        return () => window.clearTimeout(timer);
    }, [latestWithdrawalRequest]);

    const actualBalance = Number(user.walletBalance || 0);
    const bonusBalance = Number(user.bonusBalance || 0);
    const pendingWinningMoney = (tickets || [])
        .filter((ticket) => ticket.status === 'Winning')
        .reduce((sum, ticket) => sum + Number(ticket.winnings || 0), 0);
    const paidWinningMoney = (tickets || [])
        .filter((ticket) => ticket.status === 'Paid')
        .reduce((sum, ticket) => sum + Number(ticket.winnings || 0), 0);

    const bonusPlayTickets = useMemo(() => {
        return (tickets || []).filter(ticket => {
            if (ticket.status === 'Canceled' || ticket.status === 'Booked') return false;
            const firstSelection = ticket.selections?.[0];
            return Number(firstSelection?.bonusStakeAmount || 0) > 0;
        });
    }, [tickets]);

    const bonusUnlockProgress = useMemo(() => {
        const distinctRaceIds = new Set<string>();
        const raceDayMap = new Map<string, Set<string>>();

        bonusPlayTickets.forEach(ticket => {
            const ticketDay = ticket.timestamp.toISOString().slice(0, 10);
            const uniqueRaceIds = Array.from(new Set<string>(ticket.selections.map(selection => selection.raceId)));
            uniqueRaceIds.forEach(raceId => {
                distinctRaceIds.add(raceId);
                if (!raceDayMap.has(raceId)) raceDayMap.set(raceId, new Set<string>());
                raceDayMap.get(raceId)!.add(ticketDay);
            });
        });

        const sameRaceBestCount = Math.max(0, ...Array.from(raceDayMap.values()).map(days => days.size));
        return {
            distinctRaceCount: distinctRaceIds.size,
            sameRaceBestCount,
            optionAQualified: distinctRaceIds.size >= 3,
            optionBQualified: sameRaceBestCount >= 3,
        };
    }, [bonusPlayTickets]);

    const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    if (typeof withdrawAmount !== 'number' || withdrawAmount <= 0) {
      setWithdrawError('Please enter a valid amount.');
      return;
    }
    if (withdrawAmount > (user.walletBalance ?? 0)) {
        setWithdrawError('Withdrawal amount cannot exceed your available balance.');
        onWalletFlash();
        return;
    }

    setWithdrawBusy(true);
    try {
      if (withdrawMode === 'mobile' && onMobileWithdrawal) {
        const createdRequest = await onMobileWithdrawal(withdrawAmount, withdrawMethod, withdrawPhone);
        if (createdRequest) {
          if (createdRequest.status === 'Completed') {
            setLatestWithdrawalRequest(null);
            setWithdrawAmount('');
          } else {
            setLatestWithdrawalRequest(createdRequest);
            setWithdrawAmount('');
          }
        }
      } else {
        const createdRequest = await onWithdrawalRequest(withdrawAmount);
        if (createdRequest) {
            setLatestWithdrawalRequest(createdRequest);
            setWithdrawAmount('');
        }
      }
    } catch (err: unknown) {
      setWithdrawError(err instanceof Error ? err.message : 'Withdrawal failed. Please try again.');
    } finally {
      setWithdrawBusy(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
            {latestWithdrawalRequest && (
                <WithdrawalCodeModal
                    request={latestWithdrawalRequest}
                    onClose={() => setLatestWithdrawalRequest(null)}
                />
            )}
      <h3 className="text-xl font-bold text-betese-dark mb-4">{t('tab_wallet')}</h3>

            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p className="text-gray-700"><span className="font-black uppercase text-[11px] tracking-widest text-gray-500">Account ID:</span> <span className="font-bold">{user.id}</span></p>
                    <p className="text-gray-700"><span className="font-black uppercase text-[11px] tracking-widest text-gray-500">Owner ID:</span> <span className="font-bold">{user.createdById || 'Self-Registered'}</span></p>
                </div>
                {user.createdByName && (
                    <p className="mt-1 text-gray-600"><span className="font-black uppercase text-[11px] tracking-widest text-gray-500">Owner Name:</span> <span className="font-bold">{user.createdByName}</span></p>
                )}
            </div>
      
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs uppercase font-bold text-gray-600">Actual Money</p>
                    <p className="text-2xl font-black text-betese-green">{actualBalance.toFixed(2)} GMD</p>
                    <p className="text-xs text-gray-500 mt-1">Available for betting and withdrawal</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-xs uppercase font-bold text-gray-600">Bonus Wallet</p>
                    <p className="text-2xl font-black text-yellow-700">{bonusBalance.toFixed(2)} GMD</p>
                    <p className="text-xs text-gray-500 mt-1">Locked until bonus play rules are completed</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs uppercase font-bold text-gray-600">Winning Money (Pending)</p>
                    <p className="text-2xl font-black text-blue-700">{pendingWinningMoney.toFixed(2)} GMD</p>
                    <p className="text-xs text-gray-500 mt-1">Winning tickets not yet paid out</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-xs uppercase font-bold text-gray-600">Winning Paid</p>
                    <p className="text-2xl font-black text-purple-700">{paidWinningMoney.toFixed(2)} GMD</p>
                    <p className="text-xs text-gray-500 mt-1">Total winnings already credited/paid</p>
                </div>
                {bonusBalance > 0 && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 md:col-span-3 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-amber-800 uppercase">Welcome Bonus Unlock Progress</p>
                                <p className="text-xs text-amber-700 mt-1">Bonus bets unlock into your real wallet through either of the two paths below.</p>
                            </div>
                            <div className="px-3 py-2 rounded-xl bg-white border border-amber-200 text-right">
                                <p className="text-[10px] font-black text-gray-500 uppercase">Current Bonus</p>
                                <p className="text-lg font-black text-amber-700">{bonusBalance.toFixed(2)} GMD</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className={`rounded-xl border p-4 ${bonusUnlockProgress.optionAQualified ? 'bg-green-50 border-green-300' : 'bg-white border-amber-200'}`}>
                                <p className="text-sm font-black text-gray-800 uppercase">Option A: 3 Different Games</p>
                                <p className="text-xs text-gray-600 mt-1">Play bonus across 3 different races to unlock fast.</p>
                                <p className="mt-3 text-2xl font-black text-betese-dark">{Math.min(bonusUnlockProgress.distinctRaceCount, 3)}/3</p>
                                <p className={`text-xs font-bold mt-1 ${bonusUnlockProgress.optionAQualified ? 'text-green-700' : 'text-amber-700'}`}>
                                    {bonusUnlockProgress.optionAQualified ? 'Qualified: bonus should move to actual wallet.' : 'Not yet qualified'}
                                </p>
                            </div>

                            <div className={`rounded-xl border p-4 ${bonusUnlockProgress.optionBQualified ? 'bg-green-50 border-green-300' : 'bg-white border-amber-200'}`}>
                                <p className="text-sm font-black text-gray-800 uppercase">Option B: Same Game 3 Days</p>
                                <p className="text-xs text-gray-600 mt-1">Play one race with bonus on 3 different days.</p>
                                <p className="mt-3 text-2xl font-black text-betese-dark">{Math.min(bonusUnlockProgress.sameRaceBestCount, 3)}/3</p>
                                <p className={`text-xs font-bold mt-1 ${bonusUnlockProgress.optionBQualified ? 'text-green-700' : 'text-amber-700'}`}>
                                    {bonusUnlockProgress.optionBQualified ? 'Qualified: bonus should move to actual wallet.' : 'Not yet qualified'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl bg-white border border-amber-200 p-3">
                                <p className="font-black text-gray-800 uppercase mb-1">Strict Rule Summary</p>
                                <p className="text-gray-600">Fast unlock = play all 3 races once.</p>
                                <p className="text-gray-600">Slow unlock = play one race on 3 different days.</p>
                                <p className="text-gray-600">Repeating the same race 3 times in one day does not qualify.</p>
                            </div>
                            <div className="rounded-xl bg-white border border-amber-200 p-3">
                                <p className="font-black text-gray-800 uppercase mb-1">How Bonus Is Used</p>
                                <p className="text-gray-600">When you place a bet online, bonus money is used first before actual cash.</p>
                                <p className="text-gray-600">Winning from bonus-funded tickets stays in Bonus Wallet until one unlock path is completed.</p>
                            </div>
                        </div>
                    </div>
                )}
      </div>

      {/* Tabs */}
      <div className="flex mb-6 border-b">
          <button 
            onClick={() => setActiveTab('deposit')}
            className={`flex-1 py-2 text-center font-bold ${activeTab === 'deposit' ? 'border-b-4 border-betese-green text-betese-green' : 'text-gray-500 hover:text-gray-700'}`}
          >
              {t('deposit_funds')}
          </button>
          <button 
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-2 text-center font-bold ${activeTab === 'withdraw' ? 'border-b-4 border-betese-green text-betese-green' : 'text-gray-500 hover:text-gray-700'}`}
          >
              {t('withdraw_funds')}
          </button>
      </div>

      {activeTab === 'deposit' && (
          <div className="space-y-6 animate-fade-in">
              <div className="rounded-2xl border-2 border-betese-green bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-widest text-betese-green">Add money</p>
                  <h4 className="mt-1 text-xl font-black text-betese-dark">Top up with AfriMoney, Wave or APS</h4>
                  <p className="mt-2 text-sm text-gray-600">Choose your favourite payment method and we’ll credit your wallet as soon as the provider confirms.</p>

                  <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 bg-white rounded-xl p-2 shadow-inner border border-gray-200 overflow-hidden">
                          <img src={AFRIMONEY_LOGO} alt="AfriMoney" className="h-8 w-auto object-contain" />
                          <img src={WAVE_LOGO} alt="Wave" className="h-8 w-auto object-contain" />
                          <img src="/payment-logos/aps.svg" alt="APS Wallet" className="h-8 w-auto object-contain" />
                      </div>
                      <button
                          type="button"
                          onClick={() => setIsPaymentSheetOpen(true)}
                          className="px-5 py-3 rounded-xl bg-betese-green text-white font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all"
                      >
                          Top up
                      </button>
                  </div>
              </div>

              <div>
                  <h4 className="font-bold text-gray-700 mb-2">{t('deposit_history')}</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 text-sm">
                      {depositRequests.length > 0 ? depositRequests.map(req => (
                          <div key={req.id} className="p-3 border rounded bg-gray-50 flex justify-between items-center">
                              <div>
                                  <p className="font-bold">{req.amount.toFixed(2)} GMD <span className="text-xs font-normal text-gray-500">({req.method})</span></p>
                                  <p className="text-xs text-gray-500">Phone: {req.transactionId}</p>
                                  <p className="text-xs text-gray-400">{new Date(req.timestamp).toLocaleDateString()}</p>
                                  {getVerificationBadge(req)}
                              </div>
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusChipStyle(req.status)}`}>{req.status}</span>
                          </div>
                      )) : <p className="text-gray-500 italic">No deposit requests yet.</p>}
                  </div>
              </div>
          </div>
      )}

      <PaymentSheet
          isOpen={isPaymentSheetOpen}
          onClose={() => setIsPaymentSheetOpen(false)}
          user={user}
          onDepositRequest={onDepositRequest}
      />


      {activeTab === 'withdraw' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWithdrawMode('mobile')}
                className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl font-bold text-sm border-2 transition-all ${
                  withdrawMode === 'mobile'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'
                }`}
              >
                <Smartphone className={`w-6 h-6 ${withdrawMode === 'mobile' ? 'text-blue-700' : 'text-gray-400'}`} />
                <span>Mobile money</span>
                <div className="flex items-center justify-center gap-3 py-1">
                  <img src={WAVE_LOGO} alt="Wave" className="h-6 w-auto object-contain" />
                  <img src={AFRIMONEY_LOGO} alt="AfriMoney" className="h-6 w-auto object-contain" />
                </div>
              </button>
              <button
                type="button"
                onClick={() => setWithdrawMode('cash')}
                className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl font-bold text-sm border-2 transition-all ${
                  withdrawMode === 'cash'
                    ? 'border-gray-900 bg-gray-50 text-gray-900 shadow-md'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                <Hash className={`w-6 h-6 ${withdrawMode === 'cash' ? 'text-gray-900' : 'text-gray-400'}`} />
                <span>Withdrawal Code</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Collect cash at vendor</span>
              </button>
            </div>

            <div className={`rounded-xl border p-4 flex gap-3 ${
              withdrawMode === 'mobile' ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'
            }`}>
              {withdrawMode === 'mobile' ? (
                <ArrowDownToLine className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              ) : (
                <Banknote className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              )}
              <p className="text-sm text-gray-700">
                {withdrawMode === 'mobile'
                  ? 'Send funds directly to your Wave or AfriMoney wallet. Your balance is deducted immediately and refunded automatically if the transfer fails.'
                  : 'Generate a withdrawal code and collect cash from a vendor. Show the code when you arrive.'}
              </p>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Banknote className="w-4 h-4 text-gray-500" />
                    {t('amount_to_withdraw')}
                  </label>
                  <input 
                      type="number"
                      value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="Enter amount in GMD"
                      className="w-full p-3 border border-gray-300 rounded-xl"
                      min="1"
                      step="any"
                      required
                  />
                </div>

                {withdrawMode === 'mobile' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Choose network</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setWithdrawMethod('Wave')}
                          aria-label="Wave"
                          className={`flex items-center justify-center px-3 py-4 rounded-xl border-2 transition-all ${
                            withdrawMethod === 'Wave'
                              ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                              : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                        >
                          <img src={WAVE_LOGO} alt="Wave" className="h-9 w-auto object-contain" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithdrawMethod('AfriMoney')}
                          aria-label="AfriMoney"
                          className={`flex items-center justify-center px-3 py-4 rounded-xl border-2 transition-all ${
                            withdrawMethod === 'AfriMoney'
                              ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200'
                              : 'border-gray-200 bg-white hover:border-purple-300'
                          }`}
                        >
                          <img src={AFRIMONEY_LOGO} alt="AfriMoney" className="h-9 w-auto object-contain" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                        <Phone className="w-4 h-4 text-gray-500" />
                        Mobile money phone
                      </label>
                      <input
                        type="tel"
                        value={withdrawPhone}
                        onChange={e => setWithdrawPhone(e.target.value)}
                        placeholder="7-digit Gambian number"
                        className="w-full p-3 border border-gray-300 rounded-xl"
                        required
                      />
                    </div>
                  </>
                )}

                {withdrawError && (
                  <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{withdrawError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={withdrawBusy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 text-betese-dark font-bold rounded-xl hover:bg-yellow-600 disabled:opacity-60 transition-colors"
                >
                  {withdrawBusy ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing…
                    </>
                  ) : withdrawMode === 'mobile' ? (
                    <>
                      <img
                        src={withdrawMethod === 'Wave' ? WAVE_LOGO : AFRIMONEY_LOGO}
                        alt={withdrawMethod}
                        className="h-6 w-auto object-contain"
                      />
                      Withdraw
                    </>
                  ) : (
                    <>
                      <Hash className="w-5 h-5" />
                      {t('generate_code')}
                    </>
                  )}
                </button>
            </form>

            <div>
                <h4 className="text-lg font-semibold text-betese-dark mb-2">{t('withdrawal_history')}</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {withdrawalRequests.length > 0 ? withdrawalRequests.map(req => (
                        <div key={req.id} className="bg-gray-50 p-3 rounded-md text-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold">{req.amount.toFixed(2)} GMD</p>
                                    <p className="text-xs text-gray-500">{new Date(req.requestedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                                    {req.payoutMethod && req.payoutMethod !== 'Cash' && (
                                      <div className="mt-1">
                                        <img
                                          src={req.payoutMethod === 'Wave' ? WAVE_LOGO : AFRIMONEY_LOGO}
                                          alt={req.payoutMethod}
                                          className="h-4 w-auto object-contain"
                                        />
                                      </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusChipStyle(req.status)}`}>
                                        {req.status}
                                    </span>
                                    {/* Cancel Button: Only visible for Pending requests */}
                                    {req.status === 'Pending' && onCancelWithdrawal && (
                                        <button 
                                            onClick={() => onCancelWithdrawal(req.id)}
                                            className="px-2 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">Code: <span className="font-mono">{req.code}</span></p>
                            {req.status === 'Completed' && req.processedByName && (
                            <>
                                <p className="text-xs text-gray-500 mt-1">Processed by: <strong>{req.processedByName}</strong></p>
                                {String(req.processedByName).includes('[Wave') && (
                                    <p className="text-xs text-blue-700 font-bold mt-1">Winning paid by Wave ✓</p>
                                )}
                            </>
                            )}
                        </div>
                    )) : <p className="text-gray-500 text-sm">No withdrawal requests yet.</p>}
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
