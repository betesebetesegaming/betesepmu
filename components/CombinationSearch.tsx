import React, { useState, useMemo } from 'react';
import { Ticket, Race, BetTypeOption, BetSelection } from '../types';

interface CombinationSearchProps {
  allTickets: Ticket[];
  races: Race[];
  onCancelTicket: (ticketId: string) => void;
  effectiveTime: Date;
}

export const CombinationSearch: React.FC<CombinationSearchProps> = ({ allTickets, races, onCancelTicket, effectiveTime }) => {
  const [selectedRaceId, setSelectedRaceId] = useState<string>('');
  const [selectedBetType, setSelectedBetType] = useState<BetTypeOption | ''>('');

  const activeAndUpcomingRaces = races.filter(r => effectiveTime < r.endDate);

  const isTicketCancellable = (ticket: Ticket): boolean => {
    if (ticket.status === 'Booked') return true;
    if (ticket.status !== 'Active') return false;
    
    const hasRaceStarted = ticket.selections.some(selection => {
        const race = races.find(r => r.id === selection.raceId);
        return race && effectiveTime >= race.startDate;
    });
    return !hasRaceStarted;
  };

  const flatTicketSelections = useMemo(() => {
    if (!selectedRaceId || !selectedBetType) return [];

    const selections: { ticket: Ticket; selection: BetSelection }[] = [];

    const activeTickets = allTickets.filter(t => t.status === 'Active' || t.status === 'Booked');

    for (const ticket of activeTickets) {
        for (const selection of ticket.selections) {
            if (selection.raceId === selectedRaceId && selection.betType === selectedBetType) {
                selections.push({ ticket, selection });
            }
        }
    }

    // Sort by timestamp, newest first
    return selections.sort((a, b) => b.ticket.timestamp.getTime() - a.ticket.timestamp.getTime());

  }, [selectedRaceId, selectedBetType, allTickets]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-betese-dark mb-4">Live Combination Explorer</h2>
      <p className="text-sm text-gray-600 mb-4">Select a race and bet type to see a detailed list of all active bets. You can cancel individual tickets directly from this table if needed.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 border rounded-lg bg-gray-50">
        <select value={selectedRaceId} onChange={e => setSelectedRaceId(e.target.value)} className="p-2 border rounded w-full bg-white">
          <option value="">-- Select Race --</option>
          {activeAndUpcomingRaces.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={selectedBetType} onChange={e => setSelectedBetType(e.target.value as BetTypeOption)} className="p-2 border rounded w-full bg-white">
          <option value="">-- Select Bet Type --</option>
          {Object.values(BetTypeOption).map(bt => <option key={bt} value={bt}>{bt}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="text-left py-2 px-3">Ticket ID</th>
              <th className="text-left py-2 px-3">Time Played</th>
              <th className="text-left py-2 px-3">Vendor</th>
              <th className="text-left py-2 px-3">Combination (Order)</th>
              <th className="text-left py-2 px-3">Combination (Disorder)</th>
              <th className="text-right py-2 px-3">Stake</th>
              <th className="text-center py-2 px-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {flatTicketSelections.length > 0 ? (
              flatTicketSelections.map(({ ticket, selection }, index) => (
                <tr key={`${ticket.id}-${index}`} className="border-b">
                  <td className="py-2 px-3 font-mono">{ticket.id}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{ticket.timestamp.toLocaleString()}</td>
                  <td className="py-2 px-3">{ticket.vendorName}</td>
                  <td className="py-2 px-3 font-mono font-bold">
                      {selection.xCount > 0 && `${'X '.repeat(selection.xCount)}`}
                      {selection.numbers.join(', ')}
                  </td>
                  <td className="py-2 px-3 font-mono">
                      {selection.xCount > 0 && `${'X '.repeat(selection.xCount)}`}
                      {[...selection.numbers].sort((a, b) => a - b).join(', ')}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold">
                      {(selection.cost * selection.multiplier).toFixed(2)} GMD
                  </td>
                  <td className="py-2 px-3 text-center">
                    {isTicketCancellable(ticket) ? (
                      <button
                        onClick={() => onCancelTicket(ticket.id)}
                        className="px-3 py-1 text-xs text-white font-semibold rounded-lg bg-red-600 hover:bg-red-700"
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 font-semibold">{ticket.status}</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-6 text-gray-500">
                  {selectedRaceId && selectedBetType ? 'No active tickets found for this selection.' : 'Please select a race and bet type to see ticket details.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};