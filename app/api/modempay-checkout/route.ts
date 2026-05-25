import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CheckoutBody {
  provider?: string;
  amount?: number | string;
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  externalRef?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

/**
 * Creates a ModemPay hosted-checkout session for Wave or APS Wallet.
 *
 * Front end calls this with { provider: 'wave' | 'aps', amount, customerId,
 * customerPhone, externalRef, returnUrl }. Server uses MODEMPAY_SECRET_KEY
 * (never exposed to the browser) to create the session and returns
 * { checkoutUrl } which the front end opens in a new window. AfriMoney is
 * intentionally NOT handled here; it uses the direct AfriMoney API in
 * /api/afrimoney-payment.
 */
export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    provider,
    amount,
    customerId,
    customerPhone,
    customerName,
    externalRef,
    returnUrl,
    cancelUrl,
  } = body;

  const normalizedProvider = String(provider || '').toLowerCase();
  if (!['wave', 'aps'].includes(normalizedProvider)) {
    return NextResponse.json({ error: 'provider must be "wave" or "aps"' }, { status: 400 });
  }
  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }
  if (!externalRef) {
    return NextResponse.json({ error: 'externalRef is required' }, { status: 400 });
  }

  const secret = process.env.MODEMPAY_SECRET_KEY;
  const publicKey = process.env.MODEMPAY_PUBLIC_KEY;
  const baseUrl = process.env.MODEMPAY_BASE_URL || 'https://api.modempay.com';
  const merchantName = process.env.MODEMPAY_MERCHANT_NAME || 'Betese PMU';

  if (!secret) {
    return NextResponse.json({ error: 'ModemPay secret key not configured' }, { status: 503 });
  }

  const payload = {
    amount: Number(amount),
    currency: 'GMD',
    payment_method: normalizedProvider,
    external_reference: externalRef,
    description: `${merchantName} wallet top-up`,
    customer: {
      id: customerId || undefined,
      phone: customerPhone || undefined,
      name: customerName || undefined,
    },
    success_url: returnUrl || undefined,
    cancel_url: cancelUrl || returnUrl || undefined,
    metadata: {
      source: 'betese-pmu',
      provider: normalizedProvider,
    },
  };

  try {
    const upstream = await fetch(`${baseUrl}/v1/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
        'X-Public-Key': publicKey || '',
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    const dataObj = data as Record<string, unknown> & {
      data?: Record<string, unknown>;
    };
    const checkoutUrl =
      (dataObj.checkout_url as string | undefined) ||
      (dataObj.url as string | undefined) ||
      (dataObj.payment_url as string | undefined) ||
      (dataObj.session_url as string | undefined) ||
      (dataObj.data?.checkout_url as string | undefined) ||
      (dataObj.data?.url as string | undefined);

    if (upstream.ok && checkoutUrl) {
      return NextResponse.json({
        ok: true,
        checkoutUrl,
        sessionId:
          (dataObj.id as string | undefined) ||
          (dataObj.session_id as string | undefined) ||
          (dataObj.data?.id as string | undefined) ||
          null,
        provider: normalizedProvider,
        externalRef,
      });
    }

    return NextResponse.json(
      {
        error: dataObj.error || dataObj.message || 'ModemPay checkout creation failed',
        details: data,
      },
      { status: upstream.status || 502 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
