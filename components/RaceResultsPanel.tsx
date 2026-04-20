
import React from 'react';
import { Race } from '../types';

interface RaceResultsPanelProps {
  races: Race[];
  onSelectRace: (race: Race) => void;
  effectiveTime: Date;
}

export const RaceResultsPanel: React.FC<RaceResultsPanelProps> = ({ races, onSelectRace, effectiveTime }) => {
  const pastRaces = races
    .filter(r => effectiveTime >= r.endDate)
    .sort((a, b) => b.endDate.getTime() - a.endDate.getTime());

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-betese-dark mb-4">Race Results</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {pastRaces.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No completed races yet.</p>
        ) : (
          pastRaces.map((race) => (
            <button
              key={race.id}
              onClick={() => onSelectRace(race)}
              className="w-full text-left p-3 rounded-md transition-all hover:bg-gray-100 border flex justify-between items-center"
            >
              <div>
                <p className="font-semibold">{race.name}</p>
                <p className="text-xs text-gray-500">{race.endDate.toLocaleString()}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${race.result ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {race.result ? 'View Results' : 'Pending'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
