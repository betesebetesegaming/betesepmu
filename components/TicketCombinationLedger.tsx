import React, { useMemo, useState } from 'react';
import { Race, Ticket } from '../types';

interface TicketCombinationLedgerProps {
  tickets: Ticket[];
  races: Race[];
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
  actorName: string;
  dateKey: string;
  raceId: string;
  race: string;
  raceCode: string;
  scheduledTime: Date | null;
  isFinished: boolean;
  betType: string;
  combination: string;
  stake: number;
  status: Ticket['status'];
  selectionStatus: 'Win' | 'Loss' | 'Pending' | 'Booked' | 'Canceled';
  payout: number;
  paidBy: string;
  winningCombinations?: number;
  winningCombinationText?: string;
  winType?: string;
  payoutCheck?: 'OK' | 'Check';
  stampTime: string;
}

interface RaceLedgerSection {
  raceId: string;
  raceCode: string;
  raceName: string;
  scheduledTime: Date | null;
  isFinished: boolean;
  winningNumbers: string;
  dateKey: string;
  isToday: boolean;
  ordinal: number;
  rows: LedgerRow[];
}

export const TicketCombinationLedger: React.FC<TicketCombinationLedgerProps> = ({ tickets, races, onClose }) => {
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterTicketNumber, setFilterTicketNumber] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<LedgerFilterStatus>('All');

  const getTicketStatusLabel = (status: Ticket['status']) => {
    if (status === 'Active') return 'Awaiting Result';
    if (status === 'Winning') return 'Awaiting Cashier Payout';
    if (status === 'Booked') return 'Booking Pending Payment';
    if (status === 'Paid') return 'Paid';
    if (status === 'Lost') return 'Lost';
    if (status === 'Canceled') return 'Canceled';
    return status;
  };

  const getSelectionOutcomeLabel = (row: LedgerRow) => {
    if (row.selectionStatus === 'Win') return 'Winning';
    if (row.selectionStatus === 'Loss') return 'Lost';
    if (row.selectionStatus === 'Pending') return 'Awaiting Result';
    if (row.selectionStatus === 'Booked') return 'Booking Pending Payment';
    if (row.selectionStatus === 'Canceled') return 'Canceled';
    return getTicketStatusLabel(row.status);
  };

  const raceById = useMemo(() => new Map(races.map(race => [race.id, race])), [races]);
  const now = new Date();

  const rows = useMemo<LedgerRow[]>(() => {
    return tickets.flatMap(ticket =>
      ticket.selections.map((sel, selectionIndex) => {
        const race = raceById.get(sel.raceId);
        const breakdown = ticket.winningsBreakdown?.find(b => b.selectionIndex === selectionIndex);
        const safeDate = normalizeDate(ticket.timestamp as unknown as Date | string | number);
        const scheduledTime = race?.endDate || null;
        const isFinished = Boolean(race?.result) || (scheduledTime ? now >= scheduledTime : false);
        const selectionStatus: LedgerRow['selectionStatus'] = ticket.status === 'Canceled'
          ? 'Canceled'
          : ticket.status === 'Booked'
            ? 'Booked'
            : breakdown?.status === 'Win'
              ? 'Win'
              : isFinished
                ? 'Loss'
                : 'Pending';
        const payout = Number(breakdown?.totalPayout || 0);
        const winningCombinationText = breakdown?.winningCombinationList?.length
          ? breakdown.winningCombinationList.map(combo => combo.join('-')).join(' | ')
          : undefined;
        const expectedPayout = breakdown && breakdown.payoutPerCombination !== undefined && breakdown.winningCombinations !== undefined
          ? Number((breakdown.payoutPerCombination * breakdown.winningCombinations).toFixed(2))
          : payout;
        return {
          ticketId: ticket.id,
          vendorName: ticket.vendorName || '-',
          actorName: ticket.customerId ? `ONLINE (${ticket.customerId})` : (ticket.vendorName || '-'),
          dateKey: safeDate ? toDateInput(safeDate) : '',
          raceId: sel.raceId,
          race: sel.raceName || race?.name || sel.raceId,
          raceCode: race?.raceCode || race?.name || sel.raceId,
          scheduledTime,
          isFinished,
          betType: sel.betType,
          combination: formatCombination(sel),
          stake: sel.cost * sel.multiplier,
          status: ticket.status,
          selectionStatus,
          payout,
          paidBy: ticket.paidByName || ticket.paidById || '',
          winningCombinations: breakdown?.winningCombinations,
          winningCombinationText,
          winType: breakdown?.winType,
          payoutCheck: breakdown?.status === 'Win' && Math.abs(expectedPayout - payout) < 0.01 ? 'OK' : breakdown?.status === 'Win' ? 'Check' : undefined,
          stampTime: safeDate ? safeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        };
      })
    );
  }, [tickets, raceById, now]);

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

  const ledgerByRace = useMemo(() => {
    const todayKey = toDateInput(now);
    const sectionMap = new Map<string, RaceLedgerSection>();

    filteredRows.forEach(row => {
      const baseDate = row.scheduledTime || normalizeDate(`${row.dateKey}T00:00:00`) || now;
      const dateKey = toDateInput(baseDate);
      if (!sectionMap.has(row.raceId)) {
        sectionMap.set(row.raceId, {
          raceId: row.raceId,
          raceCode: row.raceCode,
          raceName: row.race,
          scheduledTime: row.scheduledTime,
          isFinished: row.isFinished,
          winningNumbers: row.isFinished ? 'Result added' : 'Pending result',
          dateKey,
          isToday: dateKey === todayKey,
          ordinal: 0,
          rows: [],
        });
      }
      sectionMap.get(row.raceId)!.rows.push(row);
    });

    const sections = Array.from(sectionMap.values());
    const todaySorted = sections.filter(s => s.isToday).sort((a, b) => {
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;
      return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });
    todaySorted.forEach((section, index) => { section.ordinal = index + 1; });

    sections.sort((a, b) => {
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      if (a.isToday && b.isToday) {
        if (a.isFinished && !b.isFinished) return -1;
        if (!a.isFinished && b.isFinished) return 1;
        if (a.scheduledTime && b.scheduledTime) return b.scheduledTime.getTime() - a.scheduledTime.getTime();
        return 0;
      }
      if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
      if (a.scheduledTime && b.scheduledTime) return b.scheduledTime.getTime() - a.scheduledTime.getTime();
      return a.raceName.localeCompare(b.raceName);
    });

    return { sections, todayKey };
  }, [filteredRows, now]);

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
              <option value="Active">Awaiting Result</option>
              <option value="Winning">Awaiting Cashier Payout</option>
              <option value="Lost">Lost</option>
              <option value="Booked">Booking Pending Payment</option>
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
        <div className="px-6 py-4 space-y-5">
          <p className="text-sm text-gray-500">Races grouped by date · today first · most recently ended on top with OUTSTANDING badge.</p>
          {ledgerByRace.sections.length === 0 ? (
            <div className="py-5 text-center text-sm text-gray-500 border rounded-lg bg-gray-50">
              {rows.length === 0
                ? 'No ticket transaction data available to display.'
                : 'No rows match current filters. Click "Clear all filters" to view all transactions.'}
            </div>
          ) : (
            ledgerByRace.sections.map((section, index) => {
              const isFirstFinished = index === 0 && section.isFinished;
              const headerClass = isFirstFinished
                ? 'bg-orange-500 text-white'
                : section.isFinished
                  ? 'bg-amber-50 text-amber-900 border-b border-amber-200'
                  : 'bg-betese-dark text-white';

              return (
                <div key={section.raceId} className={`border-2 rounded-xl overflow-hidden ${isFirstFinished ? 'border-orange-400 shadow-lg' : section.isFinished ? 'border-amber-300 shadow-md' : 'border-gray-200'}`}>
                  <div className={`flex items-center justify-between px-4 py-3 gap-3 flex-wrap ${headerClass}`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      {section.isToday && section.ordinal > 0 && (
                        <span className={`text-[11px] font-black uppercase px-2 py-1 rounded ${isFirstFinished ? 'bg-white/20' : section.isFinished ? 'bg-amber-200 text-amber-900' : 'bg-white/10'}`}>
                          {section.ordinal === 1 ? '1st Race' : section.ordinal === 2 ? '2nd Race' : section.ordinal === 3 ? '3rd Race' : `${section.ordinal}th Race`}
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base uppercase">{section.raceCode}</span>
                          {section.scheduledTime && <span className="text-sm font-semibold opacity-90">{section.scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                          <span className="font-semibold text-sm opacity-90">- {section.raceName}</span>
                        </div>
                        <div className={`text-xs mt-0.5 ${isFirstFinished ? 'text-white/80' : section.isFinished ? 'text-amber-700' : 'text-white/80'}`}>
                          {section.isFinished ? 'Result added - settlement verified per selection' : 'Awaiting result'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {section.isFinished && (
                        <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border-2 ${isFirstFinished ? 'border-white text-white bg-red-600 animate-pulse' : 'border-amber-500 text-amber-800 bg-amber-100'}`}>
                          OUTSTANDING
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded font-semibold ${section.isFinished ? 'bg-amber-100 text-amber-800' : 'bg-green-500 text-white'}`}>
                        {section.rows.length} row{section.rows.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Ticket</th>
                          <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Bet Type</th>
                          <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Combination</th>
                          <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide">Stake</th>
                          <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wide">Outcome</th>
                          <th className="text-right py-2 px-3 text-xs font-bold uppercase tracking-wide">Payout</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row, i) => (
                          <tr key={`${section.raceId}-${row.ticketId}-${i}`} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="py-3 px-3 text-xs font-mono font-semibold text-gray-700 align-top">
                              <div>{row.ticketId}</div>
                              <div className="text-[10px] text-gray-500 font-semibold mt-0.5">{row.actorName}</div>
                              <div className="text-[10px] text-gray-400">{row.stampTime}</div>
                            </td>
                            <td className="py-3 px-3 text-xs text-gray-700 align-top">{row.betType}</td>
                            <td className="py-3 px-3 align-top">
                              <div className="font-mono text-sm text-gray-900 tracking-widest">{row.combination}</div>
                              {row.selectionStatus === 'Win' && row.winType && (
                                <div className="text-[10px] text-green-700 font-bold mt-1">{row.winType}</div>
                              )}
                              {row.selectionStatus === 'Win' && row.winningCombinations !== undefined && (
                                <div className="text-[10px] text-indigo-700 mt-0.5">Winning combinations: {row.winningCombinations}</div>
                              )}
                              {row.selectionStatus === 'Win' && row.winningCombinationText && (
                                <div className="text-[10px] text-gray-500 mt-0.5">Hits: {row.winningCombinationText}</div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-gray-800 text-xs align-top">{row.stake.toFixed(2)} GMD</td>
                            <td className="py-3 px-3 text-xs font-semibold align-top">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-bold ${
                                row.selectionStatus === 'Win'
                                  ? 'bg-green-100 text-green-700'
                                  : row.selectionStatus === 'Loss'
                                    ? 'bg-red-100 text-red-700'
                                    : row.selectionStatus === 'Booked'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : row.selectionStatus === 'Canceled'
                                        ? 'bg-gray-100 text-gray-600'
                                        : 'bg-amber-100 text-amber-700'
                              }`}>
                                {getSelectionOutcomeLabel(row)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-xs font-semibold text-gray-700 align-top">
                              <div className={row.payout > 0 ? 'text-green-700 font-bold' : ''}>{row.payout.toFixed(2)} GMD</div>
                              {row.paidBy && row.status === 'Paid' && (
                                <div className="text-[10px] text-purple-700 font-bold">by {row.paidBy}</div>
                              )}
                              {row.payoutCheck && (
                                <div className={`text-[10px] font-bold mt-0.5 ${row.payoutCheck === 'OK' ? 'text-green-700' : 'text-red-700'}`}>
                                  {row.payoutCheck === 'OK' ? 'Payout OK' : 'Payout Check'}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}

          <div className="bg-gray-100 border-t-2 border-gray-300 rounded-lg px-4 py-3 flex flex-wrap gap-4 justify-between text-sm">
            <div className="font-black text-gray-600 uppercase tracking-wide">Total ({filteredRows.length} row{filteredRows.length !== 1 ? 's' : ''})</div>
            <div className="font-black text-gray-900">Stake: {totals.totalStake.toFixed(2)} GMD</div>
            <div className="font-black text-gray-900">Payout: {totals.totalPayout.toFixed(2)} GMD</div>
          </div>
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
