
import React, { useState, useEffect, useMemo } from 'react';
import {
    DepositCapsConfig,
    DEPOSIT_CAPS_DEFAULTS,
    dbFetchDepositCaps,
    dbSaveDepositCaps,
    dbCancelWithdrawal,
    dbProcessWithdrawalRequest,
} from '../firebaseClient';
import { User, Ticket, WithdrawalRequest, PaymentIntegrationConfig, DepositLog, Race } from '../types';
import { BETTING_CUTOFF_MS, normalizeGambiaPhone } from '../utils';

// =================================================================
// SHARED STYLE HELPERS
// =================================================================

const Card: React.FC<{ title: string; subtitle?: string; accent?: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, subtitle, accent = 'from-indigo-500 to-blue-600', right, children }) => (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className={`px-6 py-4 bg-gradient-to-r ${accent} flex items-center justify-between`}>
            <div>
                <h3 className="text-white font-black text-lg leading-tight">{title}</h3>
                {subtitle && <p className="text-white/80 text-xs font-medium mt-0.5">{subtitle}</p>}
            </div>
            {right}
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone = 'text-gray-900' }) => (
    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">{label}</p>
        <p className={`text-xl font-black ${tone}`}>{value}</p>
    </div>
);

// =================================================================
// 1.  DEPOSIT & WITHDRAWAL CAPS
// =================================================================

export const DepositCapsPanel: React.FC<{ currentUserName: string }> = ({ currentUserName }) => {
    const [config, setConfig] = useState<DepositCapsConfig>(DEPOSIT_CAPS_DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const fetched = await dbFetchDepositCaps();
                if (!alive) return;
                setConfig(fetched);
                setSavedAt(fetched.updatedAt || null);
            } catch (e: any) {
                if (alive) setError(e?.message || 'Failed to load deposit caps.');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const updateField = (key: keyof DepositCapsConfig, value: number | boolean) => {
        setConfig((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setError('');
        if (config.perTransactionMin < 0 || config.perTransactionMax < config.perTransactionMin) {
            setError('Per-transaction max must be greater than min.');
            return;
        }
        if (config.dailyLimitPerCustomer < 0 || config.weeklyLimitPerCustomer < 0 || config.monthlyLimitPerCustomer < 0) {
            setError('Limits must be non-negative.');
            return;
        }
        setSaving(true);
        try {
            await dbSaveDepositCaps(config, currentUserName);
            setSavedAt(new Date().toISOString());
        } catch (e: any) {
            setError(e?.message || 'Save failed.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <Card title="Deposit & Withdrawal Caps" accent="from-emerald-500 to-teal-600">
            <p className="text-sm text-gray-500">Loading…</p>
        </Card>;
    }

    return (
        <div className="space-y-6">
            <Card
                title="Deposit Caps"
                subtitle="Enforced on customer deposits across all channels"
                accent="from-emerald-500 to-teal-600"
                right={savedAt ? <span className="text-[11px] font-bold text-white/80 bg-white/10 px-3 py-1.5 rounded-full border border-white/20">Saved {new Date(savedAt).toLocaleString()}</span> : null}
            >
                {error && <p className="mb-4 p-3 bg-red-50 text-red-700 font-bold text-sm rounded-lg border-l-4 border-red-500">{error}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberField label="Min per Deposit (GMD)" value={config.perTransactionMin} onChange={(v) => updateField('perTransactionMin', v)} hint="Reject deposits smaller than this" />
                    <NumberField label="Max per Deposit (GMD)" value={config.perTransactionMax} onChange={(v) => updateField('perTransactionMax', v)} hint="Reject deposits larger than this" />
                    <NumberField label="Daily Limit per Customer (GMD)" value={config.dailyLimitPerCustomer} onChange={(v) => updateField('dailyLimitPerCustomer', v)} hint="Cumulative cap in a 24h window" />
                    <NumberField label="Weekly Limit per Customer (GMD)" value={config.weeklyLimitPerCustomer} onChange={(v) => updateField('weeklyLimitPerCustomer', v)} />
                    <NumberField label="Monthly Limit per Customer (GMD)" value={config.monthlyLimitPerCustomer} onChange={(v) => updateField('monthlyLimitPerCustomer', v)} />
                    <ToggleField label="Freeze All Deposits" value={config.depositsFrozen} onChange={(v) => updateField('depositsFrozen', v)} tone="emerald" hint="Hard stop — emergencies only" />
                </div>
            </Card>

            <Card title="Withdrawal Caps" subtitle="Enforced on customer withdrawal requests" accent="from-rose-500 to-pink-600">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumberField label="Max per Withdrawal (GMD)" value={config.perWithdrawalMax} onChange={(v) => updateField('perWithdrawalMax', v)} />
                    <NumberField label="Daily Withdrawal Limit per Customer (GMD)" value={config.dailyWithdrawalLimitPerCustomer} onChange={(v) => updateField('dailyWithdrawalLimitPerCustomer', v)} />
                    <ToggleField label="Freeze All Withdrawals" value={config.withdrawalsFrozen} onChange={(v) => updateField('withdrawalsFrozen', v)} tone="rose" hint="Stops new withdrawal codes" />
                </div>
            </Card>

            <div className="sticky bottom-0 -mx-2 px-2 py-3 bg-white/70 backdrop-blur border-t border-gray-200 z-10 flex items-center justify-between gap-3 rounded-b-xl">
                <p className="text-xs text-gray-600">
                    {config.depositsFrozen && <span className="inline-block mr-2 px-2 py-1 bg-amber-100 text-amber-900 font-bold rounded">DEPOSITS FROZEN</span>}
                    {config.withdrawalsFrozen && <span className="inline-block mr-2 px-2 py-1 bg-rose-100 text-rose-900 font-bold rounded">WITHDRAWALS FROZEN</span>}
                    Changes apply immediately after saving.
                </p>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-6 py-3 rounded-xl font-black text-white shadow-lg transition-all ${saving ? 'bg-gray-400' : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'}`}
                >
                    {saving ? 'Saving…' : '💾 Save Caps'}
                </button>
            </div>
        </div>
    );
};

const NumberField: React.FC<{ label: string; value: number; onChange: (v: number) => void; hint?: string }> = ({ label, value, onChange, hint }) => (
    <label className="block">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{label}</span>
        <input
            type="number"
            value={Number.isFinite(value) ? value : 0}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="mt-1 block w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 focus:border-emerald-400 focus:ring-0 font-mono text-lg font-bold text-gray-900"
            min={0}
        />
        {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
    </label>
);

const ToggleField: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; tone?: string; hint?: string }> = ({ label, value, onChange, tone = 'indigo', hint }) => {
    const onColor = tone === 'rose' ? 'bg-rose-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';
    return (
        <div className="flex items-start justify-between gap-3 p-3 rounded-lg border-2 border-gray-200 bg-gray-50">
            <div>
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">{label}</p>
                {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
            </div>
            <button
                type="button"
                onClick={() => onChange(!value)}
                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${value ? onColor : 'bg-gray-300'}`}
                aria-pressed={value}
            >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${value ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        </div>
    );
};

// =================================================================
// 2.  USER CONTROL PANEL (block/unblock + balance + reset)
// =================================================================

interface UserControlPanelProps {
    users: User[];
    onToggleLock: (userId: string) => void;
    onAdminResetPassword: (userId: string, newPass: string) => { success: boolean; message: string };
    onAdminAdjustBalance: (customerId: string, walletDelta: number, bonusDelta: number, note: string, approvalPin: string) => Promise<{ success: boolean; message: string }>;
}

export const UserControlPanel: React.FC<UserControlPanelProps> = ({ users, onToggleLock, onAdminResetPassword, onAdminAdjustBalance }) => {
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<'All' | 'Customer' | 'Vendor' | 'Supervisor' | 'Admin'>('All');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');
    const [resetTarget, setResetTarget] = useState<User | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [adjustTarget, setAdjustTarget] = useState<User | null>(null);
    const [walletDelta, setWalletDelta] = useState(0);
    const [bonusDelta, setBonusDelta] = useState(0);
    const [adjustNote, setAdjustNote] = useState('');
    const [adjustPin, setAdjustPin] = useState('');
    const [adjustMsg, setAdjustMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (users || []).filter((u) => {
            if (roleFilter !== 'All' && u.role !== roleFilter) return false;
            if (statusFilter === 'active' && u.isLocked) return false;
            if (statusFilter === 'locked' && !u.isLocked) return false;
            if (!q) return true;
            return (u.name || '').toLowerCase().includes(q)
                || (u.phone || '').toLowerCase().includes(q)
                || (u.id || '').toLowerCase().includes(q);
        });
    }, [users, search, roleFilter, statusFilter]);

    const stats = useMemo(() => {
        const total = users.length;
        const locked = users.filter((u) => u.isLocked).length;
        const customers = users.filter((u) => u.role === 'Customer').length;
        const lockedCustomers = users.filter((u) => u.role === 'Customer' && u.isLocked).length;
        return { total, locked, customers, lockedCustomers };
    }, [users]);

    const handleResetPassword = () => {
        if (!resetTarget || newPassword.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }
        const result = onAdminResetPassword(resetTarget.id, newPassword);
        alert(result.message);
        if (result.success) {
            setResetTarget(null);
            setNewPassword('');
        }
    };

    const handleAdjust = async () => {
        if (!adjustTarget) return;
        if (!adjustPin.trim()) {
            setAdjustMsg({ ok: false, text: 'Approval PIN required.' });
            return;
        }
        if (walletDelta === 0 && bonusDelta === 0) {
            setAdjustMsg({ ok: false, text: 'Enter a wallet or bonus delta.' });
            return;
        }
        const res = await onAdminAdjustBalance(adjustTarget.id, walletDelta, bonusDelta, adjustNote, adjustPin);
        setAdjustMsg({ ok: res.success, text: res.message });
        if (res.success) {
            setTimeout(() => {
                setAdjustTarget(null);
                setWalletDelta(0);
                setBonusDelta(0);
                setAdjustNote('');
                setAdjustPin('');
                setAdjustMsg(null);
            }, 1500);
        }
    };

    return (
        <Card title="User Control Center" subtitle="Block, unblock, reset passwords, adjust balances" accent="from-indigo-500 to-purple-600">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Total Users" value={stats.total} />
                <Stat label="Locked" value={stats.locked} tone="text-rose-600" />
                <Stat label="Customers" value={stats.customers} tone="text-indigo-600" />
                <Stat label="Locked Customers" value={stats.lockedCustomers} tone="text-amber-600" />
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <input
                    type="text"
                    placeholder="🔍 Search by name, phone, or ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-indigo-400 focus:ring-0 text-sm"
                />
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold">
                    <option value="All">All Roles</option>
                    <option value="Customer">Customers</option>
                    <option value="Vendor">Vendors</option>
                    <option value="Supervisor">Supervisors</option>
                    <option value="Admin">Admins</option>
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold">
                    <option value="all">All Statuses</option>
                    <option value="active">Active only</option>
                    <option value="locked">Locked only</option>
                </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                        <tr>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">User</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Role</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Wallet</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Status</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No users match this filter.</td></tr>
                        )}
                        {filtered.map((u) => (
                            <tr key={u.id} className="border-t hover:bg-indigo-50/30 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-bold text-gray-900">{u.name}</p>
                                    <p className="text-[11px] text-gray-500">{u.role === 'Customer' ? u.phone : u.id}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${u.role === 'Admin' ? 'bg-red-100 text-red-700' : u.role === 'Supervisor' ? 'bg-orange-100 text-orange-700' : u.role === 'Vendor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{u.role}</span>
                                </td>
                                <td className="px-4 py-3 font-mono">{u.role === 'Customer' ? `${(u.walletBalance || 0).toFixed(2)} GMD` : '—'}</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${u.isLocked ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        <span className={`w-2 h-2 rounded-full ${u.isLocked ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                                        {u.isLocked ? 'LOCKED' : 'ACTIVE'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        {u.role !== 'Admin' && (
                                            <button
                                                onClick={() => onToggleLock(u.id)}
                                                className={`px-3 py-1 text-xs font-bold text-white rounded-lg shadow-sm transition-all ${u.isLocked ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                                            >
                                                {u.isLocked ? '✓ Unlock' : '✕ Lock'}
                                            </button>
                                        )}
                                        {u.role !== 'Admin' && (
                                            <button
                                                onClick={() => { setResetTarget(u); setNewPassword(''); }}
                                                className="px-3 py-1 text-xs font-bold text-white rounded-lg shadow-sm bg-amber-500 hover:bg-amber-600 transition-all"
                                            >
                                                ↻ Reset PW
                                            </button>
                                        )}
                                        {u.role === 'Customer' && (
                                            <button
                                                onClick={() => { setAdjustTarget(u); setWalletDelta(0); setBonusDelta(0); setAdjustNote(''); setAdjustPin(''); setAdjustMsg(null); }}
                                                className="px-3 py-1 text-xs font-bold text-white rounded-lg shadow-sm bg-indigo-500 hover:bg-indigo-600 transition-all"
                                            >
                                                💰 Adjust
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {resetTarget && (
                <Modal onClose={() => setResetTarget(null)} title={`Reset Password — ${resetTarget.name}`}>
                    <input
                        type="password"
                        placeholder="New password (min 6 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 focus:ring-0"
                    />
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setResetTarget(null)} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 font-bold rounded-xl">Cancel</button>
                        <button onClick={handleResetPassword} className="flex-1 px-4 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600">Reset Password</button>
                    </div>
                </Modal>
            )}

            {adjustTarget && (
                <Modal onClose={() => setAdjustTarget(null)} title={`Adjust Balance — ${adjustTarget.name}`}>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                            <span className="text-xs font-bold text-gray-600 uppercase">Wallet Δ (GMD)</span>
                            <input type="number" value={walletDelta} onChange={(e) => setWalletDelta(Number(e.target.value) || 0)} className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-gray-200 font-mono" />
                        </label>
                        <label className="block">
                            <span className="text-xs font-bold text-gray-600 uppercase">Bonus Δ (GMD)</span>
                            <input type="number" value={bonusDelta} onChange={(e) => setBonusDelta(Number(e.target.value) || 0)} className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-gray-200 font-mono" />
                        </label>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Use negative numbers to deduct. Current wallet: <span className="font-mono font-bold">{(adjustTarget.walletBalance || 0).toFixed(2)} GMD</span></p>
                    <label className="block mt-3">
                        <span className="text-xs font-bold text-gray-600 uppercase">Reason / Note</span>
                        <input type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. correction for failed Wave deposit ref 1234" className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-gray-200" />
                    </label>
                    <label className="block mt-3">
                        <span className="text-xs font-bold text-gray-600 uppercase">Approval PIN</span>
                        <input type="password" value={adjustPin} onChange={(e) => setAdjustPin(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border-2 border-gray-200" />
                    </label>
                    {adjustMsg && <p className={`mt-3 p-2 text-xs font-bold rounded-lg ${adjustMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{adjustMsg.text}</p>}
                    <div className="flex gap-2 mt-4">
                        <button onClick={() => setAdjustTarget(null)} className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 font-bold rounded-xl">Cancel</button>
                        <button onClick={handleAdjust} className="flex-1 px-4 py-2.5 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600">Apply Adjustment</button>
                    </div>
                </Modal>
            )}
        </Card>
    );
};

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-black text-gray-900 mb-4">{title}</h4>
            {children}
        </div>
    </div>
);

// =================================================================
// 3.  PAYMENT CONTROL (provider quick-toggle)
// =================================================================

interface PaymentControlPanelProps {
    configs: PaymentIntegrationConfig[];
    onSave: (config: PaymentIntegrationConfig) => Promise<void>;
    depositLogs: DepositLog[];
}

export const PaymentControlPanel: React.FC<PaymentControlPanelProps> = ({ configs, onSave, depositLogs }) => {
    const [saving, setSaving] = useState<string | null>(null);

    const providerMeta: Record<string, { color: string; emoji: string }> = {
        Wave: { color: 'from-blue-500 to-cyan-600', emoji: '🌊' },
        AfriMoney: { color: 'from-yellow-500 to-orange-600', emoji: '📱' },
        APS: { color: 'from-purple-500 to-pink-600', emoji: '💳' },
    };

    const usage = useMemo(() => {
        const byMethod: Record<string, { count: number; total: number; lastAt?: Date }> = {};
        (depositLogs || []).forEach((d) => {
            const m = d.method || 'Cash';
            if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
            byMethod[m].count += 1;
            byMethod[m].total += d.amount || 0;
            const ts = d.timestamp instanceof Date ? d.timestamp : new Date(d.timestamp as any);
            if (!byMethod[m].lastAt || ts > byMethod[m].lastAt!) byMethod[m].lastAt = ts;
        });
        return byMethod;
    }, [depositLogs]);

    const handleToggle = async (config: PaymentIntegrationConfig) => {
        const next = { ...config, isEnabled: !config.isEnabled };
        setSaving(config.provider);
        try {
            await onSave(next);
        } catch (e: any) {
            alert(`Failed to update ${config.provider}: ${e.message || e}`);
        } finally {
            setSaving(null);
        }
    };

    return (
        <Card title="Payment Provider Control" subtitle="One-click enable / disable per channel" accent="from-amber-500 to-orange-600">
            {configs.length === 0 && <p className="text-sm text-gray-500">No payment providers configured yet. Add credentials in the Payment API panel first.</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {configs.map((cfg) => {
                    const meta = providerMeta[cfg.provider] || { color: 'from-gray-600 to-gray-700', emoji: '⚙️' };
                    const stats = usage[cfg.provider] || { count: 0, total: 0 };
                    return (
                        <div key={cfg.provider} className={`rounded-2xl overflow-hidden shadow-lg border ${cfg.isEnabled ? 'border-emerald-300' : 'border-gray-200'}`}>
                            <div className={`p-5 bg-gradient-to-br ${meta.color} text-white`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-3xl">{meta.emoji}</span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${cfg.isEnabled ? 'bg-emerald-400/30 text-emerald-50 border border-emerald-200/40' : 'bg-black/20 text-gray-200 border border-white/20'}`}>
                                        {cfg.isEnabled ? '● Live' : '○ Disabled'}
                                    </span>
                                </div>
                                <p className="mt-3 text-2xl font-black">{cfg.provider}</p>
                                <p className="text-xs text-white/70 font-medium">{cfg.environment} · {cfg.currency || 'GMD'}</p>
                            </div>
                            <div className="p-4 bg-white space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2 bg-gray-50 rounded-lg">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Deposits</p>
                                        <p className="font-mono font-black text-gray-900">{stats.count}</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 rounded-lg">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase">Total</p>
                                        <p className="font-mono font-black text-gray-900">{stats.total.toFixed(0)} GMD</p>
                                    </div>
                                </div>
                                {stats.lastAt && <p className="text-[10px] text-gray-500">Last used: {stats.lastAt.toLocaleString()}</p>}
                                <button
                                    onClick={() => handleToggle(cfg)}
                                    disabled={saving === cfg.provider}
                                    className={`w-full py-2.5 font-black rounded-xl text-sm shadow transition-all ${cfg.isEnabled ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-emerald-500 text-white hover:bg-emerald-600'} ${saving === cfg.provider ? 'opacity-60' : ''}`}
                                >
                                    {saving === cfg.provider ? 'Saving…' : cfg.isEnabled ? '⏸ Disable' : '▶ Enable'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

// =================================================================
// 4.  BOOKING CODES (live booked tickets)
// =================================================================

interface BookingCodesPanelProps {
    allTickets: Ticket[];
    races: Race[];
    onCancelTicket: (ticketId: string) => void;
    onReprintTicket: (ticket: Ticket) => void;
    effectiveTime: Date;
}

export const BookingCodesPanel: React.FC<BookingCodesPanelProps> = ({ allTickets, races, onCancelTicket, onReprintTicket, effectiveTime }) => {
    const [filter, setFilter] = useState<'live' | 'all'>('live');
    const [search, setSearch] = useState('');

    const booked = useMemo(() => {
        const list = (allTickets || []).filter((t) => t.status === 'Booked' && t.bookingCode);
        return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [allTickets]);

    const isExpired = (ticket: Ticket) => {
        const now = effectiveTime.getTime();
        return ticket.selections.some((sel) => {
            const race = races.find((r) => r.id === sel.raceId);
            if (!race) return true;
            return (race.endDate.getTime() - now) <= BETTING_CUTOFF_MS;
        });
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return booked.filter((t) => {
            if (filter === 'live' && isExpired(t)) return false;
            if (!q) return true;
            return (t.bookingCode || '').toLowerCase().includes(q)
                || (t.id || '').toLowerCase().includes(q)
                || (t.vendorName || '').toLowerCase().includes(q);
        });
    }, [booked, filter, search, races, effectiveTime]);

    const stats = useMemo(() => {
        const total = booked.length;
        const expired = booked.filter(isExpired).length;
        const sum = booked.reduce((s, t) => s + (t.totalCost || 0), 0);
        return { total, live: total - expired, expired, sum };
    }, [booked, races, effectiveTime]);

    return (
        <Card title="Booking Codes — Live Running" subtitle="All booked (unpaid) tickets across vendors" accent="from-blue-500 to-cyan-600">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Booked Total" value={stats.total} />
                <Stat label="Live" value={stats.live} tone="text-emerald-600" />
                <Stat label="Expired" value={stats.expired} tone="text-rose-600" />
                <Stat label="Total Value" value={`${stats.sum.toFixed(0)} GMD`} tone="text-blue-600" />
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
                <input type="text" placeholder="🔍 Search by code, ID, or vendor…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm" />
                <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold">
                    <option value="live">Live only</option>
                    <option value="all">All booked</option>
                </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-50 to-cyan-50">
                        <tr>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Code</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Booked</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Cost</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Status</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No booking codes match this filter.</td></tr>
                        )}
                        {filtered.map((t) => {
                            const expired = isExpired(t);
                            return (
                                <tr key={t.id} className="border-t hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <p className="font-mono text-lg font-black tracking-widest text-blue-700">{t.bookingCode}</p>
                                        <p className="text-[10px] text-gray-500">#{t.id.slice(0, 8)}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs">
                                        <p className="font-bold">{t.vendorName}</p>
                                        <p className="text-gray-500">{t.timestamp.toLocaleString()}</p>
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold">{t.totalCost.toFixed(0)} GMD</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${expired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{expired ? 'EXPIRED' : 'LIVE'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1.5">
                                            <button onClick={() => onReprintTicket(t)} className="px-3 py-1 text-xs font-bold text-white rounded-lg bg-blue-500 hover:bg-blue-600 shadow-sm">🖨 Reprint</button>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Cancel booking ${t.bookingCode}? This cannot be undone.`)) onCancelTicket(t.id);
                                                }}
                                                className="px-3 py-1 text-xs font-bold text-white rounded-lg bg-rose-500 hover:bg-rose-600 shadow-sm"
                                            >
                                                ✕ Cancel
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

// =================================================================
// 5.  WITHDRAWAL CODES (cashier-issued)
// =================================================================

interface WithdrawalCodesPanelProps {
    withdrawalRequests: WithdrawalRequest[];
    currentUserId: string;
    currentUserName: string;
    effectiveTime: Date;
    onRefresh?: () => void;
}

export const WithdrawalCodesPanel: React.FC<WithdrawalCodesPanelProps> = ({ withdrawalRequests, currentUserId, currentUserName, effectiveTime, onRefresh }) => {
    const [filter, setFilter] = useState<'Pending' | 'Completed' | 'Canceled' | 'All'>('Pending');
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const filtered = useMemo(() => {
        const list = (withdrawalRequests || []).slice().sort((a, b) => {
            const ta = a.requestedAt instanceof Date ? a.requestedAt.getTime() : new Date(a.requestedAt as any).getTime();
            const tb = b.requestedAt instanceof Date ? b.requestedAt.getTime() : new Date(b.requestedAt as any).getTime();
            return tb - ta;
        });
        const q = search.trim().toLowerCase();
        return list.filter((r) => {
            if (filter !== 'All' && r.status !== filter) return false;
            if (!q) return true;
            return (r.code || '').toLowerCase().includes(q)
                || (r.customerName || '').toLowerCase().includes(q)
                || (r.recipientPhone || '').toLowerCase().includes(q);
        });
    }, [withdrawalRequests, filter, search]);

    const stats = useMemo(() => {
        const pending = withdrawalRequests.filter((r) => r.status === 'Pending');
        const completed = withdrawalRequests.filter((r) => r.status === 'Completed');
        const pendingTotal = pending.reduce((s, r) => s + (r.amount || 0), 0);
        const completedToday = completed.filter((r) => {
            const at = r.completedAt instanceof Date ? r.completedAt : (r.completedAt ? new Date(r.completedAt as any) : null);
            if (!at) return false;
            return at.toDateString() === effectiveTime.toDateString();
        });
        const completedTodayTotal = completedToday.reduce((s, r) => s + (r.amount || 0), 0);
        return { pendingCount: pending.length, pendingTotal, completedToday: completedToday.length, completedTodayTotal };
    }, [withdrawalRequests, effectiveTime]);

    const handleCashPayout = async (req: WithdrawalRequest) => {
        if (!req.code) return;
        if (!confirm(`Pay ${req.amount.toFixed(0)} GMD cash to ${req.customerName}?\nCode: ${req.code}`)) return;
        setBusyId(req.id);
        setMsg(null);
        try {
            const ok = await dbProcessWithdrawalRequest(req.code, currentUserId, currentUserName, effectiveTime);
            if (ok) {
                setMsg({ ok: true, text: `✓ Paid ${req.amount.toFixed(0)} GMD to ${req.customerName}` });
                onRefresh?.();
            } else {
                setMsg({ ok: false, text: 'Could not pay — code may already be processed.' });
            }
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message || 'Payout failed.' });
        } finally {
            setBusyId(null);
        }
    };

    const handleCancel = async (req: WithdrawalRequest) => {
        if (!confirm(`Cancel withdrawal code ${req.code} (${req.amount.toFixed(0)} GMD)?`)) return;
        setBusyId(req.id);
        setMsg(null);
        try {
            await dbCancelWithdrawal(req.id);
            setMsg({ ok: true, text: 'Withdrawal canceled.' });
            onRefresh?.();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message || 'Cancel failed.' });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Card title="Withdrawal Codes — Cashier Payouts" subtitle="Customer-issued codes ready for cash payout" accent="from-rose-500 to-red-600">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <Stat label="Pending Codes" value={stats.pendingCount} tone="text-amber-600" />
                <Stat label="Pending Value" value={`${stats.pendingTotal.toFixed(0)} GMD`} tone="text-rose-600" />
                <Stat label="Paid Today" value={stats.completedToday} tone="text-emerald-600" />
                <Stat label="Cashed Today" value={`${stats.completedTodayTotal.toFixed(0)} GMD`} tone="text-blue-600" />
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
                <input type="text" placeholder="🔍 Search by code, customer, or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm" />
                <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold">
                    <option value="Pending">Pending only</option>
                    <option value="Completed">Completed only</option>
                    <option value="Canceled">Canceled only</option>
                    <option value="All">All</option>
                </select>
                {onRefresh && (
                    <button onClick={onRefresh} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200">↻ Refresh</button>
                )}
            </div>

            {msg && <p className={`mb-3 p-3 text-sm font-bold rounded-lg ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-l-4 border-emerald-400' : 'bg-rose-50 text-rose-700 border-l-4 border-rose-400'}`}>{msg.text}</p>}

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                    <thead className="bg-gradient-to-r from-rose-50 to-red-50">
                        <tr>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Code</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Customer</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Amount</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Status</th>
                            <th className="text-left px-4 py-3 font-black text-gray-700 uppercase text-xs">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No withdrawal codes match this filter.</td></tr>
                        )}
                        {filtered.map((r) => (
                            <tr key={r.id} className="border-t hover:bg-rose-50/30 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-mono text-lg font-black tracking-widest text-rose-700">{r.code}</p>
                                    <p className="text-[10px] text-gray-500">{(r.requestedAt instanceof Date ? r.requestedAt : new Date(r.requestedAt as any)).toLocaleString()}</p>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                    <p className="font-bold">{r.customerName}</p>
                                    <p className="text-gray-500">{r.recipientPhone || '—'}</p>
                                </td>
                                <td className="px-4 py-3 font-mono font-black text-lg">{r.amount.toFixed(0)} GMD</td>
                                <td className="px-4 py-3">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        r.status === 'Pending' ? 'bg-amber-100 text-amber-700'
                                        : r.status === 'Completed' ? 'bg-emerald-100 text-emerald-700'
                                        : r.status === 'Processing' ? 'bg-blue-100 text-blue-700'
                                        : r.status === 'Failed' ? 'bg-rose-100 text-rose-700'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}>{r.status}</span>
                                    {r.processedByName && <p className="text-[10px] text-gray-500 mt-1">by {r.processedByName}</p>}
                                </td>
                                <td className="px-4 py-3">
                                    {r.status === 'Pending' ? (
                                        <div className="flex gap-1.5">
                                            <button
                                                disabled={busyId === r.id}
                                                onClick={() => handleCashPayout(r)}
                                                className="px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-emerald-500 hover:bg-emerald-600 shadow-sm disabled:opacity-50"
                                            >
                                                💵 Pay Cash
                                            </button>
                                            <button
                                                disabled={busyId === r.id}
                                                onClick={() => handleCancel(r)}
                                                className="px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-rose-500 hover:bg-rose-600 shadow-sm disabled:opacity-50"
                                            >
                                                ✕ Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};
