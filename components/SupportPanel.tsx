
import React, { useState, useRef } from 'react';

interface SupportPanelProps {
    onRecalculateAllTickets?: () => Promise<void>;
}

export const SupportPanel: React.FC<SupportPanelProps> = ({ onRecalculateAllTickets }) => {
    const [issueText, setIssueText] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'up-to-date' | 'available'>('up-to-date');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- SAFETY SNAPSHOT LOGIC ---
    const handleQuickSnapshot = () => {
        const data: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('betese-')) {
                data[key] = JSON.parse(localStorage.getItem(key) || 'null');
            }
        }
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `SNAPSHOT_${new Date().toISOString().split('T')[0]}.betese`; // Custom extension for simplicity
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Snapshot Saved! Keep this file safe.");
    };

    const handleRestoreSnapshot = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (confirm("Are you sure? This will replace current data with the snapshot.")) {
                    Object.entries(data).forEach(([key, value]) => {
                        if (typeof value === 'object') localStorage.setItem(key, JSON.stringify(value));
                        else localStorage.setItem(key, String(value));
                    });
                    window.location.reload();
                }
            } catch (err) {
                alert("Invalid snapshot file.");
            }
        };
        reader.readAsText(file);
    };

    // --- REPORTING LOGIC ---
    const handleCreateReport = () => {
        if (!issueText.trim()) {
            alert("Please describe the issue first.");
            return;
        }
        
        // Bundle data with the message
        const dataDump: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('betese-')) {
                dataDump[key] = JSON.parse(localStorage.getItem(key) || 'null');
            }
        }

        const report = {
            timestamp: new Date(),
            issueDescription: issueText,
            systemData: dataDump
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `BUG_REPORT_${new Date().getTime()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setIssueText('');
        alert("Report generated! Please send the downloaded file to the developer.");
    };

    // --- UPDATE LOGIC (SIMULATED) ---
    const checkForUpdates = () => {
        setIsChecking(true);
        setTimeout(() => {
            setIsChecking(false);
            // In a real app, this would check an API.
            // Here we just simulate that the system is healthy.
            setUpdateStatus('up-to-date'); 
            alert("Your system is currently up to date (Version 1.0.0)");
        }, 2000);
    };

    const handleRecalculateAll = async () => {
        if (!onRecalculateAllTickets) return;
        if (!confirm('Recalculate all existing tickets now? This will correct historical outcomes with business-safe rules.')) return;
        setIsRecalculating(true);
        try {
            await onRecalculateAllTickets();
            alert('Recalculation completed successfully.');
        } catch (e: any) {
            alert(`Recalculation failed: ${e.message || e}`);
        } finally {
            setIsRecalculating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT: REPORTING */}
            <div className="bg-white p-6 rounded-lg shadow-lg border-l-8 border-blue-600">
                <h2 className="text-2xl font-bold text-betese-dark mb-4 flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M14 5L19 10L10 19L5 19L5 14L14 5Z"/><path d="M13 6L18 11"/></svg> Report a Problem
                </h2>
                <p className="text-gray-600 mb-4 text-sm">
                    Found a bug? Don't worry. Describe it below and click the button. 
                    We will generate a comprehensive file for you to send to the developer.
                </p>
                <textarea
                    className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-0 mb-4 h-40"
                    placeholder="e.g., The payout for Ticket #12345 seems wrong..."
                    value={issueText}
                    onChange={(e) => setIssueText(e.target.value)}
                ></textarea>
                <button 
                    onClick={handleCreateReport}
                    className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition-all shadow-md flex justify-center items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Download Support Package
                </button>
            </div>

            {/* RIGHT: UPDATES & SAFETY */}
            <div className="space-y-6">
                {/* Update Center */}
                <div className="bg-white p-6 rounded-lg shadow-lg border-l-8 border-green-500">
                    <h2 className="text-2xl font-bold text-betese-dark mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" /></svg> System Updates
                    </h2>
                    <div className="flex items-center justify-between mb-6 bg-gray-50 p-3 rounded">
                        <span className="font-semibold text-gray-700">Current Version:</span>
                        <span className="font-mono font-bold text-green-600">v1.0.0 (Live)</span>
                    </div>
                    <button 
                        onClick={checkForUpdates}
                        disabled={isChecking}
                        className={`w-full py-3 font-bold text-lg rounded-lg transition-all shadow-md flex justify-center items-center gap-2 ${isChecking ? 'bg-gray-300 text-gray-600' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    >
                        {isChecking ? 'Checking Server...' : 'Check for Updates'}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        If an update is available, this button will turn yellow. Clicking it will refresh the app safely.
                    </p>

                    {onRecalculateAllTickets && (
                        <button
                            onClick={handleRecalculateAll}
                            disabled={isRecalculating}
                            className={`w-full mt-4 py-3 font-bold text-lg rounded-lg transition-all shadow-md flex justify-center items-center gap-2 ${isRecalculating ? 'bg-gray-300 text-gray-600' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                        >
                            {isRecalculating ? 'Recalculating Tickets...' : 'Recalculate All Existing Tickets'}
                        </button>
                    )}
                </div>

                {/* Safety Snapshot */}
                <div className="bg-white p-6 rounded-lg shadow-lg border-l-8 border-yellow-500">
                    <h2 className="text-2xl font-bold text-betese-dark mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-yellow-500" viewBox="0 0 24 24" fill="currentColor"><path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z" /><path fillRule="evenodd" d="M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.163 3.75A.75.75 0 0110 12h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg> Safety Snapshot
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Before updating or if something feels wrong, click "Save Snapshot". 
                        If "it didn't work", click "Restore" to go back instantly.
                    </p>
                    <div className="flex gap-4">
                        <button 
                            onClick={handleQuickSnapshot}
                            className="flex-1 py-3 bg-yellow-500 text-betese-dark font-bold rounded-lg hover:bg-yellow-600 shadow-md"
                        >
                            Save Snapshot
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 shadow-md"
                        >
                            Restore
                        </button>
                        <input type="file" accept=".betese,.json" ref={fileInputRef} onChange={handleRestoreSnapshot} className="hidden" />
                    </div>
                </div>
            </div>
        </div>
    );
};
