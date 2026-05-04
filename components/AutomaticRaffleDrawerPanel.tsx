import React, { useMemo, useState } from 'react';
import { Ticket, User } from '../types';
import { TableScrollNavigator } from './TableScrollNavigator';

type PrizeTier = 'First' | 'Second' | 'Third';

interface RaffleEntry {
    raffleNumber: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    ticketId: string;
    amount: number;
    timestamp: Date;
}

interface RaffleWinner {
    tier: PrizeTier;
    prize: number;
    raffleNumber: string;
    customerId: string;
    customerName: string;
    customerPhone: string;
    ticketId: string;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'GMD', maximumFractionDigits: 2 }).format(value);

const toDayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const normalizePhone = (phone?: string) => String(phone || '').replace(/\s+/g, '').trim();

const toRaffleNumber = (index: number) => String(100000 + index).padStart(6, '0');

const pickDistinctEntries = (entries: RaffleEntry[], count: number): RaffleEntry[] => {
    const pool = [...entries];
    const picked: RaffleEntry[] = [];

    while (pool.length > 0 && picked.length < count) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const candidate = pool[randomIndex];
        picked.push(candidate);
        pool.splice(randomIndex, 1);
    }

    return picked;
};

interface AutomaticRaffleDrawerPanelProps {
    users: User[];
    tickets: Ticket[];
    effectiveTime: Date;
}

export const AutomaticRaffleDrawerPanel: React.FC<AutomaticRaffleDrawerPanelProps> = ({ users = [], tickets = [], effectiveTime }) => {
    const [drawName, setDrawName] = useState('Online Customer Raffle');
    const [drawDate, setDrawDate] = useState(toDayKey(effectiveTime));
    const [oneEntryPerCustomer, setOneEntryPerCustomer] = useState(true);

    const [firstPrize, setFirstPrize] = useState(10000);
    const [secondPrize, setSecondPrize] = useState(5000);
    const [thirdPrize, setThirdPrize] = useState(2500);

    const [firstNumber, setFirstNumber] = useState('');
    const [secondNumber, setSecondNumber] = useState('');
    const [thirdNumber, setThirdNumber] = useState('');

    const [winners, setWinners] = useState<RaffleWinner[]>([]);

    const customersById = useMemo(() => {
        const map = new Map<string, User>();
        users.forEach(user => map.set(user.id, user));
        return map;
    }, [users]);

    const eligibleEntries = useMemo(() => {
        const selectedDate = new Date(drawDate + 'T00:00:00');
        const selectedDay = toDayKey(selectedDate);

        const onlineTickets = tickets.filter(ticket => {
            if (!ticket.customerId) return false;
            if (!ticket.timestamp) return false;
            if (['Canceled', 'Booked'].includes(ticket.status)) return false;

            const customer = customersById.get(ticket.customerId);
            if (!customer || customer.role !== 'Customer') return false;
            if (!normalizePhone(customer.phone)) return false;

            const ticketDay = toDayKey(new Date(ticket.timestamp));
            return ticketDay === selectedDay;
        });

        if (!onlineTickets.length) return [] as RaffleEntry[];

        const source = oneEntryPerCustomer
            ? Array.from(new Map(onlineTickets.map(ticket => [ticket.customerId as string, ticket])).values())
            : onlineTickets;

        return source.map((ticket, index) => {
            const customer = customersById.get(ticket.customerId || '');
            return {
                raffleNumber: toRaffleNumber(index + 1),
                customerId: ticket.customerId || '',
                customerName: customer?.name || 'Unknown Customer',
                customerPhone: normalizePhone(customer?.phone),
                ticketId: ticket.id,
                amount: Number(ticket.totalCost || 0),
                timestamp: new Date(ticket.timestamp)
            };
        });
    }, [tickets, customersById, drawDate, oneEntryPerCustomer]);

    const runAutomaticDraw = () => {
        if (eligibleEntries.length < 3) {
            alert('Not enough eligible online customers to draw 3 winners.');
            return;
        }

        const picked = pickDistinctEntries(eligibleEntries, 3);
        const prizeValues = [firstPrize, secondPrize, thirdPrize];
        const tiers: PrizeTier[] = ['First', 'Second', 'Third'];

        const nextWinners = picked.map((entry, index) => ({
            tier: tiers[index],
            prize: Number(prizeValues[index] || 0),
            raffleNumber: entry.raffleNumber,
            customerId: entry.customerId,
            customerName: entry.customerName,
            customerPhone: entry.customerPhone,
            ticketId: entry.ticketId
        }));

        setWinners(nextWinners);
    };

    const runNumberBasedDraw = () => {
        const numberMap = new Map<string, RaffleEntry>(eligibleEntries.map(entry => [entry.raffleNumber, entry] as [string, RaffleEntry]));
        const selectedNumbers = [firstNumber, secondNumber, thirdNumber].map(n => n.trim());

        if (selectedNumbers.some(n => !n)) {
            alert('Please provide all winning numbers (1st, 2nd, 3rd).');
            return;
        }

        if (new Set(selectedNumbers).size !== 3) {
            alert('Winning numbers must be unique.');
            return;
        }

        const entries = selectedNumbers.map(n => numberMap.get(n));
        if (entries.some(e => !e)) {
            alert('One or more winning numbers are not in the eligible list.');
            return;
        }

        const prizeValues = [firstPrize, secondPrize, thirdPrize];
        const tiers: PrizeTier[] = ['First', 'Second', 'Third'];

        const nextWinners = entries.map((entry, index) => ({
            tier: tiers[index],
            prize: Number(prizeValues[index] || 0),
            raffleNumber: entry!.raffleNumber,
            customerId: entry!.customerId,
            customerName: entry!.customerName,
            customerPhone: entry!.customerPhone,
            ticketId: entry!.ticketId
        }));

        setWinners(nextWinners);
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Automatic Raffle Drawer</h2>
                        <p className="mt-1 text-sm text-slate-700">Eligible participants: online customers with a registered phone number and betting activity on selected date.</p>
                    </div>
                    <div className="rounded-lg bg-white/80 px-4 py-3 text-right shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eligible Entries</p>
                        <p className="text-2xl font-extrabold text-slate-900">{eligibleEntries.length}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Draw Setup</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="space-y-1">
                                <span className="text-sm font-semibold text-slate-700">Draw Name</span>
                                <input value={drawName} onChange={e => setDrawName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Weekend Online Draw" />
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-semibold text-slate-700">Draw Date</span>
                                <input type="date" value={drawDate} onChange={e => setDrawDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-semibold text-slate-700">1st Prize (GMD)</span>
                                <input type="number" min={0} value={firstPrize} onChange={e => setFirstPrize(Number(e.target.value || 0))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-semibold text-slate-700">2nd Prize (GMD)</span>
                                <input type="number" min={0} value={secondPrize} onChange={e => setSecondPrize(Number(e.target.value || 0))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-semibold text-slate-700">3rd Prize (GMD)</span>
                                <input type="number" min={0} value={thirdPrize} onChange={e => setThirdPrize(Number(e.target.value || 0))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                            </label>
                            <label className="space-y-1">
                                <span className="text-sm font-semibold text-slate-700">Entry Rule</span>
                                <select value={oneEntryPerCustomer ? 'one' : 'all'} onChange={e => setOneEntryPerCustomer(e.target.value === 'one')} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                                    <option value="one">One entry per customer</option>
                                    <option value="all">All tickets as entries</option>
                                </select>
                            </label>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <button onClick={runAutomaticDraw} className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
                                Run Automatic Draw
                            </button>
                            <button onClick={() => setWinners([])} className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-300">
                                Clear Winners
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Draw by Winning Numbers</h3>
                        <p className="text-sm text-slate-600 mb-4">Enter the winning raffle numbers for 1st, 2nd, and 3rd place.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input value={firstNumber} onChange={e => setFirstNumber(e.target.value.trim())} className="rounded-lg border border-slate-300 px-3 py-2" placeholder="1st Number" />
                            <input value={secondNumber} onChange={e => setSecondNumber(e.target.value.trim())} className="rounded-lg border border-slate-300 px-3 py-2" placeholder="2nd Number" />
                            <input value={thirdNumber} onChange={e => setThirdNumber(e.target.value.trim())} className="rounded-lg border border-slate-300 px-3 py-2" placeholder="3rd Number" />
                        </div>
                        <button onClick={runNumberBasedDraw} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
                            Apply Winning Numbers
                        </button>
                    </div>
                </div>

                <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900">Current Winners</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-4">{drawName} • {drawDate}</p>
                    <div className="space-y-3">
                        {winners.length === 0 && <p className="text-sm text-slate-500">No winners selected yet.</p>}
                        {winners.map((winner) => (
                            <div key={winner.tier} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-bold text-slate-900">{winner.tier} Prize</p>
                                <p className="text-xs text-slate-600">Number: <span className="font-semibold">{winner.raffleNumber}</span></p>
                                <p className="text-xs text-slate-600">Customer: <span className="font-semibold">{winner.customerName}</span> ({winner.customerPhone})</p>
                                <p className="text-xs text-slate-600">Ticket: <span className="font-semibold">{winner.ticketId}</span></p>
                                <p className="mt-1 text-sm font-extrabold text-emerald-700">{formatCurrency(winner.prize)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-3">Eligible Number List</h3>
                <TableScrollNavigator className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-slate-100 text-left text-slate-700">
                                <th className="px-3 py-2 font-semibold">Raffle Number</th>
                                <th className="px-3 py-2 font-semibold">Customer</th>
                                <th className="px-3 py-2 font-semibold">Phone</th>
                                <th className="px-3 py-2 font-semibold">Ticket</th>
                                <th className="px-3 py-2 font-semibold">Stake</th>
                            </tr>
                        </thead>
                        <tbody>
                            {eligibleEntries.length === 0 && (
                                <tr>
                                    <td className="px-3 py-4 text-slate-500" colSpan={5}>No eligible online bettors found for selected date.</td>
                                </tr>
                            )}
                            {eligibleEntries.map(entry => (
                                <tr key={entry.raffleNumber + entry.ticketId} className="border-t border-slate-100">
                                    <td className="px-3 py-2 font-mono font-semibold text-slate-800">{entry.raffleNumber}</td>
                                    <td className="px-3 py-2 text-slate-800">{entry.customerName}</td>
                                    <td className="px-3 py-2 text-slate-700">{entry.customerPhone}</td>
                                    <td className="px-3 py-2 text-slate-700">{entry.ticketId}</td>
                                    <td className="px-3 py-2 text-slate-700">{formatCurrency(entry.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableScrollNavigator>
            </div>
        </div>
    );
};
