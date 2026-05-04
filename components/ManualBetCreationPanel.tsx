
import React, { useState, useMemo } from 'react';
import { Race, BetTypeOption, User, ManualBetOrder, BetSelection } from '../types';
import { TableScrollNavigator } from './TableScrollNavigator';

interface ManualBetCreationPanelProps {
    races: Race[];
    users: User[];
    manualBetOrders: ManualBetOrder[];
    onCreateManualBet: (selectionData: Omit<BetSelection, 'cost' | 'raceName'>, multiplier: number, totalCost: number, assignedVendorId: string) => void;
    onCancelManualBet: (orderId: string) => void;
    effectiveTime: Date;
}

export const ManualBetCreationPanel: React.FC<ManualBetCreationPanelProps> = ({ races, users, manualBetOrders, onCreateManualBet, onCancelManualBet, effectiveTime }) => {
    const [raceId, setRaceId] = useState('');
    const [betType, setBetType] = useState<BetTypeOption | ''>('');
    const [numbers, setNumbers] = useState('');
    const [multiplier, setMultiplier] = useState(1);
    const [totalCost, setTotalCost] = useState<number | ''>('');
    const [vendorId, setVendorId] = useState('');
    const [error, setError] = useState('');

    const availableRaces = useMemo(() => races.filter(r => r.endDate > effectiveTime), [races, effectiveTime]);
    const vendors = useMemo(() => users.filter(u => u.role === 'Vendor'), [users]);
    const pendingOrders = useMemo(() => manualBetOrders.filter(o => o.status === 'Pending'), [manualBetOrders]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const parsedNumbers = numbers.split(/,|-|\s+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        
        if (!raceId || !betType || parsedNumbers.length === 0 || totalCost === '' || !vendorId) {
            setError('Please fill all fields.');
            return;
        }
        
        const selectionData = {
            raceId,
            betType,
            numbers: parsedNumbers,
            xCount: 0, // Manual bets are simplified to not use X for now
            multiplier: multiplier, // Added multiplier here
        };

        onCreateManualBet(selectionData, multiplier, Number(totalCost), vendorId);

        // Reset form
        setRaceId('');
        setBetType('');
        setNumbers('');
        setMultiplier(1);
        setTotalCost('');
        setVendorId('');
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                <h3 className="text-lg font-semibold text-betese-dark">Create Manual Priced Bet</h3>
                {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <select value={raceId} onChange={e => setRaceId(e.target.value)} className="p-2 border rounded w-full bg-white" required>
                        <option value="">-- Select Race --</option>
                        {availableRaces.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select value={betType} onChange={e => setBetType(e.target.value as BetTypeOption)} className="p-2 border rounded w-full bg-white" required>
                        <option value="">-- Select Bet Type --</option>
                        {Object.values(BetTypeOption).map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </select>
                    <input type="text" value={numbers} onChange={e => setNumbers(e.target.value)} placeholder="Numbers (e.g., 1, 5, 10)" className="p-2 border rounded w-full" required />
                    <input type="number" value={multiplier} onChange={e => setMultiplier(parseInt(e.target.value, 10) || 1)} min="1" placeholder="Multiplier" className="p-2 border rounded w-full" required />
                    <input type="number" value={totalCost} onChange={e => setTotalCost(e.target.value === '' ? '' : parseFloat(e.target.value))} min="1" placeholder="Manual Total Cost (GMD)" className="p-2 border rounded w-full" required />
                    <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="p-2 border rounded w-full bg-white" required>
                        <option value="">-- Assign to Vendor --</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                </div>
                <button type="submit" className="w-full px-6 py-3 bg-betese-green text-white font-bold rounded-lg shadow-md hover:bg-green-700">Create & Assign Bet</button>
            </form>

             <div className="bg-white p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-betese-dark mb-4">Pending Manual Bets</h3>
                <TableScrollNavigator className="overflow-x-auto">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="text-left py-2 px-3">Assigned To</th>
                                <th className="text-left py-2 px-3">Created At</th>
                                <th className="text-left py-2 px-3">Bet Details</th>
                                <th className="text-right py-2 px-3">Total Cost</th>
                                <th className="text-center py-2 px-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingOrders.map(order => {
                                const vendor = users.find(u => u.id === order.assignedVendorId);
                                const race = races.find(r => r.id === order.selections[0].raceId);
                                return (
                                    <tr key={order.id} className="border-b">
                                        <td className="py-2 px-3">{vendor?.name ?? 'Unknown'}</td>
                                        <td className="py-2 px-3 whitespace-nowrap">{order.createdAt.toLocaleTimeString()}</td>
                                        <td className="py-2 px-3">
                                            <p className="font-semibold">{race?.name} - {order.selections[0].betType}</p>
                                            <p className="font-mono">{order.selections[0].numbers.join(', ')}</p>
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold">{order.totalCost.toFixed(2)} GMD</td>
                                        <td className="py-2 px-3 text-center">
                                            <button onClick={() => onCancelManualBet(order.id)} className="px-3 py-1 text-xs text-white font-semibold rounded-lg bg-red-600 hover:bg-red-700">Cancel</button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {pendingOrders.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-4 text-gray-500">No pending manual bets.</td></tr>
                            )}
                        </tbody>
                    </table>
                </TableScrollNavigator>
            </div>
        </div>
    );
};
