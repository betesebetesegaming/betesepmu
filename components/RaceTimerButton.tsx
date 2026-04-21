
import React, { useMemo } from 'react';
import { Race } from '../types';
import { BETTING_CUTOFF_MS } from '../utils';

interface RaceTimerButtonProps {
  race: Race;
  isSelected: boolean;
  onClick: (raceId: string) => void;
  initialEffectiveTime: Date; 
  variant?: 'vendor' | 'customer';
}

const RaceTimerButton: React.FC<RaceTimerButtonProps> = ({ race, isSelected, onClick, initialEffectiveTime, variant = 'vendor' }) => {
  const timeLeft = race.endDate.getTime() - initialEffectiveTime.getTime();
  const isEnded = timeLeft <= 0;
  
  // Betting closes 2 mins before race start
  const isBettingClosed = timeLeft <= BETTING_CUTOFF_MS;
  const isClosingSoon = !isBettingClosed && timeLeft < (BETTING_CUTOFF_MS + 60000);

  const totalSecondsRemaining = Math.max(0, Math.floor(timeLeft / 1000));
  const minutes = Math.floor(totalSecondsRemaining / 60);
  const seconds = totalSecondsRemaining % 60;

  const buttonClasses = useMemo(() => {
    if (isEnded) return 'bg-gray-300 text-gray-500 cursor-not-allowed';
    if (isBettingClosed) return 'bg-red-50 text-red-700 ring-1 ring-red-200';
    if (isSelected) return 'bg-betese-green text-white shadow-lg ring-2 ring-betese-yellow';
    if (isClosingSoon) return 'bg-yellow-400 text-yellow-900 shadow-lg ring-2 ring-yellow-600 animate-pulse';
    return 'bg-green-100 text-betese-dark hover:bg-green-200 shadow';
  }, [isEnded, isBettingClosed, isSelected, isClosingSoon]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEnded) {
      onClick(race.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isEnded}
      className={`p-3 rounded-xl font-black transition-all flex flex-col items-center justify-center gap-1 w-32 h-28 text-center ${buttonClasses}`}
    >
      <span className="flex justify-center">
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M4 14L8 9L13 8L16 10L20 10L19 13L16 13L14 16L10 16L8 19H5L6 16L4 14Z"/>
          <circle cx="14.5" cy="10.5" r="0.9" fill="currentColor"/>
        </svg>
      </span>
      <span className="text-sm uppercase tracking-tighter">{race.name}</span>
      
      {isEnded ? (
        <span className="text-xs font-bold text-gray-600">FINISHED</span>
      ) : (
        <div className="flex flex-col items-center">
            <span className="text-lg font-mono leading-none">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            {isBettingClosed ? (
                <span className="text-[10px] text-red-600 uppercase font-black bg-red-100 px-1 rounded mt-1">CLOSED</span>
            ) : (
                <span className="text-[10px] opacity-70 uppercase">Starts in</span>
            )}
        </div>
      )}
    </button>
  );
};

export default RaceTimerButton;
