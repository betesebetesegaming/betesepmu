
import React from 'react';
import { BetSlip } from '../types';
import { useLanguage } from '../LanguageContext';

interface BetSlipPanelProps {
  betSlip: BetSlip;
  onClear: () => void;
  onInitiatePlaceBet: () => void;
  onRemove: (index: number) => void;
  onUpdateSelectionMultiplier: (index: number, multiplier: number) => void;
  onInitiateBookBet?: () => void;
}

export const BetSlipPanel: React.FC<BetSlipPanelProps> = ({ betSlip, onClear, onInitiatePlaceBet, onRemove, onUpdateSelectionMultiplier, onInitiateBookBet }) => {
  const hasSelections = betSlip.selections.length === 0;
  const { t } = useLanguage();
  
  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-betese-green sticky top-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-black text-betese-dark uppercase tracking-tight">{t('bet_slip')}</h3>
        <button
          onClick={onClear}
          className="text-xs font-black text-red-600 hover:text-red-800 uppercase"
        >
          {t('clear_all')}
        </button>
      </div>

      <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-2">
        {betSlip.selections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-2 opacity-20">🎫</p>
            <p className="text-gray-400 font-bold uppercase text-xs">{t('your_bet_slip_empty')}</p>
          </div>
        ) : (
          betSlip.selections.map((selection, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-xl border-2 border-gray-100 shadow-sm animate-fade-in">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-black text-betese-green text-sm uppercase leading-none mb-1">{selection.betType}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">{selection.raceName}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                     <span className="text-[9px] font-black text-gray-400 uppercase w-full">Selected Combination:</span>
                     {selection.pattern && selection.pattern.length > 0 ? (
                        selection.pattern.map((p, i) => (
                            <span key={i} className={`px-2 py-1 rounded font-black text-sm border ${p === 'X' ? 'bg-yellow-400 text-black border-yellow-600' : 'bg-betese-dark text-white border-betese-green'}`}>
                                {p}
                            </span>
                        ))
                     ) : (
                        selection.numbers.map((num, i) => (
                            <span key={i} className="px-2 py-1 bg-betese-dark text-white rounded font-black text-sm border border-betese-green">
                                {num}
                            </span>
                        ))
                     )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-black text-lg text-gray-900 leading-none">GMD {selection.cost.toFixed(0)}</p>
                    <button onClick={() => onRemove(index)} className="text-[10px] font-black text-red-500 uppercase mt-2 hover:underline">Remove</button>
                </div>
              </div>
              
               <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center bg-white rounded-lg border p-1 shadow-sm">
                    <button
                        onClick={() => onUpdateSelectionMultiplier(index, selection.multiplier - 1)}
                        disabled={selection.multiplier <= 1}
                        className="w-8 h-8 font-black text-xl bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-30 transition-colors"
                    >
                        -
                    </button>
                    <span className="w-12 text-center font-black text-sm">x{selection.multiplier}</span>
                    <button
                        onClick={() => onUpdateSelectionMultiplier(index, selection.multiplier + 1)}
                        className="w-8 h-8 font-black text-xl bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                        +
                    </button>
                </div>
                <p className="font-black text-xl text-betese-dark">GMD {(selection.cost * selection.multiplier).toFixed(0)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 border-t-2 border-black/10 pt-4">
        <div className="flex justify-between items-end">
          <span className="text-xs font-black text-gray-500 uppercase">{t('total_cost')}</span>
          <span className="text-3xl font-black text-betese-dark tracking-tighter">GMD {betSlip.totalCost.toFixed(0)}</span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          onClick={onInitiatePlaceBet}
          disabled={hasSelections}
          className="w-full py-5 bg-betese-green text-white font-black rounded-2xl shadow-xl hover:brightness-110 disabled:bg-gray-300 disabled:opacity-50 transition-all active:scale-95 text-xl uppercase tracking-widest"
        >
          {t('place_bet')}
        </button>
        {onInitiateBookBet && (
           <div className="pt-2">
               <button
                 onClick={onInitiateBookBet}
                 disabled={hasSelections}
                 className="w-full py-3 bg-yellow-400 text-betese-dark font-black rounded-xl shadow hover:brightness-110 disabled:opacity-50 text-sm uppercase"
               >
                 {t('book_bet')}
               </button>
           </div>
        )}
      </div>
    </div>
  );
};
