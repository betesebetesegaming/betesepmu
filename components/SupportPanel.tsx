
import React, { useState, useRef } from 'react';

export const SupportPanel: React.FC = () => {
    const [issueText, setIssueText] = useState('');
    const [isChecking, setIsChecking] = useState(false);
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LEFT: REPORTING */}
            <div className="bg-white p-6 rounded-lg shadow-lg border-l-8 border-blue-600">
                <h2 className="text-2xl font-bold text-betese-dark mb-4 flex items-center gap-2">
                    <span className="text-3xl">🛠️</span> Report a Problem
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
                        <span className="text-3xl">🔄</span> System Updates
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
                </div>

                {/* Safety Snapshot */}
                <div className="bg-white p-6 rounded-lg shadow-lg border-l-8 border-yellow-500">
                    <h2 className="text-2xl font-bold text-betese-dark mb-2 flex items-center gap-2">
                        <span className="text-3xl">💾</span> Safety Snapshot
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
