import type { Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { adminDb } from '../admin';
import {
  buildConfig,
  calculateRows,
  getCarryMap,
  type Bet,
  type CarryRow,
} from '../pmu-calculate';

interface PayoutBody {
  raceId?: string;
  /**
   * Final finishing order — an array of horse numbers, position 0 = winner.
   * If omitted we read it from race_results/{raceId}.
   */
  positions?: number[];
  /**
   * Set to true to persist the resulting rows into the `payouts` collection and
   * update `jackpot_carry` for any unclaimed pools.
   */
  commit?: boolean;
}

/**
 * POST /api/calculate-pmu-payouts
 *
 * Pulls bets, payout config, and carry-over jackpots for the race, runs the
 * pari-mutuel math from `lib/pmu/calculate.ts` (copied into the functions
 * workspace), and returns the dividends per bet-type / level. Optionally
 * persists the results.
 */
export async function calculatePmuPayoutsHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as PayoutBody;
  if (!body.raceId) {
    res.status(400).json({ error: 'raceId is required' });
    return;
  }

  try {
    // 1. positions
    let positions = Array.isArray(body.positions)
      ? body.positions.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : null;
    if (!positions || positions.length === 0) {
      const resultSnap = await adminDb.collection('race_results').doc(body.raceId).get();
      if (!resultSnap.exists) {
        res.status(404).json({ error: 'No race_results row for raceId; pass positions explicitly or finalise the race first' });
        return;
      }
      const data = resultSnap.data() as { positions?: number[] };
      positions = Array.isArray(data.positions) ? data.positions.map((x) => Number(x)) : [];
    }
    if (!positions || positions.length === 0) {
      res.status(400).json({ error: 'positions could not be resolved' });
      return;
    }

    // 2. bets
    const betsSnap = await adminDb.collection('tickets').where('race_id', '==', body.raceId).get();
    const bets: Bet[] = [];
    betsSnap.forEach((doc) => {
      const d = doc.data() as { bet_type?: string; selection?: number[]; stake?: number; units?: number };
      bets.push({
        id: doc.id,
        bet_type: String(d.bet_type || ''),
        selection: Array.isArray(d.selection) ? d.selection.map((x) => Number(x)) : [],
        stake: Number(d.stake || 0),
        units: Number(d.units || 1),
      });
    });

    // 3. config
    const configSnap = await adminDb.collection('payout_config').get();
    const configRows: Array<Partial<{ bet_type: string }>> = [];
    configSnap.forEach((doc) => {
      const d = doc.data() as Record<string, unknown>;
      configRows.push({ ...(d as object) });
    });
    const config = buildConfig(configRows as never);

    // 4. carry-over
    const carrySnap = await adminDb.collection('jackpot_carry').get();
    const carryRows: CarryRow[] = [];
    carrySnap.forEach((doc) => {
      const d = doc.data() as { bet_type?: string; level?: string; amount?: number };
      carryRows.push({
        id: doc.id,
        bet_type: String(d.bet_type || ''),
        level: String(d.level || 'main'),
        amount: Number(d.amount || 0),
      });
    });
    const carryMap = getCarryMap(carryRows);

    // 5. compute
    const rows = calculateRows({ raceId: body.raceId, bets, positions, config, carryMap });

    // 6. optionally persist
    if (body.commit) {
      const batch = adminDb.batch();
      for (const row of rows) {
        const id = `${body.raceId}_${row.bet_type}_${row.level}`;
        batch.set(adminDb.collection('payouts').doc(id), {
          ...row,
          calculated_at: new Date().toISOString(),
        });
        const carryKey = `${row.bet_type}:${row.level}`;
        if (row.carry_out > 0) {
          batch.set(adminDb.collection('jackpot_carry').doc(carryKey), {
            bet_type: row.bet_type,
            level: row.level,
            amount: row.carry_out,
            updated_at: new Date().toISOString(),
          });
        } else {
          batch.delete(adminDb.collection('jackpot_carry').doc(carryKey));
        }
      }
      await batch.commit();
    }

    res.json({ ok: true, raceId: body.raceId, rows });
  } catch (err) {
    logger.error('calculate-pmu-payouts failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
