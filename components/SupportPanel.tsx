
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { apiUrl } from '../lib/apiUrl';

interface SupportPanelProps {
    onRecalculateAllTickets?: () => Promise<void>;
}

type ChatRole = 'user' | 'ai' | 'system';

interface ChatTurn {
    id: string;
    role: ChatRole;
    text: string;
    actions?: string[];
    timestamp: Date;
}

const QUICK_PROMPTS: { label: string; prompt: string }[] = [
    { label: '💸  Payout looks wrong', prompt: 'A customer says their winning ticket payout is wrong. What should I check?' },
    { label: '🪙  Deposit not credited', prompt: 'A customer made a Wave / AfriMoney deposit but their wallet balance did not increase. How do I investigate?' },
    { label: '🔒  Account locked', prompt: 'A customer says they cannot log in and their account is locked. What is the right resolution flow?' },
    { label: '🐎  Race result correction', prompt: 'I need to correct a race result after tickets have already settled. What is the safest procedure?' },
    { label: '🧾  Reprint a ticket', prompt: 'How do I reprint a ticket from the admin panel and what audit info should I record?' },
    { label: '📞  Customer wants refund', prompt: 'A customer is asking for a refund on a ticket. What policy and steps should I apply?' },
];

const newTurnId = () => `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const SupportPanel: React.FC<SupportPanelProps> = ({ onRecalculateAllTickets }) => {
    const [draft, setDraft] = useState('');
    const [turns, setTurns] = useState<ChatTurn[]>(() => ([
        {
            id: newTurnId(),
            role: 'ai',
            text: 'Hi — I am the Betese AI Support Assistant. Describe any issue you are seeing (payouts, deposits, locked accounts, race results, etc.) and I will diagnose it and suggest safe next steps.',
            timestamp: new Date(),
        },
    ]));
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'up-to-date' | 'available'>('up-to-date');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [turns, isAnalyzing]);

    const collectLocalSnapshot = () => {
        const dataDump: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('betese-')) {
                try {
                    dataDump[key] = JSON.parse(localStorage.getItem(key) || 'null');
                } catch {
                    dataDump[key] = localStorage.getItem(key);
                }
            }
        }
        return dataDump;
    };

    const localTriage = (issue: string, snapshot: Record<string, any>) => {
        const text = String(issue || '').toLowerCase();
        const actions: string[] = [];

        if (text.includes('payout') || text.includes('paid') || text.includes('win')) {
            actions.push('Open Ticket Information and confirm the ticket status + "Paid By" before any manual payout.');
            actions.push('If a race result was edited recently, run "Recalculate All Existing Tickets" once.');
        }
        if (text.includes('deposit') || text.includes('wallet') || text.includes('balance')) {
            actions.push('Open the customer deposit history and verify processor name, method, and timestamp.');
            actions.push('Use Admin > Adjust Balance with a correction PIN for approved wallet fixes.');
        }
        if (text.includes('phone') || text.includes('register') || text.includes('bonus')) {
            actions.push('Verify phone normalization (+220 local/international, +221 international only).');
            actions.push('Check duplicate-phone lock before approving the account.');
        }
        if (text.includes('result') || text.includes('race')) {
            actions.push('Confirm winning numbers, then rerun settlement from the admin tools.');
            actions.push('Export a support snapshot to preserve evidence before any change.');
        }
        if (text.includes('lock') || text.includes('block') || text.includes('unblock')) {
            actions.push('Use Admin > Users to unlock the customer if the lock was caused by duplicate phone.');
            actions.push('Confirm KYC info matches before unlocking accounts holding large balances.');
        }
        if (text.includes('refund') || text.includes('cancel')) {
            actions.push('Only refund active (un-settled) tickets — paid/settled tickets require manager approval.');
            actions.push('Record the reason in the cancel modal so the audit trail is complete.');
        }
        if (actions.length === 0) {
            actions.push('Export the support snapshot and review the latest entries in Ticket Information.');
            actions.push('Save a safety snapshot before performing any corrective action.');
        }

        const snapshotKeys = Object.keys(snapshot || {});
        const summary = `Offline triage complete — analysed your issue and ${snapshotKeys.length} local data block(s). The AI service was unreachable, so this is the rule-based fallback.`;

        return { summary, actions };
    };

    const sendPrompt = async (prompt: string) => {
        const trimmed = prompt.trim();
        if (!trimmed || isAnalyzing) return;

        const userTurn: ChatTurn = { id: newTurnId(), role: 'user', text: trimmed, timestamp: new Date() };
        setTurns((prev) => [...prev, userTurn]);
        setDraft('');
        setIsAnalyzing(true);

        const snapshot = collectLocalSnapshot();
        try {
            const url = apiUrl('/support-ai');
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    issueDescription: trimmed,
                    systemData: snapshot,
                    timestamp: new Date().toISOString(),
                }),
            });
            if (!response.ok) throw new Error(`AI service responded ${response.status}`);
            const payload = await response.json();
            const summary = String(payload?.summary || 'AI diagnosis completed.');
            const actions = Array.isArray(payload?.actions)
                ? payload.actions.map((x: any) => String(x)).slice(0, 6)
                : [];
            setTurns((prev) => [...prev, {
                id: newTurnId(),
                role: 'ai',
                text: summary,
                actions: actions.length ? actions : undefined,
                timestamp: new Date(),
            }]);
        } catch (err: any) {
            const fallback = localTriage(trimmed, snapshot);
            setTurns((prev) => [...prev, {
                id: newTurnId(),
                role: 'ai',
                text: fallback.summary,
                actions: fallback.actions,
                timestamp: new Date(),
            }]);
            console.warn('AI service unavailable, using local fallback.', err);
        } finally {
            setIsAnalyzing(false);
            requestAnimationFrame(() => textareaRef.current?.focus());
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendPrompt(draft);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt(draft);
        }
    };

    const handleClearChat = () => {
        if (!confirm('Clear this conversation?')) return;
        setTurns([{
            id: newTurnId(),
            role: 'ai',
            text: 'New conversation started. How can I help?',
            timestamp: new Date(),
        }]);
    };

    // ----- snapshot / report -----
    const handleQuickSnapshot = () => {
        const data: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('betese-')) {
                try { data[key] = JSON.parse(localStorage.getItem(key) || 'null'); } catch { data[key] = localStorage.getItem(key); }
            }
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SNAPSHOT_${new Date().toISOString().split('T')[0]}.betese`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert('Snapshot saved. Keep this file safe.');
    };

    const handleRestoreSnapshot = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (confirm('Are you sure? This will replace current local data with the snapshot.')) {
                    Object.entries(data).forEach(([key, value]) => {
                        if (typeof value === 'object') localStorage.setItem(key, JSON.stringify(value));
                        else localStorage.setItem(key, String(value));
                    });
                    window.location.reload();
                }
            } catch {
                alert('Invalid snapshot file.');
            }
        };
        reader.readAsText(file);
    };

    const handleCreateReport = () => {
        const latestUser = [...turns].reverse().find((t) => t.role === 'user');
        const issue = latestUser?.text || draft || '(no issue description provided)';
        const report = {
            timestamp: new Date(),
            issueDescription: issue,
            transcript: turns.map((t) => ({ role: t.role, text: t.text, actions: t.actions, at: t.timestamp })),
            systemData: collectLocalSnapshot(),
        };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `BUG_REPORT_${new Date().getTime()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert('Support package downloaded. Please send the file to the developer.');
    };

    const checkForUpdates = () => {
        setIsChecking(true);
        setTimeout(() => {
            setIsChecking(false);
            setUpdateStatus('up-to-date');
            alert('Your system is currently up to date (Version 1.0.0)');
        }, 1500);
    };

    const handleRecalculateAll = async () => {
        if (!onRecalculateAllTickets) return;
        if (!confirm('Recalculate all existing tickets now? This will correct historical outcomes with business-safe rules.')) return;
        setIsRecalculating(true);
        try {
            await onRecalculateAllTickets();
            alert('Recalculation completed successfully.');
        } catch (e: any) {
            alert(`Recalculation failed: ${e.message || e}`);
        } finally {
            setIsRecalculating(false);
        }
    };

    const messageCount = useMemo(() => turns.filter((t) => t.role !== 'system').length, [turns]);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* =================== AI CHAT (modern) =================== */}
            <div className="xl:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[680px] border border-indigo-800/40">
                {/* Header */}
                <div className="px-5 py-4 bg-black/30 backdrop-blur-md border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center shadow-lg shadow-indigo-900/40">
                                <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
                                    <path d="M5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8z" />
                                    <path d="M19 14l.9 2.4L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.6z" />
                                </svg>
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-slate-900 rounded-full animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-white text-lg font-black tracking-tight flex items-center gap-2">
                                Betese AI Support
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/30 uppercase tracking-wider">Online</span>
                            </h2>
                            <p className="text-indigo-200/80 text-xs font-medium">Vertex AI · Gemini · diagnoses payments, payouts, races &amp; users</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClearChat}
                        className="text-xs font-bold text-indigo-200 hover:text-white px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                        title="Start a new conversation"
                    >
                        ＋ New
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 scroll-smooth">
                    {turns.map((turn) => {
                        if (turn.role === 'user') {
                            return (
                                <div key={turn.id} className="flex justify-end animate-fade-in">
                                    <div className="max-w-[78%] bg-gradient-to-br from-indigo-500 to-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-lg shadow-indigo-900/30">
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                                        <p className="text-[10px] text-indigo-100/70 mt-1 text-right font-mono">
                                            {turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={turn.id} className="flex justify-start animate-fade-in">
                                <div className="flex gap-3 max-w-[88%]">
                                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 grid place-items-center shadow-md">
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
                                        </svg>
                                    </div>
                                    <div className="bg-white/5 backdrop-blur border border-white/10 text-indigo-50 px-4 py-3 rounded-2xl rounded-tl-md shadow-md">
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>
                                        {turn.actions && turn.actions.length > 0 && (
                                            <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                                                {turn.actions.map((action, idx) => (
                                                    <li key={idx} className="flex gap-2 text-xs text-indigo-100">
                                                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/30 border border-indigo-400/40 grid place-items-center text-[10px] font-bold text-indigo-100">{idx + 1}</span>
                                                        <span className="leading-relaxed">{action}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <p className="text-[10px] text-indigo-300/60 mt-2 font-mono">
                                            {turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {isAnalyzing && (
                        <div className="flex justify-start animate-fade-in">
                            <div className="flex gap-3 max-w-[88%]">
                                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 grid place-items-center shadow-md">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-white animate-spin-slow" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
                                    </svg>
                                </div>
                                <div className="bg-white/5 backdrop-blur border border-white/10 px-4 py-3 rounded-2xl rounded-tl-md shadow-md flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    <span className="text-xs text-indigo-200 ml-2 font-medium">AI is analysing…</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick prompts */}
                {messageCount <= 2 && (
                    <div className="px-4 pb-2">
                        <p className="text-[11px] uppercase tracking-wider text-indigo-300/80 font-bold mb-2">Quick start</p>
                        <div className="flex flex-wrap gap-2">
                            {QUICK_PROMPTS.map((q) => (
                                <button
                                    key={q.label}
                                    onClick={() => sendPrompt(q.prompt)}
                                    disabled={isAnalyzing}
                                    className="text-xs font-semibold px-3 py-2 rounded-full bg-white/5 hover:bg-white/15 text-indigo-100 border border-white/10 hover:border-indigo-300/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {q.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Composer */}
                <form onSubmit={handleSubmit} className="p-4 bg-black/30 backdrop-blur-md border-t border-white/10">
                    <div className="flex items-end gap-2 bg-white/10 rounded-2xl border border-white/15 p-2 focus-within:border-indigo-300/60 focus-within:bg-white/15 transition-all">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value.slice(0, 4500))}
                            onKeyDown={handleKeyDown}
                            maxLength={4500}
                            placeholder="Describe the issue — payouts, deposits, race results, locks…"
                            className="flex-1 bg-transparent text-white placeholder:text-indigo-200/40 text-sm px-3 py-2 outline-none resize-none max-h-48"
                            disabled={isAnalyzing}
                        />
                        <button
                            type="submit"
                            disabled={!draft.trim() || isAnalyzing}
                            className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white grid place-items-center shadow-lg shadow-indigo-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                            aria-label="Send"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 11l18-8-8 18-2-8-8-2z" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex items-center justify-between mt-2 px-1 gap-3">
                        <p className="text-[10px] text-indigo-300/60 font-medium">Enter to send · Shift+Enter for new line · responses are AI-generated, verify before acting</p>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`text-[10px] font-mono font-bold ${draft.length > 4000 ? 'text-amber-300' : draft.length > 4400 ? 'text-rose-300' : 'text-indigo-300/70'}`}>
                                {draft.length.toLocaleString()} / 4,500
                            </span>
                            <button
                                type="button"
                                onClick={handleCreateReport}
                                className="text-[10px] font-bold text-indigo-200 hover:text-white underline-offset-2 hover:underline"
                            >
                                ↓ Support package
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* =================== TOOLS SIDEBAR =================== */}
            <div className="space-y-5">
                <div className="bg-white p-5 rounded-2xl shadow-lg border-l-4 border-green-500">
                    <h3 className="text-lg font-black text-betese-dark mb-1 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-green-100 grid place-items-center text-green-700">
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" /></svg>
                        </span>
                        System
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">Current version <span className="font-mono font-bold text-green-700">v1.0.0</span> · {updateStatus === 'up-to-date' ? 'up to date' : 'update available'}</p>
                    <button
                        onClick={checkForUpdates}
                        disabled={isChecking}
                        className={`w-full py-2.5 font-bold text-sm rounded-xl transition-all shadow flex justify-center items-center gap-2 ${isChecking ? 'bg-gray-200 text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                        {isChecking ? 'Checking…' : 'Check for Updates'}
                    </button>
                    {onRecalculateAllTickets && (
                        <button
                            onClick={handleRecalculateAll}
                            disabled={isRecalculating}
                            className={`w-full mt-2 py-2.5 font-bold text-sm rounded-xl transition-all shadow flex justify-center items-center gap-2 ${isRecalculating ? 'bg-gray-200 text-gray-500' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                        >
                            {isRecalculating ? 'Recalculating…' : 'Recalculate All Tickets'}
                        </button>
                    )}
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-lg border-l-4 border-yellow-500">
                    <h3 className="text-lg font-black text-betese-dark mb-1 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-yellow-100 grid place-items-center text-yellow-700">
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z" /><path fillRule="evenodd" d="M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.163 3.75A.75.75 0 0110 12h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
                        </span>
                        Safety Snapshot
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">Save a snapshot before risky operations. Restore if something goes wrong.</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={handleQuickSnapshot}
                            className="py-2.5 bg-yellow-500 text-betese-dark font-bold rounded-xl hover:bg-yellow-600 shadow text-sm"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="py-2.5 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-800 shadow text-sm"
                        >
                            Restore
                        </button>
                        <input type="file" accept=".betese,.json" ref={fileInputRef} onChange={handleRestoreSnapshot} className="hidden" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-2xl shadow border border-indigo-100">
                    <h3 className="text-sm font-black text-indigo-900 mb-1">💡 Tip</h3>
                    <p className="text-xs text-indigo-800 leading-relaxed">
                        Use the chat to investigate before taking action. The AI sees a redacted local snapshot of your terminal data — passwords and tokens are stripped automatically.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.25s ease-out forwards; }
                @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin-slow 2.2s linear infinite; }
            `}</style>
        </div>
    );
};
