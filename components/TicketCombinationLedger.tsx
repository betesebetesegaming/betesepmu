import React, { useMemo, useState } from 'react';
import { Ticket, WinningsBreakdown } from '../types';

interface TicketCombinationLedgerProps {
  ticket: Ticket;
  onClose: () => void;
}

const getWinBreakdown = (ticket: Ticket, index: number): WinningsBreakdown | undefined =>
  ticket.winningsBreakdown?.find(b => b.selectionIndex === index);

const getStatusBadge = (status: 'Win' | 'Loss') =>
  status === 'Win'
    ? 'bg-green-100 text-green-800 border border-green-300'
    : 'bg-red-100 text-red-800 border border-red-300';

const getOverallStatusBadge = (status: Ticket['status']) => {
  switch (status) {
    case 'Winning': return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'Paid': return 'bg-purple-100 text-purple-800 border border-purple-300';
    case 'Lost': return 'bg-red-100 text-red-800 border border-red-300';
    case 'Canceled': return 'bg-gray-100 text-gray-600 border border-gray-300';
    case 'Active': return 'bg-green-100 text-green-800 border border-green-300';
    case 'Booked': return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    default: return 'bg-gray-100 text-gray-600';
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

type LedgerFilterStatus = 'All' | 'Win' | 'Loss' | 'Pending';

export const TicketCombinationLedger: React.FC<TicketCombinationLedgerProps> = ({ ticket, onClose }) => {
  const hasResult = ticket.winningsBreakdown && ticket.winningsBreakdown.length > 0;
  const totalWinnings = ticket.winnings ?? 0;
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTicketNumber, setFilterTicketNumber] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<LedgerFilterStatus>('All');

  const agentOptions = useMemo(() => {
    return ticket.vendorName ? [ticket.vendorName] : [];
  }, [ticket.vendorName]);

  const filteredSelections = useMemo(() => {
    const ticketDate = toDateInput(ticket.timestamp);
    const ticketIdLower = ticket.id.toLowerCase();
    const selectedAgent = (ticket.vendorName || '').toLowerCase();

    const agentMatches =
      filterAgent === 'All' || selectedAgent === filterAgent.toLowerCase();
    const dateMatches = !filterDate || filterDate === ticketDate;
    const ticketMatches =
      !filterTicketNumber.trim() || ticketIdLower.includes(filterTicketNumber.trim().toLowerCase());

    if (!agentMatches || !dateMatches || !ticketMatches) return [];

    return ticket.selections.filter((_, i) => {
      if (filterStatus === 'All') return true;
      const breakdown = getWinBreakdown(ticket, i);
      if (filterStatus === 'Pending') return !breakdown;
      return breakdown?.status === filterStatus;
    });
  }, [ticket, filterAgent, filterDate, filterTicketNumber, filterStatus]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wide">Ticket Combination Ledger</h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">#{ticket.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-3xl leading-none">&times;</button>
        </div>

        {/* Ticket Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 border-b bg-white">
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Agent</p>
            <p className="text-sm font-semibold text-gray-800">{ticket.vendorName || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Bet Time</p>
            <p className="text-sm font-semibold text-gray-800">
              {ticket.timestamp.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Stake</p>
            <p className="text-sm font-black text-gray-900">{ticket.totalCost.toFixed(2)} GMD</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Status</p>
            <span className={`inline-block text-xs font-black px-2 py-0.5 rounded-full ${getOverallStatusBadge(ticket.status)}`}>
              {ticket.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 px-6 py-4 border-b bg-green-50">
          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Filter Agent</label>
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
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Date</label>
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="w-full p-2 border rounded bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Ticket Manualy</label>
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
              <option value="Win">Win</option>
              <option value="Loss">Loss</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Combination Table */}
        <div className="overflow-x-auto px-6 py-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide rounded-tl-lg">#</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Race</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Bet Type</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Combination</th>
                <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide">Stake</th>
                {hasResult && (
                  <>
                    <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Result</th>
                    <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide rounded-tr-lg">Payout</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredSelections.map((sel, i) => {
                const originalIndex = ticket.selections.findIndex((ticketSel) => ticketSel === sel);
                const breakdown = getWinBreakdown(ticket, originalIndex);
                const stake = (sel.cost * sel.multiplier).toFixed(2);

                return (
                  <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="py-3 px-3 text-xs font-bold text-gray-500">{i + 1}</td>
                    <td className="py-3 px-3">
                      <span className="text-xs font-semibold text-gray-800">{sel.raceName}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                        {sel.betType}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono font-black text-sm text-gray-900 tracking-widest">
                        {formatCombination(sel)}
                      </div>
                      {sel.multiplier > 1 && (
                        <div className="text-[10px] text-gray-400 mt-0.5">×{sel.multiplier} multiplier</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-800 text-xs">{stake} GMD</td>

                    {hasResult && (
                      <>
                        <td className="py-3 px-3">
                          {breakdown ? (
                            <div className="space-y-1">
                              <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full ${getStatusBadge(breakdown.status)}`}>
                                {breakdown.status.toUpperCase()}
                              </span>
                              {breakdown.status === 'Win' && breakdown.winType && (
                                <div className="text-[10px] text-gray-500 font-semibold">{breakdown.winType}</div>
                              )}
                              {breakdown.status === 'Win' && breakdown.winningCombinations && breakdown.winningCombinations > 0 && (
                                <div className="text-[10px] text-gray-500">
                                  {breakdown.winningCombinations} combo{breakdown.winningCombinations > 1 ? 's' : ''}
                                </div>
                              )}
                              {breakdown.source && breakdown.source !== 'Primary' && (
                                <div className="text-[10px] text-orange-500 font-bold">{breakdown.source}</div>
                              )}
                              {breakdown.status === 'Win' && breakdown.winningCombinationList && breakdown.winningCombinationList.length > 0 && (
                                <div className="text-[10px] font-mono text-green-700 mt-1 space-y-0.5">
                                  {breakdown.winningCombinationList.map((combo, ci) => (
                                    <div key={ci} className="bg-green-50 border border-green-200 rounded px-1 py-0.5">
                                      {combo.join(' - ')}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {breakdown?.status === 'Win' && breakdown.totalPayout ? (
                            <span className="font-black text-green-700 text-sm">
                              {breakdown.totalPayout.toFixed(2)} GMD
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {filteredSelections.length === 0 && (
                <tr>
                  <td colSpan={hasResult ? 7 : 5} className="py-5 text-center text-sm text-gray-500">
                    No combinations match current filters.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Footer: totals */}
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td colSpan={hasResult ? 4 : 4} className="py-3 px-3 text-xs font-black text-gray-600 uppercase tracking-wide">
                  Total ({filteredSelections.length} selection{filteredSelections.length !== 1 ? 's' : ''})
                </td>
                <td className="py-3 px-3 text-right font-black text-gray-900 text-sm">{filteredSelections.reduce((sum, sel) => sum + (sel.cost * sel.multiplier), 0).toFixed(2)} GMD</td>
                {hasResult && (
                  <>
                    <td className="py-3 px-3"></td>
                    <td className="py-3 px-3 text-right font-black text-sm">
                      {totalWinnings > 0 ? (
                        <span className="text-green-700">{totalWinnings.toFixed(2)} GMD</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Win Summary Banner */}
        {totalWinnings > 0 && (
          <div className="mx-6 mb-4 rounded-xl bg-green-50 border border-green-300 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Total Winnings</p>
              <p className="text-2xl font-black text-green-800">{totalWinnings.toFixed(2)} GMD</p>
            </div>
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

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
