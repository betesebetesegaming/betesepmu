
import { Race, Ticket, BetTypeOption, Payouts, WinningsBreakdown } from './types';
import { BET_PRICING } from './constants';

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
            if (sel.betType === BetTypeOption.SimpleGagnant && sel.numbers[0] === winningNumbers[0]) add('Simple Gagnant', stake);
        });
    });
    return summary;
}

export function calculateTicketWinnings(ticket: Ticket, allRaces: Race[]): { totalWinnings: number; breakdown: WinningsBreakdown[] } {
    let grandTotalWinnings = 0;
    const finalBreakdown: WinningsBreakdown[] = [];
    ticket.selections.forEach((sel, index) => {
        const race = allRaces.find(r => r.id === sel.raceId);
        if (race?.result && sel.numbers.includes(race.result.winningNumbers[0])) {
            const payout = (race.result.payouts as any).simpleGagnant || 0;
            const winAmt = sel.cost * payout * sel.multiplier;
            grandTotalWinnings += winAmt;
            finalBreakdown.push({ selectionIndex: index, status: 'Win', totalPayout: winAmt, winType: sel.betType });
        } else {
            finalBreakdown.push({ selectionIndex: index, status: 'Loss' });
        }
    });
    return { totalWinnings: grandTotalWinnings, breakdown: finalBreakdown };
}
