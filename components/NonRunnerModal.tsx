import React, { useState } from 'react';
import { Race } from '../types';

interface NonRunnerModalProps {
  race: Race;
  onClose: () => void;
  onSave: (nonRunners: number[]) => void;
}

export const NonRunnerModal: React.FC<NonRunnerModalProps> = ({ race, onClose, onSave }) => {
  const [nonRunnersInput, setNonRunnersInput] = useState(race.nonRunners.join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedNonRunners = nonRunnersInput
      .split(/,|-|\s+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0 && n <= race.horseCount);

    const uniqueNonRunners = [...new Set(parsedNonRunners)];

    // FIX: Explicitly cast to Number to resolve TypeScript error on arithmetic operation.
    onSave(uniqueNonRunners.sort((a, b) => Number(a) - Number(b)));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold text-betese-dark mb-4">Update Non-Runners for {race.name}</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="non-runners-input" className="block text-lg font-medium text-gray-700">Non-Runner Horses</label>
            <input
              id="non-runners-input"
              type="text"
              value={nonRunnersInput}
              onChange={(e) => setNonRunnersInput(e.target.value)}
              className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm text-lg"
              placeholder="e.g., 3, 11, 14"
            />
            <p className="text-xs text-gray-500 mt-1">Enter horse numbers separated by commas, spaces, or hyphens.</p>
            <p className="text-xs text-gray-500 mt-1">Current non-runners: <span className="font-bold">{race.nonRunners.join(', ') || 'None'}</span></p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400">Cancel</button>
          <button type="submit" className="px-6 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700">Save Changes</button>
        </div>
      </form>
    </div>
  );
};
