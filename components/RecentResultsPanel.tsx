
import React from 'react';
import { Race } from '../types';
import { formatWinningNumbersForDisplay } from '../utils';

interface RecentResultsPanelProps {
    races: Race[];
    effectiveTime: Date;
}

export const RecentResultsPanel: React.FC<RecentResultsPanelProps> = ({ races, effectiveTime }) => {
    const recentRaces = races
        .filter(r => r.endDate <= effectiveTime)
        .sort((a, b) => b.endDate.getTime() - a.endDate.getTime())
        .slice(0, 5); // Show the last 5 completed races

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">
                Recent Race Results
            </h2>
            <p className="text-sm text-gray-600 mb-4">A quick view of the results for the most recently completed races.</p>
            
            {recentRaces.length > 0 ? (
                <div className="space-y-3">
                    {recentRaces.map(race => (
                        <div key={race.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-gray-50 border border-gray-200 rounded-md gap-2">
                            <div>
                                <p className="font-bold text-betese-dark">{race.name}</p>
                                <p className="text-sm text-gray-600">
                                    Completed: {race.endDate.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {race.result ? (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">Main</span>
                                            <span className="font-mono font-bold text-lg text-blue-600">{formatWinningNumbersForDisplay(race.result.winningNumbers)}</span>
                                        </div>
                                        {race.result.bracketWinningNumbers && race.result.bracketWinningNumbers.length > 0 && (
                                             <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">Bkt 1</span>
                                                <span className="font-mono font-semibold text-sm text-purple-600">
                                                    {formatWinningNumbersForDisplay(race.result.bracketWinningNumbers)}
                                                </span>
                                             </div>
                                        )}
                                        {race.result.bracket2WinningNumbers && race.result.bracket2WinningNumbers.length > 0 && (
                                             <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase">Bkt 2</span>
                                                <span className="font-mono font-semibold text-sm text-pink-600">
                                                    {formatWinningNumbersForDisplay(race.result.bracket2WinningNumbers)}
                                                </span>
                                             </div>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-sm font-semibold text-red-600 animate-pulse">Pending...</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 text-center py-4">No races have been completed yet.</p>
            )}
        </div>
    );
}
