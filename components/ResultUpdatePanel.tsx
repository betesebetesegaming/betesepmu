import React from 'react';
import { Race } from '../types';
import { PayoutReportView } from './PayoutReportView';

interface ResultUpdatePanelProps {
    races: Race[];
    onPrintRequest: (race: Race) => void;
    effectiveTime: Date;
}

export const ResultUpdatePanel: React.FC<ResultUpdatePanelProps> = ({ races, effectiveTime, onPrintRequest }) => {
    const pendingRaces = races.filter(r => r.endDate <= effectiveTime && !r.result)
        .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-red-800 mb-4">Races Awaiting Results</h2>
                <p className="text-sm text-gray-600 mb-4">The following races have finished, but the results have not been entered by an administrator yet. Please check back later for the official payout report.</p>
                {pendingRaces.length > 0 ? (
                    <div className="space-y-3">
                        {pendingRaces.map(race => (
                            <div key={race.id} className="p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                                <p className="font-bold text-betese-dark">{race.name}</p>
                                <p className="text-sm text-gray-600">Ended at: {race.endDate.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-center py-4">All completed races have results.</p>
                )}
            </div>
            
            <PayoutReportView races={races} onPrintRequest={onPrintRequest} effectiveTime={effectiveTime} />
        </div>
    );
};
