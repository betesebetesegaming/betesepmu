import { createClient } from '@supabase/supabase-js';

const BET_TYPES = ['gagnant', 'place', 'couple', 'tierce', 'quarte', 'quinte', 'multi4', 'multi5', 'multi6', 'multi7'];

const DEFAULT_CONFIG = {
  gagnant: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  place: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  couple: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.5, disorder: 0.5 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  tierce: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.6, disorder: 0.4 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  quarte: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.5, disorder: 0.25, bonus3: 0.25 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  quinte: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { order: 0.4, disorder: 0.2, bonus4: 0.25, bonus3: 0.15 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi4: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi5: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi6: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 },
  multi7: { is_enabled: true, calculation_mode: 'automatic', payout_percentage: 0.75, split_rules: { main: 1 }, jackpot_enabled: true, minimum_dividend: 20, rounding_base: 5 }
};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  },
  body: JSON.stringify(body)
});

const roundToBase = (value, base) => {
  if (!base || base <= 0) return value;
  return Math.round(value / base) * base;
};

const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeSplit = (splitRules) => {
  const entries = Object.entries(splitRules || {}).filter(([, v]) => asNumber(v, 0) > 0);
  if (entries.length === 0) return { main: 1 };
  const total = entries.reduce((sum, [, value]) => sum + asNumber(value, 0), 0);
  if (total <= 0) return { main: 1 };
  return Object.fromEntries(entries.map(([k, v]) => [k, asNumber(v, 0) / total]));
};

const isSameOrdered = (a, b) => a.length === b.length && a.every((item, idx) => item === b[idx]);

const intersectionSize = (a, b) => {
  const setB = new Set(b);
  return a.reduce((acc, item) => acc + (setB.has(item) ? 1 : 0), 0);
};

const sameUnorderedSet = (a, b) => {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((x) => setA.has(x));
};

const classifySelection = (betType, selection, positions) => {
  const top2 = positions.slice(0, 2);
  const top3 = positions.slice(0, 3);
  const top4 = positions.slice(0, 4);
  const top5 = positions.slice(0, 5);

  switch (betType) {
    case 'gagnant': {
      if (selection.length < 1) return null;
      return selection[0] === positions[0] ? 'main' : null;
    }
    case 'place': {
      if (selection.length < 1) return null;
      return top3.includes(selection[0]) ? 'main' : null;
    }
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
      const allIncluded = positions.slice(0, topN).every((horse) => pickSet.has(horse));
      return allIncluded ? 'main' : null;
    }
    default:
      return null;
  }
};

const buildConfig = (rows) => {
  const config = { ...DEFAULT_CONFIG };
  for (const row of rows || []) {
    if (!row || !BET_TYPES.includes(row.bet_type)) continue;
    config[row.bet_type] = {
      is_enabled: row.is_enabled !== false,
      calculation_mode: row.calculation_mode === 'manual' ? 'manual' : 'automatic',
      payout_percentage: asNumber(row.payout_percentage, DEFAULT_CONFIG[row.bet_type].payout_percentage),
      split_rules: normalizeSplit(row.split_rules || DEFAULT_CONFIG[row.bet_type].split_rules),
      jackpot_enabled: row.jackpot_enabled !== false,
      minimum_dividend: asNumber(row.minimum_dividend, 20),
      rounding_base: asNumber(row.rounding_base, 5)
    };
  }
  return config;
};

const getCarryMap = (carryRows) => {
  const map = new Map();
  for (const row of carryRows || []) {
    const key = `${row.bet_type}:${row.level}`;
    const current = map.get(key) || 0;
    map.set(key, current + asNumber(row.amount, 0));
  }
  return map;
};

const calculateRows = ({ raceId, bets, positions, config, carryMap }) => {
  const output = [];

  for (const betType of BET_TYPES) {
    const typeBets = bets.filter((b) => b.bet_type === betType);
    const totalPool = typeBets.reduce((sum, b) => sum + asNumber(b.stake, 0) * asNumber(b.units, 1), 0);
    const typeConfig = config[betType] || DEFAULT_CONFIG[betType];
    if (typeConfig.is_enabled === false) continue;
    const payoutPool = totalPool * asNumber(typeConfig.payout_percentage, 0.75);

    const winnersByLevel = new Map();

    for (const bet of typeBets) {
      const selection = Array.isArray(bet.selection) ? bet.selection.map((x) => Number(x)).filter((x) => Number.isFinite(x)) : [];
      const matchedLevel = classifySelection(betType, selection, positions);
      if (!matchedLevel) continue;
      const units = Math.max(1, asNumber(bet.units, 1));
      if (!winnersByLevel.has(matchedLevel)) winnersByLevel.set(matchedLevel, { winnerUnits: 0, winnerTickets: 0, betIds: [] });
      const curr = winnersByLevel.get(matchedLevel);
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

      let dividend = null;
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
        carry_out: Number(carryOut.toFixed(4))
      });
    }
  }

  return output;
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const raceId = body.race_id;
    const mode = body.mode === 'finalize' ? 'finalize' : 'preview';
    const incomingPositions = Array.isArray(body.positions)
      ? body.positions.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : null;

    if (!raceId) {
      return response(400, { error: 'race_id is required' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return response(500, { error: 'Missing Supabase environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

    let positions = incomingPositions;

    if (!positions || positions.length < 3) {
      const { data: resultRow, error: resultError } = await supabase
        .from('results')
        .select('positions')
        .eq('race_id', raceId)
        .maybeSingle();

      if (resultError) {
        return response(500, { error: resultError.message });
      }

      positions = Array.isArray(resultRow?.positions)
        ? resultRow.positions.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
        : [];
    }

    if (!positions || positions.length < 3) {
      return response(400, { error: 'Race result positions are required (minimum top 3).' });
    }

    if (mode === 'finalize' && incomingPositions && incomingPositions.length >= 3) {
      const { error: upsertResultError } = await supabase
        .from('results')
        .upsert({ race_id: raceId, positions: incomingPositions, updated_at: new Date().toISOString() }, { onConflict: 'race_id' });

      if (upsertResultError) {
        return response(500, { error: upsertResultError.message });
      }
    }

    const [betsRes, configRes, carryRes] = await Promise.all([
      supabase.from('bets').select('id,bet_type,selection,stake,units').eq('race_id', raceId),
      supabase.from('config').select('bet_type,is_enabled,calculation_mode,payout_percentage,split_rules,jackpot_enabled,minimum_dividend,rounding_base'),
      supabase.from('jackpot_carry').select('id,bet_type,level,amount').eq('is_settled', false)
    ]);

    if (betsRes.error) return response(500, { error: betsRes.error.message });
    if (configRes.error) return response(500, { error: configRes.error.message });
    if (carryRes.error) return response(500, { error: carryRes.error.message });

    const config = buildConfig(configRes.data || []);
    const carryMap = getCarryMap(carryRes.data || []);

    const rows = calculateRows({
      raceId,
      bets: betsRes.data || [],
      positions,
      config,
      carryMap
    });

    if (mode === 'finalize') {
      const { data: existingPayouts, error: existingPayoutsError } = await supabase
        .from('payouts')
        .select('bet_type,level,dividend,manual_dividend,is_overridden')
        .eq('race_id', raceId);

      if (existingPayoutsError) return response(500, { error: existingPayoutsError.message });

      const existingMap = new Map(
        (existingPayouts || []).map((p) => [`${p.bet_type}:${p.level}`, p])
      );

      const payoutPayload = rows.map((row) => ({
        ...(() => {
          const key = `${row.bet_type}:${row.level}`;
          const existing = existingMap.get(key);
          if (row.calculation_mode === 'manual') {
            return {
              dividend: existing?.manual_dividend ?? existing?.dividend ?? null,
              manual_dividend: existing?.manual_dividend ?? null,
              is_overridden: existing?.is_overridden ?? false
            };
          }
          return {
            dividend: row.dividend,
            manual_dividend: null,
            is_overridden: false
          };
        })(),
        race_id: row.race_id,
        bet_type: row.bet_type,
        level: row.level,
        pool: row.pool,
        winners: row.winners,
        winner_tickets: row.winner_tickets,
        carry_in: row.carry_in,
        carry_out: row.carry_out,
        calculation_mode: row.calculation_mode,
        updated_at: new Date().toISOString()
      }));

      const allCarryIds = (carryRes.data || []).map((x) => x.id);
      if (allCarryIds.length > 0) {
        const { error: settleError } = await supabase
          .from('jackpot_carry')
          .update({ is_settled: true, settled_race_id: raceId, settled_at: new Date().toISOString() })
          .in('id', allCarryIds);

        if (settleError) return response(500, { error: settleError.message });
      }

      const carryInsert = rows
        .filter((row) => row.carry_out > 0)
        .map((row) => ({
          race_id: raceId,
          bet_type: row.bet_type,
          level: row.level,
          amount: row.carry_out,
          is_settled: false
        }));

      if (carryInsert.length > 0) {
        const { error: carryInsertError } = await supabase.from('jackpot_carry').insert(carryInsert);
        if (carryInsertError) return response(500, { error: carryInsertError.message });
      }

      const { error: payoutError } = await supabase.from('payouts').upsert(payoutPayload, { onConflict: 'race_id,bet_type,level' });
      if (payoutError) return response(500, { error: payoutError.message });
    }

    return response(200, {
      race_id: raceId,
      mode,
      positions,
      rows
    });
  } catch (error) {
    return response(500, { error: error.message || 'Unexpected error' });
  }
};
