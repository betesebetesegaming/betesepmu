import React from 'react';
import { BetSlip } from '../types';

interface PlaceBetConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaceBet: () => void;
  onBookBet: () => void;
  betSlip: BetSlip;
  availableBalance?: number;
  isPlacingBet?: boolean;
}

export const PlaceBetConfirmModal: React.FC<PlaceBetConfirmModalProps> = ({
  isOpen,
  onClose,
  onPlaceBet,
  onBookBet,
  betSlip,
  availableBalance,
  isPlacingBet = false,
}) => {
  if (!isOpen) return null;

  const canAfford = availableBalance == null || availableBalance >= betSlip.totalCost;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-betese-dark px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Confirm Your Bet</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white bg-opacity-20 text-white flex items-center justify-center hover:bg-opacity-30 font-black text-lg leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-green-300 text-xs font-bold mt-1 uppercase tracking-widest">
            {betSlip.selections.length} selection{betSlip.selections.length !== 1 ? 's' : ''} · Review before confirming
          </p>
        </div>

        {/* Selections summary */}
        <div className="px-6 py-4 max-h-64 overflow-y-auto space-y-3">
          {betSlip.selections.map((sel, i) => (
            <div key={i} className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black uppercase text-betese-green tracking-wide truncate">{sel.betType}</p>
                <p className="text-[11px] font-semibold text-gray-500 truncate">{sel.raceName}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {sel.pattern && sel.pattern.length > 0 ? (
                    sel.pattern.map((p, j) => (
                      <span
                        key={j}
                        className={`px-1.5 py-0.5 rounded text-xs font-black border ${
                          p === 'X' ? 'bg-yellow-400 text-black border-yellow-500' : 'bg-betese-dark text-white border-betese-green'
                        }`}
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <>
                      {Array.from({ length: sel.xCount || 0 }).map((_, j) => (
                        <span key={`x${j}`} className="px-1.5 py-0.5 rounded text-xs font-black border bg-yellow-400 text-black border-yellow-500">X</span>
                      ))}
                      {sel.numbers.map((n, j) => (
                        <span key={`n${j}`} className="px-1.5 py-0.5 rounded text-xs font-black border bg-betese-dark text-white border-betese-green">{n}</span>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-black text-base text-betese-dark">GMD {(sel.cost * sel.multiplier).toFixed(0)}</p>
                {sel.multiplier > 1 && (
                  <p className="text-[10px] text-gray-400 font-bold">x{sel.multiplier}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cost row */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Total Cost</span>
          <span className="text-2xl font-black text-betese-dark">GMD {betSlip.totalCost.toFixed(0)}</span>
        </div>

        {/* Balance warning */}
        {!canAfford && (
          <div className="mx-6 mb-2 mt-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-xs font-bold text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>
              Insufficient balance (GMD {(availableBalance ?? 0).toFixed(0)} available). You can still <strong>Book this bet</strong> and pay at the shop.
            </span>
          </div>
        )}

        {/* Book bet explanation */}
        <div className="mx-6 mb-3 mt-2 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-2 text-xs font-bold text-yellow-800 flex items-start gap-2">
          <span className="mt-0.5">📋</span>
          <span>
            <strong>Book Bet (Pay at Shop)</strong> — saves your selection with a booking code. Visit any shop to pay and activate the ticket.
          </span>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 space-y-3">
          {/* Place Bet Now */}
          <button
            onClick={() => { onClose(); onPlaceBet(); }}
            disabled={isPlacingBet || !canAfford}
            className="w-full py-4 bg-betese-green text-white font-black rounded-2xl shadow-xl hover:brightness-110 disabled:bg-gray-300 disabled:opacity-50 transition-all active:scale-95 text-base uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {isPlacingBet ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Placing...
              </>
            ) : (
              <>✓ Place Bet Now · GMD {betSlip.totalCost.toFixed(0)}</>
            )}
          </button>

          {/* Book Bet */}
          <button
            onClick={() => { onClose(); onBookBet(); }}
            disabled={isPlacingBet}
            className="w-full py-4 bg-yellow-400 text-betese-dark font-black rounded-2xl shadow hover:brightness-110 disabled:opacity-50 transition-all active:scale-95 text-base uppercase tracking-widest flex items-center justify-center gap-2"
          >
            📋 Book Bet (Pay at Shop)
          </button>

          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={isPlacingBet}
            className="w-full py-3 bg-gray-100 text-gray-600 font-black rounded-xl hover:bg-gray-200 transition-all active:scale-95 text-sm uppercase tracking-widest"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
