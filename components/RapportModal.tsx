
import React from 'react';
import { Race } from '../types';
import { RapportPrintout } from './RapportPrintout';
import { triggerPrint } from '../utils';

interface RapportModalProps {
  race: Race;
  onClose: () => void;
  showPrintButton: boolean;
}

export const RapportModal: React.FC<RapportModalProps> = ({ race, onClose, showPrintButton }) => {
  const handlePrint = () => {
    // The RapportPrintout component has an ID of `rapport-${race.id}`
    // We target this ID for printing.
    triggerPrint(`rapport-${race.id}`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-100 p-2 sm:p-4 rounded-lg shadow-2xl w-full max-w-[380px]">
        <div className="max-h-[80vh] overflow-y-auto">
          {/* We pass a wrapper ID to the component for html2canvas to find */}
          <div id={`rapport-container-${race.id}`} className="printable-content">
            <RapportPrintout race={race} />
          </div>
        </div>
        <div className="mt-4 flex justify-between print:hidden">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400"
          >
            Close
          </button>
          {showPrintButton && (
            <button
              onClick={handlePrint}
              className="px-6 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700"
            >
              Print
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
