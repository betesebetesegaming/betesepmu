
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Race, Ticket, User, DepositLog, ChatMessage, ChatThread, BetSlip, BetTypeOption, BetSelection, WithdrawalRequest, DepositRequest, ManualBetOrder, RaceResult } from '../types';
import { TicketModal } from './TicketModal';
import { CustomerDepositPanel } from './CustomerDepositPanel';
import { BookingRetrievalPanel } from './BookingRetrievalPanel';
import { PayoutReportView } from './PayoutReportView';
import { RapportModal } from './RapportModal';
import { RaceResultsManagement } from './RaceResultsManagement';
import { ProcessWithdrawalPanel } from './ProcessWithdrawalPanel';
import { BetSlipPanel } from './BetSlipPanel';
import { HorseSelector } from './HorseSelector';
import { TicketCheckPanel } from './TicketCheckPanel';
import { TicketDetailsTable } from './TicketDetailsTable';
import { PendingManualBetsPanel } from './PendingManualBetsPanel';
import { RapportPrintPanel } from './RapportPrintPanel';
import RaceTimerButton from './RaceTimerButton';
import { BET_PRICING } from '../constants';
import { BETTING_CUTOFF_MS, triggerPrint } from '../utils';

interface BettingTerminalProps {
  races: Race[];
  betSlip: BetSlip;
  onUpdateBetSlip: (selection: Omit<BetSelection, 'cost' | 'multiplier'>) => void;
  onClearBetSlip: () => void;
  onInitiatePlaceBet: () => void;
  lastTicket: Ticket | null;
  onCloseTicket: () => void;
  onRemoveSelection: (index: number) => void;
  onUpdateSelectionMultiplier: (index: number, multiplier: number) => void;
  placedTickets: Ticket[];
  allTickets: Ticket[];
  onCancelTicket: (ticketId: string) => void;
  customers: User[];
  onDeposit: (customerId: string, amount: number, method: 'Cash' | 'Wave' | 'AfriMoney' | 'Correction', transactionId?: string) => { success: boolean; bonusApplied: number | null };
  onPayForBooking: (bookingCode: string) => { success: boolean; message: string };
  onProcessWithdrawal: (code: string) => boolean;
  depositLogs: DepositLog[];
  onPayoutTicket: (ticketId: string) => void;
  messages: ChatMessage[];
  threads: ChatThread[];
  onOpenChat: () => void;
  effectiveTime: Date;
  currentUser: User;
  withdrawalRequests: WithdrawalRequest[];
  onReprintTicket: (ticket: Ticket) => void;
  depositRequests: DepositRequest[];
  onApproveDepositRequest: (requestId: string) => void;
  onRejectDepositRequest: (requestId: string) => void;
  manualBetOrders: ManualBetOrder[];
  onProcessManualBet: (orderId: string) => void;
  onSaveRaceResult: (result: RaceResult) => void; 
}

type View = 'DASHBOARD' | 'PLACE_BET' | 'SCAN_PAY' | 'FINANCE' | 'SALES_REPORT' | 'RAPPORTS' | 'UPDATE_RESULTS' | 'MANUAL_BETS';

type MenuIconKind = 'horse' | 'money' | 'wallet' | 'history' | 'print' | 'results' | 'manual' | 'chat';

const MenuGraphic: React.FC<{ kind: MenuIconKind }> = ({ kind }) => {
    const photoMap: Record<MenuIconKind, { src: string; alt: string }> = {
        horse: { src: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=140&h=140&fit=crop&q=80', alt: 'horse race' },
        money: { src: 'https://images.unsplash.com/photo-1554672408-730436b60dde?w=140&h=140&fit=crop&q=80', alt: 'money payout' },
        wallet: { src: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=140&h=140&fit=crop&q=80', alt: 'wallet finance' },
        history: { src: 'https://images.unsplash.com/photo-1551281044-8b25b0b5c8ce?w=140&h=140&fit=crop&q=80', alt: 'history reports' },
        print: { src: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=140&h=140&fit=crop&q=80', alt: 'print reports' },
        results: { src: 'https://images.unsplash.com/photo-1567427017942-4bb5ac2a3b4b?w=140&h=140&fit=crop&q=80', alt: 'results trophy' },
        manual: { src: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=140&h=140&fit=crop&q=80', alt: 'manual office work' },
        chat: { src: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=140&h=140&fit=crop&q=80', alt: 'support chat' },
    };

    return (
        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/40 shadow-lg ring-2 ring-white/25">
            <img src={photoMap[kind].src} alt={photoMap[kind].alt} className="w-full h-full object-cover" loading="lazy" />
        </div>
    );
};

const MenuButton: React.FC<{ onClick: () => void, label: string, iconKind: MenuIconKind, color: string, subtext: string, count?: number }> = ({ onClick, label, iconKind, color, subtext, count }) => (
    <button 
        onClick={onClick}
        className={`${color} text-white p-4 rounded-2xl shadow-lg flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-b-4 border-black/20 hover:brightness-110 relative h-32 w-full`}
    >
        <MenuGraphic kind={iconKind} />
        <div className="text-center">
            <span className="text-lg font-black uppercase block leading-none">{label}</span>
            <span className="text-[10px] opacity-80 font-bold uppercase tracking-widest">{subtext}</span>
        </div>
        {count !== undefined && count > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-600 text-white w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-black text-xs animate-bounce shadow-lg">
                {count}
            </span>
        )}
    </button>
);

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button 
    onClick={onClick} 
    className="mb-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-gray-800 text-white font-black rounded-xl shadow-md active:scale-95 transition-all uppercase tracking-tighter"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
    Return to Menu
  </button>
);

export const BettingTerminal: React.FC<BettingTerminalProps> = (props) => {
    const { 
        races = [], 
        betSlip, 
        onUpdateBetSlip, 
        onClearBetSlip, 
        onInitiatePlaceBet, 
        onRemoveSelection, 
        onUpdateSelectionMultiplier,
        allTickets = [], 
        onPayForBooking, 
        customers = [], 
        onDeposit, 
        depositLogs = [], 
        placedTickets = [], 
        effectiveTime, 
        currentUser,
        lastTicket, 
        onCloseTicket, 
        onPayoutTicket, 
        onProcessWithdrawal, 
        withdrawalRequests = [], 
        onReprintTicket,
        depositRequests = [], 
        onApproveDepositRequest, 
        onRejectDepositRequest, 
        manualBetOrders = [], 
        onProcessManualBet,
        onSaveRaceResult,
        onOpenChat
    } = props;
    
    const [view, setView] = useState<View>('DASHBOARD');
    const [selectedRace, setSelectedRace] = useState<Race | null>(null);
    const [selectedBetType, setSelectedBetType] = useState<BetTypeOption | null>(null);
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [xCount, setXCount] = useState<number>(0);
    const [rapportModalRace, setRapportModalRace] = useState<Race | null>(null);

    const sortedRaces = useMemo(() => {
        if (!races || !Array.isArray(races)) return [];
        return [...races]
            .filter(r => r && r.endDate instanceof Date)
            .sort((a,b) => a.endDate.getTime() - b.endDate.getTime());
    }, [races]);

    const handleReturn = () => {
        onClearBetSlip();
        setSelectedNumbers([]);
        setXCount(0);
        setSelectedBetType(null);
        setView('DASHBOARD');
    };

    useEffect(() => {
        if (!selectedRace && sortedRaces.length > 0) {
            const next = sortedRaces.find(r => r.endDate > effectiveTime);
            if (next) setSelectedRace(next);
        }
    }, [sortedRaces, effectiveTime, selectedRace]);

    const timeRemaining = selectedRace ? selectedRace.endDate.getTime() - effectiveTime.getTime() : 0;
    const isBettingClosed = timeRemaining <= BETTING_CUTOFF_MS;

    const handleAddBet = useCallback(() => {
        if (!selectedRace || !selectedBetType) return;
        const pricing = BET_PRICING[selectedBetType];
        const totalSelected = selectedNumbers.length + xCount;
        if (totalSelected < pricing.minHorses) {
            alert(`INVALID: Select at least ${pricing.minHorses} horses.`);
            return;
        }
        if (isBettingClosed) {
            alert("CLOSED: 2-min cutoff reached.");
            return;
        }
        onUpdateBetSlip({ raceId: selectedRace.id, raceName: selectedRace.name, betType: selectedBetType, numbers: selectedNumbers, xCount: xCount, pattern: [] });
        setSelectedNumbers([]);
        setXCount(0);
        setSelectedBetType(null);
    }, [selectedRace, selectedBetType, selectedNumbers, xCount, onUpdateBetSlip, isBettingClosed]);

    const handlePrintDailyReport = () => {
        triggerPrint('printable-daily-sales-summary');
    };

    const pendingManualCount = (manualBetOrders || [])
        .filter(o => o && o.assignedVendorId === (currentUser?.id) && o.status === 'Pending').length;
    
    const pendingFinanceCount = ((depositRequests || []).filter(r => r && r.status === 'Pending').length) + 
                               ((withdrawalRequests || []).filter(r => r && r.status === 'Pending').length);

    // Totals for report calculation with safety
    const reportSales = (placedTickets || []).reduce((sum, t) => sum + (t?.totalCost || 0), 0);
    const reportPayouts = (placedTickets || [])
        .filter(t => t?.status === 'Paid')
        .reduce((sum, t) => sum + (t?.winnings || 0), 0);
    const reportNet = reportSales - reportPayouts;

    const renderView = () => {
        switch (view) {
            case 'PLACE_BET':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative">
                        <div className="lg:col-span-2 space-y-4">
                            {selectedRace && (
                                <div className={`sticky top-0 z-20 p-4 rounded-xl border-b-4 flex justify-between items-center shadow-lg transition-colors ${isBettingClosed ? 'bg-red-600 border-red-800 text-white' : 'bg-betese-green border-green-800 text-white'}`}>
                                    <div>
                                        <p className="text-[10px] font-black uppercase opacity-80 leading-none">Console - Active Race</p>
                                        <h4 className="text-2xl font-black uppercase">{selectedRace.name}</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase opacity-80">{isBettingClosed ? 'Status' : 'Remaining'}</p>
                                        <p className="text-4xl font-mono font-black leading-none">
                                            {isBettingClosed ? 'CLOSED' : `${Math.floor(timeRemaining / 60000).toString().padStart(2, '0')}:${Math.floor((timeRemaining % 60000) / 1000).toString().padStart(2, '0')}`}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-white p-4 rounded-xl shadow border-t-4 border-green-600">
                                <h3 className="font-black text-gray-800 uppercase mb-3 flex items-center gap-2">
                                    <span className="bg-green-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                    Select Race
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {sortedRaces.map(r => (
                                        <RaceTimerButton key={r.id} race={r} isSelected={selectedRace?.id === r.id} onClick={() => setSelectedRace(r)} initialEffectiveTime={effectiveTime} />
                                    ))}
                                </div>
                            </div>
                            {selectedRace && (
                                <div className="bg-white p-4 rounded-xl shadow border-t-4 border-blue-600">
                                    <h3 className="font-black text-gray-800 uppercase mb-3 flex items-center gap-2">
                                        <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                        Bet Type & Horses
                                    </h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                                        {Object.values(BetTypeOption).map(bt => (
                                            <button key={bt} onClick={() => setSelectedBetType(bt)} className={`p-3 rounded-lg text-xs font-black border-2 transition-all ${selectedBetType === bt ? 'bg-blue-600 text-white border-blue-800 shadow-inner' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
                                                {bt}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedBetType && <HorseSelector race={selectedRace} betType={selectedBetType} selectedNumbers={selectedNumbers} xCount={xCount} onNumberSelect={setSelectedNumbers} onXSelect={setXCount} />}
                                    <button onClick={handleAddBet} disabled={!selectedBetType || (selectedNumbers.length + xCount === 0) || isBettingClosed} className={`w-full mt-4 py-4 font-black rounded-xl shadow-lg active:scale-95 transition-all text-white ${isBettingClosed ? 'bg-gray-400 cursor-not-allowed' : 'bg-betese-dark hover:brightness-110'}`}>
                                        {isBettingClosed ? 'RACE CLOSED' : 'ADD TO SLIP'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <BetSlipPanel betSlip={betSlip} onClear={onClearBetSlip} onInitiatePlaceBet={onInitiatePlaceBet} onRemove={onRemoveSelection} onUpdateSelectionMultiplier={onUpdateSelectionMultiplier} />
                    </div>
                );
            case 'SCAN_PAY':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <TicketCheckPanel allTickets={allTickets} onPayoutTicket={onPayoutTicket} />
                        <BookingRetrievalPanel allTickets={allTickets} onPayForBooking={onPayForBooking} onPrintBookingSlip={onReprintTicket} races={races} effectiveTime={effectiveTime} />
                    </div>
                );
            case 'FINANCE':
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                        <CustomerDepositPanel customers={customers} onDeposit={onDeposit} depositLogs={depositLogs} currentUserRole={currentUser.role} depositRequests={depositRequests} onApproveDepositRequest={onApproveDepositRequest} onRejectDepositRequest={onRejectDepositRequest} />
                        <ProcessWithdrawalPanel onProcessWithdrawal={onProcessWithdrawal} withdrawalRequests={withdrawalRequests} customers={customers} />
                    </div>
                );
            case 'RAPPORTS':
                return (
                    <div className="animate-fade-in">
                        <RapportPrintPanel
                            races={races.filter(r => r.result).sort((a, b) => b.endDate.getTime() - a.endDate.getTime())}
                            onPrintRequest={(race) => setRapportModalRace(race)}
                        />
                    </div>
                );
            case 'UPDATE_RESULTS':
                return (
                    <div className="animate-fade-in">
                        <RaceResultsManagement
                            races={races}
                            tickets={allTickets}
                            effectiveTime={effectiveTime}
                            canEdit={false}
                        />
                    </div>
                );
            case 'MANUAL_BETS':
                return (
                    <div className="animate-fade-in">
                        <PendingManualBetsPanel
                            manualBetOrders={manualBetOrders}
                            currentUser={currentUser}
                            races={races}
                            onProcessManualBet={onProcessManualBet}
                        />
                    </div>
                );
            case 'SALES_REPORT':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-yellow-500">
                             <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-black uppercase text-gray-800">Terminal Log</h3>
                                <button 
                                    onClick={handlePrintDailyReport}
                                    className="px-6 py-3 bg-betese-green text-white font-black rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 border-b-4 border-black/20"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V12M10 20V8M16 20V5M22 20V10"/></svg> PRINT REPORT
                                </button>
                             </div>
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                                 <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Gross Sales</span><span className="block text-2xl font-black text-betese-green">GMD {reportSales.toFixed(0)}</span></div>
                                 <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Paid Out</span><span className="block text-2xl font-black text-blue-600">GMD {reportPayouts.toFixed(0)}</span></div>
                                 <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Vol.</span><span className="block text-2xl font-black text-gray-800">{placedTickets.length}</span></div>
                                 <div className="p-4 bg-gray-50 rounded-lg border text-center"><span className="text-[10px] font-black text-gray-500 uppercase">Net Profit</span><span className="block text-2xl font-black text-orange-600">GMD {reportNet.toFixed(0)}</span></div>
                             </div>
                             <TicketDetailsTable title="Full Transaction History" tickets={placedTickets} races={races} />
                        </div>
                    </div>
                );
            case 'DASHBOARD':
            default:
                const lastSavedTicket = placedTickets.length > 0 ? placedTickets[placedTickets.length - 1] : null;
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {lastSavedTicket && (
                                <div className="bg-yellow-100 border-l-8 border-yellow-500 p-4 rounded-r-2xl flex items-center justify-between animate-fade-in shadow-lg">
                                    <div><p className="text-[11px] font-black text-yellow-800 uppercase">Last Reference:</p><p className="font-mono font-black text-2xl text-gray-900 tracking-tight">#{lastSavedTicket.id}</p></div>
                                    <button onClick={() => onReprintTicket(lastSavedTicket)} className="px-6 py-4 bg-yellow-500 text-betese-dark font-black rounded-xl shadow hover:bg-yellow-600 active:scale-95 text-sm uppercase flex items-center gap-3 border-2 border-yellow-600"><svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="4" width="10" height="5"/><rect x="5" y="9" width="14" height="8" rx="2"/><rect x="8" y="14" width="8" height="6"/></svg> REPRINT</button>
                                </div>
                            )}
                            <div className="bg-betese-green/10 border-l-8 border-betese-green p-4 rounded-r-2xl flex items-center justify-between shadow-lg">
                                <div><p className="text-[11px] font-black text-betese-green uppercase">Shift Gross Total:</p><p className="font-black text-2xl text-gray-900 tracking-tight">GMD {reportSales.toFixed(0)}</p></div>
                                <button onClick={handlePrintDailyReport} className="px-6 py-4 bg-betese-green text-white font-black rounded-xl shadow hover:brightness-110 active:scale-95 text-sm uppercase flex items-center gap-2 border-b-4 border-black/20"><svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V12M10 20V8M16 20V5M22 20V10"/></svg> PRINT SALES</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 animate-fade-in">
                            <MenuButton onClick={() => setView('PLACE_BET')} label="Place Bet" subtext="New Ticket" iconKind="horse" color="bg-blue-600" />
                            <MenuButton onClick={() => setView('SCAN_PAY')} label="Scan/Pay" subtext="Payout" iconKind="money" color="bg-orange-600" />
                            <MenuButton onClick={() => setView('FINANCE')} label="Finance" subtext="Wallets" iconKind="wallet" color="bg-indigo-600" count={pendingFinanceCount} />
                            <MenuButton onClick={() => setView('SALES_REPORT')} label="History" subtext="Sales Log" iconKind="history" color="bg-gray-700" />
                            <MenuButton onClick={() => setView('RAPPORTS')} label="Rapport" subtext="Print Results" iconKind="print" color="bg-cyan-600" />
                            <MenuButton onClick={() => setView('UPDATE_RESULTS')} label="Results" subtext="View Only" iconKind="results" color="bg-red-600" />
                            <MenuButton onClick={() => setView('MANUAL_BETS')} label="Manual" subtext="Office" iconKind="manual" color="bg-emerald-600" count={pendingManualCount} />
                            <MenuButton onClick={() => onOpenChat()} label="Chat" subtext="Support" iconKind="chat" color="bg-purple-600" />
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-2">
            {rapportModalRace && <RapportModal race={rapportModalRace} onClose={() => setRapportModalRace(null)} showPrintButton={true} />}
            {view !== 'DASHBOARD' && <BackButton onClick={handleReturn} />}
            {renderView()}
            {lastTicket && <TicketModal ticket={lastTicket} onClose={onCloseTicket} showPrintButton={true} races={races} />}

            {/* 
               FINAL STABLE FIX: GHOST PERSISTENT CONTAINER
               Positioned absolute and far off-screen.
               Removed opacity:0 and used visibility:hidden to ensure the browser 
               keeps the text 'Live' in memory for the iframe printer.
            */}
            <div 
                id="printable-daily-sales-summary" 
                className="absolute top-0 left-[-5000px] pointer-events-none"
                style={{ visibility: 'hidden' }}
                aria-hidden="true"
            >
                <div className="c b text-lg border-b-2 border-black text-center pb-1 uppercase">BETESE DAILY SALES</div>
                <div className="flex b text-[10px] my-2 justify-between">
                    <span>VEND: {currentUser.name}</span>
                    <span>{effectiveTime.toLocaleDateString()}</span>
                </div>
                <div className="solid"></div>
                <div className="flex justify-between py-1 b"><span>TOTAL TICKETS:</span><span>{placedTickets.length}</span></div>
                <div className="flex justify-between py-1 b"><span>GROSS SALES:</span><span>GMD {reportSales.toFixed(0)}</span></div>
                <div className="flex justify-between py-1 b"><span>TOTAL PAID:</span><span>GMD {reportPayouts.toFixed(0)}</span></div>
                <div className="solid"></div>
                <div className="flex b my-2 justify-between items-center">
                    <span style={{fontSize:'12px'}}>CASH REVENUE:</span>
                    <span className="huge">GMD {reportNet.toFixed(0)}</span>
                </div>
                <div className="solid"></div>
                <p className="c b text-[9px] mt-4 uppercase">Official Terminal Report</p>
                <p className="c text-[8px] opacity-70 italic">Generated: {effectiveTime.toLocaleString()}</p>
            </div>
        </div>
    );
};
