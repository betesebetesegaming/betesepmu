
import React from 'react';

interface EmergencyRecoverProps {
    onRecover: () => void;
}

export const EmergencyRecover: React.FC<EmergencyRecoverProps> = ({ onRecover }) => {
    return (
        <button 
            onClick={(e) => {
                e.stopPropagation();
                if(confirm("Force System Recovery? This will close all windows and refresh connection.")) {
                    onRecover();
                }
            }}
            className="fixed top-2 left-2 z-[9999] w-10 h-10 bg-red-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-red-700 active:scale-90 transition-all border-2 border-white animate-pulse"
            title="Emergency System Fix"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
        </button>
    );
};
