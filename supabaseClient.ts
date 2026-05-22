
import { createClient } from '@supabase/supabase-js';
import {
    Ticket,
    User,
    Race,
    RaceResult,
    Promotion,
    ChatThread,
    ChatMessage,
    PaymentIntegrationConfig,
    OTPConfig,
    ProgramImage,
    ManualBetOrder,
    BetSelection,
    WithdrawalRequest,
    DepositLog
} from './types';
import { BETTING_CUTOFF_MS, calculateTicketWinnings, validateTicketForPlacement, validateTicketAgainstRaceState, normalizeGambiaPhone } from './utils';

// Safely retrieve environment variables
const getEnvVar = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) { }
  return undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 10 } },
      auth: { persistSession: true }
    }) 
  : null;

export const checkBackendConnection = async () => {
    if (!supabase) return false;
    try {
        const { error } = await supabase.from('users').select('count', { count: 'exact', head: true }).limit(1);
        if (!error) return true;

        // Some environments/proxies intermittently reject HEAD probes. Fallback to a tiny GET probe.
        const { error: fallbackError } = await supabase.from('users').select('id').limit(1);
        return !fallbackError;
    } catch (e) {
        try {
            const { error: fallbackError } = await supabase.from('users').select('id').limit(1);
            return !fallbackError;
        } catch {
            return false;
        }
    }
};

const isMissingRaceMetadataColumnError = (error: any): boolean => {
    if (!error) return false;
    const code = String(error.code || '');
    const message = String(error.message || '').toLowerCase();
    const details = String(error.details || '').toLowerCase();
    const hint = String(error.hint || '').toLowerCase();
    const combined = `${message} ${details} ${hint}`;

    const mentionsColumn = combined.includes('race_code') || combined.includes('venue') || combined.includes('updated_by_id') || combined.includes('updated_by_name');
    const mentionsSchemaCache = combined.includes('schema cache');

    return code === 'PGRST204' || (mentionsColumn && mentionsSchemaCache) || mentionsColumn;
};

const isMissingBonusTrackingColumnError = (error: any): boolean => {
    if (!error) return false;
    const code = String(error.code || '');
    const combined = `${String(error.message || '')} ${String(error.details || '')} ${String(error.hint || '')}`.toLowerCase();
    return code === 'PGRST204'
        || combined.includes('total_deposited_amount')
        || combined.includes('first_deposit_at');
};

const isMissingTicketChannelColumnError = (error: any): boolean => {
    if (!error) return false;
    const code = String(error.code || '');
    const combined = `${String(error.message || '')} ${String(error.details || '')} ${String(error.hint || '')}`.toLowerCase();
    return code === 'PGRST204' || combined.includes('transaction_channel');
};

const isMissingPaymentConfigColumnError = (error: any): boolean => {
    if (!error) return false;
    const code = String(error.code || '');
    const combined = `${String(error.message || '')} ${String(error.details || '')} ${String(error.hint || '')}`.toLowerCase();
    return code === 'PGRST204'
        || combined.includes('payment_configs')
        || combined.includes('environment')
        || combined.includes('signature_secret')
        || combined.includes('base_url')
        || combined.includes('webhook_secret')
        || combined.includes('callback_auth_token')
        || combined.includes('request_timeout_ms');
};

const isMissingCorrectionPinColumnError = (error: any): boolean => {
    if (!error) return false;
    const code = String(error.code || '');
    const combined = `${String(error.message || '')} ${String(error.details || '')} ${String(error.hint || '')}`.toLowerCase();
    return code === 'PGRST204' || combined.includes('correction_pin');
};

const isMissingDepositLogsTableError = (error: any): boolean => {
    if (!error) return false;
    const code = String(error.code || '');
    const combined = `${String(error.message || '')} ${String(error.details || '')} ${String(error.hint || '')}`.toLowerCase();
    return code === 'PGRST204'
        || combined.includes('deposit_logs')
        || combined.includes('relation "deposit_logs" does not exist');
};

/**
 * RACE MANAGEMENT OPERATIONS
 */

export const dbSaveRace = async (race: Race) => {
    if (!supabase) throw new Error("Database not connected");
    const payloadWithMetadata = {
        id: race.id,
        race_code: race.raceCode || null,
        name: race.name,
        venue: race.venue || null,
        start_date: race.startDate.toISOString(),
        end_date: race.endDate.toISOString(),
        horse_count: race.horseCount,
        non_runners: race.nonRunners || [],
        jackpot: race.jackpot || 0,
        updated_by_id: race.updatedById || null,
        updated_by_name: race.updatedByName || null,
        updated_at: race.updatedAt ? race.updatedAt.toISOString() : new Date().toISOString()
    };

    const { error } = await supabase.from('races').insert(payloadWithMetadata);
    if (!error) return;

    const missingMetadataColumn = isMissingRaceMetadataColumnError(error);
    if (!missingMetadataColumn) throw error;

    const { error: fallbackError } = await supabase.from('races').insert({
        id: race.id,
        name: race.name,
        start_date: race.startDate.toISOString(),
        end_date: race.endDate.toISOString(),
        horse_count: race.horseCount,
        non_runners: race.nonRunners || [],
        jackpot: race.jackpot || 0
    });
    if (fallbackError) throw fallbackError;
};

export const dbUpdateRace = async (race: Race) => {
    if (!supabase) throw new Error("Database not connected");
    const payloadWithMetadata = {
        race_code: race.raceCode || null,
        name: race.name,
        venue: race.venue || null,
        start_date: race.startDate.toISOString(),
        end_date: race.endDate.toISOString(),
        horse_count: race.horseCount,
        jackpot: race.jackpot || 0,
        updated_by_id: race.updatedById || null,
        updated_by_name: race.updatedByName || null,
        updated_at: race.updatedAt ? race.updatedAt.toISOString() : new Date().toISOString()
    };

    const { error } = await supabase.from('races').update(payloadWithMetadata).eq('id', race.id);
    if (!error) return;

    const missingMetadataColumn = isMissingRaceMetadataColumnError(error);
    if (!missingMetadataColumn) throw error;

    const { error: fallbackError } = await supabase.from('races').update({
        name: race.name,
        start_date: race.startDate.toISOString(),
        end_date: race.endDate.toISOString(),
        horse_count: race.horseCount,
        jackpot: race.jackpot || 0
    }).eq('id', race.id);
    if (fallbackError) throw fallbackError;
};

export const dbDeleteRace = async (raceId: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('races').delete().eq('id', raceId);
    if (error) throw error;
};

export const dbUpdateNonRunners = async (raceId: string, nonRunners: number[]) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('races').update({
        non_runners: nonRunners
    }).eq('id', raceId);
    if (error) throw error;
};

export const dbSaveRaceResult = async (result: RaceResult) => {
    if (!supabase) throw new Error("Database not connected");
    
    // Optimized: Use rpc call for faster JSONB update with audit fields
    const { error } = await supabase
        .from('races')
        .update({
            result: result,
            updated_at: new Date().toISOString()
        }, { count: 'none' })  // count: 'none' avoids unnecessary row counting
        .eq('id', result.raceId);
    
    if (error) throw error;
};

const mapDbTicketRow = (t: any): Ticket => ({
    id: t.id,
    timestamp: new Date(t.timestamp),
    vendorId: t.vendor_id || '',
    vendorName: t.vendor_name,
    transactionChannel: t.transaction_channel || (t.customer_id ? 'Online' : 'Terminal'),
    status: t.status,
    customerId: t.customer_id,
    bookingCode: t.booking_code,
    selections: Array.isArray(t.selections) ? t.selections : [],
    totalCost: Number(t.total_cost || 0),
    winnings: Number(t.winnings || 0) || undefined,
    winningsBreakdown: t.winnings_breakdown || undefined,
    paidAt: t.paid_at ? new Date(t.paid_at) : undefined,
    paidById: t.paid_by_id || undefined,
    paidByName: t.paid_by_name || undefined,
    canceledAt: t.canceled_at ? new Date(t.canceled_at) : undefined,
    canceledById: t.canceled_by_id || undefined,
    canceledByName: t.canceled_by_name || undefined
});

const getTicketFunding = (ticket: Pick<Ticket, 'selections' | 'totalCost'>) => {
    const metadata = Array.isArray(ticket.selections) && ticket.selections.length > 0 ? ticket.selections[0] : null;
    const bonusStake = Number(metadata?.bonusStakeAmount || 0);
    const cashStake = Number(metadata?.cashStakeAmount ?? Math.max(0, Number(ticket.totalCost || 0) - bonusStake));
    const fundingSource = metadata?.fundingSource || (bonusStake > 0 ? (cashStake > 0 ? 'mixed' : 'bonus') : 'cash');
    return {
        bonusStake: Number(bonusStake.toFixed(2)),
        cashStake: Number(cashStake.toFixed(2)),
        fundingSource
    } as const;
};

const addFundingMetadataToSelections = (ticket: Ticket, walletBalance: number, bonusBalance: number): Ticket => {
    const totalCost = Number(ticket.totalCost || 0);
    const bonusStake = Number(Math.min(totalCost, Math.max(0, bonusBalance)).toFixed(2));
    const cashStake = Number((totalCost - bonusStake).toFixed(2));
    const fundingSource: 'cash' | 'bonus' | 'mixed' = bonusStake <= 0 ? 'cash' : cashStake > 0 ? 'mixed' : 'bonus';

    return {
        ...ticket,
        selections: ticket.selections.map((selection, index) => index === 0
            ? {
                ...selection,
                fundingSource,
                bonusStakeAmount: bonusStake,
                cashStakeAmount: cashStake,
            }
            : selection)
    };
};

const evaluateBonusUnlockProgress = (tickets: Ticket[]) => {
    const eligibleTickets = tickets.filter(ticket => {
        if (ticket.status === 'Canceled' || ticket.status === 'Booked') return false;
        return getTicketFunding(ticket).bonusStake > 0;
    });

    const distinctRaceIds = new Set<string>();
    const raceDayMap = new Map<string, Set<string>>();

    eligibleTickets.forEach(ticket => {
        const ticketDay = ticket.timestamp.toISOString().slice(0, 10);
        const uniqueRaceIds = Array.from(new Set(ticket.selections.map(selection => selection.raceId)));
        uniqueRaceIds.forEach(raceId => {
            distinctRaceIds.add(raceId);
            if (!raceDayMap.has(raceId)) raceDayMap.set(raceId, new Set<string>());
            raceDayMap.get(raceId)!.add(ticketDay);
        });
    });

    const sameRaceBestCount = Math.max(0, ...Array.from(raceDayMap.values()).map(days => days.size));
    return {
        distinctRaceCount: distinctRaceIds.size,
        sameRaceBestCount,
        qualified: distinctRaceIds.size >= 3 || sameRaceBestCount >= 3,
    };
};

const maybeUnlockCustomerBonusBalance = async (customerId: string) => {
    if (!supabase) return;

    const [{ data: userRow, error: userError }, { data: ticketRows, error: ticketError }] = await Promise.all([
        supabase.from('users').select('wallet_balance, bonus_balance').eq('id', customerId).single(),
        supabase.from('tickets').select('*').eq('customer_id', customerId).neq('status', 'Canceled')
    ]);

    if (userError) throw userError;
    if (ticketError) throw ticketError;

    const bonusBalance = Number(userRow?.bonus_balance || 0);
    if (bonusBalance <= 0) return;

    const progress = evaluateBonusUnlockProgress((ticketRows || []).map(mapDbTicketRow));
    if (!progress.qualified) return;

    const nextWallet = Number((Number(userRow?.wallet_balance || 0) + bonusBalance).toFixed(2));
    const { error: unlockError } = await supabase
        .from('users')
        .update({ wallet_balance: nextWallet, bonus_balance: 0 })
        .eq('id', customerId);

    if (unlockError) throw unlockError;
};

export const dbFetchUserBalance = async (userId: string) => {
    if (!supabase) throw new Error("Supabase not connected");

    const { data, error } = await supabase
        .from('users')
        .select('wallet_balance, bonus_balance')
        .eq('id', userId)
        .single();

    if (error) throw new Error(error.message);

    const walletBalance = Number(data?.wallet_balance || 0);
    const bonusBalance = Number(data?.bonus_balance || 0);

    return {
        walletBalance,
        bonusBalance,
        totalAvailable: Number((walletBalance + bonusBalance).toFixed(2))
    };
};

export const dbSettleRaceTickets = async (result: RaceResult, allRaces: Race[]) => {
    if (!supabase) throw new Error("Database not connected");

    const updatedRaces = allRaces.map((race) => (race.id === result.raceId ? { ...race, result } : race));

    // Only fetch tickets that belong to races affected (not ALL tickets in the system)
    // For a normal result save, filter to this race's tickets plus any multi-race bet tickets
    const { data: ticketRows, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .in('status', ['Active', 'Winning', 'Paid', 'Lost'])
        .contains('selections', [{ raceId: result.raceId }]);

    // If the contains filter fails (e.g. old schema), fall back to all tickets for this race
    let relevantTicketRows = ticketRows;
    if (ticketError || !ticketRows) {
        const { data: fallbackRows, error: fallbackError } = await supabase
            .from('tickets')
            .select('*')
            .in('status', ['Active', 'Winning', 'Paid', 'Lost']);
        if (fallbackError) throw fallbackError;
        relevantTicketRows = fallbackRows;
    }

    // Re-settle all non-booked/non-canceled tickets to correct stale outcomes
    const relevantTickets = (relevantTicketRows || []).map(mapDbTicketRow);

    if (relevantTickets.length === 0) return;

    const customerIds = Array.from(new Set(relevantTickets.map((ticket) => ticket.customerId).filter(Boolean))) as string[];
    const walletBalanceMap = new Map<string, number>();
    const bonusBalanceMap = new Map<string, number>();

    if (customerIds.length > 0) {
        const { data: userRows, error: userError } = await supabase
            .from('users')
            .select('id,wallet_balance,bonus_balance')
            .in('id', customerIds);
        if (userError) throw userError;
        (userRows || []).forEach((row: any) => {
            walletBalanceMap.set(row.id, Number(row.wallet_balance || 0));
            bonusBalanceMap.set(row.id, Number(row.bonus_balance || 0));
        });
    }

    // Build all ticket update payloads in memory — NO per-ticket DB calls
    const ticketUpdates: any[] = [];

    for (const ticket of relevantTickets) {
        const evaluation = calculateTicketWinnings(ticket, updatedRaces);
        const allSelectionsResolved = ticket.selections.every((selection) => {
            const race = updatedRaces.find((item) => item.id === selection.raceId);
            return Boolean(race?.result?.winningNumbers?.length);
        });

        const nextWinnings = Number(evaluation.totalWinnings.toFixed(2));
        const previousWinnings = Number(ticket.winnings || 0);
        const isOnlineCustomer = Boolean(ticket.customerId);
        const wasPaidOnline = isOnlineCustomer && ticket.status === 'Paid';
        const funding = getTicketFunding(ticket);
        const creditsBonusWallet = isOnlineCustomer && funding.bonusStake > 0;

        let nextStatus = ticket.status;
        let paidAt = ticket.paidAt;
        let paidById = ticket.paidById;
        let paidByName = ticket.paidByName;
        let settledWinnings = nextWinnings;

        if (allSelectionsResolved) {
            if (nextWinnings > 0) {
                if (isOnlineCustomer) {
                    nextStatus = 'Paid';
                    paidAt = paidAt || new Date();
                    paidById = paidById || 'SYSTEM';
                    paidByName = paidByName || (creditsBonusWallet ? 'System Bonus Credit' : 'System Auto Credit');
                } else {
                    nextStatus = ticket.status === 'Paid' ? 'Paid' : 'Winning';
                }
            } else {
                nextStatus = 'Lost';
                paidAt = undefined;
                paidById = undefined;
                paidByName = undefined;
            }
        }

        // Business-safe rule: never claw back already-paid online winnings.
        if (wasPaidOnline && (nextStatus !== 'Paid' || settledWinnings < previousWinnings)) {
            nextStatus = 'Paid';
            settledWinnings = previousWinnings;
            paidAt = paidAt || new Date();
            paidById = paidById || 'SYSTEM';
            paidByName = paidByName || (creditsBonusWallet ? 'System Bonus Credit' : 'System Auto Credit');
        }

        if (isOnlineCustomer) {
            const previousCredited = ticket.status === 'Paid' ? previousWinnings : 0;
            const nextCredited = nextStatus === 'Paid' ? settledWinnings : 0;
            const delta = Number((nextCredited - previousCredited).toFixed(2));
            if (delta !== 0 && ticket.customerId) {
                if (creditsBonusWallet) {
                    const currentBonus = Number(bonusBalanceMap.get(ticket.customerId) || 0);
                    bonusBalanceMap.set(ticket.customerId, Number((currentBonus + delta).toFixed(2)));
                } else {
                    const currentBalance = Number(walletBalanceMap.get(ticket.customerId) || 0);
                    walletBalanceMap.set(ticket.customerId, Number((currentBalance + delta).toFixed(2)));
                }
            }
        }

        ticketUpdates.push({
            id: ticket.id,
            status: nextStatus,
            winnings: settledWinnings || null,
            winnings_breakdown: evaluation.breakdown,
            paid_at: paidAt ? paidAt.toISOString() : null,
            paid_by_id: paidById || null,
            paid_by_name: paidByName || null
        });
    }

    // Single batched upsert for ALL ticket updates — replaces N individual update calls
    const BATCH_SIZE = 100;
    for (let i = 0; i < ticketUpdates.length; i += BATCH_SIZE) {
        const batch = ticketUpdates.slice(i, i + BATCH_SIZE);
        const { error: batchError } = await supabase
            .from('tickets')
            .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
        if (batchError) throw batchError;
    }

    // Batch wallet updates for all affected customers
    if (customerIds.length > 0) {
        const walletUpdates = customerIds.map(customerId => ({
            id: customerId,
            wallet_balance: Number(walletBalanceMap.get(customerId) || 0),
            bonus_balance: Number(bonusBalanceMap.get(customerId) || 0),
        }));
        const { error: walletBatchError } = await supabase
            .from('users')
            .upsert(walletUpdates, { onConflict: 'id', ignoreDuplicates: false });
        if (walletBatchError) throw walletBatchError;

        // Unlock bonus balances per customer (still sequential but rare/fast)
        for (const customerId of customerIds) {
            await maybeUnlockCustomerBonusBalance(customerId);
        }
    }
};

export const dbRecalculateAllTicketsSafely = async () => {
    if (!supabase) throw new Error("Database not connected");

    const { data: raceRows, error: raceError } = await supabase.from('races').select('*');
    if (raceError) throw raceError;

    const allRaces: Race[] = (raceRows || []).map((r: any) => {
        const result: RaceResult | undefined = r.result ? {
            ...r.result,
            enteredAt: r.result.enteredAt ? new Date(r.result.enteredAt) : undefined,
            lastEditedAt: r.result.lastEditedAt ? new Date(r.result.lastEditedAt) : undefined,
        } : undefined;
        return {
            id: r.id,
            raceCode: r.race_code || undefined,
            name: r.name,
            venue: r.venue || undefined,
            startDate: new Date(r.start_date),
            endDate: new Date(r.end_date),
            horseCount: r.horse_count,
            nonRunners: r.non_runners || [],
            result,
            disabledBetTypes: r.disabled_bet_types || [],
            jackpot: r.jackpot || 0
        };
    });

    // Dummy result id keeps races unchanged while triggering full settlement pass.
    const noopResult: RaceResult = {
        raceId: '__RECALC_ALL__',
        winningNumbers: [],
        payouts: {}
    };

    await dbSettleRaceTickets(noopResult, allRaces);
    return { success: true };
};

/**
 * BETTING OPERATIONS
 */

export const dbPlaceBet = async (ticket: Ticket, user: User) => {
    if (!supabase) throw new Error("Supabase not connected");

    const placementValidation = validateTicketForPlacement({ selections: ticket.selections, totalCost: ticket.totalCost });
    if (!placementValidation.valid) {
        throw new Error(`Invalid ticket formula: ${placementValidation.message}`);
    }

    const raceIds = Array.from(new Set((ticket.selections || []).map(sel => sel.raceId).filter(Boolean)));
    const { data: raceRows, error: raceFetchError } = await supabase
        .from('races')
        .select('id, name, horse_count, non_runners, disabled_bet_types')
        .in('id', raceIds);
    if (raceFetchError) throw new Error(`Race validation failed: ${raceFetchError.message}`);

    const raceStateValidation = validateTicketAgainstRaceState(
        ticket.selections,
        (raceRows || []).map((row: any) => ({
            id: row.id,
            name: row.name,
            horseCount: Number(row.horse_count || 0),
            nonRunners: Array.isArray(row.non_runners) ? row.non_runners : [],
            disabledBetTypes: Array.isArray(row.disabled_bet_types) ? row.disabled_bet_types : []
        }))
    );
    if (!raceStateValidation.valid) {
        throw new Error(`Selection blocked: ${raceStateValidation.message}`);
    }

    const isOnlineCustomer = user.role === 'Customer';
    const shouldChargeWallet = isOnlineCustomer && ticket.status !== 'Booked';
    let ticketToInsert = ticket;
    if (shouldChargeWallet) {
        const { data: userRow, error: walletFetchError } = await supabase
            .from('users')
            .select('wallet_balance, bonus_balance')
            .eq('id', user.id)
            .single();

        if (walletFetchError) throw new Error(walletFetchError.message);

        const currentBalance = Number(userRow?.wallet_balance || 0);
        const currentBonusBalance = Number(userRow?.bonus_balance || 0);
        const betCost = Number(ticket.totalCost || 0);
        if ((currentBalance + currentBonusBalance) < betCost) {
            throw new Error(`Insufficient wallet and bonus balance. Available GMD ${(currentBalance + currentBonusBalance).toFixed(2)} (cash ${currentBalance.toFixed(2)}, bonus ${currentBonusBalance.toFixed(2)}), required GMD ${betCost.toFixed(2)}.`);
        }

        ticketToInsert = addFundingMetadataToSelections(ticket, currentBalance, currentBonusBalance);
        const funding = getTicketFunding(ticketToInsert);
        const nextBalance = Number((currentBalance - funding.cashStake).toFixed(2));
        const nextBonusBalance = Number((currentBonusBalance - funding.bonusStake).toFixed(2));
        const { error: walletUpdateError } = await supabase
            .from('users')
            .update({ wallet_balance: nextBalance, bonus_balance: nextBonusBalance })
            .eq('id', user.id);

        if (walletUpdateError) throw new Error(walletUpdateError.message);
    }

    const ticketInsertPayload = {
        id: ticketToInsert.id,
        timestamp: ticketToInsert.timestamp.toISOString(),
        vendor_id: isOnlineCustomer ? null : ticketToInsert.vendorId || user.id,
        vendor_name: ticketToInsert.vendorName || user.name,
        transaction_channel: isOnlineCustomer ? 'Online' : 'Terminal',
        customer_id: isOnlineCustomer ? user.id : ticket.customerId || null,
        status: ticketToInsert.status,
        booking_code: ticketToInsert.bookingCode || null,
        selections: ticketToInsert.selections,
        total_cost: ticketToInsert.totalCost,
        winnings: ticketToInsert.winnings || null,
        winnings_breakdown: ticketToInsert.winningsBreakdown || null,
        paid_at: ticketToInsert.paidAt ? ticketToInsert.paidAt.toISOString() : null,
        paid_by_id: ticketToInsert.paidById || null,
        paid_by_name: ticketToInsert.paidByName || null,
        canceled_at: ticketToInsert.canceledAt ? ticketToInsert.canceledAt.toISOString() : null,
        canceled_by_id: ticketToInsert.canceledById || null,
        canceled_by_name: ticketToInsert.canceledByName || null
    };

    const { error: insertError } = await supabase.from('tickets').insert(ticketInsertPayload);
    if (insertError) {
        if (!isMissingTicketChannelColumnError(insertError)) throw new Error(insertError.message);
        const fallbackPayload = { ...ticketInsertPayload } as any;
        delete fallbackPayload.transaction_channel;
        const { error: fallbackInsertError } = await supabase.from('tickets').insert(fallbackPayload);
        if (fallbackInsertError) throw new Error(fallbackInsertError.message);
    }

    if (isOnlineCustomer) {
        await maybeUnlockCustomerBonusBalance(user.id);
    }

    return { success: true };
};

export const dbPayoutTicket = async (ticketId: string, amount: number, staffId: string, staffName: string) => {
    if (!supabase) throw new Error("Supabase not connected");
    const { data, error } = await supabase.rpc('payout_ticket_transaction', {
        p_ticket_id: ticketId,
        p_payout_amount: amount,
        p_paid_by_id: staffId,
        p_paid_by_name: staffName
    });
    if (error) throw new Error(error.message);
    return data;
}

/**
 * FETCHING OPERATIONS
 */

export const dbFetchUsers = async (): Promise<User[]> => {
    if(!supabase) return [];
    const { data, error } = await supabase.from('users').select('*');
    if(error) return [];
    return data.map((u: any) => ({
        id: u.id, name: u.name, role: u.role, isLocked: u.is_locked, phone: u.phone,
        password: u.password, correctionPin: u.correction_pin || undefined, walletBalance: u.wallet_balance, bonusBalance: u.bonus_balance,
        totalDepositedAmount: Number(u.total_deposited_amount || 0),
        firstDepositAt: u.first_deposit_at ? new Date(u.first_deposit_at) : undefined,
        createdById: u.created_by_id, createdByName: u.created_by_name
    }));
};

// Direct single-user lookup — used as login fallback when the pre-loaded users array is empty.
export const dbFindUser = async (usernameOrPhone: string): Promise<User | null> => {
    if (!supabase) return null;
    try {
        const raw = String(usernameOrPhone || '').trim();
        if (!raw) return null;
        const normalizedPhone = normalizeGambiaPhone(raw);
        let orFilter = `name.ilike.${raw},id.ilike.${raw}`;
        if (normalizedPhone) orFilter += `,phone.eq.${normalizedPhone},id.eq.${normalizedPhone}`;
        const { data, error } = await supabase.from('users').select('*').or(orFilter).limit(5);
        if (error) {
            // Log so RLS/permission failures are visible during diagnosis.
            console.warn('[dbFindUser] users query failed — likely RLS/permission. The server-side login fallback should still succeed if SUPABASE_SERVICE_ROLE_KEY is set in Netlify.', error);
            return null;
        }
        if (!data || data.length === 0) return null;
        const u = data[0];
        return {
            id: u.id, name: u.name, role: u.role, isLocked: u.is_locked, phone: u.phone,
            password: u.password, correctionPin: u.correction_pin || undefined,
            walletBalance: u.wallet_balance, bonusBalance: u.bonus_balance,
            totalDepositedAmount: Number(u.total_deposited_amount || 0),
            firstDepositAt: u.first_deposit_at ? new Date(u.first_deposit_at) : undefined,
            createdById: u.created_by_id, createdByName: u.created_by_name
        };
    } catch (err) {
        console.warn('[dbFindUser] unexpected error:', err);
        return null;
    }
};

// Server-side login via Netlify function — bypasses client-side RLS/grant issues.
// Returns the matched User, null for wrong credentials, or throws for server/DB errors.
export const dbAuthenticateViaFunction = async (username: string, password: string): Promise<User | null> => {
    const res = await fetch('/.netlify/functions/authenticate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        // 403 = DB permission denied; 503 = not configured. Throw so caller can show specific error.
        throw new Error(json.error || `Auth service error (${res.status})`);
    }
    if (!json.user) return null;
    const u = json.user;
    return {
        id: u.id, name: u.name, role: u.role, isLocked: u.is_locked, phone: u.phone,
        password: u.password, correctionPin: u.correction_pin || undefined,
        walletBalance: u.wallet_balance, bonusBalance: u.bonus_balance,
        totalDepositedAmount: Number(u.total_deposited_amount || 0),
        firstDepositAt: u.first_deposit_at ? new Date(u.first_deposit_at) : undefined,
        createdById: u.created_by_id, createdByName: u.created_by_name
    };
};

export const dbFetchRaces = async (): Promise<Race[]> => {
    if(!supabase) return [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { data, error } = await supabase.from('races').select('*').gte('end_date', oneWeekAgo.toISOString());
    if(error) return [];
    return data.map((r: any) => ({
        id: r.id,
        raceCode: r.race_code || undefined,
        name: r.name,
        venue: r.venue || undefined,
        startDate: new Date(r.start_date),
        endDate: new Date(r.end_date),
        horseCount: r.horse_count, nonRunners: r.non_runners || [],
        result: r.result ? {
            ...r.result,
            enteredAt: r.result.enteredAt ? new Date(r.result.enteredAt) : undefined,
            lastEditedAt: r.result.lastEditedAt ? new Date(r.result.lastEditedAt) : undefined,
        } : undefined,
        disabledBetTypes: r.disabled_bet_types || [], jackpot: r.jackpot,
        updatedById: r.updated_by_id || undefined,
        updatedByName: r.updated_by_name || undefined,
        updatedAt: r.updated_at ? new Date(r.updated_at) : undefined
    }));
};

export const dbFetchLiveTickets = async (user: User): Promise<Ticket[]> => {
    if(!supabase) return [];
    let allData: any[] = [];

    if (user.role === 'Vendor') {
        // Vendors must see all booked tickets so they can retrieve by booking code.
        const [vendorActiveRes, bookedRes, historyRes] = await Promise.all([
            supabase.from('tickets').select('*').in('status', ['Active', 'Winning']).eq('vendor_id', user.id),
            supabase.from('tickets').select('*').eq('status', 'Booked'),
            supabase.from('tickets').select('*').in('status', ['Paid', 'Lost', 'Canceled']).eq('vendor_id', user.id).order('timestamp', { ascending: false }).limit(100)
        ]);
        allData = [...(vendorActiveRes.data || []), ...(bookedRes.data || []), ...(historyRes.data || [])];
    } else {
        let activeQuery = supabase.from('tickets').select('*').in('status', ['Active', 'Booked', 'Winning']);
        let historyQuery = supabase.from('tickets').select('*').in('status', ['Paid', 'Lost', 'Canceled']).order('timestamp', { ascending: false }).limit(100);
        if (user.role === 'Customer') {
            activeQuery = activeQuery.eq('customer_id', user.id);
            historyQuery = historyQuery.eq('customer_id', user.id);
        }
        const [activeRes, historyRes] = await Promise.all([activeQuery, historyQuery]);
        allData = [...(activeRes.data || []), ...(historyRes.data || [])];
    }

    const deduped = Array.from(new Map(allData.map((row) => [row.id, row])).values());
    return deduped.map(mapDbTicketRow);
};

/**
 * USER MANAGEMENT
 */

export const dbAddUser = async (user: User) => {
    if (!supabase) throw new Error("Database not connected");

    const normalizedCustomerPhone = user.role === 'Customer'
        ? normalizeGambiaPhone(user.phone || '')
        : null;

    if (user.role === 'Customer' && !normalizedCustomerPhone) {
        throw new Error('Customer phone must be valid: Gambia local 7 digits or +220XXXXXXX; Senegal must be +221XXXXXXXXX only.');
    }

    if (normalizedCustomerPhone) {
        const { data: existingRows, error: duplicateCheckError } = await supabase
            .from('users')
            .select('id')
            .eq('phone', normalizedCustomerPhone)
            .limit(1);

        if (duplicateCheckError) throw duplicateCheckError;
        if ((existingRows || []).length > 0) {
            throw new Error('Phone number already exists. Duplicate customer accounts are blocked.');
        }
    }

    const insertPayload = {
        id: user.role === 'Customer' ? (normalizedCustomerPhone || user.id) : user.id,
        name: user.name,
        role: user.role,
        phone: normalizedCustomerPhone,
        password: user.password,
        correction_pin: user.correctionPin || null,
        wallet_balance: user.walletBalance || 0,
        bonus_balance: user.bonusBalance || 0,
        is_locked: user.isLocked || false,
        created_by_id: user.createdById || null,
        created_by_name: user.createdByName || null
    };

    const { error } = await supabase.from('users').insert(insertPayload);
    if (!error) {
        if (normalizedCustomerPhone) {
            // Consume one-time verified phone marker after successful customer creation.
            await supabase.from('otp_verified_phones').delete().eq('phone', normalizedCustomerPhone);
        }
        return;
    }

    if (!isMissingCorrectionPinColumnError(error)) throw error;
    const fallbackPayload: any = { ...insertPayload };
    delete fallbackPayload.correction_pin;
    const { error: fallbackError } = await supabase.from('users').insert(fallbackPayload);
    if (fallbackError) throw fallbackError;
};

export const dbToggleUserLock = async (userId: string, isLocked: boolean) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase
        .from('users')
        .update({ is_locked: isLocked })
        .eq('id', userId)
        .neq('role', 'Admin');
    if (error) throw error;
};

export const dbAdminResetPassword = async (userId: string, newPassword: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', userId)
        .neq('role', 'Admin');
    if (error) throw error;
};

/**
 * FINANCE OPERATIONS
 */

export const dbApplyCustomerDeposit = async (
    customerId: string,
    amount: number,
    bonusAmount: number,
    processedAt: Date
) => {
    if (!supabase) throw new Error("Database not connected");

    const normalizedAmount = Number(Number(amount).toFixed(2));
    const normalizedBonus = Number(Number(bonusAmount).toFixed(2));

    let userRow: any = null;
    let supportsBonusTrackingColumns = true;

    const { data: extendedUserRow, error: userError } = await supabase
        .from('users')
        .select('wallet_balance, bonus_balance, total_deposited_amount, first_deposit_at')
        .eq('id', customerId)
        .single();

    if (userError && !isMissingBonusTrackingColumnError(userError)) throw userError;

    if (userError && isMissingBonusTrackingColumnError(userError)) {
        supportsBonusTrackingColumns = false;
        const { data: fallbackUserRow, error: fallbackError } = await supabase
            .from('users')
            .select('wallet_balance, bonus_balance')
            .eq('id', customerId)
            .single();
        if (fallbackError) throw fallbackError;
        userRow = fallbackUserRow;
    } else {
        userRow = extendedUserRow;
    }

    const currentWallet = Number(userRow?.wallet_balance || 0);
    const currentBonus = Number(userRow?.bonus_balance || 0);
    const currentDeposited = Number(userRow?.total_deposited_amount || 0);
    const nextWallet = Number((currentWallet + normalizedAmount).toFixed(2));
    const nextBonus = Number((currentBonus + normalizedBonus).toFixed(2));
    const nextDeposited = normalizedAmount > 0
        ? Number((currentDeposited + normalizedAmount).toFixed(2))
        : currentDeposited;

    const updatePayload: Record<string, any> = {
        wallet_balance: nextWallet,
        bonus_balance: nextBonus,
    };

    if (supportsBonusTrackingColumns) {
        updatePayload.total_deposited_amount = nextDeposited;
        if (!userRow?.first_deposit_at && normalizedAmount > 0) {
            updatePayload.first_deposit_at = processedAt.toISOString();
        }
    }

    const { error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', customerId);

    if (updateError) throw updateError;

    return {
        walletBalance: nextWallet,
        bonusBalance: nextBonus,
        totalDepositedAmount: nextDeposited,
        firstDepositAt: updatePayload.first_deposit_at || userRow?.first_deposit_at || null,
    };
};

export const dbApplyCustomerBalanceAdjustment = async (
    customerId: string,
    walletDelta: number,
    bonusDelta: number
) => {
    if (!supabase) throw new Error("Database not connected");

    const normalizedWalletDelta = Number(Number(walletDelta || 0).toFixed(2));
    const normalizedBonusDelta = Number(Number(bonusDelta || 0).toFixed(2));
    if (normalizedWalletDelta === 0 && normalizedBonusDelta === 0) {
        throw new Error('No adjustment provided');
    }

    const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('wallet_balance, bonus_balance')
        .eq('id', customerId)
        .single();
    if (userError) throw userError;

    const currentWallet = Number(userRow?.wallet_balance || 0);
    const currentBonus = Number(userRow?.bonus_balance || 0);
    const nextWallet = Number((currentWallet + normalizedWalletDelta).toFixed(2));
    const nextBonus = Number((currentBonus + normalizedBonusDelta).toFixed(2));

    if (nextWallet < 0) throw new Error('Wallet adjustment would create negative wallet balance');
    if (nextBonus < 0) throw new Error('Bonus adjustment would create negative bonus balance');

    const { error: updateError } = await supabase
        .from('users')
        .update({ wallet_balance: nextWallet, bonus_balance: nextBonus })
        .eq('id', customerId);
    if (updateError) throw updateError;

    return { walletBalance: nextWallet, bonusBalance: nextBonus };
};

export const dbFetchDepositRequests = async (): Promise<any[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('deposit_requests').select('*').order('timestamp', { ascending: false }).limit(200);
    if (error) return [];
    return data;
};

export const dbFetchDepositLogs = async (): Promise<DepositLog[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('deposit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(3000);

    if (error) {
        if (isMissingDepositLogsTableError(error)) return [];
        throw error;
    }

    return (data || []).map((row: any) => ({
        id: String(row.id),
        customerId: String(row.customer_id || ''),
        customerName: String(row.customer_name || ''),
        customerPhone: row.customer_phone || undefined,
        amount: Number(row.amount || 0),
        bonusAwarded: row.bonus_awarded == null ? undefined : Number(row.bonus_awarded),
        bonusAdjustment: row.bonus_adjustment == null ? undefined : Number(row.bonus_adjustment),
        processedById: String(row.processed_by_id || ''),
        processedByName: String(row.processed_by_name || ''),
        timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
        method: row.method,
        transactionId: row.transaction_id || undefined,
        note: row.note || undefined,
    }));
};

export const dbInsertDepositLog = async (log: DepositLog): Promise<void> => {
    if (!supabase) return;

    const payload = {
        id: log.id,
        customer_id: log.customerId,
        customer_name: log.customerName,
        customer_phone: log.customerPhone || null,
        amount: Number(Number(log.amount || 0).toFixed(2)),
        bonus_awarded: log.bonusAwarded == null ? null : Number(Number(log.bonusAwarded).toFixed(2)),
        bonus_adjustment: log.bonusAdjustment == null ? null : Number(Number(log.bonusAdjustment).toFixed(2)),
        processed_by_id: log.processedById,
        processed_by_name: log.processedByName,
        timestamp: log.timestamp.toISOString(),
        method: log.method,
        transaction_id: log.transactionId || null,
        note: log.note || null,
    };

    const { error } = await supabase.from('deposit_logs').insert(payload);
    if (error && !isMissingDepositLogsTableError(error)) throw error;
};

export const dbDepositRequest = async (request: any) => {
    if (!supabase) throw new Error("Database not connected");
    const normalizedAmount = Number(Number(request.amount).toFixed(2));
    const { error } = await supabase.from('deposit_requests').insert({
        id: request.id,
        amount: normalizedAmount,
        method: request.method,
        transaction_id: request.transactionId,
        customer_id: request.customerId,
        status: request.status,
        timestamp: request.timestamp.toISOString()
    });
    if (error) {
        console.error("Deposit Request Error:", error);
        throw new Error(error.message || "Failed to create deposit request");
    }
};

export const dbApproveDepositRequest = async (requestId: string, adminId: string, adminName: string, time: Date) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.rpc('approve_deposit_transaction', {
        p_request_id: requestId,
        p_admin_id: adminId,
        p_admin_name: adminName,
        p_token: "MOCK_TOKEN", // Added placeholder for potential required auth token
        p_time: time.toISOString()
    });
    if (error) {
        console.error("Approval Status Check:", error);
        // Explicit check for common edge function errors
        if (error.message?.includes('Edge Function')) {
            throw new Error(`Payment Gateway Error: ${error.message}. Please check Wave/AfriMoney backend logs.`);
        }
        throw error;
    }
};

export const dbApproveDepositRequestExact = async (
    requestId: string,
    customerId: string,
    amount: number,
    adminId: string,
    adminName: string,
    time: Date
) => {
    if (!supabase) throw new Error("Database not connected");

    const creditAmount = Number(amount);
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
        throw new Error("Invalid deposit amount");
    }

    const { data: userRow, error: userFetchError } = await supabase
        .from('users')
        .select('wallet_balance')
        .eq('id', customerId)
        .single();

    if (userFetchError) throw userFetchError;

    const currentBalance = Number(userRow?.wallet_balance) || 0;
    const nextBalance = Number((currentBalance + creditAmount).toFixed(2));

    const { error: walletUpdateError } = await supabase
        .from('users')
        .update({ wallet_balance: nextBalance })
        .eq('id', customerId);

    if (walletUpdateError) throw walletUpdateError;

    const { error: requestUpdateError } = await supabase
        .from('deposit_requests')
        .update({
            status: 'Approved',
            processed_by: adminId,
            processed_by_name: adminName,
            processed_at: time.toISOString()
        })
        .eq('id', requestId);

    if (requestUpdateError) throw requestUpdateError;
};

export const dbMarkDepositRequestApproved = async (
    requestId: string,
    adminId: string,
    adminName: string,
    time: Date
) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase
        .from('deposit_requests')
        .update({
            status: 'Approved',
            processed_by: adminId,
            processed_by_name: adminName,
            processed_at: time.toISOString()
        })
        .eq('id', requestId)
        .eq('status', 'Pending');
    if (error) throw error;
};

export const dbRejectDepositRequest = async (requestId: string, adminId: string, adminName: string, time: Date) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('deposit_requests').update({
        status: 'Rejected',
        processed_by: adminId,
        processed_by_name: adminName,
        processed_at: time.toISOString()
    }).eq('id', requestId);
    if (error) throw error;
};

export const dbFetchWithdrawalRequests = async (): Promise<any[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('withdrawal_requests').select('*').order('requested_at', { ascending: false }).limit(200);
    if (error) return [];
    return data;
};

export const dbCreateWithdrawalRequest = async (request: any) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('withdrawal_requests').insert({
        id: request.id,
        user_id: request.customerId,
        user_name: request.customerName,
        amount: request.amount,
        status: request.status,
        code: request.code,
        requested_at: request.requestedAt.toISOString()
    });
    if (error) throw error;
};

export const dbCancelWithdrawal = async (requestId: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('withdrawal_requests').update({
        status: 'Canceled'
    }).eq('id', requestId);
    if (error) throw error;
};

export const dbProcessWithdrawalRequest = async (
    code: string,
    processedById: string,
    processedByName: string,
    processedAt: Date
) => {
    if (!supabase) throw new Error("Database not connected");
    const { data, error } = await supabase.rpc('process_withdrawal_request_transaction', {
        p_code: code,
        p_processed_by_id: processedById,
        p_processed_by_name: processedByName,
        p_processed_at: processedAt.toISOString()
    });
    if (error) throw error;
    return !!data;
};

export const dbPayForBooking = async (
    bookingCode: string,
    vendorId: string,
    vendorName: string,
    paidAt: Date
) => {
    if (!supabase) throw new Error("Database not connected");
    const { data, error } = await supabase.rpc('pay_for_booking_transaction', {
        p_booking_code: bookingCode,
        p_vendor_id: vendorId,
        p_vendor_name: vendorName,
        p_paid_at: paidAt.toISOString()
    });
    if (error) throw error;
    return !!data;
};

export const dbMigrateLegacyBookedTicketsToActive = async (): Promise<number> => {
    if (!supabase) return 0;

    const { data: bookedRows, error: bookedError } = await supabase
        .from('tickets')
        .select('id, vendor_id, vendor_name')
        .eq('status', 'Booked');
    if (bookedError) throw bookedError;

    const legacyBooked = bookedRows || [];
    if (legacyBooked.length === 0) return 0;

    const { data: vendorRows, error: vendorError } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'Vendor');
    if (vendorError) throw vendorError;

    const normalizeName = (value: string) => String(value || '').trim().toLowerCase();
    const vendorByName = new Map<string, string>();
    (vendorRows || []).forEach((row: any) => {
        const key = normalizeName(row.name || '');
        if (key && !vendorByName.has(key)) vendorByName.set(key, String(row.id));
    });

    let migratedCount = 0;
    for (const row of legacyBooked as any[]) {
        const currentVendorId = String(row.vendor_id || '').trim();
        const resolvedVendorId = currentVendorId || vendorByName.get(normalizeName(row.vendor_name || '')) || null;

        const updatePayload: any = { status: 'Active' };
        if (resolvedVendorId) updatePayload.vendor_id = resolvedVendorId;
        if (row.vendor_name) updatePayload.vendor_name = row.vendor_name;

        const { error: updateError } = await supabase
            .from('tickets')
            .update(updatePayload)
            .eq('id', row.id)
            .eq('status', 'Booked');
        if (updateError) throw updateError;
        migratedCount += 1;
    }

    return migratedCount;
};

export const dbCancelTicket = async (
    ticketRef: string,
    canceledById: string,
    canceledByName: string,
    canceledAt: Date
): Promise<{ success: boolean; refundedAmount: number; ticketId?: string; message?: string }> => {
    if (!supabase) throw new Error("Database not connected");

    const normalizedRef = (ticketRef || '').trim();
    if (!normalizedRef) return { success: false, refundedAmount: 0, message: 'Ticket reference is required.' };

    let ticketRow: any = null;

    const { data: byId, error: byIdError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', normalizedRef)
        .maybeSingle();
    if (byIdError) throw byIdError;
    ticketRow = byId;

    if (!ticketRow) {
        const { data: byCode, error: byCodeError } = await supabase
            .from('tickets')
            .select('*')
            .eq('booking_code', normalizedRef.toUpperCase())
            .maybeSingle();
        if (byCodeError) throw byCodeError;
        ticketRow = byCode;
    }

    if (!ticketRow) return { success: false, refundedAmount: 0, message: 'Ticket not found.' };
    if (!['Active', 'Booked'].includes(ticketRow.status)) {
        return { success: false, refundedAmount: 0, ticketId: ticketRow.id, message: `Ticket cannot be canceled while status is ${ticketRow.status}.` };
    }

    const selectionRaceIds = Array.from(new Set((Array.isArray(ticketRow.selections) ? ticketRow.selections : []).map((s: any) => s?.raceId).filter(Boolean)));
    if (selectionRaceIds.length > 0) {
        const { data: raceRows, error: raceError } = await supabase
            .from('races')
            .select('id,start_date')
            .in('id', selectionRaceIds);
        if (raceError) throw raceError;

        const raceById = new Map((raceRows || []).map((r: any) => [r.id, new Date(r.start_date)]));
        const inCancelLockWindow = selectionRaceIds.some((raceId) => {
            const startDate = raceById.get(raceId);
            if (!startDate) return false;
            const cancelDeadline = startDate.getTime() - BETTING_CUTOFF_MS;
            return canceledAt.getTime() >= cancelDeadline;
        });

        if (inCancelLockWindow) {
            return {
                success: false,
                refundedAmount: 0,
                ticketId: ticketRow.id,
                message: 'Cancellation blocked: ticket can only be canceled more than 2 minutes before race start.'
            };
        }
    }

    const mappedTicket = mapDbTicketRow(ticketRow);
    const funding = getTicketFunding(mappedTicket);
    const refundCashAmount = ticketRow.status === 'Active' && ticketRow.customer_id ? funding.cashStake : 0;
    const refundBonusAmount = ticketRow.status === 'Active' && ticketRow.customer_id ? funding.bonusStake : 0;
    if ((refundCashAmount > 0 || refundBonusAmount > 0) && ticketRow.customer_id) {
        const { data: userRow, error: userError } = await supabase
            .from('users')
            .select('wallet_balance, bonus_balance')
            .eq('id', ticketRow.customer_id)
            .single();
        if (userError) throw userError;

        const nextBalance = Number((Number(userRow?.wallet_balance || 0) + refundCashAmount).toFixed(2));
        const nextBonusBalance = Number((Number(userRow?.bonus_balance || 0) + refundBonusAmount).toFixed(2));
        const { error: walletError } = await supabase
            .from('users')
            .update({ wallet_balance: nextBalance, bonus_balance: nextBonusBalance })
            .eq('id', ticketRow.customer_id);
        if (walletError) throw walletError;
    }

    const { error: cancelError } = await supabase
        .from('tickets')
        .update({
            status: 'Canceled',
            canceled_at: canceledAt.toISOString(),
            canceled_by_id: canceledById,
            canceled_by_name: canceledByName
        })
        .eq('id', ticketRow.id)
        .in('status', ['Active', 'Booked']);

    if (cancelError) throw cancelError;

    return {
        success: true,
        refundedAmount: Number((refundCashAmount + refundBonusAmount).toFixed(2)),
        ticketId: ticketRow.id
    };
};

/**
 * PROMOTION MANAGEMENT
 */

export const dbFetchPromotions = async (): Promise<Promotion[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('promotions').select('*').order('sort_order', { ascending: true });
    if (error) return [];
    return (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        isActive: !!p.is_active,
        rules: Array.isArray(p.rules) ? p.rules : []
    }));
};

export const dbCreatePromotion = async (promo: Promotion, sortOrder: number) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('promotions').insert({
        id: promo.id,
        name: promo.name,
        type: promo.type,
        is_active: promo.isActive,
        rules: promo.rules || [],
        sort_order: sortOrder
    });
    if (error) throw error;
};

export const dbUpdatePromotion = async (promoId: string, name: string, rules: any[]) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('promotions').update({ name, rules }).eq('id', promoId);
    if (error) throw error;
};

export const dbTogglePromotionStatus = async (promoId: string, nextStatus: boolean) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('promotions').update({ is_active: nextStatus }).eq('id', promoId);
    if (error) throw error;
};

export const dbDeletePromotion = async (promoId: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('promotions').delete().eq('id', promoId);
    if (error) throw error;
};

export const dbMovePromotion = async (promoId: string, direction: 'up' | 'down') => {
    if (!supabase) throw new Error("Database not connected");
    const { data: rows, error: fetchError } = await supabase
        .from('promotions')
        .select('id, sort_order')
        .order('sort_order', { ascending: true });
    if (fetchError) throw fetchError;

    const list = (rows || []).map((r: any) => ({ id: r.id as string, sortOrder: Number(r.sort_order) || 0 }));
    const idx = list.findIndex((x: { id: string; sortOrder: number }) => x.id === promoId);
    if (idx < 0) return;

    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return;

    const current = list[idx];
    const target = list[swapWith];

    const { error: e1 } = await supabase.from('promotions').update({ sort_order: target.sortOrder }).eq('id', current.id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('promotions').update({ sort_order: current.sortOrder }).eq('id', target.id);
    if (e2) throw e2;
};

/**
 * CHAT
 */

const mapChatThread = (t: any): ChatThread => ({
    id: t.id,
    participantIds: Array.isArray(t.participant_ids) ? t.participant_ids : [],
    name: t.name || undefined,
    isBroadcast: !!t.is_broadcast,
    lastMessageTimestamp: t.last_message_timestamp ? new Date(t.last_message_timestamp) : undefined
});

const mapChatMessage = (m: any): ChatMessage => ({
    id: m.id,
    threadId: m.thread_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    content: m.content,
    timestamp: new Date(m.timestamp),
    readByIds: Array.isArray(m.read_by_ids) ? m.read_by_ids : [],
    contentType: m.content_type || 'text',
    audioBase64: m.audio_base64 || undefined,
    audioDuration: m.audio_duration ?? undefined
});

export const dbFetchChatThreads = async (): Promise<ChatThread[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('chat_threads').select('*').order('last_message_timestamp', { ascending: false });
    if (error) return [];
    return (data || []).map(mapChatThread);
};

export const dbFetchChatMessages = async (): Promise<ChatMessage[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('timestamp', { ascending: true })
        .limit(2000);
    if (error) return [];
    return (data || []).map(mapChatMessage);
};

export const dbSendChatMessage = async (
    threadId: string | 'new',
    sender: User,
    content: string,
    recipients: string[],
    audioData?: { base64: string; duration: number }
) => {
    if (!supabase) throw new Error("Database not connected");

    let resolvedThreadId = threadId;
    if (threadId === 'new') {
        const nowIso = new Date().toISOString();
        const normalizedRecipients = recipients.length > 0 ? recipients : ['BACK_OFFICE'];
        const isBroadcast = normalizedRecipients.includes('ALL_VENDORS');
        const isPaymasterRoute = normalizedRecipients.includes('PAYMASTER');
        const isCustomerServiceRoute = normalizedRecipients.includes('CUSTOMER_SERVICE');
        const participantSet = new Set<string>([sender.id, ...normalizedRecipients]);
        const threadPayload = {
            id: `th-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
            participant_ids: Array.from(participantSet),
            name: isBroadcast
                ? 'Broadcast to All Vendors'
                : isPaymasterRoute
                    ? 'Paymaster'
                    : isCustomerServiceRoute
                        ? 'Customer Service'
                        : null,
            is_broadcast: isBroadcast,
            last_message_timestamp: nowIso
        };
        const { error: threadInsertError } = await supabase.from('chat_threads').insert(threadPayload);
        if (threadInsertError) throw threadInsertError;
        resolvedThreadId = threadPayload.id;
    }

    const now = new Date().toISOString();
    const payload = {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        thread_id: resolvedThreadId,
        sender_id: sender.id,
        sender_name: sender.name,
        content: audioData ? '[Voice message]' : content,
        timestamp: now,
        read_by_ids: [sender.id],
        content_type: audioData ? 'audio' : 'text',
        audio_base64: audioData?.base64 || null,
        audio_duration: audioData?.duration ?? null
    };

    const { error: messageError } = await supabase.from('chat_messages').insert(payload);
    if (messageError) throw messageError;

    const { error: updateThreadError } = await supabase
        .from('chat_threads')
        .update({ last_message_timestamp: now })
        .eq('id', resolvedThreadId);
    if (updateThreadError) throw updateThreadError;
};

export const dbMarkThreadAsRead = async (threadId: string, userId: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.rpc('mark_message_thread_read', {
        p_thread_id: threadId,
        p_user_id: userId
    });
    if (error) throw error;
};

/**
 * PROGRAM MEDIA
 */

const normalizeProgramType = (rawType: unknown): ProgramImage['type'] => {
    const value = String(rawType || '').trim().toLowerCase();
    if (value === 'program' || value.includes('prog')) return 'program';
    return 'advertisement';
};

const normalizeProgramMediaType = (rawMediaType: unknown): ProgramImage['mediaType'] => {
    const value = String(rawMediaType || '').trim().toLowerCase();
    return value === 'video' ? 'video' : 'image';
};

const isRlsPolicyError = (error: any): boolean => {
    const msg = String(error?.message || error || '').toLowerCase();
    return msg.includes('row-level security policy') || msg.includes('rls');
};

const toBase64 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

export const dbFetchProgramImages = async (): Promise<ProgramImage[]> => {
    if (!supabase) return [];
    let data: any[] | null = null;
    let error: any = null;

    const orderedRes = await supabase.from('program_images').select('*').order('created_at', { ascending: false });
    data = orderedRes.data as any[] | null;
    error = orderedRes.error;

    // Backward compatibility: some older schemas do not have created_at.
    if (error && String(error.message || '').toLowerCase().includes('created_at')) {
        const fallbackRes = await supabase.from('program_images').select('*');
        data = fallbackRes.data as any[] | null;
        error = fallbackRes.error;
    }

    if (error) return [];
    return (data || []).map((row: any) => ({
        id: row.id,
        type: normalizeProgramType(row.type),
        url: row.url,
        mediaType: normalizeProgramMediaType(row.media_type)
    }));
};

export const dbUploadProgramFile = async (file: File): Promise<string> => {
    if (!supabase) throw new Error("Database not connected");
    if (!file || typeof (file as any).name !== 'string') {
        throw new Error('Invalid upload file. Please choose a file and try again.');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('PROGRAMS').upload(path, file, {
        cacheControl: '3600',
        upsert: false
    });
    if (error && !isRlsPolicyError(error)) {
        throw new Error(`Storage upload failed: ${error.message}`);
    }

    // If storage RLS blocks browser upload, fallback through secure Netlify server function.
    if (error && isRlsPolicyError(error)) {
        const base64Data = await toBase64(file);
        const response = await fetch('/.netlify/functions/program-media-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type || 'application/octet-stream',
                base64Data
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.publicUrl) {
            throw new Error(`Storage upload failed: ${payload?.error || payload?.details || 'RLS fallback upload failed'}`);
        }

        return String(payload.publicUrl);
    }

    const { data } = supabase.storage.from('PROGRAMS').getPublicUrl(path);
    return data.publicUrl;
};

export const dbAddProgramImage = async (image: ProgramImage) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('program_images').insert({
        id: image.id,
        type: normalizeProgramType(image.type),
        url: image.url,
        media_type: normalizeProgramMediaType(image.mediaType)
    });
    if (!error) return;

    if (!isRlsPolicyError(error)) throw error;

    // If table RLS blocks browser insert, fallback through secure Netlify server function.
    const response = await fetch('/.netlify/functions/program-media-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: image.id,
            type: normalizeProgramType(image.type),
            url: image.url,
            mediaType: normalizeProgramMediaType(image.mediaType)
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || payload?.details || 'Program media insert failed');
    }
};

export const dbDeleteProgramImage = async (id: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('program_images').delete().eq('id', id);
    if (error) throw error;
};

/**
 * PAYMENT INTEGRATION SETTINGS
 */

export const dbFetchPaymentConfigs = async (): Promise<PaymentIntegrationConfig[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('payment_configs')
        .select('*')
        .in('provider', ['Wave', 'AfriMoney'])
        .order('provider', { ascending: true });
    if (error) return [];
    return (data || []).map((row: any) => ({
        provider: row.provider,
        isEnabled: !!row.is_enabled,
        environment: row.environment === 'production' ? 'production' : 'sandbox',
        apiKey: row.api_key || '',
        apiSecret: row.api_secret || '',
        signatureSecret: row.signature_secret || '',
        merchantId: row.merchant_id || '',
        shortCode: row.short_code || '',
        merchantMsisdn: row.merchant_msisdn || '',
        merchantDisplayName: row.merchant_display_name || '',
        currency: row.currency || 'GMD',
        baseUrl: row.base_url || '',
        webhookUrl: row.webhook_url || '',
        webhookSecret: row.webhook_secret || '',
        callbackAuthToken: row.callback_auth_token || '',
        requestTimeoutMs: Number(row.request_timeout_ms || 30000)
    }));
};

export const dbSavePaymentConfig = async (config: PaymentIntegrationConfig) => {
    if (!supabase) throw new Error("Database not connected");
    const fullPayload = {
        provider: config.provider,
        is_enabled: config.isEnabled,
        environment: config.environment,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        signature_secret: config.signatureSecret,
        merchant_id: config.merchantId,
        short_code: config.shortCode,
        merchant_msisdn: config.merchantMsisdn,
        merchant_display_name: config.merchantDisplayName,
        currency: config.currency || 'GMD',
        base_url: config.baseUrl,
        webhook_url: config.webhookUrl,
        webhook_secret: config.webhookSecret,
        callback_auth_token: config.callbackAuthToken,
        request_timeout_ms: Math.max(1000, Number(config.requestTimeoutMs || 30000)),
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('payment_configs').upsert(fullPayload);
    if (!error) return;

    if (!isMissingPaymentConfigColumnError(error)) throw error;

    const { error: fallbackError } = await supabase.from('payment_configs').upsert({
        provider: config.provider,
        is_enabled: config.isEnabled,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        merchant_id: config.merchantId,
        webhook_url: config.webhookUrl,
        updated_at: new Date().toISOString()
    });
    if (fallbackError) throw fallbackError;
};

type VendorCommissionConfigRecord = {
    defaults?: {
        terminalRate?: number;
        onlineRate?: number;
    };
    overrides?: Record<string, {
        terminalRate?: number;
        onlineRate?: number;
    }>;
    settlementPlans?: Record<string, 'weekly' | 'monthly'>;
};

export const dbFetchVendorCommissionConfig = async (): Promise<VendorCommissionConfigRecord | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('payment_configs')
        .select('provider, api_key, callback_auth_token')
        .eq('provider', 'VendorCommission')
        .maybeSingle();

    if (error) {
        if (isMissingPaymentConfigColumnError(error)) return null;
        throw error;
    }
    if (!data) return null;

    const raw = String((data as any).callback_auth_token || (data as any).api_key || '').trim();
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as VendorCommissionConfigRecord;
        return {
            defaults: parsed.defaults || {},
            overrides: parsed.overrides || {},
            settlementPlans: parsed.settlementPlans || {},
        };
    } catch {
        return null;
    }
};

export const dbSaveVendorCommissionConfig = async (config: VendorCommissionConfigRecord) => {
    if (!supabase) throw new Error("Database not connected");

    const serialized = JSON.stringify({
        defaults: config.defaults || {},
        overrides: config.overrides || {},
        settlementPlans: config.settlementPlans || {},
    });

    const fullPayload = {
        provider: 'VendorCommission',
        is_enabled: false,
        environment: 'sandbox',
        api_key: serialized,
        callback_auth_token: serialized,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('payment_configs').upsert(fullPayload);
    if (!error) return;

    if (!isMissingPaymentConfigColumnError(error)) throw error;

    const { error: fallbackError } = await supabase.from('payment_configs').upsert({
        provider: 'VendorCommission',
        api_key: serialized,
        updated_at: new Date().toISOString(),
    });
    if (fallbackError) throw fallbackError;
};

/**
 * MANUAL BET ORDERS
 */

export const dbFetchManualBetOrders = async (): Promise<ManualBetOrder[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('manual_bet_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
    if (error) return [];

    return (data || []).map((row: any) => ({
        id: row.id,
        createdAt: new Date(row.created_at),
        createdById: row.created_by_id,
        createdByName: row.created_by_name,
        assignedVendorId: row.assigned_vendor_id,
        selections: Array.isArray(row.selections) ? row.selections : [],
        totalCost: Number(row.total_cost) || 0,
        status: row.status
    }));
};

export const dbCreateManualBetOrder = async (order: ManualBetOrder) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('manual_bet_orders').insert({
        id: order.id,
        created_at: order.createdAt.toISOString(),
        created_by_id: order.createdById,
        created_by_name: order.createdByName,
        assigned_vendor_id: order.assignedVendorId,
        selections: order.selections,
        total_cost: order.totalCost,
        status: order.status
    });
    if (error) throw error;
};

export const dbCancelManualBetOrder = async (orderId: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase
        .from('manual_bet_orders')
        .update({ status: 'Canceled' })
        .eq('id', orderId)
        .eq('status', 'Pending');
    if (error) throw error;
};

export const dbMarkManualBetOrderCompleted = async (orderId: string) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase
        .from('manual_bet_orders')
        .update({ status: 'Completed' })
        .eq('id', orderId)
        .eq('status', 'Pending');
    if (error) throw error;
};

/**
 * FRESH START - RESET ALL DATA FOR NEW BETTING SEASON
 * Clears all races, tickets, and resets wallet balances to zero
 * Keeps all user accounts and functions intact
 */
export const dbFreshStart = async () => {
    if (!supabase) throw new Error("Database not connected");
    
    try {
        // Delete all tickets first (to avoid foreign key constraints)
        const { error: ticketError } = await supabase
            .from('tickets')
            .delete()
            .neq('id', ''); // Delete all rows
        if (ticketError) throw new Error(`Failed to delete tickets: ${ticketError.message}`);

        // Delete all races
        const { error: raceError } = await supabase
            .from('races')
            .delete()
            .neq('id', ''); // Delete all rows
        if (raceError) throw new Error(`Failed to delete races: ${raceError.message}`);

        // Reset all user wallet balances to 0
        const { error: walletError } = await supabase
            .from('users')
            .update({ wallet_balance: 0, bonus_balance: 0 })
            .neq('id', ''); // Update all rows
        if (walletError) throw new Error(`Failed to reset wallets: ${walletError.message}`);

        return { success: true, message: 'Fresh start completed: all races, tickets cleared, wallets reset to 0' };
    } catch (err: any) {
        throw new Error(`Fresh start failed: ${err.message}`);
    }
};

/**
 * OTP (ONE-TIME PASSWORD) CONFIGURATION & VERIFICATION
 * Used for customer registration with phone verification
 * Disabled by default until SMS provider is configured
 */

export const dbFetchOTPConfig = async (): Promise<OTPConfig | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('otp_config').select('*').single();
    if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes("could not find the table") || msg.includes('otp_config')) {
            console.warn('[OTP] otp_config table is missing in Supabase. OTP cannot be enforced until schema is created.');
        }
        return null;
    }
    
    return {
        id: data.id,
        isEnabled: !!data.is_enabled,
        provider: data.provider || 'builtin',
        apiKey: data.api_key || '',
        apiSecret: data.api_secret || '',
        phoneFromNumber: data.phone_from_number,
        codeLength: data.code_length || 4,
        expiryMinutes: data.expiry_minutes || 5,
        maxRetries: data.max_retries || 3,
        message: data.message || 'Your BETESE verification code is: {{code}}',
        createdAt: data.created_at ? new Date(data.created_at) : undefined,
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };
};

export const dbSaveOTPConfig = async (config: OTPConfig): Promise<void> => {
    if (!supabase) throw new Error("Database not connected");
    
    const payload = {
        is_enabled: config.isEnabled,
        provider: config.provider,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        phone_from_number: config.phoneFromNumber || null,
        code_length: config.codeLength,
        expiry_minutes: config.expiryMinutes,
        max_retries: config.maxRetries,
        message: config.message,
        updated_at: new Date().toISOString()
    };

    // Try upsert (update if exists, insert if not)
    const { error } = await supabase
        .from('otp_config')
        .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
};

const normalizeMsisdnForAfricell = (phone: string): string => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('220')) return digits;
    if (digits.length === 7) return `220${digits}`;
    if (digits.length > 7 && !digits.startsWith('220')) return `220${digits.slice(-7)}`;
    return digits;
};

const parseAfricellXmlResponse = (xmlText: string): { statusCode: string; statusMessage: string } => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');
        const statusCode = String(doc.getElementsByTagName('Status')[0]?.textContent || '').trim();
        const statusMessage = String(doc.getElementsByTagName('Message')[0]?.textContent || '').trim();
        return { statusCode, statusMessage };
    } catch {
        return { statusCode: '', statusMessage: '' };
    }
};

const sendOtpViaNetlifyFunction = async (params: {
    provider: OTPConfig['provider'];
    sender: string;
    msisdn: string;
    message: string;
}): Promise<{ ok: boolean; message: string }> => {
    const response = await fetch('/.netlify/functions/send-otp-sms', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        return {
            ok: false,
            message: String(payload?.error || payload?.message || `OTP SMS request failed (${response.status})`)
        };
    }

    return {
        ok: Boolean(payload?.ok),
        message: String(payload?.message || 'OTP SMS sent')
    };
};

const sendAfricellSms = async (params: {
    baseUrl: string;
    username: string;
    password: string;
    sender: string;
    msisdn: string;
    message: string;
}): Promise<{ ok: boolean; message: string }> => {
    const { baseUrl, username, password, sender, msisdn, message } = params;

    if (!baseUrl.trim()) {
        return { ok: false, message: 'Missing SMS API base URL (set VITE_AFRICELL_SMS_BASE_URL).' };
    }

    const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/sendsms?sender=${encodeURIComponent(sender)}&msisdn=${encodeURIComponent(msisdn)}`;
    const auth = btoa(`${username}:${password}`);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'text/plain; charset=utf-8'
        },
        body: message
    });

    const text = await response.text();
    const parsed = parseAfricellXmlResponse(text);
    const statusCode = parsed.statusCode || String(response.status || '');
    const statusMessage = parsed.statusMessage || response.statusText || 'Unknown response';

    if (statusCode === '200') {
        return { ok: true, message: 'SMS sent successfully' };
    }

    return { ok: false, message: `Africell SMS failed (${statusCode}): ${statusMessage}` };
};

const canSendOtpNow = async (phone: string): Promise<{ allowed: boolean; message?: string }> => {
    if (!supabase) return { allowed: false, message: 'Database not connected' };

    const maxSends = 3;
    const windowMinutes = 10;

    // Preferred path: use SQL function if available.
    const { data: rpcData, error: rpcError } = await supabase.rpc('can_send_otp', {
        p_phone: phone,
        p_max_sends: maxSends,
        p_window_minutes: windowMinutes
    });

    if (!rpcError) {
        const allowed = Boolean(rpcData);
        return allowed
            ? { allowed: true }
            : { allowed: false, message: `Too many OTP requests. Please wait ${windowMinutes} minutes and try again.` };
    }

    // Fallback path when RPC is not yet created in database.
    const rpcMsg = String(rpcError?.message || '').toLowerCase();
    const isMissingFunction = rpcMsg.includes('function') && rpcMsg.includes('can_send_otp');
    if (!isMissingFunction) {
        return { allowed: false, message: rpcError.message || 'Unable to validate OTP request limit.' };
    }

    const windowStartIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
        .from('otp_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('phone', phone)
        .gte('created_at', windowStartIso);

    if (countError) {
        return { allowed: false, message: countError.message || 'Unable to validate OTP request limit.' };
    }

    if ((count || 0) >= maxSends) {
        return { allowed: false, message: `Too many OTP requests. Please wait ${windowMinutes} minutes and try again.` };
    }

    return { allowed: true };
};

/**
 * Generate OTP and send to phone (placeholder for SMS provider)
 * For now, returns a mock OTP that can be used in development/testing
 */
export const dbGenerateAndSendOTP = async (phone: string, forcedCode?: string): Promise<{ success: boolean; message: string; expirySeconds?: number }> => {
    if (!supabase) return { success: false, message: "Database not connected" };

    try {
        const config = await dbFetchOTPConfig();
        
        // If OTP is disabled, deny
        if (!config?.isEnabled) {
            return { success: false, message: "OTP verification is not enabled" };
        }

        // Generate random OTP code
        const codeLength = config.codeLength || 4;
        const code = String(forcedCode || String(Math.floor(Math.random() * Math.pow(10, codeLength))).padStart(codeLength, '0')).trim();
        const expirySeconds = (config.expiryMinutes || 5) * 60;
        const expiresAt = new Date(Date.now() + expirySeconds * 1000);
        const normalizedPhone = normalizeMsisdnForAfricell(phone);

        if (!normalizedPhone) {
            return { success: false, message: 'Invalid phone number for OTP' };
        }

        const rateLimit = await canSendOtpNow(normalizedPhone);
        if (!rateLimit.allowed) {
            return { success: false, message: rateLimit.message || 'Too many OTP requests. Please try again later.' };
        }

        // Store OTP in otp_attempts table for verification later
        const { error: insertError } = await supabase.from('otp_attempts').insert({
            phone: normalizedPhone,
            code: code,
            expires_at: expiresAt.toISOString(),
            attempt_count: 0,
            created_at: new Date().toISOString()
        });

        if (insertError) throw insertError;

        const smsMessageTemplate = (config.message || 'Your BETESE verification code is: {{code}}');
        const smsText = smsMessageTemplate.includes('{{code}}')
            ? smsMessageTemplate.replace(/\{\{code\}\}/g, code)
            : `${smsMessageTemplate} ${code}`;

        if (config.provider === 'builtin') {
            console.log(`[OTP] Phone: ${normalizedPhone}, Code: ${code}, Expires: ${expiresAt.toISOString()}`);
            return {
                success: true,
                message: `OTP sent to ${normalizedPhone}`,
                expirySeconds
            };
        }

        const smsResult = config.provider === 'africell'
            ? await sendOtpViaNetlifyFunction({
                provider: config.provider,
                sender: (config.phoneFromNumber || 'BETESE').trim(),
                msisdn: normalizedPhone,
                message: smsText
            })
            : await sendAfricellSms({
            baseUrl: getEnvVar('VITE_AFRICELL_SMS_BASE_URL') || getEnvVar('VITE_SMS_API_BASE_URL') || '',
            username: config.apiKey,
            password: config.apiSecret,
            sender: (config.phoneFromNumber || 'BETESE').trim(),
            msisdn: normalizedPhone,
            message: smsText
        });

        if (!smsResult.ok) {
            await supabase.from('otp_attempts').delete().eq('phone', normalizedPhone).eq('code', code);
            return { success: false, message: smsResult.message };
        }

        return {
            success: true,
            message: `OTP sent to ${normalizedPhone}`,
            expirySeconds
        };
    } catch (err: any) {
        console.error("OTP generation error:", err);
        const raw = String(err?.message || '').toLowerCase();
        if (raw.includes("could not find the table") || raw.includes('otp_attempts')) {
            return {
                success: false,
                message: 'OTP backend is not configured (missing otp_attempts table). Contact Admin.'
            };
        }
        return {
            success: false,
            message: err.message || "Failed to send OTP"
        };
    }
};

/**
 * Verify OTP code for a given phone number
 */
export const dbVerifyOTP = async (phone: string, code: string): Promise<{ success: boolean; message: string; isValid?: boolean }> => {
    if (!supabase) return { success: false, message: "Database not connected" };

    try {
        const config = await dbFetchOTPConfig();
        if (!config?.isEnabled) {
            return { success: false, message: "OTP verification is not enabled" };
        }

        const normalizedPhone = normalizeMsisdnForAfricell(phone);
        if (!normalizedPhone) {
            return { success: false, message: 'Invalid phone number for OTP verification', isValid: false };
        }

        const { data, error } = await supabase
            .from('otp_attempts')
            .select('*')
            .eq('phone', normalizedPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return { success: false, message: "No OTP request found for this phone", isValid: false };
        }

        // Check if expired
        const now = new Date();
        const expiresAt = new Date(data.expires_at);
        if (now > expiresAt) {
            return { success: false, message: "OTP has expired", isValid: false };
        }

        // Check retry limit
        const attemptCount = (data.attempt_count || 0) + 1;
        const maxRetries = config.maxRetries || 3;
        if (attemptCount > maxRetries) {
            return { success: false, message: `Too many attempts. Maximum ${maxRetries} retries allowed`, isValid: false };
        }

        // Verify code
        if (data.code !== code) {
            // Update attempt count
            await supabase.from('otp_attempts').update({ attempt_count: attemptCount }).eq('id', data.id);
            return { success: false, message: "Invalid OTP code", isValid: false };
        }

        // Mark phone as verified for a short window used by DB-level insert policy.
        const verifiedExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const { error: verifiedError } = await supabase
            .from('otp_verified_phones')
            .upsert({
                phone: normalizedPhone,
                verified_at: new Date().toISOString(),
                expires_at: verifiedExpiresAt
            }, { onConflict: 'phone' });
        if (verifiedError) throw verifiedError;

        // Remove consumed OTP attempt after successful verification.
        await supabase.from('otp_attempts').delete().eq('id', data.id);

        return { success: true, message: "OTP verified successfully", isValid: true };
    } catch (err: any) {
        console.error("OTP verification error:", err);
        return { success: false, message: err.message || "Failed to verify OTP" };
    }
};
