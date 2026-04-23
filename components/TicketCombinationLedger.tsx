import React, { useMemo, useState } from 'react';
import { Ticket } from '../types';

interface TicketCombinationLedgerProps {
  tickets: Ticket[];
  onClose: () => void;
}

const getStatusColor = (status: Ticket['status']) => {
  switch (status) {
    case 'Winning': return 'text-blue-700';
    case 'Paid': return 'text-purple-700';
    case 'Lost': return 'text-red-600';
    case 'Canceled': return 'text-gray-500';
    case 'Booked': return 'text-yellow-700';
    case 'Active':
    default:
      return 'text-gray-800';
  }
};

const formatCombination = (sel: Ticket['selections'][number]): string => {
  if (sel.pattern && sel.pattern.length > 0) return sel.pattern.join(' - ');
  const prefix = sel.xCount > 0 ? Array(sel.xCount).fill('X').join(' - ') + ' - ' : '';
  return prefix + sel.numbers.join(' - ');
};

const toDateInput = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeDate = (value: Date | string | number | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type LedgerFilterStatus = Ticket['status'] | 'All';

interface LedgerRow {
  ticketId: string;
  vendorName: string;
  dateKey: string;
  race: string;
  betType: string;
  combination: string;
  stake: number;
  status: Ticket['status'];
  payout: number;
  paidBy: string;
}

export const TicketCombinationLedger: React.FC<TicketCombinationLedgerProps> = ({ tickets, onClose }) => {
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTicketNumber, setFilterTicketNumber] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<LedgerFilterStatus>('All');

  const rows = useMemo<LedgerRow[]>(() => {
    return tickets.flatMap(ticket =>
      ticket.selections.map((sel, selectionIndex) => {
        const breakdown = ticket.winningsBreakdown?.find(b => b.selectionIndex === selectionIndex);
        const safeDate = normalizeDate(ticket.timestamp as unknown as Date | string | number);
        return {
          ticketId: ticket.id,
          vendorName: ticket.vendorName || '-',
          dateKey: safeDate ? toDateInput(safeDate) : '',
          race: sel.raceName || sel.raceId,
          betType: sel.betType,
          combination: formatCombination(sel),
          stake: sel.cost * sel.multiplier,
          status: ticket.status,
          payout: breakdown?.totalPayout || 0,
          paidBy: ticket.paidByName || ticket.paidById || '',
        };
      })
    );
  }, [tickets]);

  const agentOptions = useMemo(() => {
    return Array.from(new Set(rows.map(r => r.vendorName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const ticketTerm = filterTicketNumber.trim().toLowerCase();
    return rows.filter(row => {
      if (filterAgent !== 'All' && row.vendorName.toLowerCase() !== filterAgent.toLowerCase()) return false;
      if (filterDate && row.dateKey !== filterDate) return false;
      if (ticketTerm && !row.ticketId.toLowerCase().includes(ticketTerm)) return false;
      if (filterStatus !== 'All' && row.status !== filterStatus) return false;
      return true;
    });
  }, [rows, filterAgent, filterDate, filterTicketNumber, filterStatus]);

  const totals = useMemo(() => {
    const totalStake = filteredRows.reduce((sum, row) => sum + row.stake, 0);
    const totalPayout = filteredRows.reduce((sum, row) => sum + row.payout, 0);
    return { totalStake, totalPayout };
  }, [filteredRows]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl my-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wide">Ticket Combination Ledger</h2>
            <p className="text-xs text-gray-500 mt-0.5">This table shows ticket number and exact combination for each selection so winning combinations can be verified per race.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl leading-none">&times;</button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b" style={{ backgroundColor: '#eef9ee' }}>
          <div className="text-xs font-bold text-gray-700 mb-2 uppercase">Filter Controls</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}
          >
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Agent Name Filter</label>
            <select
              value={filterAgent}
              onChange={e => setFilterAgent(e.target.value)}
              className="w-full p-2 border rounded bg-white text-sm"
            >
              <option value="All">All Agents</option>
              {agentOptions.map(agent => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Date Selection</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="w-full p-2 border rounded bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Ticket Number</label>
            <input
              type="text"
              value={filterTicketNumber}
              onChange={e => setFilterTicketNumber(e.target.value)}
              placeholder="Enter ticket number"
              className="w-full p-2 border rounded bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as LedgerFilterStatus)}
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
        </div>

        <div className="px-6 py-2 border-b bg-slate-50 text-xs text-gray-600 flex items-center justify-between">
          <span>Showing {filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => {
              setFilterAgent('All');
              setFilterDate('');
              setFilterTicketNumber('');
              setFilterStatus('All');
            }}
            className="text-xs font-semibold text-blue-700 hover:underline"
          >
            Clear all filters
          </button>
        </div>

        {/* Combination Table */}
        <div className="overflow-x-auto px-6 py-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide rounded-tl-lg">Ticket</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Race</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Bet Type</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Combination</th>
                <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide">Stake</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Status</th>
                <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide rounded-tr-lg">Payout</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const stake = row.stake.toFixed(2);

                return (
                  <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="py-3 px-3 text-xs font-mono font-semibold text-gray-700">{row.ticketId}</td>
                    <td className="py-3 px-3 text-xs font-semibold text-gray-800">{row.race}</td>
                    <td className="py-3 px-3 text-xs text-gray-700">{row.betType}</td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-sm text-gray-900 tracking-widest">
                        {row.combination}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-800 text-xs">{stake} GMD</td>
                    <td className={`py-3 px-3 text-xs font-semibold ${getStatusColor(row.status)}`}>{row.status}</td>
                    <td className="py-3 px-3 text-right text-xs font-semibold text-gray-700">
                      <div>{row.payout.toFixed(2)} GMD</div>
                      {row.status === 'Paid' && row.paidBy && (
                        <div className="text-[10px] text-purple-700 font-bold">by {row.paidBy}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-5 text-center text-sm text-gray-500">
                    {rows.length === 0
                      ? 'No ticket transaction data available to display.'
                      : 'No rows match current filters. Click "Clear all filters" to view all transactions.'}
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer: totals */}
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td colSpan={4} className="py-3 px-3 text-xs font-black text-gray-600 uppercase tracking-wide">
                  Total ({filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''})
                </td>
                <td className="py-3 px-3 text-right font-black text-gray-900 text-sm">{totals.totalStake.toFixed(2)} GMD</td>
                <td className="py-3 px-3"></td>
                <td className="py-3 px-3 text-right font-black text-sm text-gray-900">{totals.totalPayout.toFixed(2)} GMD</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-gray-600 font-bold text-xs uppercase tracking-widest bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
