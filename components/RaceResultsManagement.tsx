
import React, { useMemo, useState } from 'react';
import { Race, RaceResult, Ticket } from '../types';
import { RaceResultModal } from './RaceResultModal';
import { formatWinningNumbersForDisplay } from '../utils';

interface RaceResultsManagementProps {
    races: Race[];
    tickets: Ticket[];
    effectiveTime: Date;
    onSave?: (result: RaceResult) => Promise<boolean>;
    canEdit?: boolean;
}

export const RaceResultsManagement: React.FC<RaceResultsManagementProps> = ({ races, tickets, effectiveTime, onSave, canEdit = true }) => {
    const [editingRace, setEditingRace] = useState<Race | null>(null);

    const pastRaces = useMemo(() => {
        return races
            .filter(race => race.endDate <= effectiveTime)
            .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
    }, [races, effectiveTime]);

    const formatDateTime = (date: Date) => {
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    };
    
    const handleSaveResult = async (result: RaceResult) => {
        if (!canEdit || !onSave) return false;
        const saved = await onSave(result);
        if (saved) setEditingRace(null);
        return saved;
    };

    return (
        <>
        {editingRace && (
            <RaceResultModal
                race={editingRace}
                tickets={tickets}
                onClose={() => setEditingRace(null)}
                onSave={handleSaveResult}
            />
        )}
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">Race Results & Payouts</h2>
            <p className="text-sm text-gray-600 mb-4">{canEdit ? 'This is the dedicated area to enter or edit the winning numbers and payout dividends for all completed races.' : 'This area is view-only. Race results and tie brackets can only be entered or edited by Admin.'}</p>
            
            <div className="overflow-x-auto mt-4">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="text-left py-2 px-3">Race Name</th>
                            <th className="text-left py-2 px-3">Completed At</th>
                            <th className="text-left py-2 px-3">Result Status</th>
                            <th className="text-left py-2 px-3">Winning Numbers</th>
                            {canEdit && <th className="text-left py-2 px-3">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {pastRaces.map(race => (
                             <tr key={race.id} className="border-b">
                                <td className="py-2 px-3 font-semibold">{race.name}</td>
                                <td className="py-2 px-3">{formatDateTime(race.endDate)}</td>
                                <td className="py-2 px-3">
                                    {race.result ? (
                                        <span className="font-bold text-green-600">Results Entered</span>
                                    ) : (
                                        <span className="font-semibold text-red-600">Pending Results</span>
                                    )}
                                </td>
                                <td className="py-2 px-3 whitespace-nowrap font-mono font-bold">
                                    {race.result ? (
                                        <>
                                            {formatWinningNumbersForDisplay(race.result.winningNumbers)}
                                            {race.result.bracketWinningNumbers && race.result.bracketWinningNumbers.length > 0 && (
                                                <span className="block text-xs text-blue-600 mt-1">
                                                    Tie 1: {formatWinningNumbersForDisplay(race.result.bracketWinningNumbers)}
                                                </span>
                                            )}
                                            {race.result.bracket2WinningNumbers && race.result.bracket2WinningNumbers.length > 0 && (
                                                <span className="block text-xs text-indigo-600 mt-1">
                                                    Tie 2: {formatWinningNumbersForDisplay(race.result.bracket2WinningNumbers)}
                                                </span>
                                            )}
                                        </>
                                    ) : '---'}
                                </td>
                                {canEdit && (
                                    <td className="py-2 px-3">
                                        <button
                                            onClick={() => setEditingRace(race)}
                                            className="px-3 py-1 text-sm text-white font-semibold rounded-lg bg-blue-600 hover:bg-blue-700"
                                        >
                                            Enter/Edit Results
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {pastRaces.length === 0 && (
                             <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-4 text-gray-500">No completed races found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        </>
    );
};
