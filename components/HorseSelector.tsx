
import React, { useState, useEffect, useCallback } from 'react';
import { Race, BetTypeOption } from '../types';
import { BET_PRICING } from '../constants';

interface HorseSelectorProps {
  race: Race;
  betType: BetTypeOption;
  selectedNumbers: number[];
  xCount: number;
  // The parent expects these callbacks to update its state, which is then used to create the bet
  onNumberSelect: (numbers: number[]) => void;
  onXSelect: (count: number) => void;
  // New callback for the pattern
  onPatternChange?: (pattern: string[]) => void;
  disabled?: boolean;
}

export const HorseSelector: React.FC<HorseSelectorProps> = ({
  race,
  betType,
  onNumberSelect,
  onXSelect,
  onPatternChange,
  disabled = false
}) => {
  const pricing = BET_PRICING[betType];
  const [selectionSequence, setSelectionSequence] = useState<(number | 'X')[]>([]);

  // Define strict maximum slots for ordered bets (Base Pattern Size)
  const getStrictLimit = (type: BetTypeOption): number => {
      switch (type) {
          case BetTypeOption.SimpleGagnant:
          case BetTypeOption.SimplePlace: return 1;
          case BetTypeOption.CoupleGagnant:
          case BetTypeOption.CouplePlace: return 2;
          case BetTypeOption.Tierce: return 3;
          case BetTypeOption.Quarte: return 4;
          case BetTypeOption.Quinte: return 5;
          // Multi bets allow selecting more horses than the name implies, so we default to loose limit
          case BetTypeOption.Multi4:
          case BetTypeOption.Multi5:
          case BetTypeOption.Multi6:
          case BetTypeOption.Multi7:
              return 20; 
          default: return 20;
      }
  };

  const strictLimit = getStrictLimit(betType);
  const hasX = selectionSequence.includes('X');

  // LOGIC UPDATE: 
  // If 'X' is present, we enforce the strict limit (e.g. 3 for Tierce) because it's a Champ de Base pattern.
  // If 'X' is NOT present, we allow up to 20 (Combinatoire mode).
  const currentMaxSlots = hasX ? strictLimit : 20;
  
  const isFull = selectionSequence.length >= currentMaxSlots;

  // Whenever the internal sequence changes, update the parent's state
  useEffect(() => {
    const numbers = selectionSequence.filter((item): item is number => typeof item === 'number');
    const xCount = selectionSequence.filter(item => item === 'X').length;
    const pattern = selectionSequence.map(String);

    onNumberSelect(numbers);
    onXSelect(xCount);
    if (onPatternChange) {
        onPatternChange(pattern);
    }
  }, [selectionSequence, onNumberSelect, onXSelect, onPatternChange]);

  // Reset sequence when bet type or race changes
  useEffect(() => {
      setSelectionSequence([]);
  }, [betType, race.id]);

  const handleNumberClick = (num: number) => {
    if (disabled) return;
    if (race.nonRunners.includes(num)) return;

    // If already selected, remove it
    if (selectionSequence.includes(num)) {
        setSelectionSequence(prev => prev.filter(item => item !== num));
        return;
    }

    // Strict Length Check based on current mode (Combinatoire vs Champ)
    if (selectionSequence.length >= currentMaxSlots) {
        return; // Block input if full
    }

    setSelectionSequence(prev => [...prev, num]);
  };

  const handleXClick = () => {
      if (disabled) return;
      // SPECIAL CHECK: You cannot add an X if it would violate the strict limit of the bet type.
      // E.g. If I have 3 numbers for Tierce (Combinatoire), I cannot add X to make it 4.
      // Adding X implies converting to Champ de Base, which MUST fit in strictLimit.
      if (selectionSequence.length >= strictLimit) {
          alert(`You cannot add 'X' here. For ${betType}, a Champ de Base pattern is limited to ${strictLimit} positions.`);
          return;
      }

      const currentXCount = selectionSequence.filter(x => x === 'X').length;
      const canSelectX = !!pricing.xPriceMap;
      const maxXs = canSelectX ? Math.max(0, ...Object.keys(pricing.xPriceMap).map(Number)) : 0;

      if (!canSelectX) {
          alert(`You cannot add an 'X' (Champ de Base) to a ${betType} bet.`);
          return;
      }

      if (currentXCount >= maxXs) {
          alert(`Maximum number of 'X's for ${betType} is ${maxXs}.`);
          return;
      }

      setSelectionSequence(prev => [...prev, 'X']);
  };

  const handleBackspace = () => {
      if (disabled) return;
      setSelectionSequence(prev => prev.slice(0, -1));
  };
  
  const handleClear = () => {
      if (disabled) return;
      setSelectionSequence([]);
  };

  const maxHorsesForLayout = 20; 
  const horseNumbers = Array.from({ length: maxHorsesForLayout }, (_, i) => i + 1);
  
  return (
    <div className="p-2 border border-gray-200 rounded-lg bg-gray-50 shadow-sm relative overflow-hidden">
      
      {disabled && (
        <div className="absolute inset-0 z-50 bg-gray-200 flex flex-col items-center justify-center rounded-lg cursor-not-allowed border-4 border-red-500">
            <div className="text-6xl mb-2">🔒</div>
            <div className="text-red-600 font-black text-2xl uppercase tracking-widest">BETTING CLOSED</div>
            <p className="text-gray-600 font-bold text-sm mt-1">This race is now closed.</p>
        </div>
      )}

      <div className="flex justify-between items-start mb-2 px-1">
          <div>
            <h3 className="text-sm font-bold text-betese-dark uppercase tracking-wide">3. Select Horses</h3>
            <p className="text-[10px] text-gray-600 leading-tight">
                Select in order. Use 'X' for Field/Champ.
            </p>
          </div>
          <div className="text-right text-[10px] font-mono">
              <p className="text-gray-500">Req: {pricing.minHorses}</p>
              <p className={`font-bold ${isFull ? 'text-red-600' : 'text-blue-600'}`}>
                  Sel: {selectionSequence.length}/{hasX ? strictLimit : 'Max'}
              </p>
          </div>
      </div>

      {/* Display Area - Compact */}
      <div className={`mb-2 p-1.5 bg-white border-2 rounded-md min-h-[2.5rem] flex items-center justify-between shadow-inner transition-colors ${isFull ? 'border-red-200 bg-red-50' : 'border-blue-200'}`}>
          <div className="flex flex-wrap gap-1">
              {selectionSequence.length === 0 ? (
                  <span className="text-xs text-gray-400 italic pl-1">No selection...</span>
              ) : (
                  selectionSequence.map((item, idx) => (
                      <span key={idx} className={`w-7 h-7 flex items-center justify-center rounded font-bold text-sm shadow-sm ${item === 'X' ? 'bg-yellow-400 text-black border border-yellow-500' : 'bg-betese-dark text-white'}`}>
                          {item}
                      </span>
                  ))
              )}
          </div>
          <div className="flex gap-1 ml-1">
               <button onClick={handleBackspace} disabled={disabled || selectionSequence.length === 0} className="w-8 h-7 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-gray-700 disabled:opacity-50 text-xs" title="Undo Last">
                  ⌫
               </button>
               <button onClick={handleClear} disabled={disabled || selectionSequence.length === 0} className="w-8 h-7 flex items-center justify-center bg-red-100 rounded hover:bg-red-200 text-red-600 disabled:opacity-50 text-xs" title="Clear All">
                  🗑️
               </button>
          </div>
      </div>

      {/* Controls Grid */}
      <div>
        {/* 7 Columns fits 20 numbers + 1 X perfectly in 3 rows */}
        <div className="grid grid-cols-7 gap-0.5">
            {/* Special X Button - Same size as numbers */}
            <button
                onClick={handleXClick}
                disabled={disabled || selectionSequence.length >= strictLimit}
                className={`h-9 rounded-md font-black text-lg transition-all shadow-sm ring-1 flex items-center justify-center
                    ${disabled || selectionSequence.length >= strictLimit
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed ring-gray-200' 
                        : 'bg-yellow-500 text-white hover:bg-yellow-600 ring-yellow-300'
                    }
                `}
                title="Select Field / Champ de Base"
            >
                X
            </button>

            {/* Horse Numbers */}
            {horseNumbers.map((num) => {
                const isSelected = selectionSequence.includes(num);
                const isNonRunner = race.nonRunners.includes(num);
                const isOutOfRange = num > race.horseCount;
                const isDisabled = disabled || isNonRunner || isOutOfRange || (isFull && !isSelected);

                return (
                    <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    disabled={isDisabled}
                    className={`h-9 text-center rounded-md font-bold text-sm transition-all flex items-center justify-center shadow-sm
                        ${isNonRunner ? 'bg-red-50 text-red-300 cursor-not-allowed line-through border border-red-100' : ''}
                        ${isOutOfRange ? 'bg-gray-50 text-gray-200 cursor-not-allowed' : ''}
                        ${!isNonRunner && !isOutOfRange && isSelected ? 'bg-betese-green text-white shadow-inner ring-2 ring-green-700' : ''}
                        ${!isNonRunner && !isOutOfRange && !isSelected && isFull ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                        ${!isNonRunner && !isOutOfRange && !isSelected && !isFull ? 'bg-white text-gray-800 hover:bg-green-50 border border-gray-300' : ''}
                    `}
                    >
                    {num}
                    </button>
                );
            })}
        </div>
      </div>
    </div>
  );
};
