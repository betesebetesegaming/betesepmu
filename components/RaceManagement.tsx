
import React, { useState, useEffect } from 'react';
import { Race, BetTypeOption, RaceResult } from '../types';
import { NonRunnerModal } from './NonRunnerModal';
import { TableScrollNavigator } from './TableScrollNavigator';

interface RaceManagementProps {
    races: Race[];
    onAddRace: (race: Race) => void;
    onUpdateRace: (race: Race) => void;
    onUpdateNonRunners: (raceId: string, nonRunners: number[]) => void;
    onDeleteRace: (race: Race) => void;
    effectiveTime: Date;
}

const formatDateForInput = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatTimeForInput = (date: Date) => {
    const HH = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');
    return `${HH}:${MM}`;
};


const RaceForm: React.FC<{
    editingRace: Race | null;
    onSave: (raceData: Omit<Race, 'id' | 'nonRunners' | 'result'>, id?: string) => void;
    onCancel: () => void;
    effectiveTime: Date;
}> = ({ editingRace, onSave, onCancel, effectiveTime }) => {
    const [raceCode, setRaceCode] = useState('');
    const [name, setName] = useState('');
    const [venue, setVenue] = useState('');
    const [horseCount, setHorseCount] = useState(16);
    const [startDate, setStartDate] = useState(formatDateForInput(effectiveTime));
    const [endDate, setEndDate] = useState(formatDateForInput(effectiveTime));
    const [endTime, setEndTime] = useState('00:00'); // Default to 00:00 for manual entry
    const [disabledBetTypes, setDisabledBetTypes] = useState<BetTypeOption[]>([]);
    const [jackpot, setJackpot] = useState<number | ''>(''); // New Jackpot State
    
    // FIX: Removed effectiveTime from dependencies to prevent form reset on every clock tick
    useEffect(() => {
        if (editingRace) {
            setRaceCode(editingRace.raceCode || '');
            setName(editingRace.name);
            setVenue(editingRace.venue || '');
            setHorseCount(editingRace.horseCount);
            setDisabledBetTypes(editingRace.disabledBetTypes || []);
            setStartDate(formatDateForInput(editingRace.startDate));
            setEndDate(formatDateForInput(editingRace.endDate));
            setEndTime(formatTimeForInput(editingRace.endDate));
            setJackpot(editingRace.jackpot || '');
        } else {
            // Reset to default values for a new race
            setRaceCode('');
            setName('');
            setVenue('');
            setHorseCount(16);
            setStartDate(formatDateForInput(effectiveTime));
            setEndDate(formatDateForInput(effectiveTime));
            // Changed the default time from '00:00' to the current effective time.
            setEndTime(formatTimeForInput(effectiveTime));
            setDisabledBetTypes([]);
            setJackpot('');
        }
    }, [editingRace]); 

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Replaced problematic Date string parsing with an explicit constructor to prevent timezone-related date shifts.
        const startParts = startDate.split('-').map(Number);
        const finalStartDate = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        finalStartDate.setHours(0, 0, 0, 0);

        const endParts = endDate.split('-').map(Number);
        const timeParts = endTime.split(':').map(Number);
        const finalEndDate = new Date(endParts[0], endParts[1] - 1, endParts[2], timeParts[0], timeParts[1]);

        if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
            alert("Please enter a valid date and time.");
            return;
        }

        // Only prevent a past date when creating a new race, allowing edits for corrections.
        if (!editingRace && finalEndDate < effectiveTime) {
            alert("The race end date and time cannot be in the past. Please select a future time.");
            return;
        }
        
        onSave({
            raceCode: raceCode.trim() || undefined,
            name,
            venue: venue.trim() || undefined,
            horseCount,
            startDate: finalStartDate,
            endDate: finalEndDate,
            disabledBetTypes,
            jackpot: jackpot === '' ? undefined : Number(jackpot),
        }, editingRace?.id);
    };

    const handleDisabledBetTypeChange = (betType: BetTypeOption) => {
        setDisabledBetTypes(prev => 
            prev.includes(betType) 
                ? prev.filter(bt => bt !== betType)
                : [...prev, betType]
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 mb-6 p-4 border rounded-lg bg-gray-50 scroll-mt-4">
            <h3 className="col-span-full text-lg font-semibold text-betese-dark">
                 {editingRace ? `Editing Race: ${editingRace.name}` : 'Setup New Race'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Race Code</label>
                    <input type="text" placeholder="e.g., R1 / MAIN" value={raceCode} onChange={e => setRaceCode(e.target.value.toUpperCase())} className="p-2 border rounded w-full" />
                </div>
                <div className="lg:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Race Name</label>
                    <input type="text" placeholder="e.g., Main Race, R1" value={name} onChange={e => setName(e.target.value)} className="p-2 border rounded w-full" required />
                </div>
                <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Place / Venue</label>
                    <input type="text" placeholder="e.g., ParisLongchamp" value={venue} onChange={e => setVenue(e.target.value)} className="p-2 border rounded w-full" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded w-full" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded w-full" required />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="p-2 border rounded w-full" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Horses</label>
                    <input type="number" placeholder="16" value={horseCount} onChange={e => setHorseCount(parseInt(e.target.value, 10) || 0)} className="p-2 border rounded w-full" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-yellow-700 mb-1">Jackpot Amount (Optional)</label>
                    <input type="number" placeholder="e.g. 1000000" value={jackpot} onChange={e => setJackpot(e.target.value === '' ? '' : parseFloat(e.target.value))} className="p-2 border rounded w-full border-yellow-400 bg-yellow-50" />
                </div>
            </div>
             <div className="col-span-full pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Disabled Bet Types (Optional)</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {Object.values(BetTypeOption).map(betType => (
                        <label key={betType} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={disabledBetTypes.includes(betType)}
                                onChange={() => handleDisabledBetTypeChange(betType)}
                                className="h-4 w-4 rounded border-gray-300 text-betese-green focus:ring-betese-green"
                            />
                            {betType}
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                {editingRace && <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400">Cancel Edit</button>}
                <button type="submit" className="px-6 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700">
                    {editingRace ? 'Save Changes' : 'Save / Active'}
                </button>
            </div>
        </form>
    );
};


export const RaceManagement: React.FC<RaceManagementProps> = ({ races, onAddRace, onUpdateRace, onUpdateNonRunners, onDeleteRace, effectiveTime }) => {
    const [editingRace, setEditingRace] = useState<Race | null>(null);
    const [editingNonRunnersRace, setEditingNonRunnersRace] = useState<Race | null>(null);

    const upcomingRaces = React.useMemo(() => {
        return races
            .filter(race => race.endDate > effectiveTime)
            .sort((a,b) => a.startDate.getTime() - b.startDate.getTime());
    }, [races, effectiveTime]);

    const handleSaveRace = (raceData: Omit<Race, 'id' | 'nonRunners' | 'result'>, id?: string) => {
        if (id && editingRace) { // Editing
            onUpdateRace({
                ...editingRace,
                ...raceData,
            });
        } else { // Adding
            onAddRace({
                id: `r-${Date.now()}`,
                ...raceData,
                nonRunners: [],
            });
        }
        setEditingRace(null);
    };

    const formatDateTime = (date: Date) => {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };
    
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">Upcoming Race Setup</h2>

            <p className="text-sm text-gray-600 mb-4">Use the form below to create new races or click 'Edit' on an upcoming race in the table to modify it.</p>

            <RaceForm
                editingRace={editingRace}
                onSave={handleSaveRace}
                onCancel={() => setEditingRace(null)}
                effectiveTime={effectiveTime}
            />

            <h3 className="text-lg font-semibold text-betese-dark mt-6 mb-2">Upcoming Scheduled Races ({upcomingRaces.length})</h3>
            
            <TableScrollNavigator className="overflow-x-auto mt-4">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="text-left py-2 px-3">Code</th>
                            <th className="text-left py-2 px-3">Name</th>
                            <th className="text-left py-2 px-3">Place</th>
                            <th className="text-left py-2 px-3">Start Date</th>
                            <th className="text-left py-2 px-3">End Date & Time</th>
                            <th className="text-left py-2 px-3">Last Edited By</th>
                            <th className="text-left py-2 px-3">Jackpot</th>
                            <th className="text-left py-2 px-3">Horses</th>
                            <th className="text-left py-2 px-3">Non-Runners</th>
                            <th className="text-left py-2 px-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {upcomingRaces.map(race => (
                             <tr key={race.id} className="border-b">
                            <td className="py-2 px-3 font-mono text-xs">{race.raceCode || '-'}</td>
                                <td className="py-2 px-3 font-semibold">{race.name}</td>
                            <td className="py-2 px-3">{race.venue || '-'}</td>
                                <td className="py-2 px-3">{formatDate(race.startDate)}</td>
                                <td className="py-2 px-3">{formatDateTime(race.endDate)}</td>
                                <td className="py-2 px-3 text-xs">
                                    {race.updatedByName ? (
                                        <div>
                                            <div className="font-black text-indigo-700">{race.updatedByName}</div>
                                            <div className="text-gray-500">{race.updatedAt ? formatDateTime(race.updatedAt) : '-'}</div>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="py-2 px-3 text-yellow-700 font-bold">{race.jackpot ? race.jackpot.toLocaleString() : '-'}</td>
                                <td className="py-2 px-3 text-center">{race.horseCount}</td>
                                <td className="py-2 px-3 text-red-600 font-semibold">{race.nonRunners.join(', ')}</td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                     <div className="flex items-center gap-2">
                                        <button onClick={() => setEditingRace(race)} className="px-3 py-1 text-sm text-white font-semibold rounded-lg bg-yellow-500 hover:bg-yellow-600">Edit</button>
                                        <button onClick={() => setEditingNonRunnersRace(race)} className="px-3 py-1 text-sm text-white font-semibold rounded-lg bg-orange-500 hover:bg-orange-600">Non-Runners</button>
                                        <button onClick={() => onDeleteRace(race)} className="px-3 py-1 text-sm text-white font-semibold rounded-lg bg-red-600 hover:bg-red-700">Delete</button>
                                     </div>
                                </td>
                            </tr>
                        ))}
                        {upcomingRaces.length === 0 && (
                                <tr><td colSpan={10} className="text-center py-4 text-gray-500">No upcoming races found.</td></tr>
                        )}
                    </tbody>
                </table>
            </TableScrollNavigator>
            
            {editingNonRunnersRace && <NonRunnerModal race={editingNonRunnersRace} onClose={() => setEditingNonRunnersRace(null)} onSave={(nonRunners) => { onUpdateNonRunners(editingNonRunnersRace.id, nonRunners); setEditingNonRunnersRace(null); }} />}
        </div>
    );
};
