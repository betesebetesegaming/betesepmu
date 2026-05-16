
import React, { useState, useMemo, useEffect } from 'react';
import { BetSlip, BetTypeOption, Race, Ticket, BetSelection, User, WithdrawalRequest, Promotion, DepositRequest, ProgramImage } from '../types';
import { BetSlipPanel } from './BetSlipPanel';
import { HorseSelector } from './HorseSelector';
import { TicketModal } from './TicketModal';
import { BET_PRICING } from '../constants';
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
import RaceTimerButton from './RaceTimerButton';
import { RulesModal } from './RulesModal';
import { useLanguage } from '../LanguageContext';
import { BETTING_CUTOFF_MS } from '../utils';
import { WhatsAppButton } from './WhatsAppButton';

const Icon: React.FC<{ name: string }> = ({ name }) => {
    const icons: { [key: string]: React.ReactNode } = {
        'Simple Gagnant': <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=64&h=64&fit=crop&q=80" alt="Win" className="w-7 h-7 rounded-full object-cover border-2 border-yellow-400" />,
        'Simple Placé': <img src="https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=64&h=64&fit=crop&q=80" alt="Place" className="w-7 h-7 rounded-full object-cover border-2 border-blue-400" />,
        'Couplé Gagnant': <img src="https://images.unsplash.com/photo-1530651788726-1dbf58eeef1f?w=64&h=64&fit=crop&q=80" alt="Exacta" className="w-7 h-7 rounded-full object-cover border-2 border-green-400" />,
        'Couplé Placé': <img src="https://images.unsplash.com/photo-1598974357801-cbca100e65d3?w=64&h=64&fit=crop&q=80" alt="Quinella" className="w-7 h-7 rounded-full object-cover border-2 border-purple-400" />,
        'Tiercé': <img src="https://images.unsplash.com/photo-1548535880-2b8e15c86e5e?w=64&h=64&fit=crop&q=80" alt="Trifecta" className="w-7 h-7 rounded-full object-cover border-2 border-orange-400" />,
        'Quarté+': <img src="https://images.unsplash.com/photo-1452378174528-d6fd5f5ad2da?w=64&h=64&fit=crop&q=80" alt="Superfecta" className="w-7 h-7 rounded-full object-cover border-2 border-red-400" />,
        'Quinté+': <img src="https://images.unsplash.com/photo-1467516116939-81dc148a39ce?w=64&h=64&fit=crop&q=80" alt="Pick5" className="w-7 h-7 rounded-full object-cover border-2 border-pink-400" />,
        'Multi 4': <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=64&h=64&fit=crop&q=80&crop=left" alt="Multi4" className="w-7 h-7 rounded-full object-cover border-2 border-teal-400" />,
        'Multi 5': <img src="https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=64&h=64&fit=crop&q=80&crop=right" alt="Multi5" className="w-7 h-7 rounded-full object-cover border-2 border-indigo-400" />,
        'Multi 6': <img src="https://images.unsplash.com/photo-1530651788726-1dbf58eeef1f?w=64&h=64&fit=crop&q=80&crop=top" alt="Multi6" className="w-7 h-7 rounded-full object-cover border-2 border-amber-400" />,
        'Multi 7': <img src="https://images.unsplash.com/photo-1598974357801-cbca100e65d3?w=64&h=64&fit=crop&q=80&crop=bottom" alt="Multi7" className="w-7 h-7 rounded-full object-cover border-2 border-lime-400" />,
    };
    return icons[name] || null;
}

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
  withdrawalRequests: WithdrawalRequest[];
  onWalletFlash: () => void;
  programImages: ProgramImage[];
  promotions: Promotion[];
  onChangePassword: (userId: string, currentPassword: string, newPassword: string) => { success: boolean; message: string };
  effectiveTime: Date;
  onDepositRequest: (amount: number, method: 'Wave' | 'AfriMoney', phone: string) => void;
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
  const [selectedRace, setSelectedRace] = useState<Race | null>(availableRaces[0] || null);
  const [selectedBetType, setSelectedBetType] = useState<BetTypeOption | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [xCount, setXCount] = useState<number>(0);
  const [pattern, setPattern] = useState<string[]>([]);

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
  
  useEffect(() => {
    if (!selectedRace && availableRaces.length > 0) {
      setSelectedRace(availableRaces[0]);
      return;
    }
    if (selectedRace && effectiveTime >= selectedRace.endDate) {
      setSelectedRace(availableRaces[0] || null);
    }
    }, [effectiveTime, selectedRace, availableRaces]);

  const timeRemaining = selectedRace ? selectedRace.endDate.getTime() - effectiveTime.getTime() : 0;
  const isBettingClosed = timeRemaining <= BETTING_CUTOFF_MS;

  const handleAddBet = () => {
    if (!selectedRace || !selectedBetType) {
      alert('Please select a race and a bet type.');
      return;
    }

    // STRICT MULTI VALIDATION
    const pricing = BET_PRICING[selectedBetType];
    const totalSelected = selectedNumbers.length + xCount;
    
    if (totalSelected < pricing.minHorses) {
        alert(`INVALID SELECTION: ${selectedBetType} requires at least ${pricing.minHorses} horses. You only have ${totalSelected}.`);
        return;
    }

    if (isBettingClosed) {
        alert("Betting for this race is CLOSED (2 min cutoff).");
        return;
    }

    onUpdateBetSlip({
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        betType: selectedBetType,
        numbers: selectedNumbers,
        xCount: xCount,
        pattern: pattern,
    });
    setSelectedNumbers([]);
    setXCount(0);
    setPattern([]);
    setSelectedBetType(null);
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
              <div className="bg-white p-6 rounded-lg shadow-lg relative">
                  {/* view_program button — always shown in bet tab */}
                  <button
                    onClick={() => setIsProgramModalOpen(true)}
                    className="w-full mb-5 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black uppercase rounded-xl shadow-md transition-all text-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    view_program
                    {programItems.length > 0 && (
                      <span className="bg-yellow-400 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {programItems.length} {programItems.length === 1 ? 'page' : 'pages'}
                      </span>
                    )}
                  </button>
                  {selectedRace && (
                    <div className={`sticky top-0 z-10 -mx-6 -mt-6 mb-6 p-4 border-b-4 flex justify-between items-center shadow-md transition-colors ${isBettingClosed ? 'bg-red-600 border-red-800 text-white' : 'bg-betese-green border-green-800 text-white'}`}>
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-80 leading-none">Racing Console</p>
                            <h4 className="text-xl font-black uppercase leading-none">{selectedRace.name}</h4>
                        </div>
                        <div className="text-right">
                             <p className="text-[10px] font-black uppercase opacity-80 leading-none">{isBettingClosed ? 'Status' : 'Betting Closes'}</p>
                             <p className="text-3xl font-mono font-black leading-none">
                                {isBettingClosed ? 'CLOSED' : `${Math.floor(timeRemaining / 60000).toString().padStart(2, '0')}:${Math.floor((timeRemaining % 60000) / 1000).toString().padStart(2, '0')}`}
                             </p>
                        </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-black uppercase mb-3 text-gray-700">{t('select_race')}</h3>
                    <div className="flex flex-wrap gap-3">
                        {availableRaces.map((race) => (
                            <RaceTimerButton
                                key={race.id}
                                race={race}
                                isSelected={selectedRace?.id === race.id}
                            onClick={(id) => setSelectedRace(availableRaces.find(r => r.id === id) || null)}
                                initialEffectiveTime={effectiveTime}
                                variant="customer"
                            />
                        ))}
                    </div>
                  </div>

                  {selectedRace && (
                      <>
                      <div className="mb-6">
                          <h3 className="text-lg font-black uppercase mb-3 text-gray-700">{t('select_bet_type')}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {Object.values(BetTypeOption).map((bt) => {
                              const isDisabled = selectedRace.disabledBetTypes?.includes(bt);
                              return (
                                  <button
                                      key={bt}
                                      onClick={() => { setSelectedBetType(bt); setSelectedNumbers([]); setXCount(0); setPattern([]); }}
                                      disabled={isDisabled}
                                      className={`relative p-3 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center h-20 gap-1 border-2 ${
                                          isDisabled 
                                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                              : (selectedBetType === bt ? 'bg-yellow-400 text-betese-dark border-betese-green shadow-lg scale-105' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-yellow-400 shadow-sm')
                                      }`}
                                  >
                                      <span className="text-xl"><Icon name={bt} /></span>
                                      <span>{bt}</span>
                                  </button>
                              );
                          })}
                          </div>
                      </div>

                      {selectedBetType && (
                          <HorseSelector
                              race={selectedRace}
                              betType={selectedBetType}
                              selectedNumbers={selectedNumbers}
                              xCount={xCount}
                              onNumberSelect={setSelectedNumbers}
                              onXSelect={setXCount}
                              onPatternChange={setPattern}
                              disabled={isBettingClosed}
                          />
                      )}
                      </>
                  )}

                  <div className="mt-8">
                      <button
                          onClick={handleAddBet}
                          disabled={!selectedRace || !selectedBetType || (selectedNumbers.length + xCount === 0) || isBettingClosed}
                          className="w-full py-5 bg-betese-green text-white font-black rounded-2xl shadow-xl hover:brightness-110 disabled:bg-gray-300 disabled:opacity-50 transition-all active:scale-95 text-xl uppercase tracking-widest"
                      >
                          {t('add_to_slip')}
                      </button>
                  </div>
              </div>
            )}
            {activeTab === 'history' && <TicketHistoryPanel tickets={placedTickets} onCancelTicket={onCancelTicket} races={races} effectiveTime={effectiveTime} />}
            {activeTab === 'wallet' && (
                <div className="space-y-6">
                    <WalletPanel user={user} onWithdrawalRequest={onWithdrawalRequest} withdrawalRequests={withdrawalRequests} onWalletFlash={onWalletFlash} onDepositRequest={onDepositRequest} depositRequests={depositRequests} tickets={placedTickets} onCancelWithdrawal={onCancelWithdrawal} />
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
            />
            <RaceResultsPanel races={races} onSelectRace={setRapportModalRace} effectiveTime={effectiveTime} />
          </div>
      </div>
    </div>
  );
};
