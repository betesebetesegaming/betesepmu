import React, { useState } from 'react';

interface TestingPanelProps {
  currentTime: Date;
  onTimeJump: (minutes: number) => void;
  onResetData: () => void;
}

const ConfirmationModal: React.FC<{ onConfirm: () => void; onCancel: () => void; }> = ({ onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm text-center">
            <h3 className="text-xl font-bold text-red-700">Confirm Reset</h3>
            <p className="my-4 text-gray-700">Are you sure you want to reset all application data? This will clear all tickets, users (except defaults), races, and other information, and reload the app.</p>
            <div className="flex justify-center gap-4">
                <button onClick={onCancel} className="px-6 py-2 bg-gray-300 rounded-md font-semibold">Cancel</button>
                <button onClick={onConfirm} className="px-6 py-2 bg-red-600 text-white rounded-md font-semibold">Yes, Reset Data</button>
            </div>
        </div>
    </div>
);

export const TestingPanel: React.FC<TestingPanelProps> = ({ currentTime, onTimeJump, onResetData }) => {
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    const timeButtons = [
        { label: '+5 Min', minutes: 5 },
        { label: '+30 Min', minutes: 30 },
        { label: '+1 Hour', minutes: 60 },
        { label: '+6 Hours', minutes: 360 },
        { label: '+1 Day', minutes: 1440 },
    ];

    return (
        <>
            {isConfirmingReset && <ConfirmationModal onConfirm={onResetData} onCancel={() => setIsConfirmingReset(false)} />}
            <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-2xl z-50 max-w-xs w-full transition-all duration-300">
                <div className={`flex justify-between items-center ${isMinimized ? '' : 'border-b border-gray-600 pb-2 mb-3'}`}>
                    <h3 className="font-bold text-lg">Testing Controls</h3>
                    <button 
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="text-2xl font-mono text-gray-400 hover:text-white px-2"
                        title={isMinimized ? 'Expand Panel' : 'Minimize Panel'}
                    >
                        {isMinimized ? '[+]' : '[-]'}
                    </button>
                </div>

                {!isMinimized && (
                    <div className="animate-fade-in">
                        <div className="mb-4">
                            <p className="text-sm text-gray-400">Current App Time:</p>
                            <p className="font-mono text-yellow-300">{currentTime.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 mb-2">Jump Time Forward:</p>
                            <div className="grid grid-cols-3 gap-2">
                                {timeButtons.map(btn => (
                                    <button
                                        key={btn.minutes}
                                        onClick={() => onTimeJump(btn.minutes)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-1 rounded transition-colors"
                                    >
                                        {btn.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="mt-4 border-t border-gray-600 pt-3">
                            <button
                                onClick={() => setIsConfirmingReset(true)}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Reset All App Data
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
            `}</style>
        </>
    );
};