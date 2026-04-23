
import React, { useState, useMemo } from 'react';
import { Ticket, Race } from '../types';
import { TicketModal } from './TicketModal';
import { TicketCombinationLedger } from './TicketCombinationLedger';

interface TicketDetailsTableProps {
  title: string;
  tickets: Ticket[];
  races: Race[];
  onCancelTicket?: (ticketId: string) => void;
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

export const TicketDetailsTable: React.FC<TicketDetailsTableProps> = ({ tickets, races, onCancelTicket }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [filterAgent, setFilterAgent] = useState<string>('All');
  // Pre-fill today's date so the date box shows current date like the screenshot
  const [filterDate, setFilterDate] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ticketToView, setTicketToView] = useState<Ticket | null>(null);
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

    const hasRaceStarted = ticketRaces.some(r => now >= r.startDate);
    if (!hasRaceStarted) return 'Active';

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
      result = result.filter(t =>
        t.id.toLowerCase().includes(term) ||
        t.selections.some(sel =>
          sel.betType.toLowerCase().includes(term) ||
          sel.raceName.toLowerCase().includes(term) ||
          sel.numbers.join(' ').includes(term)
        )
      );
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

  return (
    <>
      {ticketToView && <TicketModal ticket={ticketToView} onClose={() => setTicketToView(null)} showPrintButton={true} races={races} />}
      {ledgerTicket && <TicketCombinationLedger ticket={ledgerTicket} onClose={() => setLedgerTicket(null)} />}

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
                      {/* Ticket number — clickable for ledger */}
                      <td className="py-3 px-4 align-top border-r border-gray-200">
                        <button
                          onClick={() => setLedgerTicket(ticket)}
                          className="text-xs font-mono text-gray-800 hover:text-blue-700 hover:underline text-left leading-snug break-all"
                          title="View combination ledger"
                        >
                          {ticket.id}
                        </button>
                        <div className="text-[11px] text-gray-500 mt-1">{ticket.vendorName || '-'}</div>
                      </td>

                      {/* Race number */}
                      <td className="py-3 px-4 align-top text-xs text-gray-700 whitespace-nowrap border-r border-gray-200">
                        {raceInfo.map((item, i) => (
                          <div key={i} className="mb-1 last:mb-0">
                            <div className="font-semibold">{item.label}</div>
                            {item.time && <div className="text-[11px] text-gray-500">Time: {item.time}</div>}
                          </div>
                        ))}
                      </td>

                      {/* Bet time */}
                      <td className="py-3 px-4 align-top text-xs text-gray-600 whitespace-nowrap border-r border-gray-200">
                        <div>{ticket.timestamp.toLocaleDateString('en-US')}</div>
                        <div className="text-[11px] text-gray-500">{ticket.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</div>
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
                          <span className="text-blue-700">{ticket.winnings!.toFixed(2)} GMD</span>
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
                          {/* Print/view icon button */}
                          <button
                            onClick={() => setTicketToView(ticket)}
                            title="View / Print"
                            className="p-1 rounded border border-gray-400 bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v1a1 1 0 001 1h8a1 1 0 001-1v-1h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5V9h10v4h-1v-1a1 1 0 00-1-1H7a1 1 0 00-1 1v1zm2 2v-2h4v2H8z" clipRule="evenodd" />
                            </svg>
                          </button>
                          </div>

                          {ticket.status === 'Canceled' && (
                            <div className="text-[10px] text-gray-500 leading-tight">
                              Canceled by: {ticket.canceledByName || 'Admin/Vendor'}
                            </div>
                          )}

                          {ticket.status === 'Paid' && (
                            <div className="text-[10px] text-gray-700 leading-tight font-semibold">
                              Paid by: {ticket.paidByName || 'Admin/Vendor'}
                            </div>
                          )}
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
