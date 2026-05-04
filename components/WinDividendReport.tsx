import React from 'react';
import { WinSummary, WIN_CATEGORY_ORDER } from '../utils';
import { Payouts, BetTypeOption } from '../types';
import { TableScrollNavigator } from './TableScrollNavigator';

interface WinDividendReportProps {
  summary: WinSummary | null;
  payouts: Record<keyof Payouts, number | ''>;
}

const WIN_TYPE_DETAILS: { [winType: string]: { betType: BetTypeOption, payoutKey: keyof Payouts } } = {
    'Simple Gagnant': { betType: BetTypeOption.SimpleGagnant, payoutKey: 'simpleGagnant' },
    'Simple Placé': { betType: BetTypeOption.SimplePlace, payoutKey: 'simplePlaceA' }, // Assumption: use 'A' for all placed
  'Couplé Gagnant': { betType: BetTypeOption.CoupleGagnant, payoutKey: 'ordreGagnant' },
    'Couplé Placé': { betType: BetTypeOption.CouplePlace, payoutKey: 'coupleA' }, // Assumption
    'Tiercé Ordre': { betType: BetTypeOption.Tierce, payoutKey: 'tierceOrdre' },
    'Tiercé Désordre': { betType: BetTypeOption.Tierce, payoutKey: 'tierceDesordre' },
    'Quarté+ Ordre': { betType: BetTypeOption.Quarte, payoutKey: 'quarteOrdre' },
    'Quarté+ Désordre': { betType: BetTypeOption.Quarte, payoutKey: 'quarteDesordre' },
    'Quarté+ Bonus 3': { betType: BetTypeOption.Quarte, payoutKey: 'quarteBonus3' },
    'Quinté+ Ordre': { betType: BetTypeOption.Quinte, payoutKey: 'quinteOrdre' },
    'Quinté+ Désordre': { betType: BetTypeOption.Quinte, payoutKey: 'quinteDesordre' },
    'Quinté+ Bonus 4': { betType: BetTypeOption.Quinte, payoutKey: 'quinteBonus4' },
    'Quinté+ Bonus 3': { betType: BetTypeOption.Quinte, payoutKey: 'quinteBonus3' },
    'Multi 4': { betType: BetTypeOption.Multi4, payoutKey: 'multi4' },
    'Multi 5': { betType: BetTypeOption.Multi5, payoutKey: 'multi5' },
    'Multi 6': { betType: BetTypeOption.Multi6, payoutKey: 'multi6' },
    'Multi 7': { betType: BetTypeOption.Multi7, payoutKey: 'multi7' },
};

export const WinDividendReport: React.FC<WinDividendReportProps> = ({ summary, payouts }) => {
  if (!summary || Object.keys(summary).length === 0) {
    return (
      <div className="mt-6 text-center text-gray-500">
        <p>No winning bets found for this result.</p>
      </div>
    );
  }

  // Filter and sort the categories that have winners
  const winningCategories = WIN_CATEGORY_ORDER.filter(category => summary[category]);

  const grandTotalPayout = winningCategories.reduce((total, winType) => {
    const details = WIN_TYPE_DETAILS[winType];
    if (!details) return total;
    const { betType, payoutKey } = details;
    const payoutValue = winType === 'Couplé Gagnant'
      ? (payouts.ordreGagnant ?? payouts.desordreGagnant)
      : payouts[payoutKey];
    const { units } = summary[winType];

    if (typeof payoutValue === 'number' && units > 0) {
      return total + (units * payoutValue);
    }
    return total;
  }, 0);

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold text-betese-dark mb-2 border-b pb-1">Winning Bet Summary</h3>
      <TableScrollNavigator className="overflow-x-auto">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left font-semibold py-2 px-3">Bet / Win Type</th>
              <th className="text-right font-semibold py-2 px-3">Winning Bets</th>
              <th className="text-right font-semibold py-2 px-3">Total Stake (GMD)</th>
              <th className="text-right font-semibold py-2 px-3">Total Payout (GMD)</th>
            </tr>
          </thead>
          <tbody>
            {winningCategories.map(winType => {
                const { count, stake, units } = summary[winType];
              const details = WIN_TYPE_DETAILS[winType];
              let totalPayout = 0;
              if(details) {
                  const { payoutKey } = details;
                  const payoutValue = winType === 'Couplé Gagnant'
                    ? (payouts.ordreGagnant ?? payouts.desordreGagnant)
                    : payouts[payoutKey];
                  
                  if (typeof payoutValue === 'number' && units > 0) {
                    totalPayout = units * payoutValue;
                  }
              }

              return (
                <tr key={winType} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-betese-green">{winType}</td>
                  <td className="py-2 px-3 text-right font-mono">{count}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold">{stake.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-red-600">{totalPayout > 0 ? totalPayout.toFixed(2) : '---'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 font-bold">
                <td colSpan={3} className="py-2 px-3 text-right">Grand Total Payout Liability:</td>
                <td className="py-2 px-3 text-right text-lg text-red-700">{grandTotalPayout.toFixed(2)} GMD</td>
            </tr>
          </tfoot>
        </table>
      </TableScrollNavigator>
    </div>
  );
};
