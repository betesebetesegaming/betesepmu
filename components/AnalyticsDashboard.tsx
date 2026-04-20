
import React, { useMemo } from 'react';
import { Ticket, Race, BetTypeOption } from '../types';

interface AnalyticsDashboardProps {
  tickets: Ticket[];
  races: Race[];
}

const InfoCard: React.FC<{ title: string; value: string; color: string; icon: React.ReactNode }> = ({ title, value, color, icon }) => (
    <div className="bg-white p-6 rounded-lg shadow-lg flex items-center gap-4">
        <div className={`p-3 rounded-full bg-opacity-20 ${color.replace('text-', 'bg-')}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-sm font-semibold text-gray-500">{title}</h3>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
    </div>
);

interface BetTypePerformance {
    betsPlaced: number;
    totalStake: number;
    winningBets: number;
    totalPayout: number;
}

interface RacePerformance {
    betsPlaced: number;
    totalStake: number;
    totalPayout: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tickets, races }) => {
    
    const raceNameMap = useMemo(() => new Map(races.map(r => [r.id, r.name])), [races]);

    const analyticsData = useMemo(() => {
        // Overall stats
        const ticketsSold = tickets.filter(t => ['Active', 'Winning', 'Lost', 'Paid'].includes(t.status)).length;
        const totalStake = tickets.reduce((sum, t) => sum + t.totalCost, 0);
        const totalPayout = tickets.filter(t => t.status === 'Paid').reduce((sum, t) => sum + (t.winnings ?? 0), 0);
        const netProfit = totalStake - totalPayout;

        // Per-bet-type stats
        const initialBetTypeStats = Object.values(BetTypeOption).reduce((acc, betType) => {
            acc[betType] = { betsPlaced: 0, totalStake: 0, winningBets: 0, totalPayout: 0 };
            return acc;
        }, {} as Record<BetTypeOption, BetTypePerformance>);

        const byBetType = tickets.reduce((stats, ticket) => {
            for (const selection of ticket.selections) {
                const betType = selection.betType;
                stats[betType].betsPlaced++;
                // Use selection multiplier, not ticket multiplier
                stats[betType].totalStake += selection.cost * selection.multiplier;
                
                if (ticket.status === 'Winning' || ticket.status === 'Paid') {
                    stats[betType].winningBets++;
                    
                    if (ticket.totalCost > 0) {
                         // Proportional payout attribution based on selection stake weight
                        stats[betType].totalPayout += ((selection.cost * selection.multiplier) / ticket.totalCost) * (ticket.winnings ?? 0);
                    }
                }
            }
            return stats;
        }, initialBetTypeStats);
        
        // Per-race stats
        const byRace = tickets.reduce((stats, ticket) => {
             for (const selection of ticket.selections) {
                const raceId = selection.raceId;
                if (!stats[raceId]) {
                    stats[raceId] = { betsPlaced: 0, totalStake: 0, totalPayout: 0 };
                }
                stats[raceId].betsPlaced++;
                stats[raceId].totalStake += selection.cost * selection.multiplier;
                
                 if (ticket.status === 'Winning' || ticket.status === 'Paid') {
                    if (ticket.totalCost > 0) {
                        stats[raceId].totalPayout += ((selection.cost * selection.multiplier) / ticket.totalCost) * (ticket.winnings ?? 0);
                    }
                }
            }
            return stats;
        }, {} as Record<string, RacePerformance>);

        return {
            overall: { ticketsSold, totalStake, totalPayout, netProfit },
            byBetType,
            byRace,
        };

    }, [tickets]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <InfoCard title="Total Tickets Sold" value={analyticsData.overall.ticketsSold.toLocaleString()} color="text-blue-600" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>} />
                <InfoCard title="Total Stake" value={`${analyticsData.overall.totalStake.toFixed(2)}`} color="text-gray-600" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>} />
                <InfoCard title="Total Payouts" value={`${analyticsData.overall.totalPayout.toFixed(2)}`} color="text-red-600" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>} />
                <InfoCard title="Net Profit" value={`${analyticsData.overall.netProfit.toFixed(2)}`} color="text-betese-green" icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-betese-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-betese-dark mb-4">Bet Type Performance</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="text-left font-semibold py-2 px-3">Bet Type</th>
                                <th className="text-right font-semibold py-2 px-3">Bets Placed</th>
                                <th className="text-right font-semibold py-2 px-3">Total Stake</th>
                                <th className="text-right font-semibold py-2 px-3">Winning Bets</th>
                                <th className="text-right font-semibold py-2 px-3">Total Payout</th>
                                <th className="text-right font-semibold py-2 px-3">Win Rate</th>
                                <th className="text-right font-semibold py-2 px-3">Net Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {Object.entries(analyticsData.byBetType).map(([betType, stats]) => {
                                // FIX: Cast stats to the correct type to allow property access.
                                const { betsPlaced, totalStake, winningBets, totalPayout } = stats as BetTypePerformance;
                                const netProfit = totalStake - totalPayout;
                                const winRate = betsPlaced > 0 ? (winningBets / betsPlaced) * 100 : 0;
                                return (
                                    <tr key={betType}>
                                        <td className="py-2 px-3 font-semibold">{betType}</td>
                                        <td className="py-2 px-3 text-right font-mono">{betsPlaced}</td>
                                        <td className="py-2 px-3 text-right font-mono">{totalStake.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-mono">{winningBets}</td>
                                        <td className="py-2 px-3 text-right font-mono">{totalPayout.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-mono">{winRate.toFixed(1)}%</td>
                                        <td className={`py-2 px-3 text-right font-mono font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {netProfit.toFixed(2)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-betese-dark mb-4">Race Performance</h3>
                 <div className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="text-left font-semibold py-2 px-3">Race</th>
                                <th className="text-right font-semibold py-2 px-3">Bets Placed</th>
                                <th className="text-right font-semibold py-2 px-3">Total Stake</th>
                                <th className="text-right font-semibold py-2 px-3">Total Payout</th>
                                <th className="text-right font-semibold py-2 px-3">Net Profit</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-gray-200">
                            {Object.entries(analyticsData.byRace).map(([raceId, stats]) => {
                                // FIX: Cast stats to the correct type to allow property access.
                                const { betsPlaced, totalStake, totalPayout } = stats as RacePerformance;
                                const netProfit = totalStake - totalPayout;
                                return (
                                    <tr key={raceId}>
                                        <td className="py-2 px-3 font-semibold">{raceNameMap.get(raceId) || raceId}</td>
                                        <td className="py-2 px-3 text-right font-mono">{betsPlaced}</td>
                                        <td className="py-2 px-3 text-right font-mono">{totalStake.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-mono">{totalPayout.toFixed(2)}</td>
                                        <td className={`py-2 px-3 text-right font-mono font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {netProfit.toFixed(2)}
                                        </td>
                                    </tr>
                                )
                            })}
                         </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
