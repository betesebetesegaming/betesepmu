
import React, { useState, useMemo } from 'react';
import { Ticket, Race } from '../types';
import { TicketModal } from './TicketModal';
import { TicketCombinationLedger } from './TicketCombinationLedger';

interface TicketDetailsTableProps {
  title: string;
  tickets: Ticket[];
  races: Race[]; // Added races for filtering
  onCancelTicket?: (ticketId: string) => void;
}

const getStatusColor = (status: Ticket['status']) => {
    switch (status) {
        case 'Winning': return 'text-blue-600';
        case 'Paid': return 'text-purple-600';
        case 'Lost': return 'text-red-600';
        case 'Canceled': return 'text-gray-500';
        case 'Active': return 'text-green-600';
        case 'Booked': return 'text-yellow-800';
        default: return 'text-black';
    }
}

type FilterStatus = Ticket['status'] | 'All';

export const TicketDetailsTable: React.FC<TicketDetailsTableProps> = ({ tickets, races, onCancelTicket }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ticketToView, setTicketToView] = useState<Ticket | null>(null);
  const [ledgerTicket, setLedgerTicket] = useState<Ticket | null>(null);

  const agentOptions = useMemo(() => {
    return Array.from(new Set(tickets.map(t => t.vendorName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    let sortedTickets = [...tickets].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (searchTerm.trim() !== '') {
      const term = searchTerm.trim().toLowerCase();
      sortedTickets = sortedTickets.filter(t => {
        const combinationText = t.selections
          .map(sel => [sel.betType, sel.raceName, sel.pattern?.join('-') || sel.numbers.join('-'), sel.numbers.join(','), String(sel.xCount || 0)].join(' '))
          .join(' ')
          .toLowerCase();
        return t.id.toLowerCase().includes(term) || combinationText.includes(term);
      });
    }

    if (filterStatus !== 'All') {
        sortedTickets = sortedTickets.filter(t => t.status === filterStatus);
    }

    if (filterAgent !== 'All') {
        sortedTickets = sortedTickets.filter(t => (t.vendorName || '').toLowerCase() === filterAgent.toLowerCase());
    }

    if (filterDate) {
        sortedTickets = sortedTickets.filter(t => {
            const yyyy = t.timestamp.getFullYear();
            const mm = String(t.timestamp.getMonth() + 1).padStart(2, '0');
            const dd = String(t.timestamp.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}` === filterDate;
        });
    }

    return sortedTickets;
  }, [tickets, filterStatus, filterAgent, filterDate, searchTerm]);


  return (
    <>
    {ticketToView && <TicketModal ticket={ticketToView} onClose={() => setTicketToView(null)} showPrintButton={true} races={races} />}
    {ledgerTicket && <TicketCombinationLedger ticket={ledgerTicket} onClose={() => setLedgerTicket(null)} />}
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-3xl font-black text-betese-dark mb-4 uppercase">TICKET</h2>
      
      <div className="mb-4 text-sm font-semibold text-gray-700">Tickets list({filteredTickets.length})</div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 p-3 border rounded-lg bg-green-50">
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="p-2 border rounded bg-white text-sm font-semibold">
          <option value="All">Filter by agent</option>
          {agentOptions.map(agent => <option key={agent} value={agent}>{agent}</option>)}
        </select>

        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="p-2 border rounded bg-white text-sm" />

        <input
          type="text"
          placeholder="Ticket number"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="p-2 border rounded bg-white text-sm"
        />

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as FilterStatus)} className="p-2 border rounded bg-white text-sm font-semibold">
          <option value="All">Filter by status</option>
          <option value="Active">Active</option>
          <option value="Winning">Winning</option>
          <option value="Paid">Paid</option>
          <option value="Lost">Lost</option>
          <option value="Canceled">Canceled</option>
          <option value="Booked">Booked</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="text-left py-2 px-3">Ticket Number</th>
              <th className="text-left py-2 px-3">Race Number</th>
              <th className="text-left py-2 px-3">Bet Time</th>
              <th className="text-left py-2 px-3">Bet-Combinations</th>
              <th className="text-left py-2 px-3">Result</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Cancel Options</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length > 0 ? (
              filteredTickets.map(ticket => (
                <tr key={ticket.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 text-xs font-mono">
                    <button
                      onClick={() => setLedgerTicket(ticket)}
                      className="text-blue-700 font-mono font-semibold hover:underline hover:text-blue-900 text-left"
                      title="View combination ledger"
                    >
                      {ticket.id}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-xs">
                    <div className="space-y-1">
                      {Array.from(new Set(ticket.selections.map(sel => sel.raceName || sel.raceId))).map((raceLabel, idx) => (
                        <div key={idx} className="font-semibold">{raceLabel}</div>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">{ticket.timestamp.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</td>
                  <td className="py-2 px-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-blue-700">Show selections ({ticket.selections.length})</summary>
                      <div className="mt-2 space-y-1">
                        {ticket.selections.map((sel, i) => (
                          <div key={i} className="text-xs border rounded px-2 py-1 bg-gray-50">
                            <div className="font-semibold">{sel.betType}</div>
                            <div className="font-mono">{sel.pattern && sel.pattern.length > 0 ? sel.pattern.join('-') : `${sel.xCount > 0 ? 'X-'.repeat(sel.xCount) : ''}${sel.numbers.join('-')}`}</div>
                            <div className="text-gray-600">Stake: {(sel.cost * sel.multiplier).toFixed(2)} GMD</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </td>
                  <td className="py-2 px-3 font-semibold text-blue-700">{ticket.winnings !== undefined && ticket.winnings > 0 ? `${ticket.winnings.toFixed(2)} GMD` : '-'}</td>
                  <td className={`py-2 px-3 font-bold ${getStatusColor(ticket.status)}`}>{ticket.status}</td>
                   <td className="py-2 px-3 text-xs">
                    <div className="flex flex-col gap-1 items-start">
                        <button onClick={() => setTicketToView(ticket)} className="px-2 py-1 bg-blue-500 text-white font-semibold rounded hover:bg-blue-600 text-xs">
                            View
                        </button>
                        {onCancelTicket && (ticket.status === 'Active' || ticket.status === 'Booked') && (
                          <button onClick={() => onCancelTicket(ticket.id)} className="px-2 py-1 bg-red-600 text-white font-semibold rounded hover:bg-red-700 text-xs">
                            Cancel
                          </button>
                        )}
                        {ticket.status === 'Canceled' && ticket.canceledByName && (
                          <span>By: {ticket.canceledByName}</span>
                        )}
                         {ticket.status === 'Paid' && ticket.paidByName && (
                          <span>By: {ticket.paidByName}</span>
                        )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-4 px-3 text-center text-gray-500">
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
