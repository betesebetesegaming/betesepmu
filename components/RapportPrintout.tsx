
import React from 'react';
import { Race, Payouts } from '../types';
import { formatWinningNumbersForDisplay } from '../utils';

interface RapportPrintoutProps {
  race: Race;
}

const PayoutRow: React.FC<{ label: string; value?: number }> = ({ label, value }) => {
  if (value === undefined || value === 0) return null;
  return (
      <div className="flex justify-between items-baseline text-[10px] leading-tight border-b border-black border-dashed pb-0.5 mb-0.5">
        <span className="font-bold uppercase">{label}</span>
        <span className="font-black">{value.toFixed(0)}</span>
      </div>
  );
}

const PayoutGroup: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => {
    // Only render if there are children (payouts exist)
    const hasContent = React.Children.toArray(children).some(child => React.isValidElement(child));
    if (!hasContent) return null;

    return (
        <div className="mb-1">
            <p className="font-black text-[9px] uppercase border-b-2 border-black mb-0.5">{title}</p>
            <div>{children}</div>
        </div>
    )
}

const SingleRapportSection: React.FC<{ 
    title: string;
    winningNumbers: number[];
    payouts: Payouts;
    race: Race;
    sectionIndex: number;
}> = ({ title, winningNumbers, payouts, race, sectionIndex }) => {
    if (!winningNumbers || winningNumbers.length === 0) return null;

    return (
        <div className={`w-full max-w-[300px] ${sectionIndex > 0 ? 'mt-4 pt-4 border-t-4 border-black border-double' : ''}`}>
            {/* Header - Minimal */}
            <div className="text-center border-b-2 border-black pb-1 mb-1">
                <p className="text-lg font-black uppercase leading-none tracking-tighter">{title}</p>
                <div className="flex justify-between text-[10px] font-bold mt-1 leading-none">
                    <span>{race.endDate.toLocaleDateString()}</span>
                    <span className="uppercase">{race.name}</span>
                </div>
                {sectionIndex === 0 && race.nonRunners && race.nonRunners.length > 0 && (
                    <p className="text-[10px] font-bold border-t border-black mt-0.5 pt-0.5">NP: {race.nonRunners.join(', ')}</p>
                )}
            </div>
            
            {/* Result Box */}
            <div className="border-2 border-black p-1 text-center mb-1 bg-white">
                <p className="text-[8px] font-black uppercase leading-none">RESULT NUMBERS</p>
                <p className="text-2xl font-black tracking-widest leading-none">{formatWinningNumbersForDisplay(winningNumbers)}</p>
            </div>

            {/* Payouts List */}
            <div className="space-y-0.5">
                <PayoutGroup title="Quinté+">
                    <PayoutRow label="Ordre" value={payouts.quinteOrdre} />
                    <PayoutRow label="Désordre" value={payouts.quinteDesordre} />
                    <PayoutRow label="Bonus 4" value={payouts.quinteBonus4} />
                    <PayoutRow label="Bonus 3" value={payouts.quinteBonus3} />
                </PayoutGroup>

                <PayoutGroup title="Quarté+">
                    <PayoutRow label="Ordre" value={payouts.quarteOrdre} />
                    <PayoutRow label="Désordre" value={payouts.quarteDesordre} />
                    <PayoutRow label="Bonus 3" value={payouts.quarteBonus3} />
                </PayoutGroup>

                <PayoutGroup title="Tiercé">
                    <PayoutRow label="Ordre" value={payouts.tierceOrdre} />
                    <PayoutRow label="Désordre" value={payouts.tierceDesordre} />
                </PayoutGroup>

                <PayoutGroup title="Couplé">
                    <PayoutRow label="Gagnant" value={payouts.ordreGagnant || payouts.desordreGagnant} />
                    <PayoutRow label="Placé A" value={payouts.coupleA} />
                    <PayoutRow label="Placé B" value={payouts.coupleB} />
                    <PayoutRow label="Placé C" value={payouts.coupleC} />
                </PayoutGroup>

                <PayoutGroup title="Simple">
                    <PayoutRow label="Gagnant" value={payouts.simpleGagnant} />
                    <PayoutRow label="Placé A" value={payouts.simplePlaceA} />
                    <PayoutRow label="Placé B" value={payouts.simplePlaceB} />
                    <PayoutRow label="Placé C" value={payouts.simplePlaceC} />
                </PayoutGroup>
                
                <PayoutGroup title="Multi">
                    <PayoutRow label="Multi 4" value={payouts.multi4} />
                    <PayoutRow label="Multi 5" value={payouts.multi5} />
                    <PayoutRow label="Multi 6" value={payouts.multi6} />
                    <PayoutRow label="Multi 7" value={payouts.multi7} />
                </PayoutGroup>
            </div>
        </div>
    );
};

export const RapportPrintout: React.FC<RapportPrintoutProps> = ({ race }) => {
  const { result } = race;
  if (!result) return null;

  return (
    <>
      <div id={`rapport-${race.id}`} className="font-sans bg-white printable-content w-full max-w-[300px]">
        
        {/* 1. Primary Result */}
        <SingleRapportSection 
            title="OFFICIAL REPORT" 
            winningNumbers={result.winningNumbers} 
            payouts={result.payouts} 
            race={race}
            sectionIndex={0}
        />

        {/* 2. Bracket 1 Result */}
        {result.bracketWinningNumbers && result.bracketPayouts && (
            <SingleRapportSection 
                title="BRACKET REPORT (1)" 
                winningNumbers={result.bracketWinningNumbers} 
                payouts={result.bracketPayouts} 
                race={race}
                sectionIndex={1}
            />
        )}

        {/* 3. Bracket 2 Result */}
        {result.bracket2WinningNumbers && result.bracket2Payouts && (
            <SingleRapportSection 
                title="BRACKET REPORT (2)" 
                winningNumbers={result.bracket2WinningNumbers} 
                payouts={result.bracket2Payouts} 
                race={race}
                sectionIndex={2}
            />
        )}

        <div className="mt-2 pt-1 border-t border-black text-center">
            <p className="text-[8px] font-bold uppercase">BETESE PMU - OFFICIAL</p>
            <p className="text-[7px] leading-none">{new Date().toLocaleString()}</p>
        </div>
      </div>
    </>
  );
};
