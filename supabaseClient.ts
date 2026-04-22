
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
    ProgramImage,
    ManualBetOrder,
    BetSelection,
    WithdrawalRequest
} from './types';

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
        const participantSet = new Set<string>([sender.id, ...normalizedRecipients]);
        const threadPayload = {
            id: `th-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
            participant_ids: Array.from(participantSet),
            name: isBroadcast ? 'Broadcast to All Vendors' : null,
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

export const dbFetchProgramImages = async (): Promise<ProgramImage[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('program_images').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        url: row.url,
        mediaType: row.media_type || 'image'
    }));
};

export const dbAddProgramImage = async (image: ProgramImage) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('program_images').insert({
        id: image.id,
        type: image.type,
        url: image.url,
        media_type: image.mediaType
    });
    if (error) throw error;
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
    const { data, error } = await supabase.from('payment_configs').select('*').order('provider', { ascending: true });
    if (error) return [];
    return (data || []).map((row: any) => ({
        provider: row.provider,
        isEnabled: !!row.is_enabled,
        apiKey: row.api_key || '',
        apiSecret: row.api_secret || '',
        merchantId: row.merchant_id || '',
        webhookUrl: row.webhook_url || ''
    }));
};

export const dbSavePaymentConfig = async (config: PaymentIntegrationConfig) => {
    if (!supabase) throw new Error("Database not connected");
    const { error } = await supabase.from('payment_configs').upsert({
        provider: config.provider,
        is_enabled: config.isEnabled,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        merchant_id: config.merchantId,
        webhook_url: config.webhookUrl,
        updated_at: new Date().toISOString()
    });
    if (error) throw error;
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
