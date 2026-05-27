import { getDatabase } from 'firebase-admin/database';
import { ensureAdminApp } from './admin';

export type RtdbDepositRecord = {
  id: string;
  customer_id: string;
  customer_name?: string | null;
  amount: number;
  method: string;
  transaction_id?: string | null;
  status: string;
  timestamp: string;
  provider_reference?: string | null;
  verification_status?: string | null;
  verification_source?: string | null;
  verification_message?: string | null;
  processed_by?: string | null;
  processed_by_name?: string | null;
  processed_at?: string | null;
  verified_at?: string | null;
};

export type RtdbWithdrawalRecord = {
  id: string;
  user_id: string;
  user_name?: string | null;
  amount: number;
  status: string;
  code?: string | null;
  requested_at: string;
  payout_method?: string | null;
  recipient_phone?: string | null;
  external_ref?: string | null;
  processed_by?: string | null;
  processed_by_name?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
};

export type RtdbCheckoutRecord = {
  external_ref: string;
  session_id?: string | null;
  method?: string;
  amount?: number;
  customer_id?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  status: string;
  created_at?: string;
  completed_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
};

function rtdbRef() {
  return getDatabase(ensureAdminApp()).ref();
}

export async function syncDepositToRtdb(record: RtdbDepositRecord): Promise<void> {
  const updates: Record<string, RtdbDepositRecord> = {
    [`payments/deposits/${record.id}`]: record,
  };
  if (record.customer_id) {
    updates[`payments/byCustomer/${record.customer_id}/deposits/${record.id}`] = record;
  }
  await rtdbRef().update(updates);
}

export async function patchDepositOnRtdb(
  id: string,
  customerId: string | undefined,
  patch: Partial<RtdbDepositRecord>,
): Promise<void> {
  const updates: Record<string, Partial<RtdbDepositRecord>> = {
    [`payments/deposits/${id}`]: patch,
  };
  if (customerId) {
    updates[`payments/byCustomer/${customerId}/deposits/${id}`] = patch;
  }
  await rtdbRef().update(updates);
}

export async function syncWithdrawalToRtdb(record: RtdbWithdrawalRecord): Promise<void> {
  const updates: Record<string, RtdbWithdrawalRecord> = {
    [`payments/withdrawals/${record.id}`]: record,
  };
  if (record.user_id) {
    updates[`payments/byCustomer/${record.user_id}/withdrawals/${record.id}`] = record;
  }
  await rtdbRef().update(updates);
}

export async function patchWithdrawalOnRtdb(
  id: string,
  userId: string | undefined,
  patch: Partial<RtdbWithdrawalRecord>,
): Promise<void> {
  const updates: Record<string, Partial<RtdbWithdrawalRecord>> = {
    [`payments/withdrawals/${id}`]: patch,
  };
  if (userId) {
    updates[`payments/byCustomer/${userId}/withdrawals/${id}`] = patch;
  }
  await rtdbRef().update(updates);
}

export async function syncCheckoutToRtdb(record: RtdbCheckoutRecord): Promise<void> {
  await rtdbRef().child(`payments/checkouts/${record.external_ref}`).set(record);
}
