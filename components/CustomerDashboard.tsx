
import React, { useState, useMemo, useEffect } from 'react';
import { BetSlip, Race, Ticket, BetSelection, User, WithdrawalRequest, Promotion, DepositRequest, ProgramImage } from '../types';
import { BetSlipPanel } from './BetSlipPanel';
import { TicketModal } from './TicketModal';
import { TicketHistoryPanel } from './TicketHistoryPanel';
import { WinningTicketModal } from './WinningTicketModal';
import { BookingCodeModal } from './BookingCodeModal';
import { WalletPanel } from './WalletPanel';
import { RaceResultsPanel } from './RaceResultsPanel';
import { RapportModal } from './RapportModal';
import { ProgramModal } from './ProgramModal';
import { PromotionCarousel } from './PromotionCarousel';
import { PromotionTicker } from './PromotionTicker';
import { PasswordChangePanel } from './PasswordChangePanel';
import { OfficialPayoutsPanel } from './AllBetsPricesPanel';
import { RulesModal } from './RulesModal';
import { useLanguage } from '../LanguageContext';
import { BETTING_CUTOFF_MS } from '../utils';
import { WhatsAppButton } from './WhatsAppButton';
import { BetSheet } from './BetSheet';
import { PaymentSheet } from './PaymentSheet';

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full text-center px-4 py-3 text-base sm:text-lg font-bold rounded-lg transition-all ${
            isActive
                ? 'bg-betese-green text-white shadow-md'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
    >
        {label}
    </button>
);

interface CustomerDashboardProps {
  user: User;
  races: Race[];
  betSlip: BetSlip;
  onUpdateBetSlip: (selection: Omit<BetSelection, 'cost' | 'multiplier'>) => void;
  onClearBetSlip: () => void;
  onInitiatePlaceBet: () => void;
  onInitiateBookBet: () => void; 
  lastTicket: Ticket | null;
  onCloseTicket: () => void;
  onRemoveSelection: (index: number) => void;
  onUpdateSelectionMultiplier: (index: number, multiplier: number) => void;
  placedTickets: Ticket[];
  onCancelTicket: (ticketId: string) => void;
  seenWinningTickets: Set<string>;
  onMarkWinningTicketAsSeen: (id: string) => void;
  onWithdrawalRequest: (amount: number) => Promise<WithdrawalRequest | null>;
  onMobileWithdrawal?: (amount: number, method: 'Wave' | 'AfriMoney', phone: string) => Promise<WithdrawalRequest | null>;
  withdrawalRequests: WithdrawalRequest[];
  onWalletFlash: () => void;
  programImages: ProgramImage[];
  promotions: Promotion[];
  onChangePassword: (userId: string, currentPassword: string, newPassword: string) => { success: boolean; message: string };
  effectiveTime: Date;
  onDepositRequest: (amount: number, method: 'Wave' | 'AfriMoney' | 'APS' | 'QMoney' | 'Card', phone: string, externalRef?: string) => void;
  depositRequests: DepositRequest[];
  onCancelWithdrawal?: (requestId: string) => void;
  isBettingInProgress?: boolean;
  externalOpenProgram?: boolean;
  onExternalProgramClose?: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  user,
  races,
  betSlip,
  onUpdateBetSlip,
  onClearBetSlip,
  onInitiatePlaceBet,
  onInitiateBookBet,
  lastTicket,
  onCloseTicket,
  onRemoveSelection,
  onUpdateSelectionMultiplier,
  placedTickets,
  onCancelTicket,
  seenWinningTickets,
  onMarkWinningTicketAsSeen,
  onWithdrawalRequest,
  onMobileWithdrawal,
  withdrawalRequests,
  onWalletFlash,
  programImages,
  promotions,
  onChangePassword,
  effectiveTime,
  onDepositRequest,
  depositRequests,
  onCancelWithdrawal,
  isBettingInProgress = false,
  externalOpenProgram,
  onExternalProgramClose,}) => {
  const [activeTab, setActiveTab] = useState<'bet' | 'history' | 'wallet' | 'info'>('bet');
  const [rapportModalRace, setRapportModalRace] = useState<Race | null>(null);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [showPromoTV, setShowPromoTV] = useState(true);
  const [isBetSheetOpen, setIsBetSheetOpen] = useState(false);
  const [betSheetInitialRaceId, setBetSheetInitialRaceId] = useState<string | null>(null);
  const [paymentSheetAmount, setPaymentSheetAmount] = useState<number | undefined>(undefined);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const { t } = useLanguage();

  // Sync external trigger (from Header PROGRAM button)
  useEffect(() => {
    if (externalOpenProgram) {
      setIsProgramModalOpen(true);
      onExternalProgramClose?.();
    }
  }, [externalOpenProgram]);

  const availableRaces = useMemo(
    () => [...races].filter(r => r.endDate > effectiveTime).sort((a,b) => a.endDate.getTime() - b.endDate.getTime()),
    [races, effectiveTime]
  );

  const winningTicketToShow = useMemo(() => {
      return (placedTickets || []).find(t => t.status === 'Winning' && !seenWinningTickets.has(t.id));
  }, [placedTickets, seenWinningTickets]);

  const latestResultedRace = useMemo(() => {
    return (races || [])
      .filter(r => r.result)
      .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())[0] || null;
  }, [races]);

  const programItems = useMemo(() => {
    return (programImages || []).filter((item) => {
      const typeValue = String((item as any)?.type || '').trim().toLowerCase();
      return typeValue === 'program' || typeValue.includes('prog');
    });
  }, [programImages]);

  const advertisementItems = useMemo(() => {
    return (programImages || []).filter((item) => {
      const typeValue = String((item as any)?.type || '').trim().toLowerCase();
      return typeValue === 'advertisement' || typeValue.includes('ad');
    });
  }, [programImages]);

  const nextRace = availableRaces[0] || null;
  const nextRaceTimeRemaining = nextRace ? nextRace.endDate.getTime() - effectiveTime.getTime() : 0;
  const nextRaceClosed = !nextRace || nextRaceTimeRemaining <= BETTING_CUTOFF_MS;

  const formatRaceCountdown = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const openBetSheet = (raceId?: string | null) => {
    setBetSheetInitialRaceId(raceId ?? null);
    setIsBetSheetOpen(true);
  };
  
  return (
    <div className="space-y-6">
      <WhatsAppButton />
      {/* Floating program button removed — PROGRAM button is now in the header */}
      {/* 100% Logic: Never show print for online customers to prevent fraud */}
      {lastTicket?.status === 'Booked' && lastTicket.bookingCode && (
        <BookingCodeModal ticket={lastTicket} onClose={onCloseTicket} />
      )}
      {lastTicket && lastTicket.status !== 'Booked' && (
        <TicketModal ticket={lastTicket} onClose={onCloseTicket} showPrintButton={false} races={races} />
      )}
      {winningTicketToShow && <WinningTicketModal ticket={winningTicketToShow} onClose={() => onMarkWinningTicketAsSeen(winningTicketToShow.id)} />}
      {rapportModalRace && <RapportModal race={rapportModalRace} onClose={() => setRapportModalRace(null)} showPrintButton={false} />}
      <ProgramModal isOpen={isProgramModalOpen} onClose={() => setIsProgramModalOpen(false)} programImages={programItems} />
      <RulesModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} />
      {showPromoTV && <PromotionCarousel ads={advertisementItems} onClose={() => setShowPromoTV(false)} />}
      <PromotionTicker promotions={promotions} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-2 rounded-lg shadow-lg grid grid-cols-2 md:grid-cols-4 gap-2">
                <TabButton label={t('tab_place_bet')} isActive={activeTab === 'bet'} onClick={() => setActiveTab('bet')} />
                <TabButton label={t('tab_history')} isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />
                <TabButton label={t('tab_wallet')} isActive={activeTab === 'wallet'} onClick={() => setActiveTab('wallet')} />
                <TabButton label={t('tab_info')} isActive={activeTab === 'info'} onClick={() => setActiveTab('info')} />
            </div>

            {activeTab === 'bet' && (
              <div className="bg-white p-5 rounded-2xl shadow-lg relative space-y-4">
                  <button
                    onClick={() => setIsProgramModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black uppercase rounded-xl shadow-md transition-all text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    View Program
                    {programItems.length > 0 && (
                      <span className="bg-yellow-400 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {programItems.length} {programItems.length === 1 ? 'page' : 'pages'}
                      </span>
                    )}
                  </button>

                  {nextRace ? (
                    <div className={`rounded-2xl p-4 text-white shadow-md ${nextRaceClosed ? 'bg-red-600' : 'bg-betese-green'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase opacity-90 leading-none">Next Race</p>
                          <h4 className="text-2xl font-black leading-tight">{nextRace.name}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase opacity-90 leading-none">{nextRaceClosed ? 'Status' : 'Closes in'}</p>
                          <p className="text-3xl font-mono font-black leading-none">
                            {nextRaceClosed ? 'CLOSED' : formatRaceCountdown(nextRaceTimeRemaining)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl p-6 bg-gray-100 text-center text-gray-500 font-bold uppercase text-sm">
                      {t('no_races')}
                    </div>
                  )}

                  <button
                    onClick={() => openBetSheet(nextRace?.id ?? null)}
                    disabled={availableRaces.length === 0}
                    className="w-full py-5 bg-betese-green text-white font-black rounded-2xl shadow-xl hover:brightness-110 disabled:bg-gray-300 disabled:opacity-50 transition-all active:scale-95 text-xl uppercase tracking-widest flex items-center justify-center gap-3"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add More Bet
                  </button>

                  {availableRaces.length > 1 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Or pick a race directly</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableRaces.slice(0, 6).map((race) => {
                          const remaining = race.endDate.getTime() - effectiveTime.getTime();
                          const closed = remaining <= BETTING_CUTOFF_MS;
                          return (
                            <button
                              key={race.id}
                              onClick={() => openBetSheet(race.id)}
                              disabled={closed}
                              className={`text-left p-3 rounded-xl border-2 transition-all active:scale-95 ${
                                closed
                                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                  : 'border-gray-200 bg-white hover:border-betese-green'
                              }`}
                            >
                              <p className="text-[10px] font-black uppercase text-gray-400">Race</p>
                              <p className="text-sm font-black text-betese-dark truncate">{race.name}</p>
                              <p className="text-xs font-mono font-bold">{closed ? 'CLOSED' : formatRaceCountdown(remaining)}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            )}
            {activeTab === 'history' && <TicketHistoryPanel tickets={placedTickets} onCancelTicket={onCancelTicket} races={races} effectiveTime={effectiveTime} />}
            {activeTab === 'wallet' && (
                <div className="space-y-6">
                    <WalletPanel user={user} onWithdrawalRequest={onWithdrawalRequest} onMobileWithdrawal={onMobileWithdrawal} withdrawalRequests={withdrawalRequests} onWalletFlash={onWalletFlash} onDepositRequest={onDepositRequest} depositRequests={depositRequests.filter(r => r.customerId === user.id)} tickets={placedTickets} onCancelWithdrawal={onCancelWithdrawal} />
                    <PasswordChangePanel user={user} onChangePassword={onChangePassword} />
                </div>
            )}
             {activeTab === 'info' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                         <h3 className="text-xl font-bold text-betese-dark mb-4">{t('legal_compliance')}</h3>
                         <button onClick={() => setIsRulesModalOpen(true)} className="w-full py-4 bg-betese-green text-white font-black rounded-xl hover:bg-green-700 shadow-md">
                            {t('official_rules_link')}
                        </button>
                    </div>
                    <OfficialPayoutsPanel latestResultedRace={latestResultedRace} />
                </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            <BetSlipPanel
              betSlip={betSlip}
              onClear={onClearBetSlip}
              onInitiatePlaceBet={onInitiatePlaceBet}
              onInitiateBookBet={onInitiateBookBet}
              onRemove={onRemoveSelection}
              onUpdateSelectionMultiplier={onUpdateSelectionMultiplier}
              isPlacingBet={isBettingInProgress}
              availableBalance={(user.walletBalance ?? 0) + (user.bonusBalance ?? 0)}
              onAddMore={() => openBetSheet(nextRace?.id ?? null)}
              onTopUp={(amount) => {
                setPaymentSheetAmount(amount);
                setIsPaymentSheetOpen(true);
              }}
            />
            <RaceResultsPanel races={races} onSelectRace={setRapportModalRace} effectiveTime={effectiveTime} />
          </div>
      </div>

      <BetSheet
        isOpen={isBetSheetOpen}
        onClose={() => setIsBetSheetOpen(false)}
        races={races}
        effectiveTime={effectiveTime}
        onAddToSlip={onUpdateBetSlip}
        initialRaceId={betSheetInitialRaceId}
        onPlaceBet={onInitiatePlaceBet}
      />

      <PaymentSheet
        isOpen={isPaymentSheetOpen}
        onClose={() => { setIsPaymentSheetOpen(false); setPaymentSheetAmount(undefined); }}
        user={user}
        initialAmount={paymentSheetAmount}
        onDepositRequest={onDepositRequest}
      />
    </div>
  );
};
