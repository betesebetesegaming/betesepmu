
import React from 'react';
import { ManualBetOrder, User, Race } from '../types';
import { TableScrollNavigator } from './TableScrollNavigator';

interface PendingManualBetsPanelProps {
    manualBetOrders: ManualBetOrder[];
    currentUser: User;
    races: Race[];
    onProcessManualBet: (orderId: string) => void;
}

export const PendingManualBetsPanel: React.FC<PendingManualBetsPanelProps> = ({ manualBetOrders, currentUser, races, onProcessManualBet }) => {
    const assignedOrders = manualBetOrders.filter(order => order.assignedVendorId === currentUser.id && order.status === 'Pending');

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-betese-dark mb-4">Pending Manual Bets</h2>
            <p className="text-sm text-gray-600 mb-4">These are special bets created by the back office for you to process. Confirm with the customer before printing.</p>
            <TableScrollNavigator className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="text-left py-2 px-3">Created By</th>
                            <th className="text-left py-2 px-3">Created At</th>
                            <th className="text-left py-2 px-3">Bet Details</th>
                            <th className="text-right py-2 px-3">Multiplier</th>
                            <th className="text-right py-2 px-3">Total Cost</th>
                            <th className="text-center py-2 px-3">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assignedOrders.length > 0 ? (
                            assignedOrders.map(order => {
                                const race = races.find(r => r.id === order.selections[0].raceId);
                                return (
                                <tr key={order.id} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-3">{order.createdByName}</td>
                                    <td className="py-2 px-3 whitespace-nowrap">{order.createdAt.toLocaleString()}</td>
                                    <td className="py-2 px-3">
                                        <p className="font-semibold">{race?.name ?? 'Unknown Race'}</p>
                                        <p>{order.selections[0].betType}: <span className="font-mono">{order.selections[0].numbers.join(', ')}</span></p>
                                    </td>
                                    <td className="py-2 px-3 text-right font-semibold">x{order.selections[0].multiplier}</td>
                                    <td className="py-2 px-3 text-right font-bold text-lg">{order.totalCost.toFixed(2)} GMD</td>
                                    <td className="py-2 px-3 text-center">
                                        <button 
                                            onClick={() => onProcessManualBet(order.id)}
                                            className="px-4 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700"
                                        >
                                            Process & Print
                                        </button>
                                    </td>
                                </tr>
                            )})
                        ) : (
                            <tr>
                                <td colSpan={6} className="py-6 px-3 text-center text-gray-500">
                                    You have no pending manual bets assigned to you.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </TableScrollNavigator>
        </div>
    );
};
