import type { DepositRequest, WithdrawalRequest } from '../types';

export function normalizeDepositMethod(raw: unknown): DepositRequest['method'] {
  const method = String(raw || '').trim().toLowerCase();
  switch (method) {
    case 'afrimoney': return 'AfriMoney';
    case 'aps': return 'APS';
    case 'qmoney': return 'QMoney';
    case 'card': return 'Card';
    case 'wave':
    default:
      return 'Wave';
  }
}

export function normalizeDepositStatus(raw: unknown): DepositRequest['status'] {
  const status = String(raw || '').trim().toLowerCase();
  if (status === 'approved' || status === 'completed') return 'Approved';
  if (status === 'rejected' || status === 'failed') return 'Rejected';
  return 'Pending';
}

export function normalizeWithdrawalStatus(raw: unknown): WithdrawalRequest['status'] {
  const status = String(raw || '').trim().toLowerCase();
  if (status === 'settled' || status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  if (status === 'processing') return 'Processing';
  if (status === 'canceled' || status === 'cancelled') return 'Canceled';
  if (status === 'pending') return 'Pending';
  return (String(raw || 'Pending') as WithdrawalRequest['status']);
}

function buildDepositVerificationDefaults(
  request: Pick<DepositRequest, 'method' | 'status' | 'processedBy' | 'processedByName'> & Partial<DepositRequest>,
) {
  if (request.method !== 'Wave') {
    return {
      verificationStatus: request.verificationStatus || ('NotStarted' as const),
      verificationSource: request.verificationSource,
      verificationMessage: request.verificationMessage,
      providerReference: request.providerReference,
      verifiedAt: request.verifiedAt,
    };
  }

  if (request.verificationStatus) {
    return {
      verificationStatus: request.verificationStatus,
      verificationSource: request.verificationSource,
      verificationMessage: request.verificationMessage,
      providerReference: request.providerReference,
      verifiedAt: request.verifiedAt,
    };
  }

  if (request.status === 'Approved') {
    const isClientFallback = request.processedBy === 'SYSTEM' || request.processedByName === 'Wave Direct Deposit';
    return {
      verificationStatus: 'Verified' as const,
      verificationSource: isClientFallback ? ('client-fallback' as const) : ('manual-review' as const),
      verificationMessage: isClientFallback
        ? 'Credited through temporary client fallback. Replace with webhook confirmation for production.'
        : 'Approved after manual review.',
      providerReference: request.providerReference,
      verifiedAt: request.verifiedAt,
    };
  }

  if (request.status === 'Rejected') {
    return {
      verificationStatus: 'VerificationFailed' as const,
      verificationSource: request.verificationSource || ('manual-review' as const),
      verificationMessage: request.verificationMessage || 'Deposit request rejected before provider confirmation.',
      providerReference: request.providerReference,
      verifiedAt: request.verifiedAt,
    };
  }

  return {
    verificationStatus: 'PendingProviderConfirmation' as const,
    verificationSource: request.verificationSource,
    verificationMessage: request.verificationMessage || 'Waiting for payment provider confirmation.',
    providerReference: request.providerReference,
    verifiedAt: request.verifiedAt,
  };
}

export function mapDepositRequestRow(r: Record<string, unknown>): DepositRequest {
  const normalizedMethod = normalizeDepositMethod(r.method);
  const normalizedStatus = normalizeDepositStatus(r.status);

  return {
    id: String(r.id || ''),
    customerId: String(r.customer_id || ''),
    customerName: String(r.customer_name || 'Quick Deposit'),
    amount: Number(r.amount) || 0,
    method: normalizedMethod,
    transactionId: String(r.transaction_id || ''),
    status: normalizedStatus,
    timestamp: r.timestamp ? new Date(String(r.timestamp)) : new Date(),
    processedBy: r.processed_by ? String(r.processed_by) : undefined,
    processedByName: r.processed_by_name ? String(r.processed_by_name) : undefined,
    processedAt: r.processed_at ? new Date(String(r.processed_at)) : undefined,
    ...buildDepositVerificationDefaults({
      method: normalizedMethod,
      status: normalizedStatus,
      processedBy: r.processed_by ? String(r.processed_by) : undefined,
      processedByName: r.processed_by_name ? String(r.processed_by_name) : undefined,
      providerReference: r.provider_reference ? String(r.provider_reference) : undefined,
      verificationStatus: r.verification_status as DepositRequest['verificationStatus'],
      verificationSource: r.verification_source as DepositRequest['verificationSource'],
      verificationMessage: r.verification_message ? String(r.verification_message) : undefined,
      verifiedAt: r.verified_at ? new Date(String(r.verified_at)) : undefined,
    }),
  };
}

export function mapWithdrawalRequestRow(r: Record<string, unknown>): WithdrawalRequest {
  return {
    id: String(r.id || ''),
    customerId: String(r.user_id || ''),
    customerName: String(r.user_name || 'Client'),
    amount: Number(r.amount) || 0,
    status: normalizeWithdrawalStatus(r.status),
    code: String(r.code || ''),
    requestedAt: r.requested_at ? new Date(String(r.requested_at)) : new Date(),
    completedAt: r.completed_at ? new Date(String(r.completed_at)) : undefined,
    processedBy: r.processed_by ? String(r.processed_by) : undefined,
    processedByName: r.processed_by_name ? String(r.processed_by_name) : undefined,
    payoutMethod: r.payout_method as WithdrawalRequest['payoutMethod'],
    recipientPhone: r.recipient_phone ? String(r.recipient_phone) : undefined,
    providerTransferId: r.provider_transfer_id ? String(r.provider_transfer_id) : undefined,
    failureReason: r.failure_reason ? String(r.failure_reason) : undefined,
  };
}
