import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PaymentBody {
  customerPhone?: string;
  amount?: number | string;
  externalRef?: string;
  customerName?: string;
}

/**
 * Normalize a Gambia MSISDN down to its bare local form (e.g. 7700099999).
 * Accepts `+220...`, `00220...`, `220...` and plain local digits.
 * Returns null when the result is not a 7-9 digit local number.
 */
function normalizeMsisdn(raw: string): string | null {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('00220')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('220') && digits.length > 9) {
    digits = digits.slice(3);
  }
  if (digits.length < 7 || digits.length > 9) return null;
  return digits;
}

function maskMsisdn(msisdn: string): string {
  if (msisdn.length <= 4) return msisdn;
  return `${msisdn.slice(0, 2)}***${msisdn.slice(-2)}`;
}

export async function POST(request: Request) {
  let body: PaymentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { customerPhone, amount, externalRef, customerName } = body;

  if (!customerPhone || !amount || !externalRef) {
    return NextResponse.json(
      { ok: false, error: 'customerPhone, amount and externalRef are required' },
      { status: 400 }
    );
  }

  const normalizedCustomer = normalizeMsisdn(String(customerPhone));
  if (!normalizedCustomer) {
    return NextResponse.json(
      { ok: false, error: 'Invalid customer phone number. Provide a 7-9 digit Gambia MSISDN.' },
      { status: 400 }
    );
  }

  const accessToken = process.env.AFRIMONEY_ACCESS_TOKEN;
  const mpin = process.env.AFRIMONEY_MPIN;
  const tpin = process.env.AFRIMONEY_TPIN;
  const merchantMsisdn = process.env.AFRIMONEY_MERCHANT_MSISDN;
  const productId = process.env.AFRIMONEY_MERCHANT_PRODUCT_ID || '12';
  const baseUrl = process.env.AFRIMONEY_BASE_URL || 'https://api.sandbox.afrimoney.gm';

  if (!accessToken || !mpin || !tpin || !merchantMsisdn) {
    return NextResponse.json(
      { ok: false, error: 'AfriMoney credentials not configured' },
      { status: 503 }
    );
  }

  const payload = {
    serviceCode: 'MERCHPAY',
    transactionAmount: String(amount),
    initiator: 'transactor',
    currency: '101',
    bearerCode: 'USSD',
    source: 'BETESE PMU',
    language: 'en',
    externalReferenceId: externalRef,
    remarks: `BETESE deposit for ${customerName || normalizedCustomer}`,
    transactionMode: 'transactionMode',
    transactor: {
      idType: 'mobileNumber',
      productId,
      tpin,
      idValue: merchantMsisdn,
      mpin,
      pin: mpin,
    },
    sender: {
      idType: 'mobileNumber',
      productId,
      idValue: normalizedCustomer,
    },
    extensibleFields: { field1: 'WEB', field3: 'BETESE PMU' },
  };

  const upstreamUrl = `${baseUrl.replace(/\/+$/, '')}/MERCHPAY`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Non-JSON response (e.g. NGINX 401/403 HTML page from sandbox) — keep rawText
    }

    const root: Record<string, unknown> =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    const inner: Record<string, unknown> =
      root.Map && typeof root.Map === 'object'
        ? (root.Map as Record<string, unknown>)
        : root;

    const txnStatus = String(inner.status || inner.transactionStatus || '').toUpperCase();
    const transactionId = inner.transactionId ? String(inner.transactionId) : undefined;
    const serviceRequestId = inner.serviceRequestId ? String(inner.serviceRequestId) : undefined;
    const upstreamMessage = inner.message ? String(inner.message) : undefined;

    const txnSucceeded = txnStatus === 'SUCCEEDED' || txnStatus === 'SUCCESS';
    const ok = upstream.ok && txnSucceeded;

    console.log(
      `[AfriMoney MERCHPAY] upstream=${upstream.status} ok=${ok} ref=${externalRef} txn=${transactionId || '-'} svc=${serviceRequestId || '-'} msisdn=${maskMsisdn(normalizedCustomer)} msg=${upstreamMessage || '-'}`
    );

    if (ok) {
      return NextResponse.json({
        ok: true,
        transactionId: transactionId || externalRef,
        serviceRequestId,
        message: upstreamMessage || 'Payment successful',
      });
    }

    // Forward the real upstream HTTP status (401/403/422 etc.) when the upstream
    // itself failed; if HTTP was 2xx but the transaction status was not SUCCEEDED,
    // treat it as a 502 (we got a response but the payment was rejected).
    const clientStatus = !upstream.ok ? upstream.status : 502;

    const fallbackError =
      rawText && rawText.length < 500 && rawText.trim()
        ? rawText.trim()
        : 'AfriMoney payment failed';

    return NextResponse.json(
      {
        ok: false,
        error: upstreamMessage || fallbackError,
        status: txnStatus || undefined,
        upstreamStatus: upstream.status,
        serviceRequestId,
      },
      { status: clientStatus }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[AfriMoney MERCHPAY] network error ref=${externalRef} msisdn=${maskMsisdn(normalizedCustomer)}: ${msg}`
    );
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
