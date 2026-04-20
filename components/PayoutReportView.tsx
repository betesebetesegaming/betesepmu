import React, { useState, useMemo } from 'react';
import { Race } from '../types';
import { RapportPrintPanel } from './RapportPrintPanel';

export const PayoutReportView: React.FC<{ races: Race[], onPrintRequest: (race: Race) => void, effectiveTime: Date }> = ({ races, onPrintRequest, effectiveTime }) => {
    const [reportDate, setReportDate] = useState(effectiveTime.toISOString().split('T')[0]);

    const filteredRaces = useMemo(() => {
        const [year, month, day] = reportDate.split('-').map(Number);
        // This creates a date at the start of the day in the browser's local timezone.
        const targetDayStart = new Date(year, month - 1, day);
        const targetDayEnd = new Date(targetDayStart);
        targetDayEnd.setDate(targetDayStart.getDate() + 1);

        return races.filter(r => {
            const raceEndTime = r.endDate;
            // Check if the race ended on the selected day and has a result
            return raceEndTime >= targetDayStart && raceEndTime < targetDayEnd && r.result;
        }).sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
    }, [races, reportDate]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-betese-dark mb-4">Race Payout Reports</h2>
            <div className="mb-4">
                <label htmlFor="payout-date" className="block text-sm font-medium text-gray-700">Select Date</label>
                <input type="date" id="payout-date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" />
            </div>
            <RapportPrintPanel races={filteredRaces} onPrintRequest={onPrintRequest} />
        </div>
    );
};