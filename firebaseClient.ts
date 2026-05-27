// Firestore-backed data layer.
// Migrated from realtimeDb/Postgres to Firebase Firestore.
// File name kept (`realtimeDbClient`) to avoid breaking imports across the app.
// The exported `realtimeDb` symbol is a thin Firestore-backed compat shim that
// emulates realtimeDb's `.channel(...).on(...).subscribe()` realtime API.

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit as fsLimit,
    onSnapshot,
    writeBatch,
    runTransaction,
    serverTimestamp,
    type Query,
    type Unsubscribe,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import { db, firebaseApp } from './lib/firebase/client';
import { apiUrl } from './lib/apiUrl';
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
    WithdrawalRequest,
    DepositLog,
} from './types';
import {
    BETTING_CUTOFF_MS,
    calculateTicketWinnings,
    validateTicketForPlacement,
    validateTicketAgainstRaceState,
    normalizeGambiaPhone,
} from './utils';

const storage = getStorage(firebaseApp);

// ---------- Backend availability ----------
export const checkBackendConnection = async (): Promise<boolean> => {
    try {
        await getDocs(query(collection(db, 'users'), fsLimit(1)));
        return true;
    } catch {
        return false;
    }
};

// ---------- realtimeDb compat shim ----------
// App.tsx uses `realtimeDb.channel(...).on('postgres_changes', { event, schema, table, filter })`.
// We emulate that via Firestore onSnapshot listeners. Filter format: "field=eq.value".
type RealtimeCallback = (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: any; old: any }) => void;

interface ChannelListener {
    table: string;
    event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
    filter?: string;
    callback: RealtimeCallback;
}

const buildChannelQuery = (listener: ChannelListener): Query => {
    const base = collection(db, listener.table);
    if (!listener.filter) return base;
    const match = listener.filter.match(/^([\w_]+)=eq\.(.+)$/);
    if (!match) return base;
    return query(base, where(match[1]!, '==', match[2]!));
};

const eventTypeFromChange = (changeType: 'added' | 'modified' | 'removed'): 'INSERT' | 'UPDATE' | 'DELETE' =>
    changeType === 'added' ? 'INSERT' : changeType === 'modified' ? 'UPDATE' : 'DELETE';

const matchesEventFilter = (filter: ChannelListener['event'], actual: 'INSERT' | 'UPDATE' | 'DELETE'): boolean =>
    filter === '*' || filter === actual;

class realtimeDbChannelShim {
    private listeners: ChannelListener[] = [];
    private unsubscribers: Unsubscribe[] = [];

    on(_eventName: 'postgres_changes', opts: { event: ChannelListener['event']; schema?: string; table: string; filter?: string }, callback: RealtimeCallback) {
        this.listeners.push({ table: opts.table, event: opts.event, filter: opts.filter, callback });
        return this;
    }

    subscribe(_status?: (status: string) => void) {
        for (const listener of this.listeners) {
            const q = buildChannelQuery(listener);
            const unsub = onSnapshot(
                q,
                (snap) => {
                    snap.docChanges().forEach((change) => {
                        const eventType = eventTypeFromChange(change.type);
                        if (!matchesEventFilter(listener.event, eventType)) return;
                        const data = { id: change.doc.id, ...change.doc.data() };
                        listener.callback({ eventType, new: data, old: data });
                    });
                },
                (err) => console.warn(`[realtime] ${listener.table} subscription error`, err)
            );
            this.unsubscribers.push(unsub);
        }
        return this;
    }

    unsubscribe() {
        this.unsubscribers.forEach((u) => u());
        this.unsubscribers = [];
        this.listeners = [];
    }
}

export const realtimeDb = {
    channel(_name: string) {
        return new realtimeDbChannelShim();
    },
    removeChannel(ch: realtimeDbChannelShim | null | undefined) {
        if (ch && typeof ch.unsubscribe === 'function') ch.unsubscribe();
    },
    removeAllChannels() {
        /* no-op; individual channels manage their own subscriptions */
    },
} as const;

// ---------- Helpers ----------
const toDate = (v: any): Date | undefined => {
    if (!v) return undefined;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') return v.toDate();
    return new Date(v);
};

const isoOrNull = (d: Date | undefined | null): string | null => (d ? d.toISOString() : null);

const mapDbTicketRow = (t: any): Ticket => ({
    id: t.id,
    timestamp: toDate(t.timestamp) || new Date(),
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
    paidAt: toDate(t.paid_at),
    paidById: t.paid_by_id || undefined,
    paidByName: t.paid_by_name || undefined,
    canceledAt: toDate(t.canceled_at),
    canceledById: t.canceled_by_id || undefined,
    canceledByName: t.canceled_by_name || undefined,
});

const mapUserRow = (u: any): User => ({
    id: u.id,
    name: u.name,
    role: u.role,
    isLocked: !!u.is_locked,
    phone: u.phone,
    password: u.password,
    correctionPin: u.correction_pin || undefined,
    walletBalance: Number(u.wallet_balance || 0),
    bonusBalance: Number(u.bonus_balance || 0),
    totalDepositedAmount: Number(u.total_deposited_amount || 0),
    firstDepositAt: toDate(u.first_deposit_at),
    createdById: u.created_by_id,
    createdByName: u.created_by_name,
});

const mapRaceRow = (r: any): Race => ({
    id: r.id,
    raceCode: r.race_code || undefined,
    name: r.name,
    venue: r.venue || undefined,
    startDate: toDate(r.start_date) || new Date(),
    endDate: toDate(r.end_date) || new Date(),
    horseCount: r.horse_count,
    nonRunners: Array.isArray(r.non_runners) ? r.non_runners : [],
    result: r.result
        ? {
              ...r.result,
              enteredAt: toDate(r.result.enteredAt),
              lastEditedAt: toDate(r.result.lastEditedAt),
          }
        : undefined,
    disabledBetTypes: Array.isArray(r.disabled_bet_types) ? r.disabled_bet_types : [],
    jackpot: Number(r.jackpot || 0),
    updatedById: r.updated_by_id || undefined,
    updatedByName: r.updated_by_name || undefined,
    updatedAt: toDate(r.updated_at),
});

const getTicketFunding = (ticket: Pick<Ticket, 'selections' | 'totalCost'>) => {
    const metadata = Array.isArray(ticket.selections) && ticket.selections.length > 0 ? ticket.selections[0] : null;
    const bonusStake = Number(metadata?.bonusStakeAmount || 0);
    const cashStake = Number(metadata?.cashStakeAmount ?? Math.max(0, Number(ticket.totalCost || 0) - bonusStake));
    const fundingSource = metadata?.fundingSource || (bonusStake > 0 ? (cashStake > 0 ? 'mixed' : 'bonus') : 'cash');
    return {
        bonusStake: Number(bonusStake.toFixed(2)),
        cashStake: Number(cashStake.toFixed(2)),
        fundingSource,
    } as const;
};

const addFundingMetadataToSelections = (ticket: Ticket, walletBalance: number, bonusBalance: number): Ticket => {
    const totalCost = Number(ticket.totalCost || 0);
    const bonusStake = Number(Math.min(totalCost, Math.max(0, bonusBalance)).toFixed(2));
    const cashStake = Number((totalCost - bonusStake).toFixed(2));
    const fundingSource: 'cash' | 'bonus' | 'mixed' = bonusStake <= 0 ? 'cash' : cashStake > 0 ? 'mixed' : 'bonus';
    return {
        ...ticket,
        selections: ticket.selections.map((selection, index) =>
            index === 0
                ? { ...selection, fundingSource, bonusStakeAmount: bonusStake, cashStakeAmount: cashStake }
                : selection
        ),
    };
};

const evaluateBonusUnlockProgress = (tickets: Ticket[]) => {
    const eligibleTickets = tickets.filter((ticket) => {
        if (ticket.status === 'Canceled' || ticket.status === 'Booked') return false;
        return getTicketFunding(ticket).bonusStake > 0;
    });
    const distinctRaceIds = new Set<string>();
    const raceDayMap = new Map<string, Set<string>>();
    eligibleTickets.forEach((ticket) => {
        const ticketDay = ticket.timestamp.toISOString().slice(0, 10);
        const uniqueRaceIds = Array.from(new Set(ticket.selections.map((s) => s.raceId)));
        uniqueRaceIds.forEach((raceId) => {
            distinctRaceIds.add(raceId);
            if (!raceDayMap.has(raceId)) raceDayMap.set(raceId, new Set<string>());
            raceDayMap.get(raceId)!.add(ticketDay);
        });
    });
    const sameRaceBestCount = Math.max(0, ...Array.from(raceDayMap.values()).map((days) => days.size));
    return {
        distinctRaceCount: distinctRaceIds.size,
        sameRaceBestCount,
        qualified: distinctRaceIds.size >= 3 || sameRaceBestCount >= 3,
    };
};

const maybeUnlockCustomerBonusBalance = async (customerId: string) => {
    const [userSnap, ticketsSnap] = await Promise.all([
        getDoc(doc(db, 'users', customerId)),
        getDocs(query(collection(db, 'tickets'), where('customer_id', '==', customerId))),
    ]);
    const userData = userSnap.data();
    const bonusBalance = Number(userData?.bonus_balance || 0);
    if (bonusBalance <= 0) return;

    const ticketRows = ticketsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t: any) => t.status !== 'Canceled');
    const progress = evaluateBonusUnlockProgress(ticketRows.map(mapDbTicketRow));
    if (!progress.qualified) return;

    const nextWallet = Number((Number(userData?.wallet_balance || 0) + bonusBalance).toFixed(2));
    await updateDoc(doc(db, 'users', customerId), { wallet_balance: nextWallet, bonus_balance: 0 });
};

// ============================================================================
// RACE MANAGEMENT
// ============================================================================

export const dbSaveRace = async (race: Race) => {
    await setDoc(doc(db, 'races', race.id), {
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
        updated_at: race.updatedAt ? race.updatedAt.toISOString() : new Date().toISOString(),
    });
};

export const dbUpdateRace = async (race: Race) => {
    await updateDoc(doc(db, 'races', race.id), {
        race_code: race.raceCode || null,
        name: race.name,
        venue: race.venue || null,
        start_date: race.startDate.toISOString(),
        end_date: race.endDate.toISOString(),
        horse_count: race.horseCount,
        jackpot: race.jackpot || 0,
        updated_by_id: race.updatedById || null,
        updated_by_name: race.updatedByName || null,
        updated_at: race.updatedAt ? race.updatedAt.toISOString() : new Date().toISOString(),
    });
};

export const dbDeleteRace = async (raceId: string) => {
    await deleteDoc(doc(db, 'races', raceId));
};

export const dbUpdateNonRunners = async (raceId: string, nonRunners: number[]) => {
    await updateDoc(doc(db, 'races', raceId), { non_runners: nonRunners });
};

export const dbSaveRaceResult = async (result: RaceResult) => {
    await updateDoc(doc(db, 'races', result.raceId), {
        result,
        updated_at: new Date().toISOString(),
    });
};

export const dbFetchRaces = async (): Promise<Race[]> => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const snap = await getDocs(
            query(collection(db, 'races'), where('end_date', '>=', oneWeekAgo.toISOString()))
        );
        return snap.docs.map((d) => mapRaceRow({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn('[dbFetchRaces] failed', e);
        return [];
    }
};

// ============================================================================
// TICKET / BETTING
// ============================================================================

export const dbFetchUserBalance = async (userId: string) => {
    const snap = await getDoc(doc(db, 'users', userId));
    const data = snap.data();
    const walletBalance = Number(data?.wallet_balance || 0);
    const bonusBalance = Number(data?.bonus_balance || 0);
    return {
        walletBalance,
        bonusBalance,
        totalAvailable: Number((walletBalance + bonusBalance).toFixed(2)),
    };
};

export const dbSettleRaceTickets = async (result: RaceResult, allRaces: Race[]) => {
    const updatedRaces = allRaces.map((r) => (r.id === result.raceId ? { ...r, result } : r));

    // Firestore has no `contains` for arrays of objects; fetch all settle-eligible tickets and filter in memory.
    const ticketsSnap = await getDocs(
        query(collection(db, 'tickets'), where('status', 'in', ['Active', 'Winning', 'Paid', 'Lost']))
    );
    const allTicketRows = ticketsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
    const relevantRows = allTicketRows.filter((t) =>
        Array.isArray(t.selections) && t.selections.some((s: any) => s?.raceId === result.raceId)
    );
    const ticketsToConsider = relevantRows.length > 0 ? relevantRows : allTicketRows;
    const relevantTickets = ticketsToConsider.map(mapDbTicketRow);
    if (relevantTickets.length === 0) return;

    const customerIds = Array.from(new Set(relevantTickets.map((t) => t.customerId).filter(Boolean))) as string[];
    const walletMap = new Map<string, number>();
    const bonusMap = new Map<string, number>();

    if (customerIds.length > 0) {
        const userDocs = await Promise.all(customerIds.map((id) => getDoc(doc(db, 'users', id))));
        userDocs.forEach((s, idx) => {
            const d = s.data() || {};
            walletMap.set(customerIds[idx]!, Number(d.wallet_balance || 0));
            bonusMap.set(customerIds[idx]!, Number(d.bonus_balance || 0));
        });
    }

    const ticketUpdates: any[] = [];
    for (const ticket of relevantTickets) {
        const evaluation = calculateTicketWinnings(ticket, updatedRaces);
        const allResolved = ticket.selections.every((sel) => {
            const race = updatedRaces.find((r) => r.id === sel.raceId);
            return Boolean(race?.result?.winningNumbers?.length);
        });

        const nextWinnings = Number(evaluation.totalWinnings.toFixed(2));
        const previousWinnings = Number(ticket.winnings || 0);
        const isOnline = Boolean(ticket.customerId);
        const wasPaidOnline = isOnline && ticket.status === 'Paid';
        const funding = getTicketFunding(ticket);
        const creditsBonus = isOnline && funding.bonusStake > 0;

        let nextStatus = ticket.status;
        let paidAt = ticket.paidAt;
        let paidById = ticket.paidById;
        let paidByName = ticket.paidByName;
        let settledWinnings = nextWinnings;

        if (allResolved) {
            if (nextWinnings > 0) {
                if (isOnline) {
                    nextStatus = 'Paid';
                    paidAt = paidAt || new Date();
                    paidById = paidById || 'SYSTEM';
                    paidByName = paidByName || (creditsBonus ? 'System Bonus Credit' : 'System Auto Credit');
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

        if (wasPaidOnline && (nextStatus !== 'Paid' || settledWinnings < previousWinnings)) {
            nextStatus = 'Paid';
            settledWinnings = previousWinnings;
            paidAt = paidAt || new Date();
            paidById = paidById || 'SYSTEM';
            paidByName = paidByName || (creditsBonus ? 'System Bonus Credit' : 'System Auto Credit');
        }

        if (isOnline && ticket.customerId) {
            const previousCredited = ticket.status === 'Paid' ? previousWinnings : 0;
            const nextCredited = nextStatus === 'Paid' ? settledWinnings : 0;
            const delta = Number((nextCredited - previousCredited).toFixed(2));
            if (delta !== 0) {
                if (creditsBonus) {
                    const cur = Number(bonusMap.get(ticket.customerId) || 0);
                    bonusMap.set(ticket.customerId, Number((cur + delta).toFixed(2)));
                } else {
                    const cur = Number(walletMap.get(ticket.customerId) || 0);
                    walletMap.set(ticket.customerId, Number((cur + delta).toFixed(2)));
                }
            }
        }

        ticketUpdates.push({
            id: ticket.id,
            status: nextStatus,
            winnings: settledWinnings || null,
            winnings_breakdown: evaluation.breakdown,
            paid_at: isoOrNull(paidAt),
            paid_by_id: paidById || null,
            paid_by_name: paidByName || null,
        });
    }

    // Batched ticket writes.
    const BATCH = 400;
    for (let i = 0; i < ticketUpdates.length; i += BATCH) {
        const batch = writeBatch(db);
        for (const u of ticketUpdates.slice(i, i + BATCH)) {
            const { id, ...rest } = u;
            batch.update(doc(db, 'tickets', id), rest);
        }
        await batch.commit();
    }

    if (customerIds.length > 0) {
        const batch = writeBatch(db);
        for (const id of customerIds) {
            batch.update(doc(db, 'users', id), {
                wallet_balance: Number(walletMap.get(id) || 0),
                bonus_balance: Number(bonusMap.get(id) || 0),
            });
        }
        await batch.commit();

        for (const id of customerIds) await maybeUnlockCustomerBonusBalance(id);
    }
};

export const dbRecalculateAllTicketsSafely = async () => {
    const snap = await getDocs(collection(db, 'races'));
    const races = snap.docs.map((d) => mapRaceRow({ id: d.id, ...d.data() }));
    const noopResult: RaceResult = { raceId: '__RECALC_ALL__', winningNumbers: [], payouts: {} };
    await dbSettleRaceTickets(noopResult, races);
    return { success: true };
};

export const dbPlaceBet = async (ticket: Ticket, user: User) => {
    const placement = validateTicketForPlacement({ selections: ticket.selections, totalCost: ticket.totalCost });
    if (!placement.valid) throw new Error(`Invalid ticket formula: ${placement.message}`);

    const raceIds = Array.from(new Set((ticket.selections || []).map((s) => s.raceId).filter(Boolean)));
    if (raceIds.length === 0) throw new Error('Ticket has no race selections');

    // Firestore `in` is limited to 30 values; raceIds is typically small for one ticket.
    const raceDocs = await Promise.all(raceIds.map((id) => getDoc(doc(db, 'races', id))));
    const raceRows = raceDocs
        .filter((d) => d.exists())
        .map((d) => {
            const data = d.data() as any;
            return {
                id: d.id,
                name: data.name,
                horseCount: Number(data.horse_count || 0),
                nonRunners: Array.isArray(data.non_runners) ? data.non_runners : [],
                disabledBetTypes: Array.isArray(data.disabled_bet_types) ? data.disabled_bet_types : [],
            };
        });

    const stateCheck = validateTicketAgainstRaceState(ticket.selections, raceRows);
    if (!stateCheck.valid) throw new Error(`Selection blocked: ${stateCheck.message}`);

    const isOnline = user.role === 'Customer';
    const shouldChargeWallet = isOnline && ticket.status !== 'Booked';
    let ticketToInsert = ticket;

    await runTransaction(db, async (tx) => {
        if (shouldChargeWallet) {
            const userRef = doc(db, 'users', user.id);
            const userSnap = await tx.get(userRef);
            const ud = userSnap.data() || {};
            const balance = Number(ud.wallet_balance || 0);
            const bonus = Number(ud.bonus_balance || 0);
            const cost = Number(ticket.totalCost || 0);
            if (balance + bonus < cost) {
                throw new Error(
                    `Insufficient wallet and bonus balance. Available GMD ${(balance + bonus).toFixed(2)}, required GMD ${cost.toFixed(2)}.`
                );
            }
            ticketToInsert = addFundingMetadataToSelections(ticket, balance, bonus);
            const funding = getTicketFunding(ticketToInsert);
            tx.update(userRef, {
                wallet_balance: Number((balance - funding.cashStake).toFixed(2)),
                bonus_balance: Number((bonus - funding.bonusStake).toFixed(2)),
            });
        }

        const ticketPayload = {
            id: ticketToInsert.id,
            timestamp: ticketToInsert.timestamp.toISOString(),
            vendor_id: isOnline ? null : ticketToInsert.vendorId || user.id,
            vendor_name: ticketToInsert.vendorName || user.name,
            transaction_channel: isOnline ? 'Online' : 'Terminal',
            customer_id: isOnline ? user.id : ticket.customerId || null,
            status: ticketToInsert.status,
            booking_code: ticketToInsert.bookingCode || null,
            selections: ticketToInsert.selections,
            total_cost: ticketToInsert.totalCost,
            winnings: ticketToInsert.winnings || null,
            winnings_breakdown: ticketToInsert.winningsBreakdown || null,
            paid_at: isoOrNull(ticketToInsert.paidAt),
            paid_by_id: ticketToInsert.paidById || null,
            paid_by_name: ticketToInsert.paidByName || null,
            canceled_at: isoOrNull(ticketToInsert.canceledAt),
            canceled_by_id: ticketToInsert.canceledById || null,
            canceled_by_name: ticketToInsert.canceledByName || null,
        };
        tx.set(doc(db, 'tickets', ticketToInsert.id), ticketPayload);
    });

    if (isOnline) await maybeUnlockCustomerBonusBalance(user.id);
    return { success: true };
};

export const dbPayoutTicket = async (ticketId: string, amount: number, staffId: string, staffName: string) => {
    return runTransaction(db, async (tx) => {
        const ticketRef = doc(db, 'tickets', ticketId);
        const snap = await tx.get(ticketRef);
        if (!snap.exists()) throw new Error('Ticket not found');
        const t = snap.data() as any;
        if (t.status === 'Paid') throw new Error('Ticket already paid');
        if (!['Active', 'Winning'].includes(t.status)) throw new Error(`Cannot pay ticket with status ${t.status}`);

        tx.update(ticketRef, {
            status: 'Paid',
            winnings: amount,
            paid_at: new Date().toISOString(),
            paid_by_id: staffId,
            paid_by_name: staffName,
        });
        return { ok: true };
    });
};

export const dbCancelTicket = async (
    ticketRef: string,
    canceledById: string,
    canceledByName: string,
    canceledAt: Date
): Promise<{ success: boolean; refundedAmount: number; ticketId?: string; message?: string }> => {
    const normalized = (ticketRef || '').trim();
    if (!normalized) return { success: false, refundedAmount: 0, message: 'Ticket reference is required.' };

    // Try by ID first, then by booking code.
    let ticketDoc = await getDoc(doc(db, 'tickets', normalized));
    if (!ticketDoc.exists()) {
        const byCode = await getDocs(
            query(collection(db, 'tickets'), where('booking_code', '==', normalized.toUpperCase()), fsLimit(1))
        );
        if (byCode.empty) return { success: false, refundedAmount: 0, message: 'Ticket not found.' };
        ticketDoc = byCode.docs[0]!;
    }

    const ticketRow = { id: ticketDoc.id, ...ticketDoc.data() } as any;
    if (!['Active', 'Booked'].includes(ticketRow.status)) {
        return {
            success: false,
            refundedAmount: 0,
            ticketId: ticketRow.id,
            message: `Ticket cannot be canceled while status is ${ticketRow.status}.`,
        };
    }

    const raceIds = Array.from(
        new Set((Array.isArray(ticketRow.selections) ? ticketRow.selections : []).map((s: any) => s?.raceId).filter(Boolean))
    ) as string[];
    if (raceIds.length > 0) {
        const raceDocs = await Promise.all(raceIds.map((id) => getDoc(doc(db, 'races', id))));
        const raceMap = new Map(
            raceDocs
                .filter((d) => d.exists())
                .map((d) => [d.id, toDate((d.data() as any).start_date)!] as const)
        );
        const inLock = raceIds.some((id) => {
            const start = raceMap.get(id);
            if (!start) return false;
            return canceledAt.getTime() >= start.getTime() - BETTING_CUTOFF_MS;
        });
        if (inLock) {
            return {
                success: false,
                refundedAmount: 0,
                ticketId: ticketRow.id,
                message: 'Cancellation blocked: ticket can only be canceled more than 2 minutes before race start.',
            };
        }
    }

    const mappedTicket = mapDbTicketRow(ticketRow);
    const funding = getTicketFunding(mappedTicket);
    const refundCash = ticketRow.status === 'Active' && ticketRow.customer_id ? funding.cashStake : 0;
    const refundBonus = ticketRow.status === 'Active' && ticketRow.customer_id ? funding.bonusStake : 0;

    await runTransaction(db, async (tx) => {
        if ((refundCash > 0 || refundBonus > 0) && ticketRow.customer_id) {
            const userRef = doc(db, 'users', ticketRow.customer_id);
            const userSnap = await tx.get(userRef);
            const ud = userSnap.data() || {};
            tx.update(userRef, {
                wallet_balance: Number((Number(ud.wallet_balance || 0) + refundCash).toFixed(2)),
                bonus_balance: Number((Number(ud.bonus_balance || 0) + refundBonus).toFixed(2)),
            });
        }
        tx.update(doc(db, 'tickets', ticketRow.id), {
            status: 'Canceled',
            canceled_at: canceledAt.toISOString(),
            canceled_by_id: canceledById,
            canceled_by_name: canceledByName,
        });
    });

    return {
        success: true,
        refundedAmount: Number((refundCash + refundBonus).toFixed(2)),
        ticketId: ticketRow.id,
    };
};

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export const dbFetchUsers = async (): Promise<User[]> => {
    try {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map((d) => mapUserRow({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
};

export const dbFindUser = async (usernameOrPhone: string): Promise<User | null> => {
    try {
        const raw = String(usernameOrPhone || '').trim();
        if (!raw) return null;
        const normalizedPhone = normalizeGambiaPhone(raw);

        // Firestore has no OR query — do multiple `where` queries and merge.
        const queries: Promise<any>[] = [
            getDoc(doc(db, 'users', raw)),
            getDocs(query(collection(db, 'users'), where('name', '==', raw), fsLimit(1))),
            getDocs(query(collection(db, 'users'), where('phone', '==', raw), fsLimit(1))),
        ];
        if (normalizedPhone) {
            queries.push(getDoc(doc(db, 'users', normalizedPhone)));
            queries.push(getDocs(query(collection(db, 'users'), where('phone', '==', normalizedPhone), fsLimit(1))));
        }
        const results = await Promise.all(queries);
        for (const res of results) {
            if ('exists' in res && res.exists()) return mapUserRow({ id: res.id, ...res.data() });
            if ('docs' in res && res.docs.length > 0) {
                const d = res.docs[0];
                return mapUserRow({ id: d.id, ...d.data() });
            }
        }
        return null;
    } catch (err) {
        console.warn('[dbFindUser] failed', err);
        return null;
    }
};

export const dbAuthenticateViaFunction = async (username: string, password: string): Promise<User | null> => {
    // Migrated: look up the user directly via Firestore (used to call a server function).
    // Firebase Auth integration (email/password, phone, Google) lives in Phase 4 / lib/firebase/client.ts.
    const user = await dbFindUser(username);
    if (!user) return null;
    if ((user.password || '').trim() !== (password || '').trim()) return null;
    return user;
};

export const dbFetchLiveTickets = async (user: User): Promise<Ticket[]> => {
    try {
        const aggregate: any[] = [];
        if (user.role === 'Vendor') {
            const [vendorActive, booked, history] = await Promise.all([
                getDocs(query(collection(db, 'tickets'), where('status', 'in', ['Active', 'Winning']), where('vendor_id', '==', user.id))),
                getDocs(query(collection(db, 'tickets'), where('status', '==', 'Booked'))),
                getDocs(
                    query(
                        collection(db, 'tickets'),
                        where('status', 'in', ['Paid', 'Lost', 'Canceled']),
                        where('vendor_id', '==', user.id),
                        orderBy('timestamp', 'desc'),
                        fsLimit(100)
                    )
                ),
            ]);
            aggregate.push(
                ...vendorActive.docs.map((d) => ({ id: d.id, ...d.data() })),
                ...booked.docs.map((d) => ({ id: d.id, ...d.data() })),
                ...history.docs.map((d) => ({ id: d.id, ...d.data() }))
            );
        } else {
            const activeStatuses = ['Active', 'Booked', 'Winning'];
            const historyStatuses = ['Paid', 'Lost', 'Canceled'];
            const activeQ =
                user.role === 'Customer'
                    ? query(collection(db, 'tickets'), where('status', 'in', activeStatuses), where('customer_id', '==', user.id))
                    : query(collection(db, 'tickets'), where('status', 'in', activeStatuses));
            const historyQ =
                user.role === 'Customer'
                    ? query(
                          collection(db, 'tickets'),
                          where('status', 'in', historyStatuses),
                          where('customer_id', '==', user.id),
                          orderBy('timestamp', 'desc'),
                          fsLimit(100)
                      )
                    : query(collection(db, 'tickets'), where('status', 'in', historyStatuses), orderBy('timestamp', 'desc'), fsLimit(100));
            const [active, history] = await Promise.all([getDocs(activeQ), getDocs(historyQ)]);
            aggregate.push(
                ...active.docs.map((d) => ({ id: d.id, ...d.data() })),
                ...history.docs.map((d) => ({ id: d.id, ...d.data() }))
            );
        }
        const deduped = Array.from(new Map(aggregate.map((row) => [row.id, row])).values());
        return deduped.map(mapDbTicketRow);
    } catch (e) {
        console.warn('[dbFetchLiveTickets] failed', e);
        return [];
    }
};

export const dbAddUser = async (user: User) => {
    const normalizedCustomerPhone = user.role === 'Customer' ? normalizeGambiaPhone(user.phone || '') : null;
    if (user.role === 'Customer' && !normalizedCustomerPhone) {
        throw new Error('Customer phone must be valid: Gambia local 7 digits or +220XXXXXXX; Senegal must be +221XXXXXXXXX only.');
    }
    if (normalizedCustomerPhone) {
        const existing = await getDocs(
            query(collection(db, 'users'), where('phone', '==', normalizedCustomerPhone), fsLimit(1))
        );
        if (!existing.empty) throw new Error('Phone number already exists. Duplicate customer accounts are blocked.');
    }
    const id = user.role === 'Customer' ? (normalizedCustomerPhone || user.id) : user.id;
    await setDoc(doc(db, 'users', id), {
        id,
        name: user.name,
        role: user.role,
        phone: normalizedCustomerPhone,
        password: user.password || null,
        correction_pin: user.correctionPin || null,
        wallet_balance: user.walletBalance || 0,
        bonus_balance: user.bonusBalance || 0,
        is_locked: user.isLocked || false,
        created_by_id: user.createdById || null,
        created_by_name: user.createdByName || null,
    });
    if (normalizedCustomerPhone) {
        const verifiedSnap = await getDocs(
            query(collection(db, 'otp_verified_phones'), where('phone', '==', normalizedCustomerPhone))
        );
        await Promise.all(verifiedSnap.docs.map((d) => deleteDoc(d.ref)));
    }
};

export const dbToggleUserLock = async (userId: string, isLocked: boolean) => {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists() && userSnap.data()?.role === 'Admin') return;
    await updateDoc(doc(db, 'users', userId), { is_locked: isLocked });
};

export const dbAdminResetPassword = async (userId: string, newPassword: string) => {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (userSnap.exists() && userSnap.data()?.role === 'Admin') return;
    await updateDoc(doc(db, 'users', userId), { password: newPassword });
};

// ============================================================================
// FINANCE
// ============================================================================

export const dbApplyCustomerDeposit = async (
    customerId: string,
    amount: number,
    bonusAmount: number,
    processedAt: Date
) => {
    const normalizedAmount = Number(Number(amount).toFixed(2));
    const normalizedBonus = Number(Number(bonusAmount).toFixed(2));

    return runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', customerId);
        const snap = await tx.get(userRef);
        const data = snap.data() || {};
        const currentWallet = Number(data.wallet_balance || 0);
        const currentBonus = Number(data.bonus_balance || 0);
        const currentDeposited = Number(data.total_deposited_amount || 0);
        const nextWallet = Number((currentWallet + normalizedAmount).toFixed(2));
        const nextBonus = Number((currentBonus + normalizedBonus).toFixed(2));
        const nextDeposited = normalizedAmount > 0 ? Number((currentDeposited + normalizedAmount).toFixed(2)) : currentDeposited;

        const update: Record<string, any> = {
            wallet_balance: nextWallet,
            bonus_balance: nextBonus,
            total_deposited_amount: nextDeposited,
        };
        if (!data.first_deposit_at && normalizedAmount > 0) update.first_deposit_at = processedAt.toISOString();
        tx.update(userRef, update);

        return {
            walletBalance: nextWallet,
            bonusBalance: nextBonus,
            totalDepositedAmount: nextDeposited,
            firstDepositAt: update.first_deposit_at || data.first_deposit_at || null,
        };
    });
};

export const dbApplyCustomerBalanceAdjustment = async (
    customerId: string,
    walletDelta: number,
    bonusDelta: number
) => {
    const w = Number(Number(walletDelta || 0).toFixed(2));
    const b = Number(Number(bonusDelta || 0).toFixed(2));
    if (w === 0 && b === 0) throw new Error('No adjustment provided');

    return runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', customerId);
        const snap = await tx.get(userRef);
        const data = snap.data() || {};
        const nextWallet = Number((Number(data.wallet_balance || 0) + w).toFixed(2));
        const nextBonus = Number((Number(data.bonus_balance || 0) + b).toFixed(2));
        if (nextWallet < 0) throw new Error('Wallet adjustment would create negative wallet balance');
        if (nextBonus < 0) throw new Error('Bonus adjustment would create negative bonus balance');
        tx.update(userRef, { wallet_balance: nextWallet, bonus_balance: nextBonus });
        return { walletBalance: nextWallet, bonusBalance: nextBonus };
    });
};

export const dbFetchDepositRequests = async (): Promise<any[]> => {
    try {
        const snap = await getDocs(
            query(collection(db, 'deposit_requests'), orderBy('timestamp', 'desc'), fsLimit(200))
        );
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
};

export const dbFetchDepositLogs = async (): Promise<DepositLog[]> => {
    try {
        const snap = await getDocs(query(collection(db, 'deposit_logs'), orderBy('timestamp', 'desc'), fsLimit(3000)));
        return snap.docs.map((d) => {
            const row = d.data() as any;
            return {
                id: String(d.id),
                customerId: String(row.customer_id || ''),
                customerName: String(row.customer_name || ''),
                customerPhone: row.customer_phone || undefined,
                amount: Number(row.amount || 0),
                bonusAwarded: row.bonus_awarded == null ? undefined : Number(row.bonus_awarded),
                bonusAdjustment: row.bonus_adjustment == null ? undefined : Number(row.bonus_adjustment),
                processedById: String(row.processed_by_id || ''),
                processedByName: String(row.processed_by_name || ''),
                timestamp: toDate(row.timestamp) || new Date(),
                method: row.method,
                transactionId: row.transaction_id || undefined,
                note: row.note || undefined,
            };
        });
    } catch {
        return [];
    }
};

export const dbInsertDepositLog = async (log: DepositLog): Promise<void> => {
    await setDoc(doc(db, 'deposit_logs', log.id), {
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
    });
};

export const dbDepositRequest = async (request: any) => {
    await setDoc(doc(db, 'deposit_requests', request.id), {
        id: request.id,
        amount: Number(Number(request.amount).toFixed(2)),
        method: request.method,
        transaction_id: request.transactionId,
        customer_id: request.customerId,
        status: request.status,
        timestamp: request.timestamp.toISOString(),
    });
};

export const dbApproveDepositRequest = async (
    requestId: string,
    adminId: string,
    adminName: string,
    time: Date
) => {
    return runTransaction(db, async (tx) => {
        const reqRef = doc(db, 'deposit_requests', requestId);
        const snap = await tx.get(reqRef);
        if (!snap.exists()) throw new Error('Deposit request not found');
        const reqData = snap.data() as any;
        if (reqData.status !== 'Pending') throw new Error(`Deposit already ${reqData.status}`);

        const userRef = doc(db, 'users', reqData.customer_id);
        const userSnap = await tx.get(userRef);
        const userData = userSnap.data() || {};
        const amount = Number(reqData.amount || 0);
        const nextBalance = Number((Number(userData.wallet_balance || 0) + amount).toFixed(2));

        tx.update(userRef, { wallet_balance: nextBalance });
        tx.update(reqRef, {
            status: 'Approved',
            processed_by: adminId,
            processed_by_name: adminName,
            processed_at: time.toISOString(),
        });
    });
};

export const dbApproveDepositRequestExact = async (
    requestId: string,
    customerId: string,
    amount: number,
    adminId: string,
    adminName: string,
    time: Date
) => {
    const creditAmount = Number(amount);
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) throw new Error('Invalid deposit amount');
    return runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', customerId);
        const userSnap = await tx.get(userRef);
        const data = userSnap.data() || {};
        const nextBalance = Number((Number(data.wallet_balance || 0) + creditAmount).toFixed(2));
        tx.update(userRef, { wallet_balance: nextBalance });
        tx.update(doc(db, 'deposit_requests', requestId), {
            status: 'Approved',
            processed_by: adminId,
            processed_by_name: adminName,
            processed_at: time.toISOString(),
        });
    });
};

export const dbMarkDepositRequestApproved = async (
    requestId: string,
    adminId: string,
    adminName: string,
    time: Date
) => {
    await updateDoc(doc(db, 'deposit_requests', requestId), {
        status: 'Approved',
        processed_by: adminId,
        processed_by_name: adminName,
        processed_at: time.toISOString(),
    });
};

export const dbRejectDepositRequest = async (requestId: string, adminId: string, adminName: string, time: Date) => {
    await updateDoc(doc(db, 'deposit_requests', requestId), {
        status: 'Rejected',
        processed_by: adminId,
        processed_by_name: adminName,
        processed_at: time.toISOString(),
    });
};

export const dbFetchWithdrawalRequests = async (): Promise<any[]> => {
    try {
        const snap = await getDocs(
            query(collection(db, 'withdrawal_requests'), orderBy('requested_at', 'desc'), fsLimit(200))
        );
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
};

export const dbCreateWithdrawalRequest = async (request: any) => {
    await setDoc(doc(db, 'withdrawal_requests', request.id), {
        id: request.id,
        user_id: request.customerId,
        user_name: request.customerName,
        amount: request.amount,
        status: request.status,
        code: request.code,
        requested_at: request.requestedAt.toISOString(),
    });
};

export const dbCancelWithdrawal = async (requestId: string) => {
    await updateDoc(doc(db, 'withdrawal_requests', requestId), { status: 'Canceled' });
};

export const dbProcessWithdrawalRequest = async (
    code: string,
    processedById: string,
    processedByName: string,
    processedAt: Date
): Promise<boolean> => {
    return runTransaction(db, async (tx) => {
        const matching = await getDocs(
            query(
                collection(db, 'withdrawal_requests'),
                where('code', '==', code),
                where('status', '==', 'Pending'),
                fsLimit(1)
            )
        );
        if (matching.empty) return false;
        const reqDoc = matching.docs[0]!;
        const reqRef = doc(db, 'withdrawal_requests', reqDoc.id);
        const reqData = reqDoc.data() as any;
        const userRef = doc(db, 'users', reqData.user_id);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('Customer not found');
        const userData = userSnap.data() || {};
        const amount = Number(reqData.amount || 0);
        const balance = Number(userData.wallet_balance || 0);
        if (balance < amount) throw new Error('Insufficient wallet balance');

        tx.update(userRef, { wallet_balance: Number((balance - amount).toFixed(2)) });
        tx.update(reqRef, {
            status: 'Completed',
            processed_by: processedById,
            processed_by_name: processedByName,
            completed_at: processedAt.toISOString(),
        });
        return true;
    });
};

export const dbPayForBooking = async (
    bookingCode: string,
    vendorId: string,
    vendorName: string,
    paidAt: Date
): Promise<boolean> => {
    return runTransaction(db, async (tx) => {
        const matching = await getDocs(
            query(
                collection(db, 'tickets'),
                where('booking_code', '==', bookingCode),
                where('status', '==', 'Booked'),
                fsLimit(1)
            )
        );
        if (matching.empty) return false;
        const ticketDoc = matching.docs[0]!;
        tx.update(doc(db, 'tickets', ticketDoc.id), {
            status: 'Active',
            vendor_id: vendorId,
            vendor_name: vendorName,
            paid_at: paidAt.toISOString(),
        });
        return true;
    });
};

export const dbMigrateLegacyBookedTicketsToActive = async (): Promise<number> => {
    try {
        const bookedSnap = await getDocs(query(collection(db, 'tickets'), where('status', '==', 'Booked')));
        if (bookedSnap.empty) return 0;

        const vendorSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'Vendor')));
        const vendorByName = new Map<string, string>();
        vendorSnap.docs.forEach((d) => {
            const data = d.data() as any;
            const key = String(data.name || '').trim().toLowerCase();
            if (key && !vendorByName.has(key)) vendorByName.set(key, d.id);
        });

        let migratedCount = 0;
        const batch = writeBatch(db);
        for (const d of bookedSnap.docs) {
            const row = d.data() as any;
            const currentVendorId = String(row.vendor_id || '').trim();
            const resolvedVendorId = currentVendorId || vendorByName.get(String(row.vendor_name || '').trim().toLowerCase());
            const update: any = { status: 'Active' };
            if (resolvedVendorId) update.vendor_id = resolvedVendorId;
            if (row.vendor_name) update.vendor_name = row.vendor_name;
            batch.update(doc(db, 'tickets', d.id), update);
            migratedCount += 1;
        }
        await batch.commit();
        return migratedCount;
    } catch (e) {
        console.warn('[dbMigrateLegacyBookedTicketsToActive] failed', e);
        return 0;
    }
};

// ============================================================================
// PROMOTIONS
// ============================================================================

export const dbFetchPromotions = async (): Promise<Promotion[]> => {
    try {
        const snap = await getDocs(query(collection(db, 'promotions'), orderBy('sort_order', 'asc')));
        return snap.docs.map((d) => {
            const p = d.data() as any;
            const rawDisplayMode = p.display_mode;
            const displayMode: 'scroll' | 'static' = rawDisplayMode === 'static' ? 'static' : 'scroll';
            return {
                id: d.id,
                name: p.name,
                type: p.type,
                isActive: !!p.is_active,
                rules: Array.isArray(p.rules) ? p.rules : [],
                displayMode,
            };
        });
    } catch {
        return [];
    }
};

export const dbCreatePromotion = async (promo: Promotion, sortOrder: number) => {
    await setDoc(doc(db, 'promotions', promo.id), {
        id: promo.id,
        name: promo.name,
        type: promo.type,
        is_active: promo.isActive,
        rules: promo.rules || [],
        sort_order: sortOrder,
        display_mode: promo.displayMode || 'scroll',
    });
};

export const dbUpdatePromotion = async (promoId: string, name: string, rules: any[]) => {
    await updateDoc(doc(db, 'promotions', promoId), { name, rules });
};

export const dbTogglePromotionStatus = async (promoId: string, nextStatus: boolean) => {
    await updateDoc(doc(db, 'promotions', promoId), { is_active: nextStatus });
};

export const dbSetPromotionDisplayMode = async (promoId: string, mode: 'scroll' | 'static') => {
    await updateDoc(doc(db, 'promotions', promoId), { display_mode: mode });
};

export const dbDeletePromotion = async (promoId: string) => {
    await deleteDoc(doc(db, 'promotions', promoId));
};

export const dbMovePromotion = async (promoId: string, direction: 'up' | 'down') => {
    const snap = await getDocs(query(collection(db, 'promotions'), orderBy('sort_order', 'asc')));
    const list = snap.docs.map((d) => ({ id: d.id, sortOrder: Number((d.data() as any).sort_order || 0) }));
    const idx = list.findIndex((x) => x.id === promoId);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return;
    const current = list[idx]!;
    const target = list[swapWith]!;
    const batch = writeBatch(db);
    batch.update(doc(db, 'promotions', current.id), { sort_order: target.sortOrder });
    batch.update(doc(db, 'promotions', target.id), { sort_order: current.sortOrder });
    await batch.commit();
};

// ============================================================================
// CHAT
// ============================================================================

const mapChatThread = (t: any): ChatThread => ({
    id: t.id,
    participantIds: Array.isArray(t.participant_ids) ? t.participant_ids : [],
    name: t.name || undefined,
    isBroadcast: !!t.is_broadcast,
    lastMessageTimestamp: toDate(t.last_message_timestamp),
});

const mapChatMessage = (m: any): ChatMessage => ({
    id: m.id,
    threadId: m.thread_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    content: m.content,
    timestamp: toDate(m.timestamp) || new Date(),
    readByIds: Array.isArray(m.read_by_ids) ? m.read_by_ids : [],
    contentType: m.content_type || 'text',
    audioBase64: m.audio_base64 || undefined,
    audioDuration: m.audio_duration ?? undefined,
});

export const dbFetchChatThreads = async (): Promise<ChatThread[]> => {
    try {
        const snap = await getDocs(query(collection(db, 'chat_threads'), orderBy('last_message_timestamp', 'desc')));
        return snap.docs.map((d) => mapChatThread({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
};

export const dbFetchChatMessages = async (): Promise<ChatMessage[]> => {
    try {
        const snap = await getDocs(query(collection(db, 'chat_messages'), orderBy('timestamp', 'asc'), fsLimit(2000)));
        return snap.docs.map((d) => mapChatMessage({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
};

export const dbSendChatMessage = async (
    threadId: string | 'new',
    sender: User,
    content: string,
    recipients: string[],
    audioData?: { base64: string; duration: number }
) => {
    let resolvedThreadId = threadId;
    if (threadId === 'new') {
        const nowIso = new Date().toISOString();
        const normalizedRecipients = recipients.length > 0 ? recipients : ['BACK_OFFICE'];
        const isBroadcast = normalizedRecipients.includes('ALL_VENDORS');
        const isPaymaster = normalizedRecipients.includes('PAYMASTER');
        const isCustomerService = normalizedRecipients.includes('CUSTOMER_SERVICE');
        const participantSet = new Set<string>([sender.id, ...normalizedRecipients]);
        const newId = `th-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
        await setDoc(doc(db, 'chat_threads', newId), {
            id: newId,
            participant_ids: Array.from(participantSet),
            name: isBroadcast
                ? 'Broadcast to All Vendors'
                : isPaymaster
                ? 'Paymaster'
                : isCustomerService
                ? 'Customer Service'
                : null,
            is_broadcast: isBroadcast,
            last_message_timestamp: nowIso,
        });
        resolvedThreadId = newId;
    }
    const now = new Date().toISOString();
    const msgId = `msg-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    await setDoc(doc(db, 'chat_messages', msgId), {
        id: msgId,
        thread_id: resolvedThreadId,
        sender_id: sender.id,
        sender_name: sender.name,
        content: audioData ? '[Voice message]' : content,
        timestamp: now,
        read_by_ids: [sender.id],
        content_type: audioData ? 'audio' : 'text',
        audio_base64: audioData?.base64 || null,
        audio_duration: audioData?.duration ?? null,
    });
    await updateDoc(doc(db, 'chat_threads', resolvedThreadId), { last_message_timestamp: now });
};

export const dbMarkThreadAsRead = async (threadId: string, userId: string) => {
    const msgsSnap = await getDocs(query(collection(db, 'chat_messages'), where('thread_id', '==', threadId)));
    const batch = writeBatch(db);
    msgsSnap.docs.forEach((d) => {
        const data = d.data() as any;
        const readBy = Array.isArray(data.read_by_ids) ? data.read_by_ids : [];
        if (!readBy.includes(userId)) {
            batch.update(d.ref, { read_by_ids: [...readBy, userId] });
        }
    });
    await batch.commit();
};

// ============================================================================
// PROGRAM MEDIA
// ============================================================================

const normalizeProgramType = (raw: unknown): ProgramImage['type'] => {
    const v = String(raw || '').trim().toLowerCase();
    if (v === 'program' || v.includes('prog')) return 'program';
    return 'advertisement';
};
const normalizeProgramMediaType = (raw: unknown): ProgramImage['mediaType'] => {
    const v = String(raw || '').trim().toLowerCase();
    return v === 'video' ? 'video' : 'image';
};

export const dbFetchProgramImages = async (): Promise<ProgramImage[]> => {
    try {
        const snap = await getDocs(query(collection(db, 'program_images'), orderBy('created_at', 'desc')));
        return snap.docs.map((d) => {
            const row = d.data() as any;
            return {
                id: d.id,
                type: normalizeProgramType(row.type),
                url: row.url,
                mediaType: normalizeProgramMediaType(row.media_type),
            };
        });
    } catch {
        try {
            const snap = await getDocs(collection(db, 'program_images'));
            return snap.docs.map((d) => {
                const row = d.data() as any;
                return {
                    id: d.id,
                    type: normalizeProgramType(row.type),
                    url: row.url,
                    mediaType: normalizeProgramMediaType(row.media_type),
                };
            });
        } catch {
            return [];
        }
    }
};

export const dbUploadProgramFile = async (file: File): Promise<string> => {
    if (!file || typeof (file as any).name !== 'string') {
        throw new Error('Invalid upload file. Please choose a file and try again.');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `PROGRAMS/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: file.type, cacheControl: 'public, max-age=3600' });
    return await getDownloadURL(ref);
};

export const dbAddProgramImage = async (image: ProgramImage) => {
    await setDoc(doc(db, 'program_images', image.id), {
        id: image.id,
        type: image.type,
        url: image.url,
        media_type: image.mediaType,
        created_at: new Date().toISOString(),
    });
};

export const dbDeleteProgramImage = async (id: string) => {
    await deleteDoc(doc(db, 'program_images', id));
};

// ============================================================================
// PAYMENT CONFIGS
// ============================================================================

export const dbFetchPaymentConfigs = async (): Promise<PaymentIntegrationConfig[]> => {
    try {
        const snap = await getDocs(collection(db, 'payment_configs'));
        return snap.docs.map((d) => {
            const row = d.data() as any;
            return {
                provider: row.provider,
                isEnabled: !!row.is_enabled,
                environment: row.environment || 'sandbox',
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
                requestTimeoutMs: Number(row.request_timeout_ms || 15000),
            };
        });
    } catch {
        return [];
    }
};

export const dbSavePaymentConfig = async (config: PaymentIntegrationConfig) => {
    await setDoc(doc(db, 'payment_configs', config.provider), {
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
        currency: config.currency,
        base_url: config.baseUrl,
        webhook_url: config.webhookUrl,
        webhook_secret: config.webhookSecret,
        callback_auth_token: config.callbackAuthToken,
        request_timeout_ms: config.requestTimeoutMs,
    });
};

// ============================================================================
// VENDOR COMMISSION
// ============================================================================

export interface VendorCommissionConfigRecord {
    [key: string]: any;
}

export const dbFetchVendorCommissionConfig = async (): Promise<VendorCommissionConfigRecord | null> => {
    try {
        const snap = await getDoc(doc(db, 'payment_configs', '__vendor_commission'));
        if (!snap.exists()) return null;
        return snap.data() as VendorCommissionConfigRecord;
    } catch {
        return null;
    }
};

export const dbSaveVendorCommissionConfig = async (config: VendorCommissionConfigRecord) => {
    await setDoc(doc(db, 'payment_configs', '__vendor_commission'), config);
};

// ============================================================================
// MANUAL BET ORDERS
// ============================================================================

const mapManualBetOrder = (m: any): ManualBetOrder => ({
    id: m.id,
    createdAt: toDate(m.created_at) || new Date(),
    createdById: m.created_by_id,
    createdByName: m.created_by_name,
    assignedVendorId: m.assigned_vendor_id,
    selections: Array.isArray(m.selections) ? m.selections : [],
    totalCost: Number(m.total_cost || 0),
    status: m.status,
});

export const dbFetchManualBetOrders = async (): Promise<ManualBetOrder[]> => {
    try {
        const snap = await getDocs(query(collection(db, 'manual_bet_orders'), orderBy('created_at', 'desc'), fsLimit(200)));
        return snap.docs.map((d) => mapManualBetOrder({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
};

export const dbCreateManualBetOrder = async (order: ManualBetOrder) => {
    await setDoc(doc(db, 'manual_bet_orders', order.id), {
        id: order.id,
        created_at: order.createdAt.toISOString(),
        created_by_id: order.createdById,
        created_by_name: order.createdByName,
        assigned_vendor_id: order.assignedVendorId,
        selections: order.selections,
        total_cost: order.totalCost,
        status: order.status,
    });
};

export const dbCancelManualBetOrder = async (orderId: string) => {
    await updateDoc(doc(db, 'manual_bet_orders', orderId), { status: 'Canceled' });
};

export const dbMarkManualBetOrderCompleted = async (orderId: string) => {
    await updateDoc(doc(db, 'manual_bet_orders', orderId), { status: 'Completed' });
};

// ============================================================================
// FRESH START (admin nuke)
// ============================================================================

export const dbFreshStart = async () => {
    const collections = ['tickets', 'races', 'deposit_requests', 'deposit_logs', 'withdrawal_requests', 'manual_bet_orders'];
    for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
    // Reset all customer wallets/bonuses
    const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'Customer')));
    const batch = writeBatch(db);
    usersSnap.docs.forEach((d) =>
        batch.update(d.ref, { wallet_balance: 0, bonus_balance: 0, total_deposited_amount: 0, first_deposit_at: null })
    );
    await batch.commit();
};

// ============================================================================
// OTP — stubs. Firebase Phone Auth handles real OTP from the client SDK directly.
// These are kept for compatibility with the old LoginScreen flow.
// ============================================================================

export const dbFetchOTPConfig = async (): Promise<OTPConfig | null> => {
    try {
        const snap = await getDoc(doc(db, 'otp_config', 'default'));
        if (!snap.exists()) return null;
        const c = snap.data() as any;
        return {
            id: c.id,
            isEnabled: !!c.is_enabled,
            provider: c.provider || 'builtin',
            apiKey: c.api_key || '',
            apiSecret: c.api_secret || '',
            phoneFromNumber: c.phone_from_number || undefined,
            codeLength: Number(c.code_length || 6),
            expiryMinutes: Number(c.expiry_minutes || 5),
            maxRetries: Number(c.max_retries || 3),
            message: c.message || 'Your BETESE verification code is: {{code}}',
            createdAt: toDate(c.created_at),
            updatedAt: toDate(c.updated_at),
        };
    } catch {
        return null;
    }
};

export const dbSaveOTPConfig = async (config: OTPConfig): Promise<void> => {
    await setDoc(doc(db, 'otp_config', 'default'), {
        id: 'default',
        is_enabled: config.isEnabled,
        provider: config.provider,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        phone_from_number: config.phoneFromNumber || null,
        code_length: config.codeLength,
        expiry_minutes: config.expiryMinutes,
        max_retries: config.maxRetries,
        message: config.message,
        updated_at: new Date().toISOString(),
    });
};

export const dbGenerateAndSendOTP = async (
    phone: string,
    forcedCode?: string
): Promise<{ success: boolean; message: string; expirySeconds?: number }> => {
    // Calls the server-side /api/send-otp route, which uses the Africell SMS
    // gateway to deliver the code. When `forcedCode` is provided (e.g. the
    // withdrawal code generated when a withdrawal request is created), the SMS
    // carries that exact code and no hash is persisted — verification is the
    // caller's responsibility (vendor enters code, system matches against
    // WithdrawalRequest.code). When `forcedCode` is omitted, the server
    // generates a fresh 6-digit code and stores a salted SHA-256 hash for
    // later validation by /api/verify-otp. The plaintext code is never
    // returned to the client.
    try {
        const payload: { phone: string; code?: string } = { phone };
        if (forcedCode) payload.code = forcedCode;
        const res = await fetch(apiUrl('/send-otp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || !data?.ok) {
            return {
                success: false,
                message: data?.error || `OTP send failed (HTTP ${res.status})`,
            };
        }
        return {
            success: true,
            message: 'OTP sent via SMS.',
            expirySeconds: Number(data?.expirySeconds || 300),
        };
    } catch (err: any) {
        return { success: false, message: err?.message || 'Network error sending OTP' };
    }
};

export const dbVerifyOTP = async (
    phone: string,
    code: string
): Promise<{ success: boolean; message: string; isValid?: boolean }> => {
    try {
        const res = await fetch(apiUrl('/verify-otp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, code }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.ok) {
            return { success: true, message: 'OTP verified.', isValid: true };
        }
        return {
            success: false,
            message: data?.error || `OTP verification failed (HTTP ${res.status})`,
            isValid: false,
        };
    } catch (err: any) {
        return { success: false, message: err?.message || 'Network error verifying OTP', isValid: false };
    }
};
