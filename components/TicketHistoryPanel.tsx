
import React, { useState, useMemo } from 'react';
import { Ticket, Race } from '../types';
import { getEffectiveTicketStatus, formatWinningNumbersForDisplay } from '../utils';

interface TicketHistoryPanelProps {
  tickets: Ticket[];
  onCancelTicket: (ticketId: string) => void;
  races: Race[];
  effectiveTime: Date;
}

type TicketFilter = 'all' | 'active' | 'winning' | 'paid' | 'lost' | 'canceled';

const TicketItem: React.FC<{ ticket: Ticket; isCancellable: boolean; onCancel: () => void; effectiveTime: Date; races: Race[]; }> = ({ ticket, isCancellable, onCancel, effectiveTime, races }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const effectiveStatus = getEffectiveTicketStatus(ticket, effectiveTime);

    const getStatusStyles = () => {
        switch(effectiveStatus) {
            case 'Winning': return 'bg-blue-50 border-blue-200 text-blue-800';
            case 'Lost': return 'bg-red-50 border-red-200 text-red-800';
            case 'Canceled': return 'bg-gray-100 border-gray-200 text-gray-600 opacity-70';
            case 'Active': return 'bg-green-50 border-green-200 text-green-800';
            case 'Booked': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'Paid': return 'bg-purple-50 border-purple-200 text-purple-800';
            case 'Expired': return 'bg-gray-200 border-gray-300 text-gray-500';
            default: return 'bg-gray-50 border-gray-200';
        }
    }

    return (
        <div className={`p-3 rounded-md border transition-all ${getStatusStyles()}`}>
            <div className="flex justify-between items-start cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div>
                    <p className="text-xs">{ticket.id}{ticket.bookingCode && ` (${ticket.bookingCode})`}</p>
                    <p className="font-bold text-lg">{ticket.totalCost.toFixed(2)} GMD</p>
                    <p className={`text-sm font-semibold`}>{effectiveStatus}</p>
                    {ticket.winnings !== undefined && ticket.winnings > 0 && (
                        <p className="text-sm font-bold text-blue-600">Won: {ticket.winnings.toFixed(2)} GMD</p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2">
                    {isCancellable && (
                         <button 
                            onClick={(e) => { e.stopPropagation(); onCancel(); }}
                            className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400"
                            title="Cancel Ticket"
                        >
                            Cancel
                        </button>
                    )}
                    <span className="text-xs text-gray-500">{ticket.timestamp.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-300/50 space-y-2">
                     <h4 className="font-semibold text-sm">Bet Combinations:</h4>
                     {ticket.selections.map((selection, index) => {
                        const race = races.find(r => r.id === selection.raceId);
                        let resultText = 'Race pending';
                        if (race?.result) {
                            resultText = `Result: ${formatWinningNumbersForDisplay(race.result.winningNumbers)}`;
                            if (race.result.bracketWinningNumbers && race.result.bracketWinningNumbers.length > 0) {
                                resultText += ` | Bracket: ${formatWinningNumbersForDisplay(race.result.bracketWinningNumbers)}`;
                            }
                        }

                        return (
                            <div key={index} className="text-xs bg-white/50 p-2 rounded">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold">{selection.raceName} - {selection.betType}</p>
                                        <p className="font-mono">
                                            Your Bet: {selection.pattern && selection.pattern.length > 0
                                                ? selection.pattern.join('-')
                                                : `${selection.xCount > 0 ? 'X-'.repeat(selection.xCount) : ''}${selection.numbers.join('-')}`}
                                        </p>
                                    </div>
                                    <p className="text-gray-600 font-semibold text-right max-w-[150px]">{resultText}</p>
                                </div>
                            </div>
                        )
                     })}
                     {ticket.winningsBreakdown && ticket.winningsBreakdown.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-dashed">
                            <h5 className="font-semibold text-sm text-blue-800">Winning Details:</h5>
                            <div className="space-y-1 mt-1">
                                {ticket.winningsBreakdown.map((breakdown, idx) => (
                                    <div key={idx} className="text-xs bg-blue-50 p-2 rounded">
                                        <div className="flex justify-between">
                                            <span className="font-bold">{breakdown.winType}</span>
                                            <span className="font-bold">{breakdown.totalPayout?.toFixed(2)} GMD</span>
                                        </div>
                                        {breakdown.payoutPerCombination !== undefined && (
                                            <p className="text-gray-700">Payout per combo: {breakdown.payoutPerCombination.toFixed(2)} GMD</p>
                                        )}
                                        {breakdown.source && (
                                            <p className="text-gray-700">Source: {breakdown.source}</p>
                                        )}
                                        {breakdown.winningCombinationList?.map((combo, i) => (
                                            <p key={i} className="text-gray-700">
                                                - Combo: <span className="font-mono">{combo.join(', ')}</span>
                                            </p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                     )}
                </div>
            )}
        </div>
    );
}

export const TicketHistoryPanel: React.FC<TicketHistoryPanelProps> = ({ tickets, onCancelTicket, races, effectiveTime }) => {
    const [filter, setFilter] = useState<TicketFilter>('all');
    const [filterAgent, setFilterAgent] = useState<string>('All');
    const [filterDate, setFilterDate] = useState<string>('');

    const agentOptions = useMemo(() => {
        return Array.from(new Set(tickets.map(t => t.vendorName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }, [tickets]);

    const historySummary = useMemo(() => {
        const activeCount = tickets.filter((ticket) => {
            const status = getEffectiveTicketStatus(ticket, effectiveTime);
            return status === 'Active' || status === 'Booked';
        }).length;
        const winningCount = tickets.filter((ticket) => {
            const status = getEffectiveTicketStatus(ticket, effectiveTime);
            return status === 'Winning' || status === 'Paid';
        }).length;
        const totalStake = tickets.reduce((sum, ticket) => sum + Number(ticket.totalCost || 0), 0);
        const totalWinnings = tickets.reduce((sum, ticket) => sum + Number(ticket.winnings || 0), 0);
        return { activeCount, winningCount, totalStake, totalWinnings };
    }, [tickets, effectiveTime]);

    const filteredTickets = useMemo(() => {
        let sorted = [...tickets].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Agent filter
        if (filterAgent !== 'All') {
            sorted = sorted.filter(t => (t.vendorName || '').toLowerCase() === filterAgent.toLowerCase());
        }

        // Date filter
        if (filterDate) {
            sorted = sorted.filter(t => {
                const yyyy = t.timestamp.getFullYear();
                const mm = String(t.timestamp.getMonth() + 1).padStart(2, '0');
                const dd = String(t.timestamp.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}` === filterDate;
            });
        }

        // Status filter
        if (filter !== 'all') {
            sorted = sorted.filter(ticket => {
                const status = getEffectiveTicketStatus(ticket, effectiveTime);
                switch (filter) {
                    case 'active':   return status === 'Active' || status === 'Booked';
                    case 'winning':  return status === 'Winning';
                    case 'paid':     return status === 'Paid';
                    case 'lost':     return status === 'Lost' || status === 'Expired';
                    case 'canceled': return status === 'Canceled';
                    default: return true;
                }
            });
        }

        return sorted;
    }, [tickets, filter, filterAgent, filterDate, effectiveTime]);

    const isTicketCancellable = (ticket: Ticket): boolean => {
        if (ticket.status === 'Booked') return true;
        if (ticket.status !== 'Active') return false;
        const hasRaceStarted = ticket.selections.some(selection => {
            const race = races.find(r => r.id === selection.raceId);
            return race && effectiveTime >= race.startDate;
        });
        return !hasRaceStarted;
    };

    const getCount = (filterType: TicketFilter) => {
        if (filterType === 'all') return tickets.length;
        return tickets.filter(ticket => {
            const status = getEffectiveTicketStatus(ticket, effectiveTime);
            switch (filterType) {
                case 'active':   return status === 'Active' || status === 'Booked';
                case 'winning':  return status === 'Winning';
                case 'paid':     return status === 'Paid';
                case 'lost':     return status === 'Lost' || status === 'Expired';
                case 'canceled': return status === 'Canceled';
                default: return false;
            }
        }).length;
    };

    const filterConfig: { label: string; type: TicketFilter; color: string; activeColor: string }[] = [
        { label: 'All',      type: 'all',      color: 'bg-gray-200 text-gray-700 hover:bg-gray-300',         activeColor: 'bg-gray-800 text-white' },
        { label: 'Active',   type: 'active',   color: 'bg-green-100 text-green-800 hover:bg-green-200',      activeColor: 'bg-green-600 text-white' },
        { label: 'Winning',  type: 'winning',  color: 'bg-blue-100 text-blue-800 hover:bg-blue-200',         activeColor: 'bg-blue-600 text-white' },
        { label: 'Paid',     type: 'paid',     color: 'bg-purple-100 text-purple-800 hover:bg-purple-200',   activeColor: 'bg-purple-600 text-white' },
        { label: 'Lost',     type: 'lost',     color: 'bg-red-100 text-red-800 hover:bg-red-200',            activeColor: 'bg-red-600 text-white' },
        { label: 'Canceled', type: 'canceled', color: 'bg-gray-100 text-gray-600 hover:bg-gray-200',         activeColor: 'bg-gray-500 text-white' },
    ];

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-betese-dark mb-4">Betting History</h3>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                <div className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Tickets</p>
                    <p className="text-lg font-black text-betese-dark">{tickets.length}</p>
                </div>
                <div className="p-3 rounded-lg border bg-green-50">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Active</p>
                    <p className="text-lg font-black text-green-700">{historySummary.activeCount}</p>
                </div>
                <div className="p-3 rounded-lg border bg-blue-50">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Winning/Paid</p>
                    <p className="text-lg font-black text-blue-700">{historySummary.winningCount}</p>
                </div>
                <div className="p-3 rounded-lg border bg-purple-50">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Total Winnings</p>
                    <p className="text-lg font-black text-purple-700">{historySummary.totalWinnings.toFixed(2)} GMD</p>
                </div>
            </div>
            <div className="mb-4 p-3 rounded-lg border bg-slate-50 text-sm flex justify-between">
                <span className="font-semibold text-gray-700">Total Stake: <span className="font-black text-betese-dark">{historySummary.totalStake.toFixed(2)} GMD</span></span>
                <span className="font-semibold text-gray-700">Net: <span className="font-black text-betese-dark">{(historySummary.totalWinnings - historySummary.totalStake).toFixed(2)} GMD</span></span>
            </div>

            {/* Filter boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 border rounded-lg bg-green-50">
                <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Filter by Agent / Vendor</label>
                    <select
                        value={filterAgent}
                        onChange={e => setFilterAgent(e.target.value)}
                        className="w-full p-2 border rounded bg-white text-sm font-semibold"
                    >
                        <option value="All">All Agents</option>
                        {agentOptions.map(agent => (
                            <option key={agent} value={agent}>{agent}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Filter by Date</label>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        className="w-full p-2 border rounded bg-white text-sm"
                    />
                </div>
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-2 mb-4 border-b pb-4">
                {filterConfig.map(({ label, type, color, activeColor }) => (
                    <button
                        key={type}
                        onClick={() => setFilter(type)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${filter === type ? activeColor : color}`}
                    >
                        {label}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${filter === type ? 'bg-white/25' : 'bg-black/10'}`}>
                            {getCount(type)}
                        </span>
                    </button>
                ))}
                {(filterAgent !== 'All' || filterDate) && (
                    <button
                        onClick={() => { setFilterAgent('All'); setFilterDate(''); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-full bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-300"
                    >
                        ✕ Clear Filters
                    </button>
                )}
            </div>

            {/* Ticket count */}
            <p className="text-xs font-semibold text-gray-500 mb-3">Showing {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}</p>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {filteredTickets.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No tickets match the current filter.</p>
                ) : (
                    filteredTickets.map((ticket) => (
                        <TicketItem
                            key={ticket.id}
                            ticket={ticket}
                            isCancellable={isTicketCancellable(ticket)}
                            onCancel={() => onCancelTicket(ticket.id)}
                            effectiveTime={effectiveTime}
                            races={races}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
