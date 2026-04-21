
import React, { useState, useEffect } from 'react';
import { Race, RaceResult, Payouts, Ticket } from '../types';
import { calculateWinSummary, WinSummary, formatWinningNumbersForInput, parseWinningNumbersFromString } from '../utils';
import { WinDividendReport } from './WinDividendReport';

interface RaceResultModalProps {
  race: Race;
  onClose: () => void;
  onSave: (result: RaceResult) => void;
  tickets: Ticket[];
}

const PayoutInput: React.FC<{label: string, value: number | '', onChange: (val: number | '') => void}> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <input 
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-betese-green focus:border-betese-green"
            placeholder="0.00"
            step="0.01"
            min="0"
        />
    </div>
);

const allPayoutKeys: (keyof Payouts)[] = [
    'ordreGagnant', 'coupleA', 'coupleB', 'coupleC', 
    'tierceOrdre', 'tierceDesordre', 'quarteOrdre', 'quarteDesordre', 
    'quarteBonus3', 'quinteOrdre', 'quinteDesordre', 'quinteBonus4', 
    'quinteBonus3', 'simpleGagnant', 'simplePlaceA', 'simplePlaceB', 
    'simplePlaceC', 'multi4', 'multi5', 'multi6', 'multi7'
];

const payoutFields: {key: keyof Payouts, label: string, group: string}[] = [
    { key: 'ordreGagnant', label: 'Gagnant (1-2 Any Order)', group: 'Couplé'},
    { key: 'coupleA', label: 'Placé (1-2)', group: 'Couplé'},
    { key: 'coupleB', label: 'Couple B (1-3)', group: 'Couplé'},
    { key: 'coupleC', label: 'Couple C (2-3)', group: 'Couplé'},
    { key: 'tierceOrdre', label: 'Tiercé Ordre', group: 'Tiercé'},
    { key: 'tierceDesordre', label: 'Tiercé Désordre', group: 'Tiercé'},
    { key: 'quarteOrdre', label: 'Quarté+ Ordre', group: 'Quarté+'},
    { key: 'quarteDesordre', label: 'Quarté+ Désordre', group: 'Quarté+'},
    { key: 'quarteBonus3', label: 'Quarté+ Bonus 3', group: 'Quarté+'},
    { key: 'quinteOrdre', label: 'Quinté+ Ordre', group: 'Quinté+'},
    { key: 'quinteDesordre', label: 'Quinté+ Désordre', group: 'Quinté+'},
    { key: 'quinteBonus4', label: 'Quinté+ Bonus 4', group: 'Quinté+'},
    { key: 'quinteBonus3', label: 'Quinté+ Bonus 3', group: 'Quinté+'},
    { key: 'simpleGagnant', label: 'Simple Gagnant', group: 'Simple'},
    { key: 'simplePlaceA', label: 'Simple Placé A', group: 'Simple'},
    { key: 'simplePlaceB', label: 'Simple Placé B', group: 'Simple'},
    { key: 'simplePlaceC', label: 'Simple Placé C', group: 'Simple'},
    { key: 'multi4', label: 'Multi 4', group: 'Multi'},
    { key: 'multi5', label: 'Multi 5', group: 'Multi'},
    { key: 'multi6', label: 'Multi 6', group: 'Multi'},
    { key: 'multi7', label: 'Multi 7', group: 'Multi'},
];

const groupedFields = payoutFields.reduce((acc, field) => {
    acc[field.group] = [...(acc[field.group] || []), field];
    return acc;
}, {} as Record<string, typeof payoutFields>);


type ResultTab = 'Primary' | 'Bracket1' | 'Bracket2';

export const RaceResultModal: React.FC<RaceResultModalProps> = ({ race, onClose, onSave, tickets }) => {
    // --- Tab State ---
    const [activeTab, setActiveTab] = useState<ResultTab>('Primary');
    const [bracketCount, setBracketCount] = useState(
        race.result?.bracket2WinningNumbers?.length ? 2 : (race.result?.bracketWinningNumbers?.length ? 1 : 0)
    );

    const initializePayouts = (sourcePayouts?: Payouts): Record<keyof Payouts, number | ''> => {
        const initial: Partial<Record<keyof Payouts, number | ''>> = {};
        for (const key of allPayoutKeys) {
            initial[key] = sourcePayouts?.[key] ?? '';
        }
        return initial as Record<keyof Payouts, number | ''>;
    };

    // --- State for all 3 Results ---
    const [primaryNumbersStr, setPrimaryNumbersStr] = useState(formatWinningNumbersForInput(race.result?.winningNumbers) || '');
    const [primaryPayouts, setPrimaryPayouts] = useState(initializePayouts(race.result?.payouts));
    
    const [bracket1NumbersStr, setBracket1NumbersStr] = useState(formatWinningNumbersForInput(race.result?.bracketWinningNumbers) || '');
    const [bracket1Payouts, setBracket1Payouts] = useState(initializePayouts(race.result?.bracketPayouts));

    const [bracket2NumbersStr, setBracket2NumbersStr] = useState(formatWinningNumbersForInput(race.result?.bracket2WinningNumbers) || '');
    const [bracket2Payouts, setBracket2Payouts] = useState(initializePayouts(race.result?.bracket2Payouts));

    // --- Win Summaries ---
    const [primaryWinSummary, setPrimaryWinSummary] = useState<WinSummary | null>(null);
    const [bracket1WinSummary, setBracket1WinSummary] = useState<WinSummary | null>(null);
    const [bracket2WinSummary, setBracket2WinSummary] = useState<WinSummary | null>(null);

    // Calc Primary Summary
    useEffect(() => {
        const parsed = parseWinningNumbersFromString(primaryNumbersStr);
        if (parsed.length > 0) setPrimaryWinSummary(calculateWinSummary(race, parsed, tickets));
        else setPrimaryWinSummary(null);
    }, [primaryNumbersStr, race, tickets]);

     // Calc Bracket 1 Summary
    useEffect(() => {
        if (bracketCount >= 1) {
            const parsed = parseWinningNumbersFromString(bracket1NumbersStr);
            if (parsed.length > 0) setBracket1WinSummary(calculateWinSummary(race, parsed, tickets));
            else setBracket1WinSummary(null);
        }
    }, [bracket1NumbersStr, race, tickets, bracketCount]);

    // Calc Bracket 2 Summary
    useEffect(() => {
        if (bracketCount >= 2) {
            const parsed = parseWinningNumbersFromString(bracket2NumbersStr);
            if (parsed.length > 0) setBracket2WinSummary(calculateWinSummary(race, parsed, tickets));
            else setBracket2WinSummary(null);
        }
    }, [bracket2NumbersStr, race, tickets, bracketCount]);


    const handlePayoutChange = (field: keyof Payouts, value: number | '', tab: ResultTab) => {
        if (tab === 'Primary') setPrimaryPayouts(prev => ({ ...prev, [field]: value }));
        else if (tab === 'Bracket1') setBracket1Payouts(prev => ({ ...prev, [field]: value }));
        else if (tab === 'Bracket2') setBracket2Payouts(prev => ({ ...prev, [field]: value }));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalWinningNumbers = parseWinningNumbersFromString(primaryNumbersStr);
        
        if (finalWinningNumbers.length === 0) {
            alert('Please enter valid winning numbers for the Primary result.');
            return;
        }

        const cleanPayouts = (input: Record<keyof Payouts, number | ''>): Payouts => {
            const output: Payouts = {};
            for (const key in input) {
                const val = input[key as keyof Payouts];
                if (typeof val === 'number') {
                    output[key as keyof Payouts] = val;
                }
            }
            return output;
        };

        const result: RaceResult = {
            raceId: race.id,
            winningNumbers: finalWinningNumbers,
            payouts: cleanPayouts(primaryPayouts),
        };

        if (bracketCount >= 1) {
            const finalBracket1 = parseWinningNumbersFromString(bracket1NumbersStr);
            if (finalBracket1.length === 0) {
                 alert('Bracket 1 is enabled but has no numbers.');
                 return;
            }
            result.bracketWinningNumbers = finalBracket1;
            result.bracketPayouts = cleanPayouts(bracket1Payouts);
        }

        if (bracketCount >= 2) {
            const finalBracket2 = parseWinningNumbersFromString(bracket2NumbersStr);
            if (finalBracket2.length === 0) {
                 alert('Bracket 2 is enabled but has no numbers.');
                 return;
            }
            result.bracket2WinningNumbers = finalBracket2;
            result.bracket2Payouts = cleanPayouts(bracket2Payouts);
        }

        onSave(result);
    };

    const getCurrentData = () => {
        switch(activeTab) {
            case 'Primary': return { numStr: primaryNumbersStr, setNumStr: setPrimaryNumbersStr, payouts: primaryPayouts, summary: primaryWinSummary };
            case 'Bracket1': return { numStr: bracket1NumbersStr, setNumStr: setBracket1NumbersStr, payouts: bracket1Payouts, summary: bracket1WinSummary };
            case 'Bracket2': return { numStr: bracket2NumbersStr, setNumStr: setBracket2NumbersStr, payouts: bracket2Payouts, summary: bracket2WinSummary };
        }
    }

    const { numStr, setNumStr, payouts, summary } = getCurrentData();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh]">
                <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between sm:items-center border-b pb-2 gap-2">
                    <h2 className="text-2xl font-bold text-betese-dark">Enter Results: {race.name}</h2>
                    
                    {/* Bracket Toggle Control */}
                    <div className="flex items-center gap-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                        <span className="text-sm font-bold text-gray-700">Brackets (Ties):</span>
                        <div className="flex gap-1">
                            <button type="button" onClick={() => { setBracketCount(0); setActiveTab('Primary'); }} className={`px-3 py-1 rounded text-xs font-bold ${bracketCount === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>None</button>
                            <button type="button" onClick={() => setBracketCount(1)} className={`px-3 py-1 rounded text-xs font-bold ${bracketCount === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1 Tie</button>
                            <button type="button" onClick={() => setBracketCount(2)} className={`px-3 py-1 rounded text-xs font-bold ${bracketCount === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>2 Ties</button>
                        </div>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-1 border-b border-gray-200 mb-4 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('Primary')}
                        className={`px-6 py-2 font-bold text-sm rounded-t-lg border-t border-l border-r ${activeTab === 'Primary' ? 'bg-white text-betese-green border-gray-300 -mb-px shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        1. Primary Result
                    </button>
                    {bracketCount >= 1 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('Bracket1')}
                            className={`px-6 py-2 font-bold text-sm rounded-t-lg border-t border-l border-r ${activeTab === 'Bracket1' ? 'bg-white text-blue-600 border-gray-300 -mb-px shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            2. Bracket 1
                        </button>
                    )}
                    {bracketCount >= 2 && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('Bracket2')}
                            className={`px-6 py-2 font-bold text-sm rounded-t-lg border-t border-l border-r ${activeTab === 'Bracket2' ? 'bg-white text-purple-600 border-gray-300 -mb-px shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            3. Bracket 2
                        </button>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-6">
                    <div className={`p-4 rounded-lg border ${activeTab === 'Primary' ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="mb-6">
                            <label className="block text-lg font-bold text-gray-800 mb-2">
                                {activeTab === 'Primary' ? 'Main Result Numbers' : `Tie / ${activeTab} Result Numbers`}
                            </label>
                            <input 
                                type="text"
                                value={numStr}
                                onChange={(e) => setNumStr(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-md shadow-sm text-2xl font-bold tracking-wider focus:ring-2 focus:ring-betese-green"
                                placeholder="e.g., 12, 6, 8, 11, 10"
                                autoFocus
                            />
                            <p className="text-xs text-gray-500 mt-1">Enter the official winning numbers for this specific report page.</p>
                        </div>

                        <WinDividendReport summary={summary} payouts={payouts} />

                        <div className="mt-6">
                            <h3 className="text-xl font-semibold text-betese-dark mb-4 border-b pb-1">Enter Payout Dividends (GMD) - {activeTab}</h3>
                             {Object.entries(groupedFields).map(([group, fields]) => (
                                <div key={group} className="mb-6">
                                    <h4 className="text-md font-bold text-gray-600 mb-2 uppercase tracking-wide">{group}</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {fields.map(field => (
                                            <PayoutInput 
                                                key={field.key}
                                                label={field.label}
                                                value={payouts[field.key] ?? ''}
                                                onChange={(val) => handlePayoutChange(field.key, val, activeTab)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-4 border-t pt-4 flex-shrink-0 bg-white">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400">Cancel</button>
                    <button type="submit" className="px-8 py-2 bg-betese-green text-white font-bold rounded-lg hover:bg-green-700 shadow-md">Save All Results</button>
                </div>
            </form>
        </div>
    );
};
