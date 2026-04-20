import React from 'react';
import { Race } from '../types';

interface OfficialPayoutsPanelProps {
  latestResultedRace: Race | null;
}

const PayoutRow: React.FC<{ label: string; value?: number }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-200">
    <span className="text-sm text-gray-700">{label}</span>
    <span className="text-sm font-bold text-betese-dark">
      {typeof value === 'number' && value > 0 ? `${value.toFixed(2)} GMD` : '---'}
    </span>
  </div>
);

export const OfficialPayoutsPanel: React.FC<OfficialPayoutsPanelProps> = ({ latestResultedRace }) => {
  const payouts = latestResultedRace?.result?.payouts;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-betese-dark mb-4">
        Official Payouts
        {latestResultedRace && <span className="text-sm font-normal text-gray-500 ml-2">({latestResultedRace.name})</span>}
      </h3>
      
      {!payouts ? (
        <p className="text-gray-500 text-center py-4">Payouts will be displayed here once the latest race results are available.</p>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
            <div>
                <h4 className="font-bold text-betese-green mb-1">Simple</h4>
                <PayoutRow label="Gagnant" value={payouts.simpleGagnant} />
                <PayoutRow label="Placé (1st)" value={payouts.simplePlaceA} />
                <PayoutRow label="Placé (2nd)" value={payouts.simplePlaceB} />
                <PayoutRow label="Placé (3rd)" value={payouts.simplePlaceC} />
            </div>
             <div>
                <h4 className="font-bold text-betese-green mb-1">Couplé</h4>
                <PayoutRow label="Gagnant (1-2)" value={payouts.coupleA} />
                <PayoutRow label="Placé (1-2)" value={payouts.coupleA} />
                <PayoutRow label="Placé (1-3)" value={payouts.coupleB} />
                <PayoutRow label="Placé (2-3)" value={payouts.coupleC} />
            </div>
            <div>
                <h4 className="font-bold text-betese-green mb-1">Tiercé</h4>
                <PayoutRow label="Ordre" value={payouts.tierceOrdre} />
                <PayoutRow label="Désordre" value={payouts.tierceDesordre} />
            </div>
             <div>
                <h4 className="font-bold text-betese-green mb-1">Quarté+</h4>
                <PayoutRow label="Ordre" value={payouts.quarteOrdre} />
                <PayoutRow label="Désordre" value={payouts.quarteDesordre} />
                <PayoutRow label="Bonus 3" value={payouts.quarteBonus3} />
            </div>
             <div>
                <h4 className="font-bold text-betese-green mb-1">Quinté+</h4>
                <PayoutRow label="Ordre" value={payouts.quinteOrdre} />
                <PayoutRow label="Désordre" value={payouts.quinteDesordre} />
                <PayoutRow label="Bonus 4" value={payouts.quinteBonus4} />
                <PayoutRow label="Bonus 3" value={payouts.quinteBonus3} />
            </div>
            <div>
                <h4 className="font-bold text-betese-green mb-1">Multi</h4>
                <PayoutRow label="Multi 4" value={payouts.multi4} />
                <PayoutRow label="Multi 5" value={payouts.multi5} />
                <PayoutRow label="Multi 6" value={payouts.multi6} />
                <PayoutRow label="Multi 7" value={payouts.multi7} />
            </div>
        </div>
      )}
    </div>
  );
};
