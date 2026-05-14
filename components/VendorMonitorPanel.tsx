import React, { useState, useMemo, useEffect } from 'react';
import { DepositLog, Ticket, User } from '../types';
import { TableScrollNavigator } from './TableScrollNavigator';
import { supabase, dbFetchVendorCommissionConfig, dbSaveVendorCommissionConfig } from '../supabaseClient';

interface VendorMonitorPanelProps {
    allTickets: Ticket[];
    depositLogs: DepositLog[];
    users: User[];
    onCancelTicket: (ticketId: string) => void;
    onToggleLock: (userId: string) => void;
}

type SortKey = 'name' | 'sales' | 'payouts' | 'net' | 'tickets';
type PeriodFilter = 'today' | 'weekly' | 'monthly' | 'all';
type SettlementPlan = 'weekly' | 'monthly';
type AccountType = 'Terminal + Online' | 'Terminal Only' | 'Online Agent Only' | 'No Activity';

interface CommissionRates {
    terminalRate: number;
    onlineRate: number;
}

interface VendorCommissionStorageShape {
    defaults?: Partial<CommissionRates>;
    overrides?: Record<string, Partial<CommissionRates>>;
    settlementPlans?: Record<string, SettlementPlan>;
}

const normalizeRate = (value: number): number => {
    const numeric = Number.isFinite(value) ? value : 0;
    const bounded = Math.max(0, Math.min(100, numeric));
    return Number(bounded.toFixed(2));
};

const getAccountType = (ticketSales: number, onlineSales: number): AccountType => {
    if (ticketSales > 0 && onlineSales > 0) return 'Terminal + Online';
    if (ticketSales > 0) return 'Terminal Only';
    if (onlineSales > 0) return 'Online Agent Only';
    return 'No Activity';
};

const accountTypeChipClass = (type: AccountType): string => {
    if (type === 'Terminal + Online') return 'bg-emerald-100 text-emerald-700';
    if (type === 'Terminal Only') return 'bg-green-100 text-green-700';
    if (type === 'Online Agent Only') return 'bg-cyan-100 text-cyan-700';
    return 'bg-gray-100 text-gray-600';
};

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
    depositLogs,
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
    const [adminCancelInput, setAdminCancelInput] = useState('');
    const [adminCancelMsg, setAdminCancelMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [period, setPeriod] = useState<PeriodFilter>('today');
    const [defaultRates, setDefaultRates] = useState<CommissionRates>({ terminalRate: 8, onlineRate: 5 });
    const [vendorRateOverrides, setVendorRateOverrides] = useState<Record<string, Partial<CommissionRates>>>({});
    const [vendorSettlementPlans, setVendorSettlementPlans] = useState<Record<string, SettlementPlan>>({});
    const [accountTypeFilter, setAccountTypeFilter] = useState<'All' | AccountType>('All');
    const [commissionConfigLoaded, setCommissionConfigLoaded] = useState(false);

    const vendors = useMemo(() => users.filter(u => u.role === 'Vendor'), [users]);

    useEffect(() => {
        let isMounted = true;

        const applyLoadedConfig = (parsed: VendorCommissionStorageShape) => {
            if (!isMounted) return;
            if (parsed.defaults) {
                setDefaultRates({
                    terminalRate: normalizeRate(Number(parsed.defaults.terminalRate ?? 8)),
                    onlineRate: normalizeRate(Number(parsed.defaults.onlineRate ?? 5)),
                });
            }
            if (parsed.overrides && typeof parsed.overrides === 'object') {
                setVendorRateOverrides(parsed.overrides);
            }
            if (parsed.settlementPlans && typeof parsed.settlementPlans === 'object') {
                const normalizedPlans = Object.entries(parsed.settlementPlans).reduce((acc, [vendorId, plan]) => {
                    acc[vendorId] = plan === 'weekly' ? 'weekly' : 'monthly';
                    return acc;
                }, {} as Record<string, SettlementPlan>);
                setVendorSettlementPlans(normalizedPlans);
            }
        };

        const loadCommissionConfig = async () => {
            // Load ONLY from online Supabase (required - no offline fallback)
            if (supabase) {
                try {
                    const remote = await dbFetchVendorCommissionConfig();
                    if (remote) {
                        applyLoadedConfig(remote);
                    }
                } catch (err) {
                    console.error("Failed to load commission config from Supabase:", err);
                }
            }

            if (isMounted) setCommissionConfigLoaded(true);
        };

        loadCommissionConfig();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!commissionConfigLoaded) return;

        const payload: VendorCommissionStorageShape = {
            defaults: defaultRates,
            overrides: vendorRateOverrides,
            settlementPlans: vendorSettlementPlans,
        };

        // Save ONLY to online Supabase (no local storage fallback)
        if (supabase) {
            dbSaveVendorCommissionConfig(payload).catch((err) => {
                console.error("Failed to save commission config to Supabase:", err);
            });
        }
    }, [defaultRates, vendorRateOverrides, vendorSettlementPlans, commissionConfigLoaded]);

    const isSameLocalDay = (a: Date, b: Date) => (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
    const now = new Date();

    const isWithinPeriod = (date: Date): boolean => {
        if (period === 'all') return true;
        if (period === 'today') return isSameLocalDay(date, now);
        if (period === 'weekly') {
            const diffMs = now.getTime() - date.getTime();
            return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
        }
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    };

    const periodLabel = period === 'today'
        ? 'today'
        : period === 'weekly'
            ? 'weekly (last 7 days)'
            : period === 'monthly'
                ? 'monthly (this month)'
                : 'all time';

    const getVendorRates = (vendorId: string): CommissionRates => {
        const overrides = vendorRateOverrides[vendorId] || {};
        return {
            terminalRate: normalizeRate(Number(overrides.terminalRate ?? defaultRates.terminalRate)),
            onlineRate: normalizeRate(Number(overrides.onlineRate ?? defaultRates.onlineRate)),
        };
    };

    const setVendorRate = (vendorId: string, key: keyof CommissionRates, value: number) => {
        const normalized = normalizeRate(value);
        setVendorRateOverrides(prev => ({
            ...prev,
            [vendorId]: {
                ...(prev[vendorId] || {}),
                [key]: normalized,
            },
        }));
    };

    const setVendorSettlementPlan = (vendorId: string, plan: SettlementPlan) => {
        setVendorSettlementPlans(prev => ({ ...prev, [vendorId]: plan }));
    };

    const isWithinSettlementCycle = (date: Date, plan: SettlementPlan): boolean => {
        if (plan === 'weekly') {
            const diffMs = now.getTime() - date.getTime();
            return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
        }
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    };

    const getFundingMeta = (ticket: Ticket) => {
        const firstSelection = ticket.selections?.[0];
        const bonusStake = Number(firstSelection?.bonusStakeAmount || 0);
        const cashStake = Number(firstSelection?.cashStakeAmount ?? Math.max(0, Number(ticket.totalCost || 0) - bonusStake));
        const source = firstSelection?.fundingSource || (bonusStake > 0 ? (cashStake > 0 ? 'mixed' : 'bonus') : 'cash');
        return {
            source,
            label: source === 'bonus' ? 'Bonus' : source === 'mixed' ? 'Mixed' : 'Cash',
            bonusStake,
            cashStake,
        } as const;
    };

    const getWalletFlowLabel = (ticket: Ticket): string => {
        if (ticket.status !== 'Paid') return 'Pending';
        if (!ticket.customerId) return 'Cash Desk';
        if (ticket.paidByName === 'System Bonus Credit') return 'Bonus Wallet (Locked)';
        return 'Real Wallet';
    };

    interface VendorStat {
        vendor: User;
        accountType: AccountType;
        settlementPlan: SettlementPlan;
        totalTickets: number;
        ticketSales: number;
        onlineSales: number;
        totalSales: number;
        terminalRate: number;
        onlineRate: number;
        terminalCommission: number;
        onlineCommission: number;
        totalCommissionDue: number;
        cycleCommissionDue: number;
        onlineDepositCount: number;
        totalPayouts: number;
        totalBonusLocked: number;
        netBalance: number;
        activeCount: number;
        winningCount: number;
        lostCount: number;
        canceledCount: number;
        paidCount: number;
    }

    const vendorStats: VendorStat[] = useMemo(() => {
        return vendors.map(vendor => {
            const settlementPlan = vendorSettlementPlans[vendor.id] || 'monthly';
            const vTickets = allTickets.filter(t => {
                if (t.vendorId !== vendor.id) return false;
                return isWithinPeriod(t.timestamp);
            });
            const vendorDeposits = (depositLogs || []).filter(log => {
                if (log.processedById !== vendor.id) return false;
                if (Number(log.amount || 0) <= 0 || log.method === 'Correction') return false;
                return isWithinPeriod(log.timestamp);
            });
            const ticketSales = vTickets.reduce((s, t) => s + (t.totalCost || 0), 0);
            const onlineSales = vendorDeposits.reduce((s, log) => s + Number(log.amount || 0), 0);
            const totalSales = ticketSales + onlineSales;
            const accountType = getAccountType(ticketSales, onlineSales);
            const rates = getVendorRates(vendor.id);
            const terminalCommission = Number(((ticketSales * rates.terminalRate) / 100).toFixed(2));
            const onlineCommission = Number(((onlineSales * rates.onlineRate) / 100).toFixed(2));
            const totalCommissionDue = Number((terminalCommission + onlineCommission).toFixed(2));

            const cycleTicketSales = (allTickets || [])
                .filter(t => t.vendorId === vendor.id)
                .filter(t => isWithinSettlementCycle(t.timestamp, settlementPlan))
                .reduce((sum, t) => sum + Number(t.totalCost || 0), 0);
            const cycleOnlineSales = (depositLogs || [])
                .filter(log => log.processedById === vendor.id)
                .filter(log => Number(log.amount || 0) > 0 && log.method !== 'Correction')
                .filter(log => isWithinSettlementCycle(log.timestamp, settlementPlan))
                .reduce((sum, log) => sum + Number(log.amount || 0), 0);
            const cycleCommissionDue = Number((((cycleTicketSales * rates.terminalRate) / 100) + ((cycleOnlineSales * rates.onlineRate) / 100)).toFixed(2));

            const totalPayouts = vTickets
                .filter(t => t.status === 'Paid' && !(t.customerId && t.paidByName === 'System Bonus Credit'))
                .reduce((s, t) => s + (t.winnings || 0), 0);
            const totalBonusLocked = vTickets
                .filter(t => t.status === 'Paid' && t.customerId && t.paidByName === 'System Bonus Credit')
                .reduce((s, t) => s + (t.winnings || 0), 0);
            return {
                vendor,
                accountType,
                settlementPlan,
                totalTickets: vTickets.length,
                ticketSales,
                onlineSales,
                totalSales,
                terminalRate: rates.terminalRate,
                onlineRate: rates.onlineRate,
                terminalCommission,
                onlineCommission,
                totalCommissionDue,
                cycleCommissionDue,
                onlineDepositCount: vendorDeposits.length,
                totalPayouts,
                totalBonusLocked,
                netBalance: totalSales - totalPayouts,
                activeCount: vTickets.filter(t => t.status === 'Active').length,
                winningCount: vTickets.filter(t => t.status === 'Winning').length,
                lostCount: vTickets.filter(t => t.status === 'Lost').length,
                canceledCount: vTickets.filter(t => t.status === 'Canceled').length,
                paidCount: vTickets.filter(t => t.status === 'Paid').length,
            };
        });
    }, [vendors, allTickets, depositLogs, period, defaultRates, vendorRateOverrides, vendorSettlementPlans]);

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
    const grandTicketSales = vendorStats.reduce((s, v) => s + v.ticketSales, 0);
    const grandOnlineSales = vendorStats.reduce((s, v) => s + v.onlineSales, 0);
    const grandSales    = vendorStats.reduce((s, v) => s + v.totalSales, 0);
    const grandTerminalCommission = vendorStats.reduce((s, v) => s + v.terminalCommission, 0);
    const grandOnlineCommission = vendorStats.reduce((s, v) => s + v.onlineCommission, 0);
    const grandCommissionDue = vendorStats.reduce((s, v) => s + v.totalCommissionDue, 0);
    const grandCycleCommissionDue = vendorStats.reduce((s, v) => s + v.cycleCommissionDue, 0);
    const grandPayouts  = vendorStats.reduce((s, v) => s + v.totalPayouts, 0);
    const grandBonusLocked = vendorStats.reduce((s, v) => s + v.totalBonusLocked, 0);
    const grandNet      = grandSales - grandPayouts;
    const grandTickets  = vendorStats.reduce((s, v) => s + v.totalTickets, 0);
    const accountTypeCounts = {
        both: vendorStats.filter(v => v.accountType === 'Terminal + Online').length,
        terminalOnly: vendorStats.filter(v => v.accountType === 'Terminal Only').length,
        onlineOnly: vendorStats.filter(v => v.accountType === 'Online Agent Only').length,
    };

    // Drill-down vendor
    const selectedStat = selectedVendorId ? vendorStats.find(v => v.vendor.id === selectedVendorId) : null;
    const drillTickets = useMemo(() => {
        if (!selectedVendorId) return [];
        let t = allTickets.filter(tt => tt.vendorId === selectedVendorId)
            .filter(tt => isWithinPeriod(tt.timestamp))
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (ticketFilter !== 'All') t = t.filter(tt => tt.status === ticketFilter);
        if (searchTicket.trim()) {
            const term = searchTicket.trim().toLowerCase();
            t = t.filter(tt => tt.id.toLowerCase().includes(term));
        }
        return t;
    }, [selectedVendorId, allTickets, ticketFilter, searchTicket, period]);
    const drillDeposits = useMemo(() => {
        if (!selectedVendorId) return [];
        return (depositLogs || [])
            .filter(log => {
                if (log.processedById !== selectedVendorId) return false;
                if (Number(log.amount || 0) <= 0 || log.method === 'Correction') return false;
                return isWithinPeriod(log.timestamp);
            })
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [selectedVendorId, depositLogs, period]);

    const formatGMD = (n: number) => `GMD ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    const filteredVendorStats = sortedVendorStats.filter(stat => accountTypeFilter === 'All' ? true : stat.accountType === accountTypeFilter);

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
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${accountTypeChipClass(selectedStat.accountType)}`}>
                        {selectedStat.accountType}
                    </span>
                    <button
                        onClick={() => setConfirmLockId(v.id)}
                        className={`ml-auto px-5 py-2 rounded-lg text-sm font-black border-b-2 active:scale-95 transition-all ${v.isLocked ? 'bg-green-600 text-white border-green-800 hover:bg-green-700' : 'bg-red-600 text-white border-red-800 hover:bg-red-700'}`}
                    >
                        {v.isLocked ? '🔓 Unlock Vendor' : '🔒 Block Vendor'}
                    </button>
                </div>

                {/* Commission stat boxes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Terminal Comm.',  value: formatGMD(selectedStat.terminalCommission), color: 'border-green-400 text-green-700' },
                        { label: 'Online Comm.',    value: formatGMD(selectedStat.onlineCommission), color: 'border-cyan-400 text-cyan-700' },
                        { label: 'Commission Due',  value: formatGMD(selectedStat.totalCommissionDue), color: 'border-fuchsia-400 text-fuchsia-700' },
                        { label: 'Cycle Due',       value: formatGMD(selectedStat.cycleCommissionDue), color: 'border-pink-400 text-pink-700' },
                    ].map(b => (
                        <div key={b.label} className={`bg-white rounded-xl border-t-4 p-3 text-center shadow ${b.color}`}>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{b.label}</p>
                            <p className={`text-xl font-black leading-none ${b.color.split(' ')[1]}`}>{b.value}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-fuchsia-50 border-2 border-fuchsia-200 rounded-xl p-4">
                    <h4 className="text-sm font-black text-fuchsia-700 uppercase mb-3">Commission Setup for {v.name}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="text-xs font-bold text-gray-700">
                            Terminal Sales Rate (%)
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={selectedStat.terminalRate}
                                onChange={(e) => setVendorRate(v.id, 'terminalRate', Number(e.target.value || 0))}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-fuchsia-300 bg-white text-sm font-black text-fuchsia-700"
                            />
                        </label>
                        <label className="text-xs font-bold text-gray-700">
                            Online Sales Rate (%)
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={selectedStat.onlineRate}
                                onChange={(e) => setVendorRate(v.id, 'onlineRate', Number(e.target.value || 0))}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-fuchsia-300 bg-white text-sm font-black text-fuchsia-700"
                            />
                        </label>
                        <label className="text-xs font-bold text-gray-700">
                            Settlement Plan
                            <select
                                value={selectedStat.settlementPlan}
                                onChange={(e) => setVendorSettlementPlan(v.id, e.target.value as SettlementPlan)}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-fuchsia-300 bg-white text-sm font-black text-fuchsia-700"
                            >
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </label>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-fuchsia-700">
                        Commission due for {periodLabel}: {formatGMD(selectedStat.totalCommissionDue)}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-fuchsia-700">
                        {selectedStat.settlementPlan === 'weekly' ? 'Weekly cycle due (last 7 days)' : 'Monthly cycle due (this month)'}: {formatGMD(selectedStat.cycleCommissionDue)}
                    </p>
                </div>

                <div className="bg-fuchsia-50/70 border border-fuchsia-200 rounded-xl p-3 text-xs text-fuchsia-700 font-semibold">
                    Commission-focused view enabled: operational ticket and deposit tables are hidden in this vendor drill-down.
                </div>

                {/* Confirm cancel modal */}
                {confirmCancelId && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
                            <h3 className="text-xl font-black text-red-600 uppercase">Confirm Cancel Ticket</h3>
                            <p className="text-sm text-gray-700">Cancel ticket <span className="font-mono font-black">#{confirmCancelId}</span>? This will refund eligible online customers and cannot be undone.</p>
                            <div className="flex gap-3">
                                <button onClick={() => { onCancelTicket(confirmCancelId!); setConfirmCancelId(null); setAdminCancelInput(''); setAdminCancelMsg({ ok: true, text: 'Ticket canceled successfully.' }); }} className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 active:scale-95">Yes, Cancel</button>
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
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">System-Wide Overview — All Vendors ({periodLabel})</p>
                    <div className="inline-flex bg-white/10 border border-white/20 rounded-full p-1">
                        <button
                            onClick={() => setPeriod('today')}
                            className={`px-3 py-1 text-[10px] font-black rounded-full uppercase transition-all ${period === 'today' ? 'bg-white text-gray-900' : 'text-white/80 hover:text-white'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setPeriod('weekly')}
                            className={`px-3 py-1 text-[10px] font-black rounded-full uppercase transition-all ${period === 'weekly' ? 'bg-white text-gray-900' : 'text-white/80 hover:text-white'}`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setPeriod('monthly')}
                            className={`px-3 py-1 text-[10px] font-black rounded-full uppercase transition-all ${period === 'monthly' ? 'bg-white text-gray-900' : 'text-white/80 hover:text-white'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setPeriod('all')}
                            className={`px-3 py-1 text-[10px] font-black rounded-full uppercase transition-all ${period === 'all' ? 'bg-white text-gray-900' : 'text-white/80 hover:text-white'}`}
                        >
                            All Time
                        </button>
                    </div>
                </div>
                <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-3">
                    <h4 className="text-[10px] font-black text-white/60 uppercase tracking-wider mb-2">Default Commission Rates</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-[11px] text-white/80 font-bold">
                            Terminal Sales (%)
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={defaultRates.terminalRate}
                                onChange={(e) => setDefaultRates(prev => ({ ...prev, terminalRate: normalizeRate(Number(e.target.value || 0)) }))}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white text-sm font-black"
                            />
                        </label>
                        <label className="text-[11px] text-white/80 font-bold">
                            Online Sales (%)
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.1}
                                value={defaultRates.onlineRate}
                                onChange={(e) => setDefaultRates(prev => ({ ...prev, onlineRate: normalizeRate(Number(e.target.value || 0)) }))}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-white/30 bg-white/10 text-white text-sm font-black"
                            />
                        </label>
                    </div>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                    <span className="text-white/60">Account Filter:</span>
                    {(['All', 'Terminal + Online', 'Terminal Only', 'Online Agent Only'] as Array<'All' | AccountType>).map(kind => (
                        <button
                            key={kind}
                            onClick={() => setAccountTypeFilter(kind)}
                            className={`px-3 py-1 rounded-full border transition-all ${accountTypeFilter === kind ? 'bg-white text-gray-900 border-white' : 'bg-white/5 text-white/80 border-white/20 hover:bg-white/10'}`}
                        >
                            {kind}
                        </button>
                    ))}
                    <span className="ml-auto text-white/50">Both: {accountTypeCounts.both} • Terminal: {accountTypeCounts.terminalOnly} • Online Only: {accountTypeCounts.onlineOnly}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Vendors',       value: String(vendors.length),      sub: `${vendors.filter(v=>v.isLocked).length} blocked`,   color: 'text-white' },
                        { label: 'Account Types', value: `${accountTypeCounts.both}/${accountTypeCounts.terminalOnly}/${accountTypeCounts.onlineOnly}`, sub: 'both / terminal / online', color: 'text-white' },
                        { label: 'Commission Due',value: formatGMD(grandCommissionDue), sub: `${formatGMD(grandTerminalCommission)} terminal + ${formatGMD(grandOnlineCommission)} online`, color: 'text-fuchsia-300' },
                        { label: 'Cycle Due',     value: formatGMD(grandCycleCommissionDue), sub: 'weekly/monthly plans', color: 'text-pink-300' },
                    ].map(b => (
                        <div key={b.label} className="text-center">
                            <p className="text-[10px] font-black text-white/50 uppercase tracking-wider">{b.label}</p>
                            <p className={`text-2xl font-black leading-none mt-1 ${b.color}`}>{b.value}</p>
                            <p className="text-[10px] text-white/40 mt-0.5">{b.sub}</p>
                        </div>
                    ))}
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
            {filteredVendorStats.length === 0 ? (
                <div className="text-center py-12 text-gray-400 italic">No vendors found.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredVendorStats.map(({ vendor, accountType, settlementPlan, totalCommissionDue, cycleCommissionDue, terminalRate, onlineRate }) => (
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

                            <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${accountTypeChipClass(accountType)}`}>{accountType}</span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-fuchsia-100 text-fuchsia-700">{settlementPlan === 'weekly' ? 'Weekly Settle' : 'Monthly Settle'}</span>
                            </div>

                            <div className="px-4 py-2 border-b border-gray-100 bg-fuchsia-50/60">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[10px] font-black text-fuchsia-700 uppercase">Commission Due</p>
                                    <p className="text-sm font-black text-fuchsia-700">{formatGMD(totalCommissionDue)}</p>
                                </div>
                                <p className="text-[10px] text-fuchsia-700/80 mt-0.5">Terminal {terminalRate}% • Online {onlineRate}%</p>
                                <p className="text-[10px] text-fuchsia-700/80">Cycle Due: {formatGMD(cycleCommissionDue)}</p>
                            </div>

                            {/* Card actions */}
                            <div className="px-4 pb-4 flex gap-2">
                                <button
                                    onClick={() => setSelectedVendorId(vendor.id)}
                                    className="flex-1 py-2 bg-gray-800 text-white text-xs font-black rounded-xl hover:bg-gray-900 active:scale-95 transition-all"
                                >
                                    Commission Details
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
