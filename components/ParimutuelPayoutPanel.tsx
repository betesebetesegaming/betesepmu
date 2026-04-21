import React, { useEffect, useMemo, useState } from 'react';
import { Race } from '../types';
import { supabase } from '../supabaseClient';

type BetType =
  | 'gagnant'
  | 'place'
  | 'couple'
  | 'tierce'
  | 'quarte'
  | 'quinte'
  | 'multi4'
  | 'multi5'
  | 'multi6'
  | 'multi7';

interface ConfigRow {
  bet_type: BetType;
  is_enabled: boolean;
  calculation_mode: 'automatic' | 'manual';
  payout_percentage: number;
  split_rules: Record<string, number>;
  jackpot_enabled: boolean;
  minimum_dividend: number;
  rounding_base: number;
}

interface PreviewRow {
  race_id: string;
  bet_type: BetType;
  level: string;
  pool: number;
  winners: number;
  dividend: number | null;
  carry_in: number;
  carry_out: number;
}

interface SalesRow {
  betType: BetType;
  totalSales: number;
  ticketCount: number;
}

const BET_TYPES: BetType[] = [
  'gagnant',
  'place',
  'couple',
  'tierce',
  'quarte',
  'quinte',
  'multi4',
  'multi5',
  'multi6',
  'multi7'
];

const PRESET_75 = 0.75;
const PRESET_80 = 0.8;

const defaultConfigFor = (betType: BetType): ConfigRow => {
  const splitMap: Record<BetType, Record<string, number>> = {
    gagnant: { main: 1 },
    place: { main: 1 },
    couple: { order: 0.5, disorder: 0.5 },
    tierce: { order: 0.6, disorder: 0.4 },
    quarte: { order: 0.5, disorder: 0.25, bonus3: 0.25 },
    quinte: { order: 0.4, disorder: 0.2, bonus4: 0.25, bonus3: 0.15 },
    multi4: { main: 1 },
    multi5: { main: 1 },
    multi6: { main: 1 },
    multi7: { main: 1 }
  };

  return {
    bet_type: betType,
    is_enabled: true,
    calculation_mode: 'automatic',
    payout_percentage: PRESET_75,
    split_rules: splitMap[betType],
    jackpot_enabled: true,
    minimum_dividend: 20,
    rounding_base: 5
  };
};

const parsePositions = (value: string): number[] =>
  value
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x > 0);

const formatMoney = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const ParimutuelPayoutPanel: React.FC<{ races: Race[] }> = ({ races }) => {
  const [raceId, setRaceId] = useState<string>('');
  const [positionsInput, setPositionsInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [configRows, setConfigRows] = useState<ConfigRow[]>(BET_TYPES.map(defaultConfigFor));
  const [overrideTarget, setOverrideTarget] = useState<{ betType: BetType; level: string }>({ betType: 'gagnant', level: 'main' });
  const [overrideValue, setOverrideValue] = useState<string>('');

  const selectedRace = useMemo(() => races.find((r) => r.id === raceId), [races, raceId]);

  const loadConfig = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('config')
      .select('bet_type,is_enabled,calculation_mode,payout_percentage,split_rules,jackpot_enabled,minimum_dividend,rounding_base');

    if (error) {
      setMessage(`Config load warning: ${error.message}`);
      return;
    }

    const map = new Map<string, ConfigRow>();
    (data || []).forEach((row: any) => {
      map.set(row.bet_type, {
        bet_type: row.bet_type,
        is_enabled: row.is_enabled !== false,
        calculation_mode: row.calculation_mode === 'manual' ? 'manual' : 'automatic',
        payout_percentage: Number(row.payout_percentage),
        split_rules: row.split_rules || { main: 1 },
        jackpot_enabled: Boolean(row.jackpot_enabled),
        minimum_dividend: Number(row.minimum_dividend ?? 20),
        rounding_base: Number(row.rounding_base ?? 5)
      });
    });

    setConfigRows(BET_TYPES.map((type) => map.get(type) || defaultConfigFor(type)));
  };

  const loadSales = async (currentRaceId: string) => {
    if (!supabase || !currentRaceId) return;
    const { data, error } = await supabase.from('bets').select('bet_type,stake,units').eq('race_id', currentRaceId);

    if (error) {
      setMessage(`Sales load warning: ${error.message}`);
      return;
    }

    const agg = new Map<BetType, { totalSales: number; ticketCount: number }>();
    BET_TYPES.forEach((type) => agg.set(type, { totalSales: 0, ticketCount: 0 }));

    (data || []).forEach((row: any) => {
      const betType = row.bet_type as BetType;
      if (!agg.has(betType)) return;
      const total = Number(row.stake || 0) * Number(row.units || 1);
      const item = agg.get(betType)!;
      item.totalSales += Number.isFinite(total) ? total : 0;
      item.ticketCount += 1;
    });

    const rows = BET_TYPES.map((betType) => ({
      betType,
      totalSales: agg.get(betType)?.totalSales || 0,
      ticketCount: agg.get(betType)?.ticketCount || 0
    }));

    setSalesRows(rows);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!raceId) return;
    void loadSales(raceId);
  }, [raceId]);

  const updateConfigCell = (betType: BetType, key: keyof ConfigRow, value: string | number | boolean) => {
    setConfigRows((prev) =>
      prev.map((row) => {
        if (row.bet_type !== betType) return row;
        if (key === 'split_rules') {
          try {
            const parsed = JSON.parse(String(value));
            return { ...row, split_rules: parsed };
          } catch {
            return row;
          }
        }
        return { ...row, [key]: value } as ConfigRow;
      })
    );
  };

  const applyPreset = (preset: number) => {
    setConfigRows((prev) => prev.map((row) => ({ ...row, payout_percentage: preset })));
  };

  const includeAllBets = () => {
    setConfigRows((prev) => prev.map((row) => ({ ...row, is_enabled: true })));
  };

  const disableAllBets = () => {
    setConfigRows((prev) => prev.map((row) => ({ ...row, is_enabled: false })));
  };

  const setAllMode = (mode: 'automatic' | 'manual') => {
    setConfigRows((prev) => prev.map((row) => ({ ...row, calculation_mode: mode })));
  };

  const saveConfig = async () => {
    if (!supabase) {
      setMessage('Supabase is not connected.');
      return;
    }
    setSavingConfig(true);
    setMessage('');

    const payload = configRows.map((row) => ({
      bet_type: row.bet_type,
      is_enabled: row.is_enabled,
      calculation_mode: row.calculation_mode,
      payout_percentage: Number(row.payout_percentage),
      split_rules: row.split_rules,
      jackpot_enabled: row.jackpot_enabled,
      minimum_dividend: Number(row.minimum_dividend),
      rounding_base: Number(row.rounding_base)
    }));

    const { error } = await supabase.from('config').upsert(payload, { onConflict: 'bet_type' });

    setSavingConfig(false);
    if (error) {
      setMessage(`Failed to save config: ${error.message}`);
      return;
    }
    setMessage('Config saved successfully.');
  };

  const callCalculation = async (mode: 'preview' | 'finalize') => {
    if (!raceId) {
      setMessage('Select a race first.');
      return;
    }

    const positions = parsePositions(positionsInput);
    if (positions.length < 3) {
      setMessage('Enter at least first 3 finishing positions (comma-separated).');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/.netlify/functions/calculate-pmu-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ race_id: raceId, mode, positions })
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result?.error || 'Calculation failed.');
        setLoading(false);
        return;
      }

      setPreviewRows(result.rows || []);
      setMessage(mode === 'preview' ? 'Live preview generated.' : 'Payouts finalized and saved.');
      await loadSales(raceId);
    } catch (error: any) {
      setMessage(`Calculation error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const applyManualOverride = async () => {
    if (!supabase || !raceId) {
      setMessage('Select race and ensure Supabase is connected.');
      return;
    }
    const numeric = Number(overrideValue);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setMessage('Manual dividend must be a positive number.');
      return;
    }

    const { error } = await supabase
      .from('payouts')
      .update({
        manual_dividend: numeric,
        dividend: numeric,
        is_overridden: true,
        updated_at: new Date().toISOString()
      })
      .eq('race_id', raceId)
      .eq('bet_type', overrideTarget.betType)
      .eq('level', overrideTarget.level);

    if (error) {
      setMessage(`Override failed: ${error.message}`);
      return;
    }

    setMessage('Manual override saved.');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-xl font-bold text-gray-900">PMU Pari-Mutuel Calculator</h3>
        <p className="mt-1 text-sm text-gray-600">
          Use this back-office box to compute total pool, winning units, and dividends by bet type.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="text-sm font-semibold text-gray-700">
            Race
            <select
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">Select race</option>
              {races.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.name} ({race.id})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-gray-700 md:col-span-2">
            Result Positions (example: 4,7,2,8,1)
            <input
              value={positionsInput}
              onChange={(e) => setPositionsInput(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="1,2,3,4,5"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => callCalculation('preview')}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Calculating...' : 'CALCULATE (Preview)'}
          </button>
          <button
            onClick={() => callCalculation('finalize')}
            disabled={loading}
            className="rounded-md bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
          >
            FINALIZE PAYOUTS
          </button>
          {selectedRace && (
            <span className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
              Selected: {selectedRace.name}
            </span>
          )}
        </div>

        {message && <p className="mt-3 text-sm font-medium text-gray-800">{message}</p>}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="text-lg font-bold text-gray-900">Quick Setup (Optional)</h4>
        <p className="mt-1 text-sm text-gray-600">Use this box only when you want one-click setup for all bet types.</p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            className="rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
            onClick={() => setAllMode('automatic')}
          >
            Auto All
          </button>
          <button
            className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
            onClick={() => setAllMode('manual')}
          >
            Manual All
          </button>
          <button
            className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800"
            onClick={includeAllBets}
          >
            Enable All
          </button>
          <button
            className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800"
            onClick={disableAllBets}
          >
            Disable All
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h4 className="text-lg font-bold text-gray-900">Payout Settings</h4>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => applyPreset(PRESET_75)}>Set All to 75%</button>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => applyPreset(PRESET_80)}>Set All to 80%</button>
          <button
            className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            onClick={saveConfig}
            disabled={savingConfig}
          >
            {savingConfig ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2">Bet Type</th>
                <th className="px-3 py-2">Use (On/Off)</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Payout %</th>
                <th className="px-3 py-2">Split Rules (JSON)</th>
                <th className="px-3 py-2">Jackpot</th>
                <th className="px-3 py-2">Min Dividend</th>
                <th className="px-3 py-2">Round Base</th>
              </tr>
            </thead>
            <tbody>
              {configRows.map((row) => (
                <tr key={row.bet_type} className="border-t">
                  <td className="px-3 py-2 font-semibold uppercase">{row.bet_type}</td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.is_enabled}
                      onChange={(e) => updateConfigCell(row.bet_type, 'is_enabled', e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.calculation_mode}
                      onChange={(e) => updateConfigCell(row.bet_type, 'calculation_mode', e.target.value as 'automatic' | 'manual')}
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={row.payout_percentage}
                      onChange={(e) => updateConfigCell(row.bet_type, 'payout_percentage', Number(e.target.value))}
                      className="w-24 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={JSON.stringify(row.split_rules)}
                      onChange={(e) => updateConfigCell(row.bet_type, 'split_rules', e.target.value)}
                      className="w-full min-w-64 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.jackpot_enabled}
                      onChange={(e) => updateConfigCell(row.bet_type, 'jackpot_enabled', e.target.checked)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      value={row.minimum_dividend}
                      onChange={(e) => updateConfigCell(row.bet_type, 'minimum_dividend', Number(e.target.value))}
                      className="w-24 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      value={row.rounding_base}
                      onChange={(e) => updateConfigCell(row.bet_type, 'rounding_base', Number(e.target.value))}
                      className="w-24 rounded border border-gray-300 px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="text-lg font-bold text-gray-900">Total Sales by Bet Type</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2">Bet Type</th>
                <th className="px-3 py-2">Ticket Count</th>
                <th className="px-3 py-2">Total Sales</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((row) => (
                <tr key={row.betType} className="border-t">
                  <td className="px-3 py-2 uppercase">{row.betType}</td>
                  <td className="px-3 py-2">{row.ticketCount}</td>
                  <td className="px-3 py-2">{formatMoney(row.totalSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="text-lg font-bold text-gray-900">Payout Results</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2">Bet Type</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Pool</th>
                <th className="px-3 py-2">Winners (Units)</th>
                <th className="px-3 py-2">Dividend</th>
                <th className="px-3 py-2">Carry In</th>
                <th className="px-3 py-2">Carry Out</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${row.bet_type}-${row.level}-${index}`} className="border-t">
                  <td className="px-3 py-2 uppercase">{row.bet_type}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">{formatMoney(row.pool)}</td>
                  <td className="px-3 py-2">{row.winners}</td>
                  <td className="px-3 py-2 font-semibold">{formatMoney(row.dividend)}</td>
                  <td className="px-3 py-2">{formatMoney(row.carry_in)}</td>
                  <td className="px-3 py-2">{formatMoney(row.carry_out)}</td>
                </tr>
              ))}
              {previewRows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-gray-500" colSpan={7}>
                    No preview yet. Click CALCULATE.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="text-lg font-bold text-gray-900">Manual Override</h4>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={overrideTarget.betType}
            onChange={(e) => setOverrideTarget((prev) => ({ ...prev, betType: e.target.value as BetType }))}
            className="rounded border border-gray-300 px-3 py-2"
          >
            {BET_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <input
            value={overrideTarget.level}
            onChange={(e) => setOverrideTarget((prev) => ({ ...prev, level: e.target.value }))}
            className="rounded border border-gray-300 px-3 py-2"
            placeholder="Level (order/disorder/bonus3/main...)"
          />
          <input
            type="number"
            min="1"
            value={overrideValue}
            onChange={(e) => setOverrideValue(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
            placeholder="Dividend value"
          />
          <button className="rounded bg-amber-600 px-4 py-2 text-white font-semibold hover:bg-amber-700" onClick={applyManualOverride}>
            Apply Override
          </button>
        </div>
      </div>
    </div>
  );
};
