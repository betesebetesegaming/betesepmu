
import React, { useRef, useState } from 'react';

export const DataManagementPanel: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const getAllData = () => {
        const data: Record<string, any> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('betese-')) {
                try {
                    data[key] = JSON.parse(localStorage.getItem(key) || 'null');
                } catch (e) {
                    data[key] = localStorage.getItem(key);
                }
            }
        }
        return data;
    };

    const handleExport = () => {
        const data = getAllData();
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `betese_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setMessage({ text: 'Backup downloaded successfully.', type: 'success' });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                
                // Validation: Check if it looks like our data
                if (typeof data !== 'object') throw new Error("Invalid file format");

                // Clear existing betese data to prevent conflicts
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('betese-')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));

                // Restore data
                Object.entries(data).forEach(([key, value]) => {
                    if (typeof value === 'object') {
                        localStorage.setItem(key, JSON.stringify(value));
                    } else {
                        localStorage.setItem(key, String(value));
                    }
                });

                alert("Data restored successfully. The application will now reload.");
                window.location.reload();

            } catch (error) {
                console.error(error);
                setMessage({ text: 'Failed to restore data. Invalid JSON file.', type: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const handleClearAll = () => {
        if (confirm("WARNING: This will delete ALL tickets, users, and race results from this device. This cannot be undone. Are you sure?")) {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('betese-')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            window.location.reload();
        }
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">System Data Management</h2>
            <p className="text-gray-600 mb-6 text-sm">
                Use this panel to backup your system before applying updates or fixes. 
                This ensures you can send your database state to technical support or restore it if something goes wrong.
            </p>

            {message && (
                <div className={`p-3 mb-4 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Export Section */}
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                    <h3 className="font-bold text-blue-800 mb-2">1. Backup Data</h3>
                    <p className="text-xs text-blue-700 mb-4">Download a copy of all tickets, users, and results to your computer.</p>
                    <button 
                        onClick={handleExport}
                        className="w-full px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Download Backup
                    </button>
                </div>

                {/* Import Section */}
                <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                    <h3 className="font-bold text-green-800 mb-2">2. Restore Data</h3>
                    <p className="text-xs text-green-700 mb-4">Upload a previously saved backup file to restore the system state.</p>
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                    />
                    <button 
                        onClick={handleImportClick}
                        className="w-full px-4 py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" transform="rotate(180 10 10)" /></svg>
                        Upload & Restore
                    </button>
                </div>

                {/* Reset Section */}
                <div className="border rounded-lg p-4 bg-red-50 border-red-200">
                    <h3 className="font-bold text-red-800 mb-2">3. Factory Reset</h3>
                    <p className="text-xs text-red-700 mb-4">Wipe all data from this device. Use with extreme caution.</p>
                    <button 
                        onClick={handleClearAll}
                        className="w-full px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700"
                    >
                        Clear All Data
                    </button>
                </div>
            </div>
        </div>
    );
};
