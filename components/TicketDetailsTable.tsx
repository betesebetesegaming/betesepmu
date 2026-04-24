
import React, { useState, useMemo } from 'react';
import { Ticket, Race } from '../types';
import { TicketCombinationLedger } from './TicketCombinationLedger';

interface TicketDetailsTableProps {
  title: string;
  tickets: Ticket[];
  races: Race[];
  onCancelTicket?: (ticketId: string) => void;
  onPayoutTicket?: (ticketId: string) => void;
}

type DisplayStatus = Ticket['status'];

const getStatusColor = (status: DisplayStatus) => {
  switch (status) {
    case 'Winning':  return 'text-blue-600';
    case 'Paid':     return 'text-purple-600';
    case 'Lost':     return 'text-red-500';
    case 'Canceled': return 'text-gray-400';
    case 'Active':   return 'text-gray-900';
    case 'Booked':   return 'text-yellow-700';
    default:         return 'text-gray-700';
  }
};

const formatBetNumbers = (sel: Ticket['selections'][number]): string => {
  if (sel.pattern && sel.pattern.length > 0) return sel.pattern.join(' ');
  const prefix = sel.xCount > 0 ? Array(sel.xCount).fill('X').join(' ') + ' ' : '';
  return prefix + sel.numbers.join(' ');
};

const formatDate = (d: Date): string => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} at ${hh}:${min}:${ss}`;
};

const formatBetLabel = (betType: string): string => {
  return betType
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

type FilterStatus = Ticket['status'] | 'All';

export const TicketDetailsTable: React.FC<TicketDetailsTableProps> = ({ tickets, races, onCancelTicket, onPayoutTicket }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [filterAgent, setFilterAgent] = useState<string>('All');
  // Keep date empty by default so agent filter can show all vendor transactions.
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ledgerTicket, setLedgerTicket] = useState<Ticket | null>(null);

  const raceById = useMemo(() => {
    return new Map(races.map(r => [r.id, r]));
  }, [races]);

  const getDisplayStatus = (ticket: Ticket): DisplayStatus => {
    if (ticket.status !== 'Active') return ticket.status;

    const now = new Date();
    const ticketRaces = ticket.selections
      .map(sel => raceById.get(sel.raceId))
      .filter((r): r is Race => Boolean(r));

    if (ticketRaces.length === 0) return ticket.status;

    const allRacesEnded = ticketRaces.every(r => now >= r.endDate);
    if (!allRacesEnded) return 'Active';

    const anyWin = ticket.winningsBreakdown?.some(b => b.status === 'Win') || (ticket.winnings || 0) > 0;
    if (anyWin) return 'Winning';
    return 'Lost';
  };

  const matchesStatusFilter = (ticket: Ticket): boolean => {
    if (filterStatus === 'All') return true;
    const displayStatus = getDisplayStatus(ticket);
    if (filterStatus === 'Active') return displayStatus === 'Active';
    if (filterStatus === 'Lost') return displayStatus === 'Lost';
    if (filterStatus === 'Winning') return displayStatus === 'Winning';
    return displayStatus === filterStatus;
  };

  const agentOptions = useMemo(() =>
    Array.from(new Set(tickets.map(t => t.vendorName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  [tickets]);

  const filteredTickets = useMemo(() => {
    let result = [...tickets].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(t => t.id.toLowerCase().includes(term));
    }
    if (filterStatus !== 'All') result = result.filter(matchesStatusFilter);
    if (filterAgent !== 'All') result = result.filter(t => (t.vendorName || '').toLowerCase() === filterAgent.toLowerCase());
    if (filterDate) {
      result = result.filter(t => {
        const yyyy = t.timestamp.getFullYear();
        const mm = String(t.timestamp.getMonth() + 1).padStart(2, '0');
        const dd = String(t.timestamp.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}` === filterDate;
      });
    }
    return result;
  }, [tickets, filterStatus, filterAgent, filterDate, searchTerm, races]);

  const filteredSummary = useMemo(() => {
    const totalStake = filteredTickets.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
    const totalWinnings = filteredTickets.reduce((sum, t) => sum + Number(t.winnings || 0), 0);
    return {
      count: filteredTickets.length,
      totalStake,
      totalWinnings,
    };
  }, [filteredTickets]);

  return (
    <>
      {ledgerTicket && <TicketCombinationLedger tickets={tickets} onClose={() => setLedgerTicket(null)} />}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header bar */}
        <div className="bg-betese-green px-5 py-3 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-black text-white whitespace-nowrap mr-2">
            Tickets list({filteredTickets.length})
          </h2>

          {/* Filter by agent */}
          <select
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-full border-2 border-white/60 bg-white/90 text-sm font-semibold text-gray-800 focus:outline-none focus:border-white"
          >
            <option value="All">Filter by agent</option>
            {agentOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Date filter */}
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-full border-2 border-white/60 bg-white/90 text-sm text-gray-800 focus:outline-none focus:border-white"
          />

          {/* Ticket number search */}
          <input
            type="text"
            placeholder="Ticket number"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[130px] px-3 py-1.5 rounded-full border-2 border-white/60 bg-white/90 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-white"
          />

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FilterStatus)}
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-full border-2 border-white/60 bg-white/90 text-sm font-semibold text-gray-800 focus:outline-none focus:border-white"
          >
            <option value="All">Filter by status</option>
            <option value="Active">Active</option>
            <option value="Winning">Winning</option>
            <option value="Paid">Paid</option>
            <option value="Lost">Lost</option>
            <option value="Canceled">Canceled</option>
            <option value="Booked">Booked</option>
          </select>
        </div>

        <div className="px-4 py-2 border-b bg-slate-50 text-xs text-gray-700 flex flex-wrap gap-4">
          <span className="font-semibold">Transactions: <span className="font-black text-betese-dark">{filteredSummary.count}</span></span>
          <span className="font-semibold">Total Stake: <span className="font-black text-betese-dark">{filteredSummary.totalStake.toFixed(2)} GMD</span></span>
          <span className="font-semibold">Total Winnings: <span className="font-black text-betese-dark">{filteredSummary.totalWinnings.toFixed(2)} GMD</span></span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gradient-to-b from-green-100 to-green-50 border-b border-gray-300">
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Ticket number</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Race number</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Bet time</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 border-r border-gray-300">Bet</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Result</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Status</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap">Options</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket, rowIdx) => {
                  const hasWinnings = ticket.winnings !== undefined && ticket.winnings > 0;
                  const displayStatus = getDisplayStatus(ticket);
                  const canPayout = hasWinnings && displayStatus === 'Winning' && typeof onPayoutTicket === 'function';
                  const raceInfo = Array.from(new Set(ticket.selections.map(sel => sel.raceId))).map((raceId) => {
                    const race = raceById.get(raceId);
                    if (!race) return { label: raceId, time: '' };
                    const hh = String(race.startDate.getHours()).padStart(2, '0');
                    const mm = String(race.startDate.getMinutes()).padStart(2, '0');
                    return { label: race.name || raceId, time: `${hh}:${mm}` };
                  });

                  return (
                    <tr
                      key={ticket.id}
                      className={`${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-100/70'} border-b border-gray-300 hover:bg-gray-50`}
                    >
                      {/* Ticket number */}
                      <td className="py-3 px-4 align-top border-r border-gray-200">
                        <button
                          onClick={() => setLedgerTicket(ticket)}
                          className="text-xs font-mono text-gray-800 hover:text-blue-700 hover:underline text-left leading-snug break-all"
                          title="View combination ledger"
                        >
                          {ticket.id}
                        </button>
                      </td>

                      {/* Race number */}
                      <td className="py-3 px-4 align-top text-xs text-gray-700 whitespace-nowrap border-r border-gray-200">
                        {raceInfo.map((item, i) => (
                          <div key={i} className="mb-1 last:mb-0">
                            <div className="font-semibold">{item.time ? `${item.label} (${item.time})` : item.label}</div>
                          </div>
                        ))}
                      </td>

                      {/* Bet time */}
                      <td className="py-3 px-4 align-top text-xs text-gray-600 whitespace-nowrap border-r border-gray-200">
                        {formatDate(ticket.timestamp)}
                      </td>

                      {/* Bet combinations — full-width inline boxes */}
                      <td className="py-1.5 px-2 align-top border-r border-gray-200">
                        <div className="">
                          {ticket.selections.map((sel, i) => (
                            <div
                              key={i}
                              className="text-xs text-gray-700 border border-gray-300 px-2 py-1 bg-white leading-snug w-full"
                            >
                              {formatBetLabel(sel.betType)} - {formatBetNumbers(sel)} - {sel.multiplier} ticket(s) {(sel.cost * sel.multiplier).toFixed(0)} GMD
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Result */}
                      <td className="py-3 px-4 align-top text-xs font-semibold whitespace-nowrap border-r border-gray-200">
                        {hasWinnings ? (
                          <div className="space-y-0.5">
                            <span className="text-blue-700">{ticket.winnings!.toFixed(2)} GMD</span>
                            {displayStatus === 'Paid' && (ticket.paidByName || ticket.paidById) && (
                              <div className="text-[11px] text-purple-700 font-bold">
                                Paid by {ticket.paidByName || ticket.paidById}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className={`py-3 px-4 align-top text-xs font-semibold whitespace-nowrap border-r border-gray-200 ${getStatusColor(displayStatus)}`}>
                        {displayStatus}
                      </td>

                      {/* Options */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-start gap-1">
                          <button
                            onClick={() => setLedgerTicket(ticket)}
                            title="Open Ticket Combination Ledger"
                            className="px-2 py-1 rounded border border-blue-400 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold leading-none"
                          >
                            Ledger
                          </button>
                          <button
                            onClick={() => {
                              if (canPayout) {
                                onPayoutTicket(ticket.id);
                              }
                            }}
                            title={canPayout ? 'Pay winning ticket' : 'Payment available for winning tickets only'}
                            disabled={!canPayout}
                            className={`px-2 py-1 rounded border text-[10px] font-bold leading-none transition-colors ${canPayout ? 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700' : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                          >
                            Payment
                          </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-gray-400 text-sm">
                    No tickets match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
