import React, { useState } from 'react';
import { BET_PRICING } from '../constants';
import { BetTypeOption } from '../types';

interface BetPricingGuideProps {
  onClose: () => void;
}

const PriceTable: React.FC<{ data: { [key: number]: number } }> = ({ data }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
        {Object.entries(data).map(([horses, cost]) => (
            <div key={horses} className="flex justify-between p-2 bg-gray-100 rounded">
                <span>{horses} Horses</span>
                <span className="font-bold">{cost} GMD</span>
            </div>
        ))}
    </div>
);

const XPriceTable: React.FC<{ data: { [xCount: number]: { [numberCount: number]: number } } }> = ({ data }) => (
    <div>
        <h4 className="font-semibold mt-4 mb-2 text-betese-dark">Champ de Base (X) Pricing</h4>
        <div className="space-y-2 text-sm">
            {Object.entries(data).map(([xCount, priceMap]) => (
                <div key={xCount}>
                    {Object.entries(priceMap).map(([baseHorses, cost]) => (
                        <div key={baseHorses} className="flex justify-between p-2 bg-blue-50 rounded">
                            <span>{baseHorses} Base + {xCount} 'X'</span>
                            <span className="font-bold">{cost} GMD</span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    </div>
);


export const BetPricingGuide: React.FC<BetPricingGuideProps> = ({ onClose }) => {
    const betTypes = Object.values(BetTypeOption);
    const [activeTab, setActiveTab] = useState<BetTypeOption>(betTypes[0]);

    const activePricing = BET_PRICING[activeTab];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-2xl font-bold text-betese-dark">Bet Pricing Guide</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 text-2xl font-bold">&times;</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <nav className="w-48 border-r overflow-y-auto bg-gray-50">
                        {betTypes.map(bt => (
                            <button 
                                key={bt} 
                                onClick={() => setActiveTab(bt)}
                                className={`w-full text-left p-3 text-sm font-semibold border-l-4 transition-colors ${activeTab === bt ? 'bg-green-50 border-betese-green text-betese-green' : 'border-transparent hover:bg-gray-100'}`}
                            >
                                {bt}
                            </button>
                        ))}
                    </nav>
                    <div className="flex-1 p-6 overflow-y-auto">
                        <h3 className="text-xl font-bold mb-1">{activeTab}</h3>
                        <p className="text-sm text-gray-600 mb-4">Requires a minimum of {activePricing.minHorses} horse(s).</p>
                        
                        {activePricing.perHorsePrice ? (
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <p className="font-semibold">This is a simple bet type.</p>
                                <p>Cost: <span className="font-bold">{activePricing.perHorsePrice} GMD</span> per horse selected.</p>
                            </div>
                        ) : (
                           <>
                                <PriceTable data={activePricing.priceMap} />
                                {activePricing.xPriceMap && <XPriceTable data={activePricing.xPriceMap} />}
                           </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
