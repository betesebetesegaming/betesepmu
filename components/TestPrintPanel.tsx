
import React, { useState } from 'react';
import { TicketModal } from './TicketModal';
import { RapportModal } from './RapportModal';
import { BookingCodeModal } from './BookingCodeModal';
import { Ticket, Race, BetTypeOption, Payouts } from '../types';
import { getPrintPaperMode, getPrintPaperWidthMm, setPrintPaperMode, setPrintPaperWidthMm } from '../utils';

// Mock data for generating printable samples
const MOCK_VENDOR = { id: 'VEND-TEST', name: 'Test Vendor' };

const mockActiveTicket: Ticket = {
    id: '98765432',
    timestamp: new Date(),
    vendorId: MOCK_VENDOR.id,
    vendorName: MOCK_VENDOR.name,
    status: 'Active',
    selections: [
        { raceId: 'main', raceName: 'Main Race', betType: BetTypeOption.Quinte, numbers: [1, 5, 8, 12, 16], xCount: 0, cost: 25, multiplier: 2 },
        { raceId: 'r1', raceName: 'Race 1', betType: BetTypeOption.CoupleGagnant, numbers: [3, 7], xCount: 0, cost: 25, multiplier: 2 },
    ],
    totalCost: 100,
};

const mockPaidTicket: Ticket = {
    ...mockActiveTicket,
    id: '11223344',
    status: 'Paid',
    winnings: 1250,
    winningsBreakdown: [
        { selectionIndex: 0, status: 'Win', winType: 'Quinté+ Bonus 3', winningCombinations: 1, winningCombinationList: [[1,5,8]], payoutPerCombination: 625, totalPayout: 1250 }
    ],
    paidAt: new Date(),
    paidById: MOCK_VENDOR.id,
    paidByName: MOCK_VENDOR.name,
};

const mockBookingTicket: Ticket = {
    ...mockActiveTicket,
    id: 'BOK-TEST123',
    status: 'Booked',
    bookingCode: 'BTEST4U',
    vendorId: '', // No vendor for booking
    vendorName: 'customer', // Customer name
};

const mockRaceWithResult: Race = {
    id: 'test-race',
    name: 'Test Race Report',
    startDate: new Date(new Date().setDate(new Date().getDate() - 1)),
    endDate: new Date(new Date().setHours(new Date().getHours() - 2)),
    horseCount: 16,
    nonRunners: [2, 9],
    result: {
        raceId: 'test-race',
        winningNumbers: [7, 4, 1, 13, 10],
        payouts: {
            ordreGagnant: 500,
            desordreGagnant: 250,
            coupleA: 150,
            coupleB: 120,
            coupleC: 180,
            tierceOrdre: 2500,
            tierceDesordre: 450,
            quarteOrdre: 10000,
            quarteDesordre: 1200,
            quarteBonus3: 150,
            quinteOrdre: 50000,
            quinteDesordre: 4000,
            quinteBonus4: 400,
            quinteBonus3: 80,
            simpleGagnant: 125,
            simplePlaceA: 50,
            simplePlaceB: 65,
            simplePlaceC: 45,
        } as Payouts,
    },
};

export const TestPrintPanel: React.FC = () => {
    const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
    const [paperMode, setPaperMode] = useState<'auto' | 'fixed'>(getPrintPaperMode());
    const [paperWidth, setPaperWidth] = useState<number>(getPrintPaperWidthMm());
    const [saveMessage, setSaveMessage] = useState<string>('');

    const PRESETS = [
        { label: '57 mm (C8 — Thermer)', value: 57 },
        { label: '58 mm (Standard BT)', value: 58 },
        { label: '72 mm', value: 72 },
        { label: '80 mm', value: 80 },
    ];

    const showTicket = (ticket: Ticket) => setModalContent(<TicketModal ticket={ticket} onClose={() => setModalContent(null)} showPrintButton={true} races={[mockRaceWithResult]} />);
    const showBooking = (ticket: Ticket) => setModalContent(<BookingCodeModal ticket={ticket} onClose={() => setModalContent(null)} />);
    const showRapport = (race: Race) => setModalContent(<RapportModal race={race} onClose={() => setModalContent(null)} showPrintButton={true} />);

    const handleSavePrintSettings = () => {
        const normalizedWidth = Math.min(112, Math.max(48, Math.round(Number(paperWidth) || 57)));
        setPrintPaperMode(paperMode);
        setPrintPaperWidthMm(normalizedWidth);
        setPaperWidth(normalizedWidth);
        setSaveMessage(`✅ Saved: ${paperMode === 'auto' ? 'Auto width' : `Fixed width ${normalizedWidth}mm`}`);
    };

    return (
        <>
            {modalContent}
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-betese-dark mb-4">Printing Tests</h2>
                <div className="mb-5 p-4 rounded-lg border border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide mb-3">Permanent Paper Size</h3>
                    <div className="flex gap-2 flex-wrap mb-3">
                        {PRESETS.map(p => (
                            <button
                                key={p.value}
                                onClick={() => { setPaperWidth(p.value); setPaperMode('fixed'); }}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold border ${
                                    paperWidth === p.value && paperMode === 'fixed'
                                        ? 'bg-betese-green text-white border-betese-green'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-betese-green'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                        <label className="flex flex-col gap-1 text-sm text-gray-700">
                            <span className="font-semibold">Mode</span>
                            <select
                                value={paperMode}
                                onChange={(e) => setPaperMode(e.target.value as 'auto' | 'fixed')}
                                className="px-3 py-2 rounded-md border border-gray-300 bg-white"
                            >
                                <option value="auto">Auto (fit content width)</option>
                                <option value="fixed">Fixed width</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-gray-700">
                            <span className="font-semibold">Paper Width (mm)</span>
                            <input
                                type="number"
                                min={48}
                                max={112}
                                step={1}
                                value={paperWidth}
                                onChange={(e) => setPaperWidth(Number(e.target.value))}
                                disabled={paperMode !== 'fixed'}
                                className="px-3 py-2 rounded-md border border-gray-300 bg-white disabled:bg-gray-100"
                            />
                        </label>
                        <button
                            onClick={handleSavePrintSettings}
                            className="px-4 py-2 bg-betese-green text-white font-bold rounded-md hover:brightness-110"
                        >
                            Save Printer Size
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">Auto mode calculates the exact content width per ticket and keeps paper length flexible for long printouts.</p>
                    {saveMessage && <p className="mt-2 text-xs font-bold text-green-700">{saveMessage}</p>}
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    Click a button to open a sample document. Use the "Print" button inside the popup to test your printer and print layouts.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button onClick={() => showTicket(mockActiveTicket)} className="p-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                        Print Sample Active Ticket
                    </button>
                    <button onClick={() => showTicket({ ...mockPaidTicket, status: 'Winning' })} className="p-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
                        Print Sample Winning Receipt
                    </button>
                     <button onClick={() => showTicket(mockPaidTicket)} className="p-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors">
                        Print Sample Paid Receipt
                    </button>
                    <button onClick={() => showBooking(mockBookingTicket)} className="p-4 bg-yellow-500 text-betese-dark font-semibold rounded-lg hover:bg-yellow-600 transition-colors">
                        Print Sample Booking Code
                    </button>
                    <button onClick={() => showRapport(mockRaceWithResult)} className="p-4 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">
                        Print Sample Race Rapport
                    </button>
                </div>
            </div>
        </>
    );
};
