import React, { useState, useMemo } from 'react';
import { Ticket, User } from '../types';

interface VendorMonitorPanelProps {
    allTickets: Ticket[];
    users: User[];
    onCancelTicket: (ticketId: string) => void;
    onToggleLock: (userId: string) => void;
}

type SortKey = 'name' | 'sales' | 'payouts' | 'net' | 'tickets';

const statusBadge = (status: Ticket['status']) => {
    const styles: Record<Ticket['status'], string> = {
        Active:   'bg-green-100 text-green-700',
        Winning:  'bg-blue-100 text-blue-700',
        Paid:     'bg-purple-100 text-purple-700',
        Lost:     'bg-red-100 text-red-600',
        Canceled: 'bg-gray-200 text-gray-500',
        Booked:   'bg-yellow-100 text-yellow-700',
    };
    return (
        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
};

export const VendorMonitorPanel: React.FC<VendorMonitorPanelProps> = ({
    allTickets,
    users,
    onCancelTicket,
    onToggleLock,
}) => {
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('sales');
    const [sortAsc, setSortAsc] = useState(false);
    const [ticketFilter, setTicketFilter] = useState<string>('All');
    const [searchTicket, setSearchTicket] = useState('');
    const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
    const [confirmLockId, setConfirmLockId] = useState<string | null>(null);

    const vendors = useMemo(() => users.filter(u => u.role === 'Vendor'), [users]);

    interface VendorStat {
        vendor: User;
        totalTickets: number;
        totalSales: number;
        totalPayouts: number;
        netBalance: number;
        activeCount: number;
        winningCount: number;
        lostCount: number;
        canceledCount: number;
        paidCount: number;
    }

    const vendorStats: VendorStat[] = useMemo(() => {
        return vendors.map(vendor => {
            const vTickets = allTickets.filter(t => t.vendorId === vendor.id);
            const totalSales = vTickets.reduce((s, t) => s + (t.totalCost || 0), 0);
            const totalPayouts = vTickets.filter(t => t.status === 'Paid').reduce((s, t) => s + (t.winnings || 0), 0);
            return {
                vendor,
                totalTickets: vTickets.length,
                totalSales,
                totalPayouts,
                netBalance: totalSales - totalPayouts,
                activeCount: vTickets.filter(t => t.status === 'Active').length,
                winningCount: vTickets.filter(t => t.status === 'Winning').length,
                lostCount: vTickets.filter(t => t.status === 'Lost').length,
                canceledCount: vTickets.filter(t => t.status === 'Canceled').length,
                paidCount: vTickets.filter(t => t.status === 'Paid').length,
            };
        });
    }, [vendors, allTickets]);

    const sortedVendorStats = useMemo(() => {
        const sorted = [...vendorStats].sort((a, b) => {
            let valA: number | string = 0, valB: number | string = 0;
            if (sortKey === 'name')    { valA = a.vendor.name; valB = b.vendor.name; }
            if (sortKey === 'sales')   { valA = a.totalSales; valB = b.totalSales; }
            if (sortKey === 'payouts') { valA = a.totalPayouts; valB = b.totalPayouts; }
            if (sortKey === 'net')     { valA = a.netBalance; valB = b.netBalance; }
            if (sortKey === 'tickets') { valA = a.totalTickets; valB = b.totalTickets; }
            if (typeof valA === 'string') return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
            return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
        });
        return sorted;
    }, [vendorStats, sortKey, sortAsc]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(false); }
    };

    const SortTh: React.FC<{ label: string; k: SortKey }> = ({ label, k }) => (
        <th
            onClick={() => toggleSort(k)}
            className="py-2 px-3 text-center text-xs font-black text-gray-600 uppercase whitespace-nowrap cursor-pointer select-none hover:bg-gray-100"
        >
            {label}{sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''}
        </th>
    );

    // Overall totals
    const grandSales    = vendorStats.reduce((s, v) => s + v.totalSales, 0);
    const grandPayouts  = vendorStats.reduce((s, v) => s + v.totalPayouts, 0);
    const grandNet      = grandSales - grandPayouts;
    const grandTickets  = vendorStats.reduce((s, v) => s + v.totalTickets, 0);

    // Drill-down vendor
    const selectedStat = selectedVendorId ? vendorStats.find(v => v.vendor.id === selectedVendorId) : null;
    const drillTickets = useMemo(() => {
        if (!selectedVendorId) return [];
        let t = allTickets.filter(tt => tt.vendorId === selectedVendorId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (ticketFilter !== 'All') t = t.filter(tt => tt.status === ticketFilter);
        if (searchTicket.trim()) {
            const term = searchTicket.trim().toLowerCase();
            t = t.filter(tt => tt.id.toLowerCase().includes(term));
        }
        return t;
    }, [selectedVendorId, allTickets, ticketFilter, searchTicket]);

    const formatGMD = (n: number) => `GMD ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    if (selectedStat) {
        const v = selectedStat.vendor;
        return (
            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setSelectedVendorId(null)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white font-black rounded-lg text-sm hover:bg-gray-900 active:scale-95 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        All Vendors
                    </button>
                    <h2 className="text-2xl font-black text-gray-800 uppercase">{v.name}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${v.isLocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {v.isLocked ? '🔒 LOCKED' : '✅ ACTIVE'}
                    </span>
                    <button
                        onClick={() => setConfirmLockId(v.id)}
                        className={`ml-auto px-5 py-2 rounded-lg text-sm font-black border-b-2 active:scale-95 transition-all ${v.isLocked ? 'bg-green-600 text-white border-green-800 hover:bg-green-700' : 'bg-red-600 text-white border-red-800 hover:bg-red-700'}`}
                    >
                        {v.isLocked ? '🔓 Unlock Vendor' : '🔒 Block Vendor'}
                    </button>
                </div>

                {/* Stat boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                        { label: 'Total Sales',    value: formatGMD(selectedStat.totalSales),    color: 'border-green-500 text-betese-green' },
                        { label: 'Paid Out',        value: formatGMD(selectedStat.totalPayouts),  color: 'border-orange-400 text-orange-600' },
                        { label: 'Net Balance',     value: formatGMD(selectedStat.netBalance),    color: `border-blue-500 ${selectedStat.netBalance >= 0 ? 'text-blue-700' : 'text-red-600'}` },
                        { label: 'Total Tickets',   value: String(selectedStat.totalTickets),      color: 'border-gray-400 text-gray-700' },
                        { label: 'Canceled',        value: String(selectedStat.canceledCount),     color: 'border-red-400 text-red-600' },
                    ].map(b => (
                        <div key={b.label} className={`bg-white rounded-xl border-t-4 p-3 text-center shadow ${b.color}`}>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{b.label}</p>
                            <p className={`text-xl font-black leading-none ${b.color.split(' ')[1]}`}>{b.value}</p>
                        </div>
                    ))}
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    {([
                        { label: 'Active',   count: selectedStat.activeCount,   bg: 'bg-green-50 border-green-300 text-green-700' },
                        { label: 'Winning',  count: selectedStat.winningCount,  bg: 'bg-blue-50 border-blue-300 text-blue-700' },
                        { label: 'Paid',     count: selectedStat.paidCount,     bg: 'bg-purple-50 border-purple-300 text-purple-700' },
                        { label: 'Lost',     count: selectedStat.lostCount,     bg: 'bg-red-50 border-red-300 text-red-600' },
                        { label: 'Canceled', count: selectedStat.canceledCount, bg: 'bg-gray-100 border-gray-300 text-gray-500' },
                    ] as { label: string; count: number; bg: string }[]).map(s => (
                        <div key={s.label} className={`border rounded-lg p-2 ${s.bg}`}>
                            <p className="text-[10px] font-black uppercase">{s.label}</p>
                            <p className="text-2xl font-black">{s.count}</p>
                        </div>
                    ))}
                </div>

                {/* Drill ticket table */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
                    <div className="bg-gray-800 px-5 py-3 flex flex-wrap items-center gap-3">
                        <h3 className="text-base font-black text-white uppercase flex-1">Ticket Transactions</h3>
                        <input
                            type="text"
                            placeholder="Search ticket ID…"
                            value={searchTicket}
                            onChange={e => setSearchTicket(e.target.value)}
                            className="px-3 py-1.5 rounded-full border border-white/40 bg-white/10 text-white placeholder-white/50 text-sm w-40 focus:outline-none"
                        />
                        <select
                            value={ticketFilter}
                            onChange={e => setTicketFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-full border border-white/40 bg-white/10 text-white text-sm focus:outline-none"
                        >
                            {['All','Active','Winning','Paid','Lost','Canceled','Booked'].map(s => (
                                <option key={s} value={s} className="text-gray-800">{s}</option>
                            ))}
                        </select>
                        <span className="text-white/60 text-sm font-bold">{drillTickets.length} rows</span>
                    </div>
                    <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="sticky top-0 bg-gray-50 border-b border-gray-300 z-10">
                                <tr>
                                    {['Ticket ID','Date','Cost','Winnings','Status','Action'].map(h => (
                                        <th key={h} className="py-2 px-3 text-center text-xs font-black text-gray-600 uppercase whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {drillTickets.length === 0 ? (
                                    <tr><td colSpan={6} className="py-8 text-center text-gray-400 italic text-sm">No tickets match filter.</td></tr>
                                ) : drillTickets.map((ticket, i) => {
                                    const canCancel = ticket.status === 'Active' || ticket.status === 'Booked';
                                    return (
                                        <tr key={ticket.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}>
                                            <td className="py-2 px-3 font-mono text-xs text-gray-700">{ticket.id}</td>
                                            <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                                                {ticket.timestamp.toLocaleDateString()} {ticket.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-2 px-3 text-center text-xs font-semibold text-gray-700">{formatGMD(ticket.totalCost || 0)}</td>
                                            <td className="py-2 px-3 text-center text-xs font-bold text-blue-700">
                                                {ticket.winnings && ticket.winnings > 0 ? formatGMD(ticket.winnings) : '—'}
                                            </td>
                                            <td className="py-2 px-3 text-center">{statusBadge(ticket.status)}</td>
                                            <td className="py-2 px-3 text-center">
                                                {canCancel ? (
                                                    <button
                                                        onClick={() => setConfirmCancelId(ticket.id)}
                                                        className="px-3 py-1 bg-red-600 text-white text-[10px] font-black rounded hover:bg-red-700 active:scale-95 transition-all"
                                                    >
                                                        Cancel
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 font-bold">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Confirm cancel modal */}
                {confirmCancelId && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
                            <h3 className="text-xl font-black text-red-600 uppercase">Confirm Cancel Ticket</h3>
                            <p className="text-sm text-gray-700">Cancel ticket <span className="font-mono font-black">#{confirmCancelId}</span>? This will refund eligible online customers and cannot be undone.</p>
                            <div className="flex gap-3">
                                <button onClick={() => { onCancelTicket(confirmCancelId!); setConfirmCancelId(null); }} className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 active:scale-95">Yes, Cancel</button>
                                <button onClick={() => setConfirmCancelId(null)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-black rounded-xl hover:bg-gray-300">Keep</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm lock modal */}
                {confirmLockId && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
                            <h3 className="text-xl font-black text-orange-600 uppercase">{v.isLocked ? 'Unlock Vendor?' : 'Block Vendor?'}</h3>
                            <p className="text-sm text-gray-700">
                                {v.isLocked
                                    ? `Unlock ${v.name} so they can log in and place bets again.`
                                    : `Block ${v.name} from logging in immediately. All active sessions will be terminated.`}
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => { onToggleLock(confirmLockId!); setConfirmLockId(null); }} className={`flex-1 py-3 text-white font-black rounded-xl active:scale-95 ${v.isLocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                    {v.isLocked ? 'Unlock' : 'Block'}
                                </button>
                                <button onClick={() => setConfirmLockId(null)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-black rounded-xl hover:bg-gray-300">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── MAIN VENDOR GRID ──
    return (
        <div className="space-y-6">
            {/* Grand totals */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-2xl shadow-2xl p-5">
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-3">System-Wide Overview — All Vendors</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Vendors',      value: String(vendors.length),    sub: `${vendors.filter(v=>v.isLocked).length} blocked`,   color: 'text-white' },
                        { label: 'Total Tickets', value: String(grandTickets),      sub: 'all time',           color: 'text-white' },
                        { label: 'Gross Sales',   value: formatGMD(grandSales),     sub: 'all transactions',   color: 'text-green-400' },
                        { label: 'Total Paid Out',value: formatGMD(grandPayouts),   sub: 'winning payouts',    color: 'text-orange-400' },
                    ].map(b => (
                        <div key={b.label} className="text-center">
                            <p className="text-[10px] font-black text-white/50 uppercase tracking-wider">{b.label}</p>
                            <p className={`text-2xl font-black leading-none mt-1 ${b.color}`}>{b.value}</p>
                            <p className="text-[10px] text-white/40 mt-0.5">{b.sub}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                    <p className="text-[11px] font-black text-white/40 uppercase">Net Revenue</p>
                    <p className={`text-3xl font-black ${grandNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatGMD(grandNet)}</p>
                </div>
            </div>

            {/* Sort header */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-black text-gray-500 uppercase">
                <span>Sort by:</span>
                {([['name','Name'],['sales','Sales'],['payouts','Paid Out'],['net','Net'],['tickets','Tickets']] as [SortKey, string][]).map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => toggleSort(k)}
                        className={`px-3 py-1 rounded-full border transition-all ${sortKey === k ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                    >
                        {label}{sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''}
                    </button>
                ))}
            </div>

            {/* Vendor cards grid */}
            {sortedVendorStats.length === 0 ? (
                <div className="text-center py-12 text-gray-400 italic">No vendors found.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {sortedVendorStats.map(({ vendor, totalTickets, totalSales, totalPayouts, netBalance, activeCount, winningCount, lostCount, canceledCount, paidCount }) => (
                        <div
                            key={vendor.id}
                            className={`bg-white rounded-2xl shadow-lg border-t-4 overflow-hidden transition-all hover:shadow-xl ${vendor.isLocked ? 'border-red-500' : 'border-betese-green'}`}
                        >
                            {/* Card header */}
                            <div className={`px-5 py-3 flex items-center justify-between ${vendor.isLocked ? 'bg-red-50' : 'bg-green-50'}`}>
                                <div>
                                    <p className="font-black text-gray-800 text-lg uppercase leading-none">{vendor.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">ID: {vendor.id.slice(0, 12)}…</p>
                                </div>
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border ${vendor.isLocked ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'}`}>
                                    {vendor.isLocked ? '🔒 Blocked' : '✅ Active'}
                                </span>
                            </div>

                            {/* Main stats */}
                            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                                <div className="p-3 text-center">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Sales</p>
                                    <p className="text-base font-black text-betese-green leading-tight">{formatGMD(totalSales)}</p>
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Paid Out</p>
                                    <p className="text-base font-black text-orange-500 leading-tight">{formatGMD(totalPayouts)}</p>
                                </div>
                                <div className="p-3 text-center">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Net</p>
                                    <p className={`text-base font-black leading-tight ${netBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatGMD(netBalance)}</p>
                                </div>
                            </div>

                            {/* Ticket status pills */}
                            <div className="px-4 py-3 flex flex-wrap gap-1.5">
                                <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">🎫 {totalTickets} total</span>
                                {activeCount > 0   && <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">▶ {activeCount} active</span>}
                                {winningCount > 0  && <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">🏆 {winningCount} winning</span>}
                                {paidCount > 0     && <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">💸 {paidCount} paid</span>}
                                {lostCount > 0     && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">✗ {lostCount} lost</span>}
                                {canceledCount > 0 && <span className="text-[10px] bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded-full">⊘ {canceledCount} canceled</span>}
                            </div>

                            {/* Card actions */}
                            <div className="px-4 pb-4 flex gap-2">
                                <button
                                    onClick={() => setSelectedVendorId(vendor.id)}
                                    className="flex-1 py-2 bg-gray-800 text-white text-xs font-black rounded-xl hover:bg-gray-900 active:scale-95 transition-all"
                                >
                                    View Transactions
                                </button>
                                <button
                                    onClick={() => setConfirmLockId(vendor.id)}
                                    className={`px-4 py-2 text-xs font-black rounded-xl border-b-2 active:scale-95 transition-all ${vendor.isLocked ? 'bg-green-600 text-white border-green-800 hover:bg-green-700' : 'bg-red-600 text-white border-red-800 hover:bg-red-700'}`}
                                >
                                    {vendor.isLocked ? '🔓' : '🔒'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Global lock confirm */}
            {confirmLockId && (() => {
                const targetVendor = users.find(u => u.id === confirmLockId);
                if (!targetVendor) return null;
                return (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
                            <h3 className="text-xl font-black text-orange-600 uppercase">
                                {targetVendor.isLocked ? 'Unlock Vendor?' : 'Block Vendor?'}
                            </h3>
                            <p className="text-sm text-gray-700">
                                {targetVendor.isLocked
                                    ? `Unlock ${targetVendor.name} so they can log in again.`
                                    : `Block ${targetVendor.name} — they won't be able to log in or place bets.`}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { onToggleLock(confirmLockId!); setConfirmLockId(null); }}
                                    className={`flex-1 py-3 text-white font-black rounded-xl active:scale-95 ${targetVendor.isLocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                                >
                                    {targetVendor.isLocked ? 'Unlock' : 'Block'}
                                </button>
                                <button onClick={() => setConfirmLockId(null)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-black rounded-xl hover:bg-gray-300">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};
