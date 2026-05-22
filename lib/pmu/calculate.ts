// Pure pari-mutuel payout math, extracted from the Netlify function.
// No database deps — wired up to Firestore in Phase 3.

export const BET_TYPES = [
  'gagnant',
  'place',
  'couple',
  'tierce',
  'quarte',
  'quinte',
  'multi4',
  'multi5',
  'multi6',
  'multi7',
] as const;

export type BetType = (typeof BET_TYPES)[number];

export interface BetTypeConfig {
  is_enabled: boolean;
  calculation_mode: 'automatic' | 'manual';
  payout_percentage: number;
  split_rules: Record<string, number>;
  jackpot_enabled: boolean;
  minimum_dividend: number;
  rounding_base: number;
}

export interface Bet {
  id: string;
  bet_type: string;
  selection: number[];
  stake: number;
  units: number;
}

export interface CarryRow {
  id?: string | number;
  bet_type: string;
  level: string;
  amount: number;
}

export interface PayoutRow {
  race_id: string;
  bet_type: BetType;
  level: string;
  pool: number;
  winners: number;
  winner_tickets: number;
  calculation_mode: 'automatic' | 'manual';
  dividend: number | null;
  carry_in: number;
  carry_out: number;
}

export const DEFAULT_CONFIG: Record<BetType, BetTypeConfig> = {
  gagnant: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  place: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  couple: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.5, disorder: 0.5 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  tierce: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.6, disorder: 0.4 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  quarte: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.5, disorder: 0.25, bonus3: 0.25 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  quinte: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.4, disorder: 0.2, bonus4: 0.25, bonus3: 0.15 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi4: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi5: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi6: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi7: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
};

const asNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const roundToBase = (value: number, base: number): number => {
  if (!base || base <= 0) return value;
  return Math.round(value / base) * base;
};

export const normalizeSplit = (splitRules: Record<string, number> | null | undefined): Record<string, number> => {
  const entries = Object.entries(splitRules || {}).filter(([, v]) => asNumber(v, 0) > 0);
  if (entries.length === 0) return { main: 1 };
  const total = entries.reduce((sum, [, value]) => sum + asNumber(value, 0), 0);
  if (total <= 0) return { main: 1 };
  return Object.fromEntries(entries.map(([k, v]) => [k, asNumber(v, 0) / total]));
};

const isSameOrdered = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((item, idx) => item === b[idx]);

const intersectionSize = (a: number[], b: number[]): number => {
  const setB = new Set(b);
  return a.reduce((acc, item) => acc + (setB.has(item) ? 1 : 0), 0);
};

const sameUnorderedSet = (a: number[], b: number[]): boolean => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((x) => setA.has(x));
};

export function classifySelection(betType: BetType, selection: number[], positions: number[]): string | null {
  const top2 = positions.slice(0, 2);
  const top3 = positions.slice(0, 3);
  const top4 = positions.slice(0, 4);
  const top5 = positions.slice(0, 5);

  switch (betType) {
    case 'gagnant':
      return selection.length >= 1 && selection[0] === positions[0] ? 'main' : null;
    case 'place':
      return selection.length >= 1 && top3.includes(selection[0]!) ? 'main' : null;
    case 'couple': {
      if (selection.length < 2) return null;
      const pick = selection.slice(0, 2);
      if (isSameOrdered(pick, top2)) return 'order';
      if (sameUnorderedSet(pick, top2)) return 'disorder';
      return null;
    }
    case 'tierce': {
      if (selection.length < 3) return null;
      const pick = selection.slice(0, 3);
      if (isSameOrdered(pick, top3)) return 'order';
      if (sameUnorderedSet(pick, top3)) return 'disorder';
      return null;
    }
    case 'quarte': {
      if (selection.length < 4) return null;
      const pick = selection.slice(0, 4);
      if (isSameOrdered(pick, top4)) return 'order';
      if (sameUnorderedSet(pick, top4)) return 'disorder';
      if (intersectionSize(pick, top4) === 3) return 'bonus3';
      return null;
    }
    case 'quinte': {
      if (selection.length < 5) return null;
      const pick = selection.slice(0, 5);
      if (isSameOrdered(pick, top5)) return 'order';
      if (sameUnorderedSet(pick, top5)) return 'disorder';
      const hitCount = intersectionSize(pick, top5);
      if (hitCount === 4) return 'bonus4';
      if (hitCount === 3) return 'bonus3';
      return null;
    }
    case 'multi4':
    case 'multi5':
    case 'multi6':
    case 'multi7': {
      const topN = Number(betType.replace('multi', ''));
      if (selection.length < topN || positions.length < topN) return null;
      const pickSet = new Set(selection);
      return positions.slice(0, topN).every((horse) => pickSet.has(horse)) ? 'main' : null;
    }
    default:
      return null;
  }
}

export function buildConfig(rows: Partial<BetTypeConfig & { bet_type: string }>[]): Record<BetType, BetTypeConfig> {
  const config: Record<BetType, BetTypeConfig> = { ...DEFAULT_CONFIG };
  for (const row of rows || []) {
    if (!row || !BET_TYPES.includes(row.bet_type as BetType)) continue;
    const betType = row.bet_type as BetType;
    config[betType] = {
      is_enabled: row.is_enabled !== false,
      calculation_mode: row.calculation_mode === 'manual' ? 'manual' : 'automatic',
      payout_percentage: asNumber(row.payout_percentage, DEFAULT_CONFIG[betType].payout_percentage),
      split_rules: normalizeSplit(row.split_rules || DEFAULT_CONFIG[betType].split_rules),
      jackpot_enabled: row.jackpot_enabled !== false,
      minimum_dividend: asNumber(row.minimum_dividend, 20),
      rounding_base: asNumber(row.rounding_base, 5),
    };
  }
  return config;
}

export function getCarryMap(carryRows: CarryRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of carryRows || []) {
    const key = `${row.bet_type}:${row.level}`;
    map.set(key, (map.get(key) || 0) + asNumber(row.amount, 0));
  }
  return map;
}

export function calculateRows(params: {
  raceId: string;
  bets: Bet[];
  positions: number[];
  config: Record<BetType, BetTypeConfig>;
  carryMap: Map<string, number>;
}): PayoutRow[] {
  const { raceId, bets, positions, config, carryMap } = params;
  const output: PayoutRow[] = [];

  for (const betType of BET_TYPES) {
    const typeBets = bets.filter((b) => b.bet_type === betType);
    const totalPool = typeBets.reduce((sum, b) => sum + asNumber(b.stake, 0) * asNumber(b.units, 1), 0);
    const typeConfig = config[betType] || DEFAULT_CONFIG[betType];
    if (typeConfig.is_enabled === false) continue;
    const payoutPool = totalPool * asNumber(typeConfig.payout_percentage, 0.75);

    const winnersByLevel = new Map<string, { winnerUnits: number; winnerTickets: number; betIds: string[] }>();

    for (const bet of typeBets) {
      const selection = Array.isArray(bet.selection)
        ? bet.selection.map((x) => Number(x)).filter((x) => Number.isFinite(x))
        : [];
      const matchedLevel = classifySelection(betType, selection, positions);
      if (!matchedLevel) continue;
      const units = Math.max(1, asNumber(bet.units, 1));
      if (!winnersByLevel.has(matchedLevel)) {
        winnersByLevel.set(matchedLevel, { winnerUnits: 0, winnerTickets: 0, betIds: [] });
      }
      const curr = winnersByLevel.get(matchedLevel)!;
      curr.winnerUnits += units;
      curr.winnerTickets += 1;
      curr.betIds.push(bet.id);
    }

    const split = normalizeSplit(typeConfig.split_rules);

    for (const [level, ratio] of Object.entries(split)) {
      const basePool = payoutPool * ratio;
      const carryKey = `${betType}:${level}`;
      const carryIn = asNumber(carryMap.get(carryKey), 0);
      const levelPool = basePool + carryIn;

      const winnerInfo = winnersByLevel.get(level) || { winnerUnits: 0, winnerTickets: 0, betIds: [] };
      const hasWinners = winnerInfo.winnerUnits > 0;

      let dividend: number | null = null;
      if (typeConfig.calculation_mode === 'automatic' && hasWinners) {
        const rawDividend = levelPool / winnerInfo.winnerUnits;
        const bounded = Math.max(rawDividend, asNumber(typeConfig.minimum_dividend, 20));
        dividend = roundToBase(bounded, asNumber(typeConfig.rounding_base, 5));
      }

      const carryOut = !hasWinners && typeConfig.jackpot_enabled ? levelPool : 0;

      output.push({
        race_id: raceId,
        bet_type: betType,
        level,
        pool: Number(levelPool.toFixed(4)),
        winners: winnerInfo.winnerUnits,
        winner_tickets: winnerInfo.winnerTickets,
        calculation_mode: typeConfig.calculation_mode,
        dividend,
        carry_in: Number(carryIn.toFixed(4)),
        carry_out: Number(carryOut.toFixed(4)),
      });
    }
  }

  return output;
}
