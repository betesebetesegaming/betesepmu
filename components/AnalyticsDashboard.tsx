
import React, { useMemo, useState } from 'react';
import { Ticket, Race, BetTypeOption } from '../types';
import { calculateTicketWinnings } from '../utils';

interface AnalyticsDashboardProps {
  tickets: Ticket[];
  races: Race[];
}

interface BetTypePerformance {
    betsPlaced: number;
    totalStake: number;
    winningBets: number;
    winningSales: number;
    totalPayout: number;
}

interface RacePerformance {
    betsPlaced: number;
    ticketsCount: number;
    totalStake: number;
    winningBets: number;
    winningSales: number;
    totalPayout: number;
}

interface RacePerformanceCard {
    raceId: string;
    raceCode: string;
    raceName: string;
    scheduledTime: Date;
    isFinished: boolean;
    winningNumbersText: string;
    overall: RacePerformance;
    byBetType: Record<BetTypeOption, BetTypePerformance>;
}

interface CombinationLedgerRow {
    ticketId: string;
    actorName: string;
    stampTime: string;
    dateKey: string;
    raceId: string;
    raceName: string;
    betType: string;
    combination: string;
    stake: number;
    status: Ticket['status'];
    selectionStatus: 'Win' | 'Loss' | 'Pending';
    payout: number;
    winType?: string;
    winningCombinations?: number;
    winningCombinationText?: string;
    payoutCheck?: 'OK' | 'CHECK';
    paidByName?: string;
    paidById?: string;
}

interface GroupedLedgerRow {
    ticketId: string;
    actorName: string;
    stampTime: string;
    rows: CombinationLedgerRow[];
}

const normalizeDate = (value: Date | string | number | undefined): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tickets, races }) => {
    const [ledgerFilterAgent, setLedgerFilterAgent] = useState<string>('All');
    const [ledgerFilterDate, setLedgerFilterDate] = useState<string>('');
    const [ledgerFilterTicket, setLedgerFilterTicket] = useState<string>('');
    const [ledgerFilterStatus, setLedgerFilterStatus] = useState<Ticket['status'] | 'All'>('All');
    const [raceDateSearch, setRaceDateSearch] = useState<string>('');
    const [selectedRaceDate, setSelectedRaceDate] = useState<string>('');
    const [expandedRaceId, setExpandedRaceId] = useState<string | null>(null);
    
    const raceNameMap = useMemo(() => new Map(races.map(r => [r.id, r.name])), [races]);

    const createEmptyBetTypeStats = (): Record<BetTypeOption, BetTypePerformance> => {
        return Object.values(BetTypeOption).reduce((acc, betType) => {
            acc[betType] = { betsPlaced: 0, totalStake: 0, winningBets: 0, winningSales: 0, totalPayout: 0 };
            return acc;
        }, {} as Record<BetTypeOption, BetTypePerformance>);
    };

    const analyticsData = useMemo(() => {
        // Per-race and per-race-bet-type stats
        const raceTicketSet = new Map<string, Set<string>>();
        const byRaceBetType: Record<string, Record<BetTypeOption, BetTypePerformance>> = {};

        const byRace = tickets.reduce((stats, ticket) => {
             for (const selection of ticket.selections) {
                const raceId = selection.raceId;
                if (!stats[raceId]) {
                    stats[raceId] = { betsPlaced: 0, ticketsCount: 0, totalStake: 0, winningBets: 0, winningSales: 0, totalPayout: 0 };
                    raceTicketSet.set(raceId, new Set<string>());
                    byRaceBetType[raceId] = createEmptyBetTypeStats();
                }

                const selectionStake = selection.cost * selection.multiplier;
                const betTypeStats = byRaceBetType[raceId][selection.betType];
                const selectionIndex = ticket.selections.indexOf(selection);
                const matchedBreakdown = ticket.winningsBreakdown?.find((row) => row.selectionIndex === selectionIndex);
                const isSelectionWin = matchedBreakdown?.status === 'Win';

                stats[raceId].betsPlaced++;
                stats[raceId].totalStake += selectionStake;
                raceTicketSet.get(raceId)?.add(ticket.id);

                betTypeStats.betsPlaced++;
                betTypeStats.totalStake += selectionStake;
                
                if (isSelectionWin) {
                    stats[raceId].winningBets++;
                    stats[raceId].winningSales += selectionStake;
                    betTypeStats.winningBets++;
                    betTypeStats.winningSales += selectionStake;
                    let selectionPayout = 0;
                    if (matchedBreakdown?.totalPayout) {
                        selectionPayout = matchedBreakdown.totalPayout;
                    } else if (ticket.totalCost > 0) {
                        selectionPayout = (selectionStake / ticket.totalCost) * (ticket.winnings ?? 0);
                    }
                    stats[raceId].totalPayout += selectionPayout;
                    betTypeStats.totalPayout += selectionPayout;
                }
            }
            return stats;
        }, {} as Record<string, RacePerformance>);

        Object.entries(byRace).forEach(([raceId, stats]) => {
            stats.ticketsCount = raceTicketSet.get(raceId)?.size || 0;
        });

        const combinationLedger: CombinationLedgerRow[] = tickets.flatMap((ticket) => {
            // Always recompute with current race results to avoid stale DB breakdown/status.
            const recalculated = calculateTicketWinnings(ticket, races);
            return ticket.selections.map((selection, index) => {
                const matchedBreakdown = recalculated.breakdown?.find((row) => row.selectionIndex === index)
                    || ticket.winningsBreakdown?.find((row) => row.selectionIndex === index);
                const winBreakdown = matchedBreakdown?.status === 'Win' ? matchedBreakdown : undefined;
                const fallbackPayout = (!matchedBreakdown && ticket.status !== 'Lost' && ticket.status !== 'Canceled' && ticket.totalCost > 0)
                    ? ((selection.cost * selection.multiplier) / ticket.totalCost) * (recalculated.totalWinnings || ticket.winnings || 0)
                    : 0;
                const payoutFromBreakdown = winBreakdown?.totalPayout || 0;
                const payout = payoutFromBreakdown || fallbackPayout;
                const winCount = winBreakdown?.winningCombinations;
                const perCombo = winBreakdown?.payoutPerCombination;
                const expectedPayout = typeof winCount === 'number' && typeof perCombo === 'number'
                    ? winCount * perCombo
                    : undefined;
                const payoutCheck: 'OK' | 'CHECK' | undefined = typeof expectedPayout === 'number'
                    ? (Math.abs(expectedPayout - payout) < 0.01 ? 'OK' : 'CHECK')
                    : undefined;
                const winningCombinationText = winBreakdown?.winningCombinationList?.length
                    ? winBreakdown.winningCombinationList.map((combo) => combo.join('-')).join(' | ')
                    : undefined;
                const safeDate = normalizeDate(ticket.timestamp as unknown as Date | string | number);
                const yyyy = safeDate ? safeDate.getFullYear() : 0;
                const mm = safeDate ? String(safeDate.getMonth() + 1).padStart(2, '0') : '00';
                const dd = safeDate ? String(safeDate.getDate()).padStart(2, '0') : '00';
                const actorName = ticket.customerId
                    ? `ONLINE (${ticket.customerId})`
                    : ticket.vendorId
                        ? `AGENT ${ticket.vendorName || '-'} (${ticket.vendorId})`
                        : (ticket.vendorName ? `AGENT ${ticket.vendorName}` : 'SYSTEM');
                const stampTime = safeDate
                    ? safeDate.toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                    })
                    : '-';
                return {
                    ticketId: String(ticket.id),
                    actorName,
                    stampTime,
                    dateKey: safeDate ? `${yyyy}-${mm}-${dd}` : '',
                    raceId: selection.raceId,
                    raceName: raceNameMap.get(selection.raceId) || selection.raceName || selection.raceId,
                    betType: selection.betType,
                    combination: selection.pattern && selection.pattern.length > 0
                        ? selection.pattern.join('-')
                        : `${selection.xCount > 0 ? 'X-'.repeat(selection.xCount) : ''}${selection.numbers.join('-')}`,
                    stake: selection.cost * selection.multiplier,
                    status: ticket.status,
                    selectionStatus: matchedBreakdown?.status || 'Pending',
                    payout,
                    winType: winBreakdown?.winType,
                    winningCombinations: winBreakdown?.winningCombinations,
                    winningCombinationText,
                    payoutCheck,
                    paidByName: ticket.paidByName,
                    paidById: ticket.paidById,
                };
            });
        }).sort((a, b) => b.ticketId.localeCompare(a.ticketId));

        const knownRaceIds = new Set(races.map((race) => race.id));
        const raceCards: RacePerformanceCard[] = races
            .map((race, index) => {
                const overall = byRace[race.id] || { betsPlaced: 0, ticketsCount: 0, totalStake: 0, winningBets: 0, winningSales: 0, totalPayout: 0 };
                const winningNumbersText = race.result?.winningNumbers?.length
                    ? race.result.winningNumbers.join('-')
                    : 'No result yet';
                return {
                    raceId: race.id,
                    raceCode: race.raceCode || `R${index + 1}`,
                    raceName: race.name,
                    scheduledTime: race.endDate,
                    isFinished: Boolean(race.result),
                    winningNumbersText,
                    overall,
                    byBetType: byRaceBetType[race.id] || createEmptyBetTypeStats(),
                };
            })
            .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

        for (const [raceId, stats] of Object.entries(byRace)) {
            if (knownRaceIds.has(raceId)) continue;
            raceCards.push({
                raceId,
                raceCode: raceId,
                raceName: raceNameMap.get(raceId) || raceId,
                scheduledTime: new Date(0),
                isFinished: false,
                winningNumbersText: 'No result yet',
                overall: stats,
                byBetType: byRaceBetType[raceId] || createEmptyBetTypeStats(),
            });
        }

        return {
            raceCards,
            combinationLedger,
        };

    }, [tickets, raceNameMap, races]);

    const ledgerAgentOptions = useMemo(() => {
        return Array.from(new Set(analyticsData.combinationLedger.map(row => row.actorName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [analyticsData.combinationLedger]);

    const filteredCombinationLedger = useMemo(() => {
        const ticketTerm = ledgerFilterTicket.trim().toLowerCase();
        return analyticsData.combinationLedger.filter((row) => {
            if (ledgerFilterAgent !== 'All' && row.actorName.toLowerCase() !== ledgerFilterAgent.toLowerCase()) return false;
            if (ledgerFilterDate && row.dateKey !== ledgerFilterDate) return false;
            if (ticketTerm && !row.ticketId.toLowerCase().includes(ticketTerm)) return false;
            if (ledgerFilterStatus !== 'All' && row.status !== ledgerFilterStatus) return false;
            return true;
        });
    }, [analyticsData.combinationLedger, ledgerFilterAgent, ledgerFilterDate, ledgerFilterTicket, ledgerFilterStatus]);

    const groupedCombinationLedger = useMemo<GroupedLedgerRow[]>(() => {
        const groups = new Map<string, CombinationLedgerRow[]>();
        filteredCombinationLedger.forEach((row) => {
            const existing = groups.get(row.ticketId);
            if (existing) {
                existing.push(row);
            } else {
                groups.set(row.ticketId, [row]);
            }
        });

        return Array.from(groups.entries()).map(([ticketId, rows]) => ({
            ticketId,
            actorName: rows[0]?.actorName || '-',
            stampTime: rows[0]?.stampTime || '-',
            rows,
        }));
    }, [filteredCombinationLedger]);

    // ── Ledger grouped by race (for the new race-headed layout) ──────────────
    interface LedgerRaceSection {
        raceId: string;
        raceName: string;
        raceCode: string;
        scheduledTime: Date | null;
        isFinished: boolean;
        winningNumbers: string;
        dateKey: string;
        isToday: boolean;
        ordinal: number;
        ticketGroups: GroupedLedgerRow[];
    }

    const ledgerByRace = useMemo<{ sections: LedgerRaceSection[]; todayKey: string }>(() => {
        const now = new Date();
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Group filtered rows by raceId, then by ticketId within each race
        const raceRowMap = new Map<string, Map<string, CombinationLedgerRow[]>>();
        filteredCombinationLedger.forEach((row) => {
            if (!raceRowMap.has(row.raceId)) raceRowMap.set(row.raceId, new Map());
            const ticketMap = raceRowMap.get(row.raceId)!;
            if (!ticketMap.has(row.ticketId)) ticketMap.set(row.ticketId, []);
            ticketMap.get(row.ticketId)!.push(row);
        });

        const sections: LedgerRaceSection[] = Array.from(raceRowMap.entries()).map(([raceId, ticketMap]) => {
            const raceCard = analyticsData.raceCards.find(c => c.raceId === raceId);
            const d = (raceCard?.scheduledTime instanceof Date && !isNaN(raceCard.scheduledTime.getTime()))
                ? raceCard.scheduledTime : null;
            const dateKey = d
                ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                : '';

            const ticketGroups: GroupedLedgerRow[] = Array.from(ticketMap.entries()).map(([ticketId, rows]) => ({
                ticketId,
                actorName: rows[0]?.actorName || '-',
                stampTime: rows[0]?.stampTime || '-',
                rows,
            }));

            return {
                raceId,
                raceName: raceCard?.raceName || raceNameMap.get(raceId) || raceId,
                raceCode: raceCard?.raceCode || raceId,
                scheduledTime: d,
                isFinished: raceCard?.isFinished ?? false,
                winningNumbers: raceCard?.winningNumbersText || 'No result yet',
                dateKey,
                isToday: dateKey === todayKey,
                ordinal: 0,
                ticketGroups,
            };
        });

        // Assign ordinals for today's races by time (earliest = 1st)
        const todaySorted = sections.filter(s => s.isToday).sort((a, b) => {
            if (!a.scheduledTime) return 1;
            if (!b.scheduledTime) return -1;
            return a.scheduledTime.getTime() - b.scheduledTime.getTime();
        });
        todaySorted.forEach((s, i) => { s.ordinal = i + 1; });

        // Sort: today first (finished first within today, most recently finished on top), then past dates
        sections.sort((a, b) => {
            if (a.isToday && !b.isToday) return -1;
            if (!a.isToday && b.isToday) return 1;
            if (a.isToday && b.isToday) {
                if (a.isFinished && !b.isFinished) return -1;
                if (!a.isFinished && b.isFinished) return 1;
                if (a.scheduledTime && b.scheduledTime) return b.scheduledTime.getTime() - a.scheduledTime.getTime();
                return 0;
            }
            return b.dateKey.localeCompare(a.dateKey);
        });

        return { sections, todayKey };
    }, [filteredCombinationLedger, analyticsData.raceCards, raceNameMap]);

    // Build sorted list of unique dates that have races
    const raceDateGroups = useMemo(() => {
        const dateMap = new Map<string, RacePerformanceCard[]>();
        analyticsData.raceCards.forEach(card => {
            if (!(card.scheduledTime instanceof Date) || Number.isNaN(card.scheduledTime.getTime())) return;
            const d = card.scheduledTime;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!dateMap.has(key)) dateMap.set(key, []);
            dateMap.get(key)!.push(card);
        });
        return Array.from(dateMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0])); // newest first
    }, [analyticsData.raceCards]);

    const filteredDateGroups = useMemo(() => {
        if (!raceDateSearch) return raceDateGroups;
        return raceDateGroups.filter(([dateKey]) => dateKey.includes(raceDateSearch));
    }, [raceDateGroups, raceDateSearch]);

    const racesForSelectedDate = useMemo(() => {
        if (!selectedRaceDate) return [];
        return analyticsData.raceCards.filter(card => {
            if (!(card.scheduledTime instanceof Date) || Number.isNaN(card.scheduledTime.getTime())) return false;
            const d = card.scheduledTime;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return key === selectedRaceDate;
        });
    }, [analyticsData.raceCards, selectedRaceDate]);

    const formatRaceTime = (date: Date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getWinLevelMeta = (winType?: string) => {
        if (!winType) return null;
        const t = winType.toLowerCase();
        if (t.includes('ordre') || t.includes('order')) {
            return {
                label: 'Order',
                className: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
            };
        }
        if (t.includes('desordre') || t.includes('disorder')) {
            return {
                label: 'Disorder',
                className: 'bg-sky-100 text-sky-800 border border-sky-300',
            };
        }
        if (t.includes('bonus4') || t.includes('bonus 4')) {
            return {
                label: 'Bonus 4',
                className: 'bg-violet-100 text-violet-800 border border-violet-300',
            };
        }
        if (t.includes('bonus3') || t.includes('bonus 3')) {
            return {
                label: 'Bonus 3',
                className: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300',
            };
        }
        return {
            label: winType,
            className: 'bg-gray-100 text-gray-700 border border-gray-300',
        };
    };

    return (
        <div className="space-y-6">
            {/* ── RACE LOOKUP BY DATE ─────────────────────────────── */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-betese-dark mb-1">Race Performance Lookup</h3>
                <p className="text-sm text-gray-500 mb-4">Search for a date, click it to load races, then click a race to view bet-type performance.</p>

                {/* Date search input */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Search by Date</label>
                        <input
                            type="date"
                            value={raceDateSearch}
                            onChange={e => {
                                setRaceDateSearch(e.target.value);
                                if (e.target.value) {
                                    setSelectedRaceDate(e.target.value);
                                    setExpandedRaceId(null);
                                }
                            }}
                            className="w-full sm:w-64 p-2 border-2 border-betese-green rounded-lg bg-white text-sm font-semibold focus:ring-2 focus:ring-betese-green"
                        />
                    </div>
                    {selectedRaceDate && (
                        <button
                            onClick={() => { setSelectedRaceDate(''); setRaceDateSearch(''); setExpandedRaceId(null); }}
                            className="mt-5 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-bold"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Clickable date chips */}
                {filteredDateGroups.length > 0 && (
                    <div className="mb-5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                            {raceDateSearch ? 'Matching dates' : 'All race dates'} — click a date to view its races
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {filteredDateGroups.map(([dateKey, cards]) => (
                                <button
                                    key={dateKey}
                                    onClick={() => { setSelectedRaceDate(dateKey); setRaceDateSearch(dateKey); setExpandedRaceId(null); }}
                                    className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${
                                        selectedRaceDate === dateKey
                                            ? 'bg-betese-green text-white border-betese-green shadow-md'
                                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-betese-green hover:text-betese-green'
                                    }`}
                                >
                                    {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    <span className="ml-1.5 text-[10px] opacity-70">{cards.length} race{cards.length > 1 ? 's' : ''}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Races for selected date */}
                {selectedRaceDate && (
                    <div>
                        <p className="text-sm font-black text-betese-dark uppercase mb-3 border-b pb-2">
                            Races on {new Date(selectedRaceDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                        {racesForSelectedDate.length === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-6">No races found for this date.</p>
                        ) : (
                            <div className="space-y-3">
                                {racesForSelectedDate.map((raceCard) => {
                                    const netProfit = raceCard.overall.totalStake - raceCard.overall.totalPayout;
                                    const isExpanded = expandedRaceId === raceCard.raceId;
                                    return (
                                        <div key={raceCard.raceId} className={`border-2 rounded-lg transition-all ${isExpanded ? 'border-betese-green shadow-md bg-white' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}>
                                            {/* Race header — click to expand */}
                                            <button
                                                className="w-full text-left px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                                                onClick={() => setExpandedRaceId(isExpanded ? null : raceCard.raceId)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${isExpanded ? 'bg-betese-green text-white' : 'bg-gray-200 text-gray-700'}`}>
                                                        {raceCard.raceCode}
                                                    </span>
                                                    <div>
                                                        <p className="font-black text-betese-dark">{raceCard.raceName}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {formatRaceTime(raceCard.scheduledTime)} &nbsp;·&nbsp;
                                                            <span className="font-semibold">Result: {raceCard.winningNumbersText}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 text-xs font-semibold items-center">
                                                    <span className="px-2 py-1 bg-gray-200 rounded">Tickets {raceCard.overall.ticketsCount}</span>
                                                    <span className="px-2 py-1 bg-gray-200 rounded">Bets {raceCard.overall.betsPlaced}</span>
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Stake {raceCard.overall.totalStake.toFixed(0)}</span>
                                                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Payout {raceCard.overall.totalPayout.toFixed(0)}</span>
                                                    <span className={`px-2 py-1 rounded ${netProfit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Net {netProfit.toFixed(0)}</span>
                                                    <span className={`px-2 py-1 rounded ${raceCard.isFinished ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'}`}>{raceCard.isFinished ? 'Finished' : 'Open'}</span>
                                                    <span className={`text-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                                                </div>
                                            </button>

                                            {/* Expanded bet-type table */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 overflow-x-auto border-t border-betese-green/30">
                                                    <table className="min-w-full bg-white text-sm border rounded mt-3">
                                                        <thead className="bg-betese-dark text-white">
                                                            <tr>
                                                                <th className="text-left font-semibold py-2 px-3">Bet Type</th>
                                                                <th className="text-right font-semibold py-2 px-3">Bets</th>
                                                                <th className="text-right font-semibold py-2 px-3">Stake</th>
                                                                <th className="text-right font-semibold py-2 px-3">Winning Bets</th>
                                                                <th className="text-right font-semibold py-2 px-3">Winning Sales</th>
                                                                <th className="text-right font-semibold py-2 px-3">Payout</th>
                                                                <th className="text-right font-semibold py-2 px-3">Net</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {Object.entries(raceCard.byBetType)
                                                                .filter(([, stats]) => (stats as BetTypePerformance).betsPlaced > 0)
                                                                .map(([betType, stats]) => {
                                                                    const typedStats = stats as BetTypePerformance;
                                                                    const typedNet = typedStats.totalStake - typedStats.totalPayout;
                                                                    return (
                                                                        <tr key={`${raceCard.raceId}-${betType}`} className="hover:bg-gray-50">
                                                                            <td className="py-2 px-3 font-semibold">{betType}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">{typedStats.betsPlaced}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">{typedStats.totalStake.toFixed(2)}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">{typedStats.winningBets}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">{typedStats.winningSales.toFixed(2)}</td>
                                                                            <td className="py-2 px-3 text-right font-mono">{typedStats.totalPayout.toFixed(2)}</td>
                                                                            <td className={`py-2 px-3 text-right font-mono font-bold ${typedNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{typedNet.toFixed(2)}</td>
                                                                        </tr>
                                                                    );
                                                            })}
                                                            {Object.values(raceCard.byBetType).every(s => (s as BetTypePerformance).betsPlaced === 0) && (
                                                                <tr><td colSpan={7} className="py-3 text-center text-gray-400 text-sm">No bets placed for this race.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {!selectedRaceDate && filteredDateGroups.length === 0 && (
                    <p className="text-center text-gray-400 py-8 text-sm">No races recorded yet.</p>
                )}
                {!selectedRaceDate && filteredDateGroups.length > 0 && (
                    <p className="text-center text-gray-400 py-4 text-sm">Select a date above to view its races.</p>
                )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-betese-dark mb-1">Ticket Combination Ledger</h3>
                <p className="text-sm text-gray-500 mb-4">Races grouped by date · today first · most recently ended on top with OUTSTANDING badge.</p>

                {/* ── 4 filter boxes ────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5 p-3 border rounded-lg bg-green-50">
                    <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Agent Name Filter</label>
                        <select
                            value={ledgerFilterAgent}
                            onChange={e => setLedgerFilterAgent(e.target.value)}
                            className="w-full p-2 border rounded bg-white text-sm"
                        >
                            <option value="All">All Agents</option>
                            {ledgerAgentOptions.map((agent) => (
                                <option key={agent} value={agent}>{agent}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Date Selection</label>
                        <input type="date" value={ledgerFilterDate} onChange={e => setLedgerFilterDate(e.target.value)}
                            className="w-full p-2 border rounded bg-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Ticket Number</label>
                        <input type="text" value={ledgerFilterTicket} onChange={e => setLedgerFilterTicket(e.target.value)}
                            placeholder="Enter ticket number"
                            className="w-full p-2 border rounded bg-white text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Filter by Status</label>
                        <select value={ledgerFilterStatus} onChange={e => setLedgerFilterStatus(e.target.value as Ticket['status'] | 'All')}
                            className="w-full p-2 border rounded bg-white text-sm">
                            <option value="All">All</option>
                            <option value="Active">Active</option>
                            <option value="Winning">Winning</option>
                            <option value="Lost">Lost</option>
                            <option value="Booked">Booked</option>
                            <option value="Paid">Paid</option>
                            <option value="Canceled">Canceled</option>
                        </select>
                    </div>
                </div>

                {/* ── Race-grouped sections ──────────────────────────── */}
                {(() => {
                    const { sections, todayKey } = ledgerByRace;
                    if (sections.length === 0) {
                        return <p className="text-center text-gray-400 py-8 text-sm">No ticket combinations found for current filters.</p>;
                    }

                    const ordinalLabel = (n: number) => {
                        const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
                        return `${n}${suffix} Race`;
                    };

                    const todaySections = sections.filter(s => s.isToday);
                    const pastSections = sections.filter(s => !s.isToday);

                    // Group past by date
                    const pastDateMap = new Map<string, typeof pastSections>();
                    pastSections.forEach(s => {
                        if (!pastDateMap.has(s.dateKey)) pastDateMap.set(s.dateKey, []);
                        pastDateMap.get(s.dateKey)!.push(s);
                    });

                    const renderTicketTable = (ticketGroups: GroupedLedgerRow[]) => (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm bg-white">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="text-left font-semibold py-2 px-3 border-r border-gray-200 w-44">Ticket</th>
                                        <th className="text-left font-semibold py-2 px-3">Bet Type</th>
                                        <th className="text-left font-semibold py-2 px-3">Combination</th>
                                        <th className="text-right font-semibold py-2 px-3">Stake</th>
                                        <th className="text-left font-semibold py-2 px-3">Status</th>
                                        <th className="text-right font-semibold py-2 px-3">Payout</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {ticketGroups.map((group) => (
                                        <tr key={group.ticketId} className="hover:bg-gray-50">
                                            <td className="py-2 px-3 font-mono font-bold align-top border-r border-gray-200 bg-gray-50">
                                                <div className="text-betese-dark">{group.ticketId}</div>
                                                <div className="text-[10px] text-gray-600 font-semibold mt-0.5">{group.actorName}</div>
                                                <div className="text-[10px] text-gray-400">{group.stampTime}</div>
                                                <div className="text-[10px] text-gray-400">{group.rows.length} bet{group.rows.length > 1 ? 's' : ''}</div>
                                            </td>
                                            <td className="py-2 px-3 align-top">
                                                <div className="space-y-1">{group.rows.map((row, i) => (
                                                    <div key={i} className="text-xs">{row.betType}</div>
                                                ))}</div>
                                            </td>
                                            <td className="py-2 px-3 font-mono align-top">
                                                <div className="space-y-1">{group.rows.map((row, i) => (
                                                    <div key={i} className="text-xs border border-gray-200 px-2 py-0.5 rounded bg-gray-50">
                                                        <div>{row.combination}</div>
                                                        {row.selectionStatus === 'Win' && row.winType && (() => {
                                                            const levelMeta = getWinLevelMeta(row.winType);
                                                            if (!levelMeta) return null;
                                                            return (
                                                                <div className="mt-1">
                                                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${levelMeta.className}`}>
                                                                        Level: {levelMeta.label}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                        {row.selectionStatus === 'Win' && typeof row.winningCombinations === 'number' && (
                                                            <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                                                                Winning combinations: {row.winningCombinations}
                                                            </div>
                                                        )}
                                                        {row.selectionStatus === 'Win' && row.winningCombinationText && (
                                                            <div className="text-[10px] text-gray-600 mt-0.5">
                                                                Hits: {row.winningCombinationText}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}</div>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono align-top">
                                                <div className="space-y-1">{group.rows.map((row, i) => (
                                                    <div key={i} className="text-xs">{row.stake.toFixed(2)}</div>
                                                ))}</div>
                                            </td>
                                            <td className="py-2 px-3 align-top">
                                                <div className="space-y-1">{group.rows.map((row, i) => (
                                                    <div key={i} className="text-xs">
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ${
                                                            row.selectionStatus === 'Win'
                                                                ? 'bg-green-100 text-green-700'
                                                                : row.selectionStatus === 'Loss'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : row.status === 'Active'
                                                                        ? 'bg-amber-100 text-amber-700'
                                                                        : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {row.selectionStatus === 'Win' ? 'Winning' : row.selectionStatus === 'Loss' ? 'Lost' : row.status}
                                                        </span>
                                                    </div>
                                                ))}</div>
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono align-top">
                                                <div className="space-y-1">{group.rows.map((row, i) => (
                                                    <div key={i} className="text-xs">
                                                        <span className={row.payout > 0 ? 'text-green-700 font-bold' : ''}>{row.payout.toFixed(2)}</span>
                                                        {row.selectionStatus === 'Win' && row.payoutCheck && (
                                                            <div className="mt-0.5">
                                                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${row.payoutCheck === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {row.payoutCheck === 'OK' ? 'Payout OK' : 'Payout Check'}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {row.status === 'Paid' && (row.paidByName || row.paidById) && (
                                                            <div className="text-[10px] text-gray-400">by {row.paidByName || row.paidById}</div>
                                                        )}
                                                    </div>
                                                ))}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );

                    const renderRaceSection = (sec: (typeof sections)[0], index: number, isFirstFinished: boolean) => {
                        const isOutstanding = sec.isFinished;
                        const timeStr = sec.scheduledTime
                            ? sec.scheduledTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                            : '';
                        return (
                            <div key={sec.raceId} className={`border-2 rounded-xl overflow-hidden ${isFirstFinished ? 'border-orange-400 shadow-lg' : isOutstanding ? 'border-amber-300 shadow-md' : 'border-gray-200'}`}>
                                {/* Race headline */}
                                <div className={`flex items-center justify-between px-4 py-3 gap-3 flex-wrap ${isFirstFinished ? 'bg-orange-500 text-white' : isOutstanding ? 'bg-amber-50 text-amber-900 border-b border-amber-200' : 'bg-betese-dark text-white'}`}>
                                    <div className="flex items-center gap-3">
                                        {sec.isToday && (
                                            <span className={`text-[11px] font-black uppercase px-2 py-1 rounded ${isFirstFinished ? 'bg-white/20' : isOutstanding ? 'bg-amber-200 text-amber-900' : 'bg-white/10'}`}>
                                                {ordinalLabel(sec.ordinal)}
                                            </span>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-base uppercase">{sec.raceCode}</span>
                                                {timeStr && <span className="text-sm font-semibold opacity-90">{timeStr}</span>}
                                                <span className="font-semibold text-sm opacity-90">— {sec.raceName}</span>
                                            </div>
                                            {sec.isFinished && (
                                                <div className={`text-xs mt-0.5 ${isFirstFinished ? 'text-white/80' : 'text-amber-700'}`}>
                                                    Result: {sec.winningNumbers}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {isOutstanding && (
                                            <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border-2 animate-pulse ${isFirstFinished ? 'border-white text-white bg-red-600' : 'border-amber-500 text-amber-800 bg-amber-100'}`}>
                                                ★ OUTSTANDING
                                            </span>
                                        )}
                                        {!sec.isFinished && (
                                            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500 text-white">OPEN</span>
                                        )}
                                        <span className={`text-xs px-2 py-1 rounded font-semibold ${isFirstFinished ? 'bg-white/20' : isOutstanding ? 'bg-amber-100 text-amber-800' : 'bg-white/10'}`}>
                                            {sec.ticketGroups.length} ticket{sec.ticketGroups.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                                {/* Ticket table for this race */}
                                {renderTicketTable(sec.ticketGroups)}
                            </div>
                        );
                    };

                    return (
                        <div className="space-y-5">
                            {/* TODAY section */}
                            {todaySections.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-1 border-t-2 border-betese-green"></div>
                                        <span className="text-xs font-black uppercase text-betese-green px-3 py-1 bg-green-50 border border-betese-green rounded-full">
                                            TODAY'S RACES — {new Date(todayKey + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </span>
                                        <div className="flex-1 border-t-2 border-betese-green"></div>
                                    </div>
                                    <div className="space-y-4">
                                        {todaySections.map((sec, idx) =>
                                            renderRaceSection(sec, idx, idx === 0 && sec.isFinished)
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* PAST DATES sections */}
                            {Array.from(pastDateMap.entries()).map(([dateKey, dateSections]) => (
                                <div key={dateKey}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-1 border-t border-gray-300"></div>
                                        <span className="text-xs font-bold uppercase text-gray-500 px-3 py-1 bg-gray-50 border border-gray-300 rounded-full">
                                            {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </span>
                                        <div className="flex-1 border-t border-gray-300"></div>
                                    </div>
                                    <div className="space-y-4">
                                        {dateSections.map((sec, idx) => renderRaceSection(sec, idx, false))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};
