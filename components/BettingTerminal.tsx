
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
    onDeposit: (customerId: string, amount: number, method: 'Cash' | 'Wave' | 'AfriMoney' | 'Correction', transactionId?: string) => Promise<{ success: boolean; bonusApplied: number | null }>;
    onPayForBooking: (bookingCode: string) => Promise<{ success: boolean; message: string }>;
    onProcessWithdrawal: (code: string) => Promise<boolean>;
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
  onSaveRaceResult: (result: RaceResult) => Promise<boolean>; 
}

type View = 'DASHBOARD' | 'PLACE_BET' | 'SCAN_PAY' | 'FINANCE' | 'RAPPORTS' | 'UPDATE_RESULTS';

type MenuIconKind = 'horse' | 'money' | 'wallet' | 'history' | 'print' | 'results' | 'chat';

const MenuGraphic: React.FC<{ kind: MenuIconKind }> = ({ kind }) => {
    const photoMap: Record<MenuIconKind, { src: string; alt: string }> = {
        horse: { src: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=140&h=140&fit=crop&q=80', alt: 'horse race' },
        money: { src: 'https://images.unsplash.com/photo-1554672408-730436b60dde?w=140&h=140&fit=crop&q=80', alt: 'money payout' },
        wallet: { src: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=140&h=140&fit=crop&q=80', alt: 'wallet finance' },
        history: { src: 'https://images.unsplash.com/photo-1551281044-8b25b0b5c8ce?w=140&h=140&fit=crop&q=80', alt: 'history reports' },
        print: { src: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=140&h=140&fit=crop&q=80', alt: 'print reports' },
        results: { src: 'https://images.unsplash.com/photo-1567427017942-4bb5ac2a3b4b?w=140&h=140&fit=crop&q=80', alt: 'results trophy' },
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

    const availableRaces = useMemo(() => {
        if (!races || !Array.isArray(races)) return [];
        return [...races]
            .filter(r => r && r.endDate instanceof Date && r.endDate > effectiveTime)
            .sort((a,b) => a.endDate.getTime() - b.endDate.getTime());
    }, [races, effectiveTime]);

    const handleReturn = () => {
        onClearBetSlip();
        setSelectedNumbers([]);
        setXCount(0);
        setSelectedBetType(null);
        setView('DASHBOARD');
    };

    useEffect(() => {
        if (!selectedRace && availableRaces.length > 0) {
            setSelectedRace(availableRaces[0]);
            return;
        }
        if (selectedRace && selectedRace.endDate <= effectiveTime) {
            setSelectedRace(availableRaces[0] || null);
        }
    }, [availableRaces, effectiveTime, selectedRace]);

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
        onUpdateBetSlip({
            raceId: selectedRace.id,
            raceName: selectedRace.name,
            betType: selectedBetType,
            numbers: selectedNumbers,
            xCount: xCount,
            pattern: [...Array.from({ length: xCount }, () => 'X'), ...selectedNumbers.map(n => String(n))]
        });
        setSelectedNumbers([]);
        setXCount(0);
        setSelectedBetType(null);
    }, [selectedRace, selectedBetType, selectedNumbers, xCount, onUpdateBetSlip, isBettingClosed]);

    const handlePrintDailyReport = () => {
        triggerPrint('printable-daily-sales-summary');
    };

    const handlePrintEndOfSale = () => {
        triggerPrint('printable-end-of-sale');
    };

    const handleShareEndOfSaleWhatsApp = () => {
        const supportNumber = '2204176003';
        const text =
            `END OF SALE REPORT\n` +
            `Vendor: ${currentUser.name}\n` +
            `Date: ${effectiveTime.toLocaleDateString()}\n` +
            `------------------\n` +
            `Tickets Sold : ${placedTickets.length}\n` +
            `Ticket Sales : GMD ${reportTicketSales.toFixed(0)}\n` +
            `Online Sales : GMD ${reportOnlineSales.toFixed(0)}\n` +
            `Total Sales  : GMD ${reportSales.toFixed(0)}\n` +
            `Paid Out     : GMD ${reportPayouts.toFixed(0)}\n` +
            `------------------\n` +
            `Net Balance  : GMD ${reportNet.toFixed(0)}\n` +
            `------------------\n` +
            `Generated: ${effectiveTime.toLocaleString()}`;
        window.open(`https://wa.me/${supportNumber}?text=${encodeURIComponent(text)}`, '_blank');
    };

    // Last 3 tickets placed by this vendor — no time restriction, just most recent
    const recentDeletableTickets = [...placedTickets]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 3);

    const pendingFinanceCount = ((depositRequests || []).filter(r => r && r.status === 'Pending').length) + 
                               ((withdrawalRequests || []).filter(r => r && r.status === 'Pending').length);

    const toDayKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const reportDayKey = toDayKey(effectiveTime);

    const todaysVendorTickets = (placedTickets || []).filter((ticket) => {
        if (!ticket || ticket.status === 'Canceled' || ticket.status === 'Booked') return false;
        const ticketTime = ticket.timestamp instanceof Date ? ticket.timestamp : new Date(ticket.timestamp);
        return toDayKey(ticketTime) === reportDayKey;
    });

    const vendorOnlineDepositLogs = (depositLogs || []).filter(log => {
        if (!log || log.processedById !== currentUser.id || Number(log.amount || 0) <= 0 || log.method === 'Correction') return false;
        const logTime = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
        return toDayKey(logTime) === reportDayKey;
    });

    // Day-based totals for report calculation
    const reportTicketSales = todaysVendorTickets.reduce((sum, t) => sum + Number(t?.totalCost || 0), 0);
    const reportOnlineSales = vendorOnlineDepositLogs.reduce((sum, log) => sum + Number(log?.amount || 0), 0);
    const reportSales = reportTicketSales + reportOnlineSales;
    const reportPayouts = todaysVendorTickets
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
                                    {availableRaces.map(r => (
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
                        <TicketCheckPanel allTickets={allTickets} onPayoutTicket={onPayoutTicket} onCancelTicket={props.onCancelTicket} onReprintTicket={onReprintTicket} />
                        <BookingRetrievalPanel allTickets={allTickets} onPayForBooking={onPayForBooking} onPrintBookingSlip={onReprintTicket} races={races} effectiveTime={effectiveTime} />
                    </div>
                );
            case 'FINANCE':
                return (
                    <div className="space-y-6 animate-fade-in">

                        {/* ── VENDOR SALES SUMMARY ── */}
                        <div className="bg-white rounded-2xl shadow-xl border-t-4 border-betese-green overflow-hidden">
                            <div className="bg-betese-green px-6 py-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Vendor Sales Summary</p>
                                    <h3 className="text-xl font-black text-white uppercase">{currentUser.name}</h3>
                                </div>
                                <p className="text-white/80 text-sm font-bold">{effectiveTime.toLocaleDateString()}</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-200">
                                <div className="p-5 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ticket Sales</p>
                                    <p className="text-2xl font-black text-betese-green leading-none">GMD {reportTicketSales.toFixed(0)}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{todaysVendorTickets.length} ticket(s)</p>
                                </div>
                                <div className="p-5 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Online Sales</p>
                                    <p className="text-2xl font-black text-indigo-600 leading-none">GMD {reportOnlineSales.toFixed(0)}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{vendorOnlineDepositLogs.length} deposit(s)</p>
                                </div>
                                <div className="p-5 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Sales</p>
                                    <p className="text-2xl font-black text-betese-green leading-none">GMD {reportSales.toFixed(0)}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">tickets + online deposits</p>
                                </div>
                                <div className="p-5 text-center">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Paid Out</p>
                                    <p className="text-2xl font-black text-orange-500 leading-none">GMD {reportPayouts.toFixed(0)}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {placedTickets.filter(t => t.status === 'Paid').length} paid
                                    </p>
                                </div>
                                <div className="p-5 text-center col-span-2 md:col-span-4 border-t border-gray-200">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Net Balance</p>
                                    <p className={`text-2xl font-black leading-none ${reportNet >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                                        GMD {reportNet.toFixed(0)}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">(ticket sales + online sales) - payouts</p>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="border-t border-gray-100 px-5 py-4 flex flex-wrap gap-3">
                                <button
                                    onClick={handlePrintEndOfSale}
                                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-5 py-3 bg-betese-green text-white font-black rounded-xl shadow hover:brightness-110 active:scale-95 transition-all border-b-4 border-black/20 text-sm uppercase"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                                        <rect x="7" y="4" width="10" height="5"/><rect x="5" y="9" width="14" height="8" rx="2"/><rect x="8" y="14" width="8" height="6"/>
                                    </svg>
                                    Print End of Sale
                                </button>
                                <button
                                    onClick={handleShareEndOfSaleWhatsApp}
                                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white font-black rounded-xl shadow hover:brightness-110 active:scale-95 transition-all border-b-4 border-black/20 text-sm uppercase"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                                    </svg>
                                    Share on WhatsApp
                                </button>
                            </div>
                        </div>

                        {/* ── LAST 3 RECENT TICKETS ── */}
                        <div className="bg-white rounded-2xl shadow-xl border-t-4 border-red-500 overflow-hidden">
                            <div className="bg-red-500 px-6 py-3 flex items-center gap-3">
                                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                                <h3 className="text-base font-black text-white uppercase">Cancel Last 3 Tickets Placed</h3>
                            </div>
                            <div className="p-4">
                                {recentDeletableTickets.length === 0 ? (
                                    <p className="text-center text-gray-400 py-4 text-sm italic">No tickets placed yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {recentDeletableTickets.map(ticket => {
                                            // Only allow cancel while race is still running (before end time)
                                            const raceIds = Array.from(new Set(ticket.selections.map(s => s.raceId)));
                                            const raceStillRunning = raceIds.some(rId => {
                                                const race = races.find(r => r.id === rId);
                                                return race && race.endDate > effectiveTime;
                                            });
                                            const canCancel = (ticket.status === 'Active' || ticket.status === 'Booked') && raceStillRunning;
                                            const raceEnded = (ticket.status === 'Active' || ticket.status === 'Booked') && !raceStillRunning;
                                            return (
                                                <div key={ticket.id} className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-mono font-black text-sm text-gray-800 truncate">#{ticket.id}</p>
                                                        <p className="text-[11px] text-gray-500">
                                                            {ticket.timestamp.toLocaleDateString()} {ticket.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            {' · '}GMD {ticket.totalCost.toFixed(0)}
                                                        </p>
                                                        {raceEnded && (
                                                            <p className="text-[10px] text-red-500 font-black uppercase mt-0.5">Race ended — contact Admin to cancel</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                                            ticket.status === 'Paid' ? 'bg-purple-100 text-purple-700' :
                                                            ticket.status === 'Winning' ? 'bg-blue-100 text-blue-700' :
                                                            ticket.status === 'Lost' ? 'bg-red-100 text-red-600' :
                                                            ticket.status === 'Canceled' ? 'bg-gray-200 text-gray-500' :
                                                            'bg-green-100 text-green-700'
                                                        }`}>{ticket.status}</span>
                                                        {canCancel ? (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm(`Cancel ticket #${ticket.id}? This cannot be undone.`)) {
                                                                        props.onCancelTicket(ticket.id);
                                                                    }
                                                                }}
                                                                className="px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg hover:bg-red-700 active:scale-95 transition-all border-b-2 border-red-800"
                                                            >
                                                                Cancel
                                                            </button>
                                                        ) : (
                                                            <span className="px-4 py-2 bg-gray-200 text-gray-400 text-xs font-black rounded-lg cursor-not-allowed">Locked</span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── CUSTOMER DEPOSITS & WITHDRAWALS ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <CustomerDepositPanel customers={customers} onDeposit={onDeposit} depositLogs={depositLogs} currentUserRole={currentUser.role} depositRequests={depositRequests} onApproveDepositRequest={onApproveDepositRequest} onRejectDepositRequest={onRejectDepositRequest} />
                            <ProcessWithdrawalPanel onProcessWithdrawal={onProcessWithdrawal} withdrawalRequests={withdrawalRequests} customers={customers} />
                        </div>
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
                                <div>
                                    <p className="text-[11px] font-black text-betese-green uppercase">Shift Total Sales:</p>
                                    <p className="font-black text-2xl text-gray-900 tracking-tight">GMD {reportSales.toFixed(0)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">Ticket {reportTicketSales.toFixed(0)} + Online {reportOnlineSales.toFixed(0)}</p>
                                </div>
                                <button onClick={handlePrintDailyReport} className="px-6 py-4 bg-betese-green text-white font-black rounded-xl shadow hover:brightness-110 active:scale-95 text-sm uppercase flex items-center gap-2 border-b-4 border-black/20"><svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V12M10 20V8M16 20V5M22 20V10"/></svg> PRINT SALES</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 animate-fade-in">
                            <MenuButton onClick={() => setView('PLACE_BET')} label="Place Bet" subtext="New Ticket" iconKind="horse" color="bg-blue-600" />
                            <MenuButton onClick={() => setView('SCAN_PAY')} label="Scan/Pay" subtext="Payout" iconKind="money" color="bg-orange-600" />
                            <MenuButton onClick={() => setView('FINANCE')} label="Finance" subtext="Wallets" iconKind="wallet" color="bg-indigo-600" count={pendingFinanceCount} />
                            <MenuButton onClick={() => setView('RAPPORTS')} label="Rapport" subtext="Print Results" iconKind="print" color="bg-cyan-600" />
                            <MenuButton onClick={() => setView('UPDATE_RESULTS')} label="Results" subtext="View Only" iconKind="results" color="bg-red-600" />
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
                <div className="flex justify-between py-1 b"><span>TICKET SALES:</span><span>GMD {reportTicketSales.toFixed(0)}</span></div>
                <div className="flex justify-between py-1 b"><span>ONLINE SALES:</span><span>GMD {reportOnlineSales.toFixed(0)}</span></div>
                <div className="flex justify-between py-1 b"><span>TOTAL SALES:</span><span>GMD {reportSales.toFixed(0)}</span></div>
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

            {/* END OF SALE printable */}
            <div
                id="printable-end-of-sale"
                className="absolute top-0 left-[-5000px] pointer-events-none"
                style={{ visibility: 'hidden' }}
                aria-hidden="true"
            >
                <div className="c b text-lg border-b-2 border-black text-center pb-1 uppercase">BETESE END OF SALE</div>
                <div className="flex b text-[10px] my-2 justify-between">
                    <span>VEND: {currentUser.name}</span>
                    <span>{effectiveTime.toLocaleDateString()}</span>
                </div>
                <div className="solid"></div>
                <div className="flex justify-between py-1 b"><span>TICKETS SOLD:</span><span>{placedTickets.length}</span></div>
                <div className="flex justify-between py-1 b"><span>TICKET SALES:</span><span>GMD {reportTicketSales.toFixed(0)}</span></div>
                <div className="flex justify-between py-1 b"><span>ONLINE SALES:</span><span>GMD {reportOnlineSales.toFixed(0)}</span></div>
                <div className="flex justify-between py-1 b"><span>TOTAL SALES:</span><span>GMD {reportSales.toFixed(0)}</span></div>
                <div className="flex justify-between py-1 b"><span>PAID OUT:</span><span>GMD {reportPayouts.toFixed(0)}</span></div>
                <div className="solid"></div>
                <div className="flex b my-2 justify-between items-center">
                    <span style={{fontSize:'12px'}}>NET BALANCE:</span>
                    <span className="huge">GMD {reportNet.toFixed(0)}</span>
                </div>
                <div className="solid"></div>
                <p className="c b text-[9px] mt-4 uppercase">Official End of Sale Report</p>
                <p className="c text-[8px] opacity-70 italic">Time: {effectiveTime.toLocaleString()}</p>
            </div>
        </div>
    );
};
