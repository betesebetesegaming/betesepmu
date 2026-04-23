
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

const getStatusColor = (status: Ticket['status']) => {
  switch (status) {
    case 'Winning':  return 'text-blue-600';
    case 'Paid':     return 'text-purple-600';
    case 'Lost':     return 'text-red-600';
    case 'Canceled': return 'text-gray-400';
    case 'Active':   return 'text-green-700';
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
  return `${mm}/${dd}/${yyyy} at ${hh}:${min}`;
};

type FilterStatus = Ticket['status'] | 'All';

export const TicketDetailsTable: React.FC<TicketDetailsTableProps> = ({ tickets, races, onCancelTicket }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ticketToView, setTicketToView] = useState<Ticket | null>(null);
  const [ledgerTicket, setLedgerTicket] = useState<Ticket | null>(null);

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
    if (filterStatus !== 'All') result = result.filter(t => t.status === filterStatus);
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
  }, [tickets, filterStatus, filterAgent, filterDate, searchTerm]);

  // Default today's date display for the date input placeholder
  const todayFormatted = (() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${now.getFullYear()}`;
  })();

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
            placeholder={todayFormatted}
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
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="text-left py-2.5 px-4 font-bold text-gray-600 whitespace-nowrap">Ticket number</th>
                <th className="text-left py-2.5 px-4 font-bold text-gray-600 whitespace-nowrap">Race number</th>
                <th className="text-left py-2.5 px-4 font-bold text-gray-600 whitespace-nowrap">Bet time</th>
                <th className="text-left py-2.5 px-4 font-bold text-gray-600">Bet</th>
                <th className="text-left py-2.5 px-4 font-bold text-gray-600">Result</th>
                <th className="text-left py-2.5 px-4 font-bold text-gray-600">Status</th>
                <th className="text-left py-2.5 px-4 font-bold text-gray-600">Options</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket, rowIdx) => {
                  const raceLabels = Array.from(new Set(ticket.selections.map(sel => sel.raceName || sel.raceId)));
                  const hasWinnings = ticket.winnings !== undefined && ticket.winnings > 0;

                  return (
                    <tr
                      key={ticket.id}
                      className={`border-b border-gray-200 align-top ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30`}
                    >
                      {/* Ticket number — clickable for ledger */}
                      <td className="py-3 px-4 align-middle">
                        <button
                          onClick={() => setLedgerTicket(ticket)}
                          className="text-xs font-mono font-semibold text-gray-800 hover:text-blue-700 hover:underline text-left leading-snug"
                          title="View combination ledger"
                        >
                          {ticket.id}
                        </button>
                      </td>

                      {/* Race number */}
                      <td className="py-3 px-4 align-middle text-xs font-semibold text-gray-700 whitespace-nowrap">
                        {raceLabels.map((label, i) => <div key={i}>{label}</div>)}
                      </td>

                      {/* Bet time */}
                      <td className="py-3 px-4 align-middle text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(ticket.timestamp)}
                      </td>

                      {/* Bet combinations — always shown inline, one per row */}
                      <td className="py-2 px-4 align-middle">
                        <div className="space-y-0.5">
                          {ticket.selections.map((sel, i) => (
                            <div
                              key={i}
                              className="text-xs text-gray-800 border border-gray-200 rounded px-2 py-1 bg-white leading-snug"
                            >
                              {sel.betType} - {formatBetNumbers(sel)} - {sel.multiplier} ticket(s) {(sel.cost * sel.multiplier).toFixed(0)} GMD
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Result */}
                      <td className="py-3 px-4 align-middle text-xs font-semibold whitespace-nowrap">
                        {hasWinnings ? (
                          <span className="text-blue-700">{ticket.winnings!.toFixed(2)} GMD</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className={`py-3 px-4 align-middle text-xs font-bold whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </td>

                      {/* Options */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          {/* Print/view icon button */}
                          <button
                            onClick={() => setTicketToView(ticket)}
                            title="View / Print"
                            className="p-1.5 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v1a1 1 0 001 1h8a1 1 0 001-1v-1h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5V9h10v4h-1v-1a1 1 0 00-1-1H7a1 1 0 00-1 1v1zm2 2v-2h4v2H8z" clipRule="evenodd" />
                            </svg>
                          </button>

                          {onCancelTicket && (ticket.status === 'Active' || ticket.status === 'Booked') && (
                            <button
                              onClick={() => onCancelTicket(ticket.id)}
                              title="Cancel ticket"
                              className="p-1.5 rounded border border-red-300 bg-white hover:bg-red-50 text-red-600 transition-colors"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}

                          {ticket.status === 'Canceled' && ticket.canceledByName && (
                            <span className="text-[10px] text-gray-400">By: {ticket.canceledByName}</span>
                          )}
                          {ticket.status === 'Paid' && ticket.paidByName && (
                            <span className="text-[10px] text-gray-400">By: {ticket.paidByName}</span>
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
