
import React, { useMemo, useState } from 'react';
import { Ticket, Race, BetTypeOption } from '../types';

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
    payout: number;
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
            return ticket.selections.map((selection, index) => {
                const matchedBreakdown = ticket.winningsBreakdown?.find((row) => row.selectionIndex === index && row.status === 'Win');
                const fallbackPayout = ticket.totalCost > 0
                    ? ((selection.cost * selection.multiplier) / ticket.totalCost) * (ticket.winnings ?? 0)
                    : 0;
                const safeDate = normalizeDate(ticket.timestamp as unknown as Date | string | number);
                const yyyy = safeDate ? safeDate.getFullYear() : 0;
                const mm = safeDate ? String(safeDate.getMonth() + 1).padStart(2, '0') : '00';
                const dd = safeDate ? String(safeDate.getDate()).padStart(2, '0') : '00';
                const actorName = ticket.customerId
                    ? `ONLINE (${ticket.customerId})`
                    : (ticket.vendorName || 'AGENT');
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
                    payout: matchedBreakdown?.totalPayout || fallbackPayout
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

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-betese-dark mb-2">Race Performance (Collapsible by Race)</h3>
                <p className="text-sm text-gray-600 mb-4">Click each race (R1, R2, MAIN) to view all bet-type performance for that race.</p>

                <div className="space-y-3">
                    {analyticsData.raceCards.map((raceCard) => {
                        const netProfit = raceCard.overall.totalStake - raceCard.overall.totalPayout;
                        return (
                            <details key={raceCard.raceId} className="border rounded-lg bg-gray-50 open:bg-white open:shadow-sm">
                                <summary className="cursor-pointer list-none px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                    <div>
                                        <p className="font-black text-betese-dark">{raceCard.raceCode} - {raceCard.raceName}</p>
                                        <p className="text-xs text-gray-500">{formatRaceTime(raceCard.scheduledTime)} | Winning: {raceCard.winningNumbersText}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                        <span className="px-2 py-1 bg-gray-200 rounded">Tickets {raceCard.overall.ticketsCount}</span>
                                        <span className="px-2 py-1 bg-gray-200 rounded">Bets {raceCard.overall.betsPlaced}</span>
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Stake {raceCard.overall.totalStake.toFixed(2)}</span>
                                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Payout {raceCard.overall.totalPayout.toFixed(2)}</span>
                                        <span className={`px-2 py-1 rounded ${netProfit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>Net {netProfit.toFixed(2)}</span>
                                        <span className={`px-2 py-1 rounded ${raceCard.isFinished ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}`}>{raceCard.isFinished ? 'Finished' : 'Open'}</span>
                                    </div>
                                </summary>

                                <div className="px-4 pb-4 overflow-x-auto">
                                    <table className="min-w-full bg-white text-sm border rounded">
                                        <thead className="bg-gray-100">
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
                                            {Object.entries(raceCard.byBetType).map(([betType, stats]) => {
                                                const typedStats = stats as BetTypePerformance;
                                                const typedNet = typedStats.totalStake - typedStats.totalPayout;
                                                return (
                                                    <tr key={`${raceCard.raceId}-${betType}`}>
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
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-betese-dark mb-4">Ticket Combination Ledger</h3>
                <p className="text-sm text-gray-600 mb-4">This table shows ticket number and exact combination for each selection so winning combinations can be verified per race.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 border rounded-lg bg-green-50">
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
                        <input
                            type="date"
                            value={ledgerFilterDate}
                            onChange={e => setLedgerFilterDate(e.target.value)}
                            className="w-full p-2 border rounded bg-white text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Ticket Number</label>
                        <input
                            type="text"
                            value={ledgerFilterTicket}
                            onChange={e => setLedgerFilterTicket(e.target.value)}
                            placeholder="Enter ticket number"
                            className="w-full p-2 border rounded bg-white text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Filter by Status</label>
                        <select
                            value={ledgerFilterStatus}
                            onChange={e => setLedgerFilterStatus(e.target.value as Ticket['status'] | 'All')}
                            className="w-full p-2 border rounded bg-white text-sm"
                        >
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

                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="text-left font-semibold py-2 px-3">Ticket</th>
                                <th className="text-left font-semibold py-2 px-3">Race</th>
                                <th className="text-left font-semibold py-2 px-3">Bet Type</th>
                                <th className="text-left font-semibold py-2 px-3">Combination</th>
                                <th className="text-right font-semibold py-2 px-3">Stake</th>
                                <th className="text-left font-semibold py-2 px-3">Status</th>
                                <th className="text-right font-semibold py-2 px-3">Payout</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {groupedCombinationLedger.length > 0 ? groupedCombinationLedger.map((group) => (
                                group.rows.map((row, rowIndex) => (
                                    <tr key={`${group.ticketId}-${row.raceId}-${rowIndex}`}>
                                        {rowIndex === 0 && (
                                            <td rowSpan={group.rows.length} className="py-2 px-3 font-mono font-bold align-top bg-gray-50 border-r border-gray-200">
                                                <div>{group.ticketId}</div>
                                                <div className="text-[10px] text-gray-700 font-semibold mt-0.5">{group.actorName}</div>
                                                <div className="text-[10px] text-gray-500 font-normal">{group.stampTime}</div>
                                                <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                                                    {group.rows.length} bet{group.rows.length > 1 ? 's' : ''}
                                                </div>
                                            </td>
                                        )}
                                        <td className="py-2 px-3">{row.raceName}</td>
                                        <td className="py-2 px-3">{row.betType}</td>
                                        <td className="py-2 px-3 font-mono">{row.combination}</td>
                                        <td className="py-2 px-3 text-right font-mono">{row.stake.toFixed(2)}</td>
                                        <td className="py-2 px-3">{row.status}</td>
                                        <td className="py-2 px-3 text-right font-mono">{row.payout.toFixed(2)}</td>
                                    </tr>
                                ))
                            )) : (
                                <tr>
                                    <td colSpan={7} className="py-4 px-3 text-center text-gray-500">No ticket combinations found for current filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
