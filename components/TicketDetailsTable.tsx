
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Ticket, Race } from '../types';
import { TicketCombinationLedger } from './TicketCombinationLedger';
import { calculateTicketWinnings, formatWinningNumbersForDisplay } from '../utils';

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

const getDisplayStatusLabel = (_ticket: Ticket, status: DisplayStatus): string => {
  if (status === 'Winning' || status === 'Paid') return 'Win';
  if (status === 'Lost') return 'Lost';
  if (status === 'Canceled') return 'Canceled';
  return 'Pending';
};

const getStatusChipClass = (status: DisplayStatus) => {
  switch (status) {
    case 'Winning':
    case 'Paid':
      return 'bg-blue-100 text-blue-700 border-blue-300';
    case 'Lost':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'Canceled':
      return 'bg-gray-100 text-gray-600 border-gray-300';
    case 'Booked':
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
};

const getWalletFlowLabel = (ticket: Ticket, displayStatus: DisplayStatus): string => {
  if (ticket.customerId) {
    if (displayStatus === 'Paid') {
      if (ticket.paidByName === 'System Bonus Credit') return 'Bonus Wallet (Auto Paid)';
      return 'Real Wallet (Auto Paid)';
    }
    if (displayStatus === 'Lost') return 'Auto Settled - Lost';
    if (displayStatus === 'Canceled') return 'Canceled';
    if (displayStatus === 'Booked') return 'Booking Pending Payment';
    return 'Awaiting Result';
  }
  if (displayStatus === 'Paid') return 'Cashier Paid';
  if (displayStatus === 'Winning') return 'Awaiting Cashier Payout';
  if (displayStatus === 'Lost') return 'Closed - Lost';
  if (displayStatus === 'Canceled') return 'Canceled';
  if (displayStatus === 'Booked') return 'Booking Pending Payment';
  return 'Awaiting Result';
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
type FilterChannel = 'All' | 'Online' | 'Terminal';

const getTicketChannel = (ticket: Ticket): 'Online' | 'Terminal' => {
  return (ticket.transactionChannel === 'Online' || ticket.customerId) ? 'Online' : 'Terminal';
};

export const TicketDetailsTable: React.FC<TicketDetailsTableProps> = ({ tickets, races, onCancelTicket, onPayoutTicket }) => {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [filterAgent, setFilterAgent] = useState<string>('All');
  // Keep date empty by default so agent filter can show all vendor transactions.
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterChannel, setFilterChannel] = useState<FilterChannel>('All');
  const [ledgerTicket, setLedgerTicket] = useState<Ticket | null>(null);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(0);
  const syncingScrollRef = useRef<'top' | 'table' | null>(null);

  const raceById = useMemo(() => {
    return new Map(races.map(r => [r.id, r]));
  }, [races]);

  const recalculatedByTicket = useMemo(() => {
    const map = new Map<string, { totalWinnings: number; breakdown: ReturnType<typeof calculateTicketWinnings>['breakdown'] }>();
    tickets.forEach(ticket => {
      const recalculated = calculateTicketWinnings(ticket, races);
      map.set(ticket.id, { totalWinnings: Number(recalculated.totalWinnings || 0), breakdown: recalculated.breakdown });
    });
    return map;
  }, [tickets, races]);

  const recalculatedWinningsByTicket = useMemo(() => {
    const map = new Map<string, number>();
    recalculatedByTicket.forEach((v, k) => map.set(k, v.totalWinnings));
    return map;
  }, [recalculatedByTicket]);

  const getDisplayStatus = (ticket: Ticket): DisplayStatus => {
    if (ticket.status === 'Paid' || ticket.status === 'Canceled' || ticket.status === 'Booked') return ticket.status;

    const allRacesResolved = ticket.selections.every(sel => {
      const race = raceById.get(sel.raceId);
      return Boolean(race?.result?.winningNumbers?.length);
    });
    if (!allRacesResolved) return 'Active';

    const resolvedWinnings = Number(recalculatedWinningsByTicket.get(ticket.id) ?? ticket.winnings ?? 0);
    if (resolvedWinnings > 0) {
      return ticket.customerId ? 'Paid' : 'Winning';
    }
    return 'Lost';
  };

  const getTicketResultNumbers = (ticket: Ticket): string => {
    const byRace = Array.from(new Set(ticket.selections.map(sel => sel.raceId))).map(raceId => {
      const race = raceById.get(raceId);
      if (!race) return `${raceId}: Pending`;
      const numbers = formatWinningNumbersForDisplay(race.result?.winningNumbers);
      return `${race.name}: ${numbers === 'N/A' ? 'Pending' : numbers}`;
    });
    return byRace.join(' | ');
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
    Array.from(new Set<string>(tickets.map(t => t.vendorName).filter((a): a is string => Boolean(a)))).sort((a, b) => a.localeCompare(b)),
  [tickets]);

  const filteredTickets = useMemo(() => {
    let result = [...tickets].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(t => t.id.toLowerCase().includes(term));
    }
    if (filterStatus !== 'All') result = result.filter(matchesStatusFilter);
    if (filterAgent !== 'All') result = result.filter(t => (t.vendorName || '').toLowerCase() === filterAgent.toLowerCase());
    if (filterChannel !== 'All') {
      result = result.filter((t) => {
        const channel = getTicketChannel(t);
        return channel === filterChannel;
      });
    }
    if (filterDate) {
      result = result.filter(t => {
        const yyyy = t.timestamp.getFullYear();
        const mm = String(t.timestamp.getMonth() + 1).padStart(2, '0');
        const dd = String(t.timestamp.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}` === filterDate;
      });
    }
    return result;
  }, [tickets, filterStatus, filterAgent, filterChannel, filterDate, searchTerm, races]);

  const filteredSummary = useMemo(() => {
    const totalStake = filteredTickets.reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
    const totalWinnings = filteredTickets.reduce((sum, t) => sum + Number(t.winnings || 0), 0);
    const realMoneyPaidOut = filteredTickets.reduce((sum, t) => {
      if (t.status !== 'Paid') return sum;
      if (t.customerId && t.paidByName === 'System Bonus Credit') return sum;
      return sum + Number(t.winnings || 0);
    }, 0);
    const bonusLockedPaidOut = filteredTickets.reduce((sum, t) => {
      if (t.status === 'Paid' && t.customerId && t.paidByName === 'System Bonus Credit') {
        return sum + Number(t.winnings || 0);
      }
      return sum;
    }, 0);
    return {
      count: filteredTickets.length,
      onlineCount: filteredTickets.filter(t => getTicketChannel(t) === 'Online').length,
      terminalCount: filteredTickets.filter(t => getTicketChannel(t) === 'Terminal').length,
      totalStake,
      totalWinnings,
      realMoneyPaidOut,
      bonusLockedPaidOut,
    };
  }, [filteredTickets]);

  useEffect(() => {
    const updateWidths = () => {
      if (!tableScrollRef.current) return;
      setTableScrollWidth(tableScrollRef.current.scrollWidth);
    };
    updateWidths();
    window.addEventListener('resize', updateWidths);
    return () => window.removeEventListener('resize', updateWidths);
  }, [filteredTickets]);

  const syncTopToTable = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    if (syncingScrollRef.current === 'table') return;
    syncingScrollRef.current = 'top';
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    syncingScrollRef.current = null;
  };

  const syncTableToTop = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    if (syncingScrollRef.current === 'top') return;
    syncingScrollRef.current = 'table';
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    syncingScrollRef.current = null;
  };

  return (
    <>
      {ledgerTicket && <TicketCombinationLedger tickets={tickets} races={races} onClose={() => setLedgerTicket(null)} />}

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

          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value as FilterChannel)}
            className="flex-1 min-w-[140px] px-3 py-1.5 rounded-full border-2 border-white/60 bg-white/90 text-sm font-semibold text-gray-800 focus:outline-none focus:border-white"
          >
            <option value="All">All Channels</option>
            <option value="Online">Online</option>
            <option value="Terminal">Terminal</option>
          </select>
        </div>

        <div className="px-4 py-2 border-b bg-slate-50 text-xs text-gray-700 flex flex-wrap gap-4">
          <span className="font-semibold">Transactions: <span className="font-black text-betese-dark">{filteredSummary.count}</span></span>
          <span className="font-semibold">Online: <span className="font-black text-blue-700">{filteredSummary.onlineCount}</span></span>
          <span className="font-semibold">Terminal: <span className="font-black text-emerald-700">{filteredSummary.terminalCount}</span></span>
          <span className="font-semibold">Total Stake: <span className="font-black text-betese-dark">{filteredSummary.totalStake.toFixed(2)} GMD</span></span>
          <span className="font-semibold">Total Winnings: <span className="font-black text-betese-dark">{filteredSummary.totalWinnings.toFixed(2)} GMD</span></span>
          <span className="font-semibold">Real Paid Out: <span className="font-black text-blue-700">{filteredSummary.realMoneyPaidOut.toFixed(2)} GMD</span></span>
          <span className="font-semibold">Bonus Locked: <span className="font-black text-amber-700">{filteredSummary.bonusLockedPaidOut.toFixed(2)} GMD</span></span>
        </div>

        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Horizontal Scroll</div>
          <div ref={topScrollRef} onScroll={syncTopToTable} className="overflow-x-auto overflow-y-hidden h-4 rounded bg-gray-200">
            <div style={{ width: Math.max(tableScrollWidth, 1), height: 1 }} />
          </div>
        </div>

        {/* Table */}
        <div ref={tableScrollRef} onScroll={syncTableToTop} className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gradient-to-b from-green-100 to-green-50 border-b border-gray-300">
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Ticket number</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Race number</th>
                <th className="hidden lg:table-cell text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Bet time</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 border-r border-gray-300">Bet</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Winnings Amount</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Result</th>
                <th className="hidden md:table-cell text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Wallet Flow</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Channel</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Paid By</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap border-r border-gray-300">Status</th>
                <th className="text-center py-1.5 px-3 font-semibold text-gray-700 whitespace-nowrap">Options</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket, rowIdx) => {
                  const displayStatus = getDisplayStatus(ticket);
                  const recalculatedWinnings = Number(recalculatedWinningsByTicket.get(ticket.id) ?? ticket.winnings ?? 0);
                  const hasWinnings = recalculatedWinnings > 0;
                  const isOnlineTicket = Boolean(ticket.customerId);
                  const channel = getTicketChannel(ticket);
                  const canPayout = hasWinnings && displayStatus === 'Winning' && !isOnlineTicket && typeof onPayoutTicket === 'function';
                  const resultNumbers = getTicketResultNumbers(ticket);
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
                        <div className="text-[10px] text-gray-600 font-semibold mt-0.5">
                          Vendor: {ticket.vendorName || ticket.vendorId || '-'}
                        </div>
                        <div className="mt-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${channel === 'Online' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {channel.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Race number */}
                      <td className="py-3 px-4 align-top text-xs text-gray-700 border-r border-gray-200 min-w-[170px]">
                        {raceInfo.map((item, i) => (
                          <div key={i} className="mb-1 last:mb-0">
                            <div className="font-semibold">{item.time ? `${item.label} (${item.time})` : item.label}</div>
                          </div>
                        ))}
                      </td>

                      {/* Bet time */}
                      <td className="hidden lg:table-cell py-3 px-4 align-top text-xs text-gray-600 whitespace-nowrap border-r border-gray-200">
                        {formatDate(ticket.timestamp)}
                      </td>

                      {/* Bet combinations — full-width inline boxes */}
                      <td className="py-1.5 px-2 align-top border-r border-gray-200 min-w-[220px]">
                        <div className="">
                          {ticket.selections.map((sel, i) => {
                            const ticketResult = recalculatedByTicket.get(ticket.id);
                            const selBreakdown = ticketResult?.breakdown?.find(b => b.selectionIndex === i);
                            const raceSettled = Boolean(raceById.get(sel.raceId)?.result?.winningNumbers?.length);
                            const isWin = selBreakdown?.status === 'Win';
                            const isLoss = raceSettled && selBreakdown?.status === 'Loss';
                            return (
                              <div
                                key={i}
                                className={`text-xs border px-2 py-1 leading-snug w-full break-words mb-0.5 last:mb-0 ${
                                  isWin ? 'border-green-400 bg-green-50 text-green-800' :
                                  isLoss ? 'border-red-200 bg-red-50 text-red-700' :
                                  'border-gray-300 bg-white text-gray-700'
                                }`}
                              >
                                {/* Bet description line */}
                                <div className="font-semibold">
                                  {formatBetLabel(sel.betType)} — horses: <span className="font-black">{formatBetNumbers(sel)}</span>
                                  <span className="ml-2 text-[10px] font-bold px-1 py-0.5 rounded bg-gray-200 text-gray-700">× {sel.multiplier} ticket{sel.multiplier > 1 ? 's' : ''}</span>
                                  <span className="ml-1 text-[10px] text-gray-500">stake: {(sel.cost * sel.multiplier).toFixed(0)} GMD</span>
                                </div>
                                {/* Win formula breakdown */}
                                {isWin && selBreakdown && (
                                  <div className="mt-0.5 text-[11px] font-black text-green-700 bg-green-100 border border-green-300 rounded px-1.5 py-0.5">
                                    ✓ WIN — Rapport <span className="underline">{selBreakdown.payoutPerCombination?.toFixed(0)}</span>
                                    {' × '}{selBreakdown.multiplier} ticket{(selBreakdown.multiplier || 1) > 1 ? 's' : ''}
                                    {' = '}<span className="text-green-900">+{selBreakdown.totalPayout?.toFixed(0)} GMD</span>
                                    {selBreakdown.winType ? <span className="ml-1 font-normal text-[9px] opacity-75">({selBreakdown.winType})</span> : null}
                                  </div>
                                )}
                                {isLoss && (
                                  <div className="mt-0.5 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                                    ✗ LOST — horses {formatBetNumbers(sel)} not in winning result
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 align-top text-xs font-semibold whitespace-nowrap border-r border-gray-200">
                        {displayStatus === 'Winning' || displayStatus === 'Paid' ? (
                          <span className="text-blue-700">{recalculatedWinnings.toFixed(2)} GMD</span>
                        ) : displayStatus === 'Lost' ? (
                          <span className="text-red-600">0.00 GMD</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Result */}
                      <td className="py-3 px-4 align-top text-xs font-semibold border-r border-gray-200 min-w-[200px] max-w-[260px]">
                        <span className={`${displayStatus === 'Winning' || displayStatus === 'Paid' ? 'text-blue-700' : displayStatus === 'Lost' ? 'text-red-600' : 'text-gray-500'}`}>
                          {resultNumbers}
                        </span>
                      </td>

                      {/* Wallet flow */}
                      <td className="hidden md:table-cell py-3 px-4 align-top text-xs font-semibold whitespace-nowrap border-r border-gray-200">
                        <span className={`${displayStatus === 'Paid' ? (ticket.customerId && ticket.paidByName === 'System Bonus Credit' ? 'text-amber-700' : 'text-blue-700') : 'text-gray-500'}`}>
                          {getWalletFlowLabel(ticket, displayStatus)}
                        </span>
                      </td>

                      {/* Channel */}
                      <td className="py-3 px-4 align-top text-xs font-semibold whitespace-nowrap border-r border-gray-200">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-black ${channel === 'Online' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
                          {channel}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 align-top text-xs font-semibold whitespace-nowrap border-r border-gray-200">
                        {displayStatus === 'Paid' ? (
                          <span className="inline-flex items-center rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 font-black text-purple-700">
                            {ticket.paidByName || ticket.paidById || (isOnlineTicket ? 'System Auto Credit' : 'Cashier')}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className={`py-3 px-4 align-top text-xs font-semibold whitespace-nowrap border-r border-gray-200 ${getStatusColor(displayStatus)}`}>
                        <div className="space-y-0.5">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-black ${getStatusChipClass(displayStatus)}`}>
                            {getDisplayStatusLabel(ticket, displayStatus)}
                          </span>
                          {displayStatus === 'Paid' && (ticket.paidByName || ticket.paidById) && (
                            <div className="text-[10px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap">
                              Paid By: {ticket.paidByName || ticket.paidById} ({channel})
                            </div>
                          )}
                        </div>
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
                            title={isOnlineTicket ? 'Online ticket is auto-paid by system' : (canPayout ? 'Pay winning ticket' : 'Payment available for vendor winning tickets only')}
                            disabled={!canPayout}
                            className={`px-2 py-1 rounded border text-[10px] font-bold leading-none transition-colors ${canPayout ? 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700' : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                          >
                            {isOnlineTicket ? 'Auto' : 'Payment'}
                          </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-8 px-4 text-center text-gray-400 text-sm">
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
