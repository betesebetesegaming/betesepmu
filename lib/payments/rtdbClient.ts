import {
  ref,
  set,
  update,
  get,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '../firebase/client';
import {
  RTDB_PAYMENTS,
  depositToRtdb,
  withdrawalToRtdb,
  type RtdbCheckoutRecord,
  type RtdbDepositRecord,
  type RtdbWithdrawalRecord,
} from './rtdbRecords';

function sortByTimestampDesc<T extends { timestamp?: string; requested_at?: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => {
    const aTs = String(a.timestamp || a.requested_at || '');
    const bTs = String(b.timestamp || b.requested_at || '');
    return bTs.localeCompare(aTs);
  });
}

function snapshotToList<T>(snap: { forEach: (cb: (c: { key: string | null; val: () => T }) => void) => void }): T[] {
  const rows: T[] = [];
  snap.forEach((child) => {
    if (child.key) rows.push({ ...(child.val() as T), id: (child.val() as { id?: string }).id || child.key } as T);
  });
  return rows;
}

export async function rtdbWriteDeposit(record: RtdbDepositRecord): Promise<void> {
  const updates: Record<string, RtdbDepositRecord> = {
    [RTDB_PAYMENTS.deposit(record.id)]: record,
  };
  if (record.customer_id) {
    updates[`${RTDB_PAYMENTS.customerDeposits(record.customer_id)}/${record.id}`] = record;
  }
  await update(ref(rtdb), updates);
}

export async function rtdbPatchDeposit(id: string, customerId: string | undefined, patch: Partial<RtdbDepositRecord>): Promise<void> {
  // Per-field paths so update() merges instead of replacing the whole node.
  // A slash-containing key in update() is treated as a full-write at that
  // path — passing the patch object whole would wipe amount/customer_id/etc.
  const updates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    updates[`${RTDB_PAYMENTS.deposit(id)}/${field}`] = value;
    if (customerId) {
      updates[`${RTDB_PAYMENTS.customerDeposits(customerId)}/${id}/${field}`] = value;
    }
  }
  if (Object.keys(updates).length === 0) return;
  await update(ref(rtdb), updates);
}

export async function rtdbWriteWithdrawal(record: RtdbWithdrawalRecord): Promise<void> {
  const updates: Record<string, RtdbWithdrawalRecord> = {
    [RTDB_PAYMENTS.withdrawal(record.id)]: record,
  };
  if (record.user_id) {
    updates[`${RTDB_PAYMENTS.customerWithdrawals(record.user_id)}/${record.id}`] = record;
  }
  await update(ref(rtdb), updates);
}

export async function rtdbPatchWithdrawal(id: string, userId: string | undefined, patch: Partial<RtdbWithdrawalRecord>): Promise<void> {
  // Per-field paths — see rtdbPatchDeposit for the why.
  const updates: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    updates[`${RTDB_PAYMENTS.withdrawal(id)}/${field}`] = value;
    if (userId) {
      updates[`${RTDB_PAYMENTS.customerWithdrawals(userId)}/${id}/${field}`] = value;
    }
  }
  if (Object.keys(updates).length === 0) return;
  await update(ref(rtdb), updates);
}

export async function rtdbWriteCheckout(record: RtdbCheckoutRecord): Promise<void> {
  await set(ref(rtdb, RTDB_PAYMENTS.checkout(record.external_ref)), record);
}

export async function rtdbFetchDeposits(limit = 200): Promise<RtdbDepositRecord[]> {
  const snap = await get(ref(rtdb, RTDB_PAYMENTS.deposits));
  if (!snap.exists()) return [];
  return sortByTimestampDesc(snapshotToList<RtdbDepositRecord>(snap)).slice(0, limit);
}

export async function rtdbFetchWithdrawals(limit = 200): Promise<RtdbWithdrawalRecord[]> {
  const snap = await get(ref(rtdb, RTDB_PAYMENTS.withdrawals));
  if (!snap.exists()) return [];
  return sortByTimestampDesc(snapshotToList<RtdbWithdrawalRecord>(snap)).slice(0, limit);
}

export function subscribeDeposits(
  customerId: string | undefined,
  onRows: (rows: RtdbDepositRecord[]) => void,
): Unsubscribe {
  const path = customerId
    ? RTDB_PAYMENTS.customerDeposits(customerId)
    : RTDB_PAYMENTS.deposits;
  return onValue(ref(rtdb, path), (snap) => {
    if (!snap.exists()) {
      onRows([]);
      return;
    }
    onRows(sortByTimestampDesc(snapshotToList<RtdbDepositRecord>(snap)));
  });
}

export function subscribeWithdrawals(
  userId: string | undefined,
  onRows: (rows: RtdbWithdrawalRecord[]) => void,
): Unsubscribe {
  const path = userId
    ? RTDB_PAYMENTS.customerWithdrawals(userId)
    : RTDB_PAYMENTS.withdrawals;
  return onValue(ref(rtdb, path), (snap) => {
    if (!snap.exists()) {
      onRows([]);
      return;
    }
    onRows(sortByTimestampDesc(snapshotToList<RtdbWithdrawalRecord>(snap)));
  });
}

export function subscribeDepositById(
  depositId: string,
  onRecord: (record: RtdbDepositRecord | null) => void,
): Unsubscribe {
  return onValue(ref(rtdb, RTDB_PAYMENTS.deposit(depositId)), (snap) => {
    onRecord(snap.exists() ? (snap.val() as RtdbDepositRecord) : null);
  });
}

export { depositToRtdb, withdrawalToRtdb };
