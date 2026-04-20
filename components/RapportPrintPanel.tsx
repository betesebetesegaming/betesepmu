import React from 'react';
import { Race } from '../types';

interface RapportPrintPanelProps {
  races: Race[];
  onPrintRequest: (race: Race) => void;
}

export const RapportPrintPanel: React.FC<RapportPrintPanelProps> = ({ races, onPrintRequest }) => {
  // Parent component now provides pre-filtered and sorted races.
  const pastRaces = races;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-betese-dark mb-4">Report Payment Printout</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {pastRaces.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No race results are available to print for the selected date.</p>
        ) : (
          pastRaces.map((race) => (
            <div
              key={race.id}
              className="w-full text-left p-3 rounded-md border flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">{race.name}</p>
                <p className="text-xs text-gray-500">{race.endDate.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
              </div>
              <button
                onClick={() => onPrintRequest(race)}
                className="px-4 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700 text-sm whitespace-nowrap"
              >
                Print Report
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
