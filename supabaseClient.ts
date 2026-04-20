
import { createClient } from '@supabase/supabase-js';
import { Ticket, User, Race, DepositLog, RaceResult } from './types';

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
        return !error;
    } catch (e) { return false; }
};

/**
 * RACE MANAGEMENT OPERATIONS
 */

export const dbSaveRace = async (race: Race) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('races').insert({
        id: race.id,
        name: race.name,
        start_date: race.startDate.toISOString(),
        end_date: race.endDate.toISOString(),
        horse_count: race.horseCount,
        non_runners: race.nonRunners || [],
        jackpot: race.jackpot || 0
    });
    if (error) throw error;
};

export const dbUpdateRace = async (race: Race) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('races').update({
        name: race.name,
        start_date: race.startDate.toISOString(),
        end_date: race.endDate.toISOString(),
        horse_count: race.horseCount,
        jackpot: race.jackpot || 0
    }).eq('id', race.id);
    if (error) throw error;
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
    const { error } = await supabase.from('races').update({
        result: result // This matches the JSONB structure
    }).eq('id', result.raceId);
    if (error) throw error;
};

/**
 * BETTING OPERATIONS
 */

export const dbPlaceBet = async (ticket: Ticket, user: User) => {
    if (!supabase) throw new Error("Supabase not connected");
    const isOnlineCustomer = user.role === 'Customer';
    if (isOnlineCustomer) {
        const { data: userRow, error: walletFetchError } = await supabase
            .from('users')
            .select('wallet_balance')
            .eq('id', user.id)
            .single();

        if (walletFetchError) throw new Error(walletFetchError.message);

        const currentBalance = Number(userRow?.wallet_balance || 0);
        const betCost = Number(ticket.totalCost || 0);
        if (currentBalance < betCost) {
            throw new Error('Insufficient wallet balance');
        }

        const nextBalance = Number((currentBalance - betCost).toFixed(2));
        const { error: walletUpdateError } = await supabase
            .from('users')
            .update({ wallet_balance: nextBalance })
            .eq('id', user.id);

        if (walletUpdateError) throw new Error(walletUpdateError.message);
    }

    const ticketInsertPayload = {
        id: ticket.id,
        timestamp: ticket.timestamp.toISOString(),
        vendor_id: isOnlineCustomer ? null : ticket.vendorId || user.id,
        vendor_name: ticket.vendorName || user.name,
        customer_id: isOnlineCustomer ? user.id : ticket.customerId || null,
        status: ticket.status,
        booking_code: ticket.bookingCode || null,
        selections: ticket.selections,
        total_cost: ticket.totalCost,
        winnings: ticket.winnings || null,
        winnings_breakdown: ticket.winningsBreakdown || null,
        paid_at: ticket.paidAt ? ticket.paidAt.toISOString() : null,
        paid_by_id: ticket.paidById || null,
        paid_by_name: ticket.paidByName || null,
        canceled_at: ticket.canceledAt ? ticket.canceledAt.toISOString() : null,
        canceled_by_id: ticket.canceledById || null,
        canceled_by_name: ticket.canceledByName || null
    };

    const { error: insertError } = await supabase.from('tickets').insert(ticketInsertPayload);
    if (insertError) throw new Error(insertError.message);

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
        password: u.password, walletBalance: u.wallet_balance, bonusBalance: u.bonus_balance,
        createdById: u.created_by_id, createdByName: u.created_by_name
    }));
};

export const dbFetchRaces = async (): Promise<Race[]> => {
    if(!supabase) return [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { data, error } = await supabase.from('races').select('*').gte('end_date', oneWeekAgo.toISOString());
    if(error) return [];
    return data.map((r: any) => ({
        id: r.id, name: r.name, startDate: new Date(r.start_date), endDate: new Date(r.end_date),
        horseCount: r.horse_count, nonRunners: r.non_runners || [], result: r.result,
        disabledBetTypes: r.disabled_bet_types || [], jackpot: r.jackpot
    }));
};

export const dbFetchLiveTickets = async (user: User): Promise<Ticket[]> => {
    if(!supabase) return [];
    let activeQuery = supabase.from('tickets').select('*').in('status', ['Active', 'Booked', 'Winning']);
    let historyQuery = supabase.from('tickets').select('*').in('status', ['Paid', 'Lost', 'Canceled']).order('timestamp', { ascending: false }).limit(100);
    if (user.role === 'Vendor') {
        activeQuery = activeQuery.eq('vendor_id', user.id);
        historyQuery = historyQuery.eq('vendor_id', user.id);
    } else if (user.role === 'Customer') {
        activeQuery = activeQuery.eq('customer_id', user.id);
        historyQuery = historyQuery.eq('customer_id', user.id);
    }
    const [activeRes, historyRes] = await Promise.all([activeQuery, historyQuery]);
    const allData = [...(activeRes.data || []), ...(historyRes.data || [])];
    return allData.map((t: any) => ({
        id: t.id, timestamp: new Date(t.timestamp), vendorId: t.vendor_id, vendorName: t.vendor_name,
        status: t.status, customerId: t.customer_id, bookingCode: t.booking_code, selections: t.selections,
        totalCost: t.total_cost, winnings: t.winnings, winningsBreakdown: t.winnings_breakdown,
        paidAt: t.paid_at ? new Date(t.paid_at) : undefined, paidById: t.paid_by_id, paidByName: t.paid_by_name,
        canceledAt: t.canceled_at ? new Date(t.canceled_at) : undefined, canceledById: t.canceled_by_id, canceledByName: t.canceled_by_name
    }));
};

/**
 * USER MANAGEMENT
 */

export const dbAddUser = async (user: User) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('users').insert({
        id: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone || null,
        password: user.password,
        wallet_balance: user.walletBalance || 0,
        bonus_balance: user.bonusBalance || 0,
        is_locked: user.isLocked || false,
        created_by_id: user.createdById || null,
        created_by_name: user.createdByName || null
    });
    if (error) throw error;
};

/**
 * FINANCE OPERATIONS
 */

export const dbFetchDepositRequests = async (): Promise<any[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('deposit_requests').select('*').order('timestamp', { ascending: false }).limit(200);
    if (error) return [];
    return data;
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
        user_id: request.userId,
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
