
import { Race, Ticket, BetTypeOption, Payouts, WinningsBreakdown, BetSelection } from './types';
import { BET_PRICING } from './constants';

// Returns the price for ONE base combination unit (e.g. 30 for CoupleGagnant, 25 for Tiercé)
const getBetBasePrice = (betType: BetTypeOption): number => {
    const pricing = BET_PRICING[betType];
    if (!pricing) return 0;
    return pricing.basePrice ?? pricing.perHorsePrice ?? 0;
};

export const formatWinningNumbersForDisplay = (numbers: number[] | undefined): string => {
    if (!numbers || numbers.length === 0) return 'N/A';
    return numbers.join('-');
};

export const formatWinningNumbersForInput = (numbers: number[] | undefined): string => {
    if (!numbers) return '';
    return numbers.join(', ');
};

export const parseWinningNumbersFromString = (str: string): number[] => {
    return str.split(/[\s,\/-]+/)
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));
};

export const normalizeGambiaPhone = (input: string): string | null => {
    const raw = String(input || '').trim();
    if (!raw) return null;

    const digits = raw.replace(/\D/g, '');
    let countryCode = '';
    let local = '';

    // Explicit country formats.
    if (digits.startsWith('220') && digits.length === 10) {
        countryCode = '220';
        local = digits.slice(3);
    } else if (digits.startsWith('221') && (digits.length === 11 || digits.length === 12)) {
        countryCode = '221';
        local = digits.slice(3);
    // Local formats without country code.
    } else if (digits.length === 7) {
        countryCode = '220';
        local = digits;
    } else if (digits.length === 8 || digits.length === 9) {
        countryCode = '221';
        local = digits;
    } else {
        return null;
    }

    if (countryCode === '220' && !/^\d{7}$/.test(local)) return null;
    if (countryCode === '221' && !/^\d{8,9}$/.test(local)) return null;

    return `+${countryCode}${local}`;
};

export const isValidGambiaPhone = (input: string): boolean => {
    return normalizeGambiaPhone(input) !== null;
};

export const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;
export const BETTING_CUTOFF_MS = 120000; // Strict 2 Minutes

export const getEffectiveTicketStatus = (ticket: Ticket, now: Date): Ticket['status'] | 'Expired' => {
  const ticketAge = now.getTime() - ticket.timestamp.getTime();
  if (['Winning', 'Active'].includes(ticket.status) && ticketAge > SEVEN_DAYS_IN_MS) {
    return 'Expired';
  }
  return ticket.status;
};

/**
 * STABLE PMU PRINT ENGINE (V5 - FINAL PRODUCTION)
 * This is based on the 'Copy of Copy' version that works perfectly.
 */
export const triggerPrint = (elementId: string): void => {
    const sourceElement = document.getElementById(elementId);
    if (!sourceElement) {
        console.error("PRINT ERROR: Element not found", elementId);
        return;
    }

    // 1. Cleanup any crashed workers
    const oldWorker = document.getElementById('betese-stable-printer');
    if (oldWorker) oldWorker.remove();

    // 2. Create the printing worker (Iframe)
    const iframe = document.createElement('iframe');
    iframe.id = 'betese-stable-printer';
    // Style for background processing
    iframe.setAttribute('style', 'position:fixed; right:0; bottom:0; width:58mm; height:1px; border:0; visibility:hidden;');
    document.body.appendChild(iframe);

    const printerDoc = iframe.contentWindow?.document;
    if (!printerDoc) return;

    // 3. Inject High-Density Thermal CSS
    printerDoc.open();
    printerDoc.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <style>
                    @page { margin: 0; size: auto; }
                    * { 
                        box-sizing: border-box; 
                        -webkit-print-color-adjust: exact !important; 
                    }
                    body { 
                        font-family: 'Courier New', Courier, monospace; 
                        width: 54mm; /* Slightly less than 58mm to prevent side-clipping */
                        margin: 0; 
                        padding: 2mm; 
                        font-size: 12px; 
                        line-height: 1.1; 
                        color: #000 !important;
                        background: #fff !important;
                        /* Force thermal head to burn darker */
                        text-shadow: 0 0 0 #000 !important;
                        font-weight: bold !important;
                    }
                    .c { text-align: center !important; }
                    .b { font-weight: 900 !important; }
                    .huge { font-size: 30px !important; letter-spacing: -1px; line-height: 0.9; margin: 4px 0; }
                    .solid { border-top: 2px solid black !important; margin: 5px 0 !important; }
                    .dashed { border-top: 1px dashed black !important; margin: 5px 0 !important; }
                    .flex { display: flex !important; justify-content: space-between !important; align-items: center !important; }
                    img { display: block !important; margin: 5px auto !important; width: 40mm !important; height: 40mm !important; }
                    .invert { background: black !important; color: white !important; padding: 2px; }
                </style>
            </head>
            <body>
                <div id="print-content">
                    ${sourceElement.innerHTML}
                </div>
            </body>
        </html>
    `);
    printerDoc.close();

    // 4. CRITICAL: Android Hardware Buffer Delay
    // Thermal printers are slow to process images. We wait 1.2s.
    setTimeout(() => {
        if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            
            // Garbage collection: Remove iframe after printing is initiated
            setTimeout(() => {
                const worker = document.getElementById('betese-stable-printer');
                if (worker) worker.remove();
            }, 10000);
        }
    }, 1200); 
};

export interface WinSummary {
    [key: string]: { count: number; stake: number; };
}

export const WIN_CATEGORY_ORDER = [
    'Simple Gagnant', 'Simple Placé', 'Couplé Gagnant', 'Couplé Placé',
    'Tiercé Ordre', 'Tiercé Désordre', 'Quarté+ Ordre', 'Quarté+ Désordre', 'Quarté+ Bonus 3',
    'Quinté+ Ordre', 'Quinté+ Désordre', 'Quinté+ Bonus 4', 'Quinté+ Bonus 3',
    'Multi 4', 'Multi 5', 'Multi 6', 'Multi 7'
];

export function calculateWinSummary(race: Race, winningNumbers: number[], tickets: Ticket[]): WinSummary {
    const summary: WinSummary = {};
    if (!winningNumbers.length) return summary;
    const first = winningNumbers[0];
    const second = winningNumbers[1];
    const add = (cat: string, stake: number) => {
        if (!summary[cat]) summary[cat] = { count: 0, stake: 0 };
        summary[cat].count++;
        summary[cat].stake += stake;
    };
    tickets.forEach(t => {
        if (t.status === 'Canceled') return;
        t.selections.forEach(sel => {
            if (sel.raceId !== race.id) return;
            const stake = sel.cost * sel.multiplier;
            if (sel.betType === BetTypeOption.SimpleGagnant && sel.numbers[0] === first) add('Simple Gagnant', stake);
            if (
                sel.betType === BetTypeOption.CoupleGagnant &&
                first !== undefined &&
                second !== undefined &&
                sel.numbers.includes(first) &&
                sel.numbers.includes(second)
            ) {
                add('Couplé Gagnant', stake);
            }
        });
    });
    return summary;
}

export const validateSelectionFormula = (sel: BetSelection): { valid: boolean; message?: string } => {
    const pricing = BET_PRICING[sel.betType];
    if (!pricing) return { valid: false, message: `Unknown bet type: ${sel.betType}` };

    const xCount = sel.xCount || 0;
    const numberCount = sel.numbers.length;
    const totalSlots = numberCount + xCount;

    if (xCount < 0) return { valid: false, message: `${sel.betType}: wildcard count cannot be negative` };
    if (numberCount < 0) return { valid: false, message: `${sel.betType}: number count cannot be negative` };
    if (totalSlots < pricing.minHorses) return { valid: false, message: `${sel.betType}: minimum horses not met` };

    const uniqueNumbers = new Set(sel.numbers);
    if (uniqueNumbers.size !== sel.numbers.length) return { valid: false, message: `${sel.betType}: duplicate horse numbers are not allowed` };

    if (pricing.perHorsePrice !== undefined) {
        if (xCount > 0) return { valid: false, message: `${sel.betType}: wildcard X is not allowed` };
        const expected = pricing.perHorsePrice * numberCount;
        if (Math.abs((sel.cost || 0) - expected) >= 0.001) {
            return { valid: false, message: `${sel.betType}: invalid cost` };
        }
        return { valid: true };
    }

    let expected: number | undefined;
    if (xCount > 0) {
        expected = pricing.xPriceMap?.[xCount]?.[numberCount];
    } else {
        expected = pricing.priceMap?.[totalSlots];
    }

    if (expected === undefined) return { valid: false, message: `${sel.betType}: invalid formula structure` };
    if (Math.abs((sel.cost || 0) - expected) >= 0.001) return { valid: false, message: `${sel.betType}: invalid cost` };
    return { valid: true };
};

export const validateTicketForPlacement = (ticketLike: { selections: BetSelection[]; totalCost: number }): { valid: boolean; message?: string } => {
    if (!ticketLike.selections?.length) return { valid: false, message: 'No selections in ticket' };
    for (const sel of ticketLike.selections) {
        const check = validateSelectionFormula(sel);
        if (!check.valid) return check;
    }
    const computedTotal = ticketLike.selections.reduce((sum, sel) => sum + (sel.cost * sel.multiplier), 0);
    if (Math.abs(computedTotal - (ticketLike.totalCost || 0)) >= 0.001) {
        return { valid: false, message: 'Ticket total cost mismatch' };
    }
    return { valid: true };
};

export function calculateTicketWinnings(ticket: Ticket, allRaces: Race[]): { totalWinnings: number; breakdown: WinningsBreakdown[] } {
    const combinations = (numbers: number[], size: number): number[][] => {
        if (size <= 0 || numbers.length < size) return [];
        if (size === 1) return numbers.map((n) => [n]);
        const output: number[][] = [];
        const walk = (start: number, current: number[]) => {
            if (current.length === size) {
                output.push([...current]);
                return;
            }
            for (let i = start; i < numbers.length; i += 1) {
                current.push(numbers[i]);
                walk(i + 1, current);
                current.pop();
            }
        };
        walk(0, []);
        return output;
    };

    const setsMatch = (a: number[], b: number[]) => a.length === b.length && a.every((value) => b.includes(value));
    const intersectionCount = (a: number[], b: number[]) => a.filter((value) => b.includes(value)).length;
    const sourceList = (race: Race) => {
        const result = race.result;
        if (!result) return [] as Array<{ source: 'Primary' | 'Bracket 1' | 'Bracket 2'; winningNumbers: number[]; payouts: Payouts }>;
        const sources: Array<{ source: 'Primary' | 'Bracket 1' | 'Bracket 2'; winningNumbers: number[]; payouts: Payouts }> = [];
        // Settlement must follow the visible main result only.
        // Hidden tie/bracket pages caused confusing/incorrect wins in production.
        if (result.winningNumbers?.length) {
            sources.push({ source: 'Primary', winningNumbers: result.winningNumbers, payouts: result.payouts || {} });
        }
        return sources;
    };

    const matchesOrderedPattern = (pattern: string[] | undefined, target: number[]) => {
        if (!pattern || pattern.length !== target.length) return false;
        return pattern.every((slot, index) => slot === 'X' || Number(slot) === target[index]);
    };

    const coversTargetWithWildcards = (selected: number[], wildcardCount: number, target: number[]) => {
        const matched = selected.filter((num) => target.includes(num)).length;
        return matched + wildcardCount >= target.length;
    };

    let grandTotalWinnings = 0;
    const finalBreakdown: WinningsBreakdown[] = [];

    ticket.selections.forEach((sel, index) => {
        // Strict PMU formula validation for all bet types.
        // Invalid structure/cost cannot be settled as win.
        if (!validateSelectionFormula(sel).valid) {
            finalBreakdown.push({ selectionIndex: index, status: 'Loss' });
            return;
        }

        const race = allRaces.find((r) => r.id === sel.raceId);
        if (!race?.result) {
            finalBreakdown.push({ selectionIndex: index, status: 'Loss' });
            return;
        }

        let selectionTotal = 0;
        const winningCombinationList: number[][] = [];
        let winType: string | undefined;
        let payoutPerCombination = 0;
        let source: 'Primary' | 'Bracket 1' | 'Bracket 2' | undefined;

        for (const resultSource of sourceList(race)) {
            const positions = resultSource.winningNumbers;
            const payouts = resultSource.payouts || {};
            const top2 = positions.slice(0, 2);
            const top3 = positions.slice(0, 3);
            const top4 = positions.slice(0, 4);
            const top5 = positions.slice(0, 5);
            let matchedCombos: number[][] = [];
            let unitPayout = 0;
            let matchedType: string | undefined;

            switch (sel.betType) {
                case BetTypeOption.SimpleGagnant:
                    if (sel.numbers.includes(positions[0])) {
                        matchedCombos = [[positions[0]]];
                        unitPayout = Number(payouts.simpleGagnant || 0);
                        matchedType = 'Simple Gagnant';
                    }
                    break;
                case BetTypeOption.SimplePlace: {
                    const placeHits: Array<{ combo: number[]; payout: number; label: string }> = [];
                    if (sel.numbers.includes(top3[0]) && Number(payouts.simplePlaceA || 0) > 0) placeHits.push({ combo: [top3[0]], payout: Number(payouts.simplePlaceA), label: 'Simple Placé A' });
                    if (sel.numbers.includes(top3[1]) && Number(payouts.simplePlaceB || 0) > 0) placeHits.push({ combo: [top3[1]], payout: Number(payouts.simplePlaceB), label: 'Simple Placé B' });
                    if (sel.numbers.includes(top3[2]) && Number(payouts.simplePlaceC || 0) > 0) placeHits.push({ combo: [top3[2]], payout: Number(payouts.simplePlaceC), label: 'Simple Placé C' });
                    if (placeHits.length > 0) {
                        matchedCombos = placeHits.map((item) => item.combo);
                        unitPayout = placeHits.reduce((sum, item) => sum + item.payout, 0);
                        matchedType = 'Simple Placé';
                    }
                    break;
                }
                case BetTypeOption.CoupleGagnant:
                    if (coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top2)) {
                        matchedCombos = [top2];
                        unitPayout = Number(payouts.ordreGagnant ?? payouts.desordreGagnant ?? 0);
                        matchedType = 'Couplé Gagnant';
                    }
                    break;
                case BetTypeOption.CouplePlace: {
                    const pairPayouts: Array<{ combo: number[]; payout: number; label: string }> = [
                        { combo: [top3[0], top3[1]], payout: Number(payouts.coupleA || 0), label: 'Couplé Placé A' },
                        { combo: [top3[0], top3[2]], payout: Number(payouts.coupleB || 0), label: 'Couplé Placé B' },
                        { combo: [top3[1], top3[2]], payout: Number(payouts.coupleC || 0), label: 'Couplé Placé C' }
                    ].filter((item) => item.combo.every((value) => Number.isFinite(value)));
                    const hits = pairPayouts.filter((item) => coversTargetWithWildcards(sel.numbers, sel.xCount || 0, item.combo) && item.payout > 0);
                    if (hits.length > 0) {
                        matchedCombos = hits.map((item) => item.combo);
                        unitPayout = hits.reduce((sum, item) => sum + item.payout, 0);
                        matchedType = 'Couplé Placé';
                    }
                    break;
                }
                case BetTypeOption.Tierce:
                    if (matchesOrderedPattern(sel.pattern, top3) || coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top3)) {
                        matchedCombos = [top3];
                        unitPayout = matchesOrderedPattern(sel.pattern, top3)
                            ? Number(payouts.tierceOrdre ?? payouts.tierceDesordre ?? 0)
                            : Number(payouts.tierceDesordre ?? payouts.tierceOrdre ?? 0);
                        matchedType = matchesOrderedPattern(sel.pattern, top3) ? 'Tiercé Ordre' : 'Tiercé Désordre';
                    }
                    break;
                case BetTypeOption.Quarte: {
                    const orderHit = matchesOrderedPattern(sel.pattern, top4);
                    const disorderHit = coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4);
                    const bonusHit = intersectionCount(sel.numbers, top4) + (sel.xCount || 0) >= 3;
                    if (orderHit && Number(payouts.quarteOrdre || 0) > 0) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.quarteOrdre || 0);
                        matchedType = 'Quarté+ Ordre';
                    } else if (disorderHit && Number(payouts.quarteDesordre || 0) > 0) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.quarteDesordre || 0);
                        matchedType = 'Quarté+ Désordre';
                    } else if (bonusHit && Number(payouts.quarteBonus3 || 0) > 0) {
                        matchedCombos = combinations(top4.filter((value) => sel.numbers.includes(value)), 3).slice(0, 1);
                        unitPayout = Number(payouts.quarteBonus3 || 0);
                        matchedType = 'Quarté+ Bonus 3';
                    }
                    break;
                }
                case BetTypeOption.Quinte: {
                    const orderHit = matchesOrderedPattern(sel.pattern, top5);
                    const disorderHit = coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top5);
                    const hits = intersectionCount(sel.numbers, top5) + (sel.xCount || 0);
                    if (orderHit && Number(payouts.quinteOrdre || 0) > 0) {
                        matchedCombos = [top5];
                        unitPayout = Number(payouts.quinteOrdre || 0);
                        matchedType = 'Quinté+ Ordre';
                    } else if (disorderHit && Number(payouts.quinteDesordre || 0) > 0) {
                        matchedCombos = [top5];
                        unitPayout = Number(payouts.quinteDesordre || 0);
                        matchedType = 'Quinté+ Désordre';
                    } else if (hits >= 4 && Number(payouts.quinteBonus4 || 0) > 0) {
                        matchedCombos = combinations(top5.filter((value) => sel.numbers.includes(value)), 4).slice(0, 1);
                        unitPayout = Number(payouts.quinteBonus4 || 0);
                        matchedType = 'Quinté+ Bonus 4';
                    } else if (hits >= 3 && Number(payouts.quinteBonus3 || 0) > 0) {
                        matchedCombos = combinations(top5.filter((value) => sel.numbers.includes(value)), 3).slice(0, 1);
                        unitPayout = Number(payouts.quinteBonus3 || 0);
                        matchedType = 'Quinté+ Bonus 3';
                    }
                    break;
                }
                case BetTypeOption.Multi4:
                    // Multi bets (4/5/6/7): win when the first 4 finishers are covered
                    // by selected horses/wildcards, in any order.
                    if ((sel.numbers.length + (sel.xCount || 0)) === 4 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi4 || 0);
                        matchedType = 'Multi 4';
                    }
                    break;
                case BetTypeOption.Multi5:
                    if ((sel.numbers.length + (sel.xCount || 0)) === 5 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi5 || 0);
                        matchedType = 'Multi 5';
                    }
                    break;
                case BetTypeOption.Multi6: {
                    if ((sel.numbers.length + (sel.xCount || 0)) === 6 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi6 || 0);
                        matchedType = 'Multi 6';
                    }
                    break;
                }
                case BetTypeOption.Multi7: {
                    if ((sel.numbers.length + (sel.xCount || 0)) === 7 && positions.length >= 4 && coversTargetWithWildcards(sel.numbers, sel.xCount || 0, top4)) {
                        matchedCombos = [top4];
                        unitPayout = Number(payouts.multi7 || 0);
                        matchedType = 'Multi 7';
                    }
                    break;
                }
            }

            if (matchedCombos.length > 0 && unitPayout > 0) {
                // Use the base price for ONE combination unit, not the total sel.cost.
                // sel.cost can be N × basePrice for combo bets (e.g. 3-horse Couplé = 90 = 3×30).
                // Only one combination wins, so payout = rapport × basePrice × multiplier.
                const basePrice = getBetBasePrice(sel.betType);
                const totalForSource = unitPayout * (basePrice || sel.cost) * sel.multiplier;
                selectionTotal += totalForSource;
                winningCombinationList.push(...matchedCombos);
                payoutPerCombination = unitPayout;
                winType = matchedType;
                source = resultSource.source;
            }
        }

        if (selectionTotal > 0) {
            grandTotalWinnings += selectionTotal;
            finalBreakdown.push({
                selectionIndex: index,
                status: 'Win',
                totalPayout: selectionTotal,
                winType,
                winningCombinations: winningCombinationList.length,
                winningCombinationList,
                payoutPerCombination,
                source
            });
        } else {
            finalBreakdown.push({ selectionIndex: index, status: 'Loss' });
        }
    });

    return { totalWinnings: grandTotalWinnings, breakdown: finalBreakdown };
}
