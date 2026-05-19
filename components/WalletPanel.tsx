
import React, { useEffect, useMemo, useState } from 'react';
import { User, WithdrawalRequest, DepositRequest, Ticket } from '../types';
import { useLanguage } from '../LanguageContext';
import { WithdrawalCodeModal } from './WithdrawalCodeModal';
import { normalizeGambiaPhone } from '../utils';
import { AfriMoneyLogo } from './AfriMoneyLogo';
import { WaveLogo } from './WaveLogo';

const WAVE_MERCHANT_URL = 'https://pay.wave.com/m/M_gm_W5puv7Atyy-N/c/gm/';

interface WalletPanelProps {
  user: User;
    onWithdrawalRequest: (amount: number) => Promise<WithdrawalRequest | null>;
  withdrawalRequests: WithdrawalRequest[];
  onWalletFlash: () => void;
  onDepositRequest: (amount: number, method: 'Wave' | 'AfriMoney', transactionId: string) => void;
  depositRequests: DepositRequest[];
    tickets: Ticket[];
  onCancelWithdrawal?: (requestId: string) => void; // New Prop
}

const getStatusChipStyle = (status: string) => {
    switch(status) {
        case 'Pending': return 'bg-yellow-200 text-yellow-800';
        case 'Approved':
        case 'Completed': return 'bg-green-200 text-green-800';
        case 'Rejected':
        case 'Canceled': return 'bg-gray-200 text-gray-700';
        default: return '';
    }
}

const getVerificationBadge = (request: DepositRequest) => {
    if (request.method !== 'Wave') return null;
    if (request.verificationStatus === 'PendingProviderConfirmation') {
        return <span className="inline-flex mt-1 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-700">Wave Pending Verification</span>;
    }
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

export const WalletPanel: React.FC<WalletPanelProps> = ({ user, onWithdrawalRequest, withdrawalRequests, onWalletFlash, onDepositRequest, depositRequests, tickets, onCancelWithdrawal }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  
  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [depositMethod, setDepositMethod] = useState<'Wave' | 'AfriMoney'>('Wave');
  const [depositPhone, setDepositPhone] = useState(''); // Renamed logic var, used to be txnId
  const [depositMessage, setDepositMessage] = useState('');
  const [lastDepositData, setLastDepositData] = useState<{amount: number, method: string, phone: string} | null>(null);
    const [waveCheckoutOpen, setWaveCheckoutOpen] = useState(false);

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('');
  const [withdrawError, setWithdrawError] = useState('');
    const [latestWithdrawalRequest, setLatestWithdrawalRequest] = useState<WithdrawalRequest | null>(null);
  const { t } = useLanguage();

    const isMobileDevice = useMemo(() => {
            if (typeof navigator === 'undefined') return false;
            return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    }, []);

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

  const handleDepositSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setDepositMessage('');
      setLastDepositData(null);
      setWaveCheckoutOpen(false);

      if (typeof depositAmount !== 'number' || depositAmount <= 0) {
          setDepositMessage('Please enter a valid deposit amount.');
          return;
      }
      if (!depositPhone) {
          setDepositMessage('Please enter the phone number you sent the payment from.');
          return;
      }

      const normalizedSenderPhone = normalizeGambiaPhone(depositPhone);
      if (!normalizedSenderPhone) {
          setDepositMessage('Gambia: local 7 digits or +220XXXXXXX. Senegal: +221XXXXXXXXX only.');
          return;
      }
      
      // Passing phone number as transactionId for now as per requirements
      onDepositRequest(depositAmount, depositMethod, normalizedSenderPhone);
      
      setLastDepositData({ amount: depositAmount, method: depositMethod, phone: normalizedSenderPhone });
      setDepositMessage(
          depositMethod === 'Wave'
              ? 'Wave deposit request submitted. Your account will be credited once verified.'
              : t('success_deposit')
      );
      setDepositAmount('');
      setDepositPhone('');
  }

  const openWaveCheckout = () => {
      window.open(WAVE_MERCHANT_URL, '_blank', 'noopener,noreferrer');
  };

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
        const createdRequest = await onWithdrawalRequest(withdrawAmount);
        if (createdRequest) {
            setLatestWithdrawalRequest(createdRequest);
            setWithdrawAmount('');
        }
  };

  const openWhatsAppProof = () => {
      if (!lastDepositData) return;
      const supportNumber = "2204176003"; // Updated Number
      const text = `Hello Betese Support,\n\nI have submitted a deposit request.\nAmount: ${lastDepositData.amount} GMD\nMethod: ${lastDepositData.method}\nSender Phone: ${lastDepositData.phone}\nCustomer ID: ${user.id}\n\nPlease verify and credit my account.`;
      
      const url = `https://wa.me/${supportNumber}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
            {latestWithdrawalRequest && (
                <WithdrawalCodeModal
                    request={latestWithdrawalRequest}
                    onClose={() => setLatestWithdrawalRequest(null)}
                />
            )}
      {waveCheckoutOpen && lastDepositData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                  <div className="flex items-center justify-between gap-3 border-b pb-4 mb-4">
                      <div>
                          <p className="text-xs font-black uppercase tracking-widest text-blue-600">Wave Checkout</p>
                          <h4 className="text-2xl font-black text-betese-dark">Pay {lastDepositData.amount.toFixed(2)} GMD</h4>
                      </div>
                      <WaveLogo height={34} />
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                      On desktop, scan the QR code below. On phone, use the button to open Wave directly if the app is installed.
                  </p>
                  <div className="flex justify-center mb-4">
                      <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(WAVE_MERCHANT_URL)}`}
                          alt="Wave payment QR"
                          className="rounded-2xl border border-gray-200 shadow-lg bg-white p-2"
                      />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                          type="button"
                          onClick={openWaveCheckout}
                          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
                      >
                          {isMobileDevice ? 'Open Wave App' : 'Open Wave Page'}
                      </button>
                      <button
                          type="button"
                          onClick={() => setWaveCheckoutOpen(false)}
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-black text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                      >
                          Close
                      </button>
                  </div>
                  <p className="mt-4 text-xs text-gray-500 break-all">
                      Betese payment link: <a href={WAVE_MERCHANT_URL} target="_blank" rel="noreferrer" className="font-bold text-blue-600 underline">{WAVE_MERCHANT_URL}</a>
                  </p>
              </div>
          </div>
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
              <div className="bg-blue-50 p-4 rounded border border-blue-200 text-sm text-blue-800">
                  <p className="font-bold mb-2">{t('how_to_deposit')}</p>
                  
                  <div className="my-3 p-3 bg-white rounded border border-blue-100 text-center shadow-sm">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Wave Payment Link</p>
                        <p className="text-sm font-black text-betese-dark break-all px-2">{WAVE_MERCHANT_URL}</p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <p className="text-sm text-blue-700 font-bold">Desktop shows QR, phone opens Wave app</p>
                        </div>
                  </div>

                  <ol className="list-decimal pl-5 space-y-1">
                      <li>{t('deposit_step_1')}</li>
                      <li>{t('deposit_step_2')}</li>
                      <li>{t('deposit_step_3')}</li>
                  </ol>
              </div>

              {/* Wave pay button — opens Wave in a new tab so user stays in Betese */}
              {depositMethod === 'Wave' && (
                  <div className="rounded-2xl border-2 border-blue-400 bg-blue-50 p-4 flex flex-col items-center gap-3">
                      <p className="text-xs font-black uppercase tracking-widest text-blue-700">Step 1 — Pay with Wave first</p>
                      <button
                          type="button"
                          onClick={openWaveCheckout}
                          className="w-full flex items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-4 font-black text-white text-base shadow-lg hover:bg-blue-700 active:scale-95 transition-all border-b-4 border-blue-900"
                      >
                          <WaveLogo height={26} />
                          PAY WITH WAVE
                      </button>
                      <p className="text-[11px] text-blue-700 font-semibold text-center">
                          Tap the button — Wave opens in a new window.<br/>
                          Log in with <strong>your own Wave account</strong> and pay.<br/>
                          Then come back here and fill in the form below.
                      </p>
                      <p className="text-xs font-black uppercase tracking-widest text-blue-500 mt-1">Step 2 — Confirm your payment below</p>
                  </div>
              )}

              <form onSubmit={handleDepositSubmit} className="space-y-3">
                  <div>
                      <label className="block text-sm font-medium text-gray-700">{t('amount_sent')}</label>
                      <input 
                        type="number" 
                        value={depositAmount} 
                        onChange={e => setDepositAmount(e.target.value === '' ? '' : parseFloat(e.target.value))} 
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="e.g., 500"
                        required
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">{t('payment_method')}</label>
                      {/* Custom method picker — shows logos instead of plain text */}
                      <div className="flex gap-2 mt-1">
                          <button
                              type="button"
                              onClick={() => setDepositMethod('Wave')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border-2 transition-all ${depositMethod === 'Wave' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          >
                              <WaveLogo height={20} />
                          </button>
                          <button
                              type="button"
                              onClick={() => setDepositMethod('AfriMoney')}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md border-2 transition-all ${depositMethod === 'AfriMoney' ? 'border-purple-700 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                          >
                              <AfriMoneyLogo height={20} />
                          </button>
                      </div>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700">{t('sender_phone')}</label>
                      <input 
                        type="tel" 
                        value={depositPhone} 
                        onChange={e => setDepositPhone(e.target.value)} 
                        className="w-full p-2 border border-gray-300 rounded-md"
                                                placeholder="e.g., 7793854 or +2207793854 or +221773607354"
                        required
                      />
                  </div>
                  {depositMessage && (
                      <div className="bg-green-50 p-3 rounded border border-green-200">
                          <p className="text-sm text-green-700 font-bold mb-2">{depositMessage}</p>
                          {lastDepositData && (
                              <button 
                                type="button" 
                                onClick={openWhatsAppProof}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 transition-colors"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                  </svg>
                                  👉 Send Proof on WhatsApp
                              </button>
                          )}
                      </div>
                  )}
                  {!depositMessage && (
                    <button type="submit" className="w-full px-4 py-3 bg-betese-green text-white font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all">
                        {depositMethod === 'Wave' ? 'Confirm Wave Payment' : t('submit_deposit')}
                    </button>
                  )}
              </form>

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

      {activeTab === 'withdraw' && (
          <div className="space-y-6 animate-fade-in">
            <form onSubmit={handleWithdrawalSubmit} className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">{t('amount_to_withdraw')}</label>
                <input 
                    type="number"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="Enter amount"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    min="1"
                    step="any"
                    required
                />
                {withdrawError && <p className="text-sm text-red-500">{withdrawError}</p>}
                <button type="submit" className="w-full px-4 py-3 bg-yellow-500 text-betese-dark font-bold rounded-lg hover:bg-yellow-600">
                    {t('generate_code')}
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
                            <p className="text-xs text-gray-500 mt-1">Processed by: <strong>{req.processedByName}</strong></p>
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
