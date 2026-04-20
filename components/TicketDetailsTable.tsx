
import React, { useState, useMemo } from 'react';
import { Ticket, Race } from '../types';
import { TicketModal } from './TicketModal';

interface TicketDetailsTableProps {
  title: string;
  tickets: Ticket[];
  races: Race[]; // Added races for filtering
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

export const TicketDetailsTable: React.FC<TicketDetailsTableProps> = ({ title, tickets, races }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [filterRaceId, setFilterRaceId] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [ticketToView, setTicketToView] = useState<Ticket | null>(null);

  const filteredTickets = useMemo(() => {
    let sortedTickets = [...tickets].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Ticket ID search overrides other filters
    if (searchTerm.trim() !== '') {
        return sortedTickets.filter(t => t.id.includes(searchTerm.trim()));
    }

    if (filterStatus !== 'All') {
        sortedTickets = sortedTickets.filter(t => t.status === filterStatus);
    }
    
    if (filterRaceId !== 'All') {
        sortedTickets = sortedTickets.filter(t => t.selections.some(sel => sel.raceId === filterRaceId));
    }

    return sortedTickets;
  }, [tickets, filterStatus, filterRaceId, searchTerm]);

  const getTicketCount = (status: FilterStatus) => {
      if (status === 'All') return tickets.length;
      return tickets.filter(t => t.status === status).length;
  }

  const FilterButton: React.FC<{ status: FilterStatus, label: string }> = ({ status, label }) => (
    <button
        onClick={() => setFilterStatus(status)}
        className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors flex items-center gap-2 ${
            filterStatus === status
                ? 'bg-betese-green text-white shadow'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
    >
        {label}
        <span className={`text-xs px-2 py-0.5 rounded-full ${filterStatus === status ? 'bg-white/20' : 'bg-gray-300'}`}>
            {getTicketCount(status)}
        </span>
    </button>
  );


  return (
    <>
    {ticketToView && <TicketModal ticket={ticketToView} onClose={() => setTicketToView(null)} showPrintButton={true} races={races} />}
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-betese-dark mb-4">{title}</h2>
      
      {/* Search and Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 border rounded-lg bg-gray-50">
        <div>
            <label htmlFor="ticket-search" className="block text-sm font-medium text-gray-700">Search by Ticket ID</label>
            <input 
                id="ticket-search"
                type="text" 
                placeholder="Type Ticket ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="mt-1 p-2 border rounded w-full bg-white"
            />
        </div>
        <div>
            <label htmlFor="race-filter" className="block text-sm font-medium text-gray-700">Filter by Race</label>
            <select id="race-filter" value={filterRaceId} onChange={e => setFilterRaceId(e.target.value)} className="mt-1 p-2 border rounded w-full bg-white">
              <option value="All">All Races</option>
              {races.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
          <FilterButton status="All" label="All Tickets" />
          <FilterButton status="Winning" label="Winning" />
          <FilterButton status="Paid" label="Paid" />
          <FilterButton status="Lost" label="Lost" />
          <FilterButton status="Active" label="Active" />
          <FilterButton status="Canceled" label="Canceled" />
          <FilterButton status="Booked" label="Booked" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="text-left py-2 px-3">Ticket ID</th>
              <th className="text-left py-2 px-3">Processed By</th>
              <th className="text-left py-2 px-3">Timestamp</th>
              <th className="text-left py-2 px-3">Selections & Stake</th>
              <th className="text-right py-2 px-3">Total Cost</th>
              <th className="text-right py-2 px-3">Winnings</th>
              <th className="text-left py-2 px-3">Status</th>
              <th className="text-left py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.length > 0 ? (
              filteredTickets.map(ticket => (
                <tr key={ticket.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 text-xs font-mono">{ticket.id}</td>
                  <td className="py-2 px-3">{ticket.vendorName}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{ticket.timestamp.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</td>
                  <td className="py-2 px-3">
                    {ticket.selections.map((sel, i) => (
                      <div key={i} className={`py-1 ${i > 0 ? 'mt-1 pt-1 border-t border-gray-200' : ''}`}>
                        <div className="flex justify-between items-start">
                           <div>
                                <span className="font-semibold">{sel.raceName} - {sel.betType}</span>
                                <div className="text-xs text-gray-700 font-mono">
                                  {sel.xCount > 0 && `${'X '.repeat(sel.xCount)}`}
                                  {sel.numbers.join(', ')}
                                </div>
                           </div>
                           <div className="text-right ml-2">
                               <span className="font-semibold text-xs whitespace-nowrap">Stake (x{sel.multiplier})</span>
                               <div className="font-bold text-xs whitespace-nowrap">
                                {(sel.cost * sel.multiplier).toFixed(2)} GMD
                               </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </td>
                  <td className="py-2 px-3 font-semibold whitespace-nowrap text-right">{ticket.totalCost.toFixed(2)} GMD</td>
                  <td className="py-2 px-3 font-semibold whitespace-nowrap text-right text-blue-600">{ticket.winnings?.toFixed(2) ?? '---'}</td>
                  <td className={`py-2 px-3 font-bold ${getStatusColor(ticket.status)}`}>{ticket.status}</td>
                   <td className="py-2 px-3 text-xs">
                    <div className="flex flex-col gap-1 items-start">
                        <button onClick={() => setTicketToView(ticket)} className="px-2 py-1 bg-blue-500 text-white font-semibold rounded hover:bg-blue-600 text-xs">
                            View
                        </button>
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
                <td colSpan={8} className="py-4 px-3 text-center text-gray-500">
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
