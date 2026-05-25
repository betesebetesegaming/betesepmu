const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

/**
 * Creates a ModemPay hosted-checkout session for Wave or APS Wallet.
 *
 * Front end calls this with { provider: 'wave' | 'aps', amount, customerId, customerPhone, externalRef, returnUrl }.
 * Server uses MODEMPAY_SECRET_KEY (never exposed to the browser) to create
 * the session and returns { checkoutUrl } which the front end opens in a new
 * window. AfriMoney is intentionally NOT handled here; it uses the direct
 * AfriMoney API in afrimoney-payment.js.
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, { ok: true });
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
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
      return response(400, { error: 'provider must be "wave" or "aps"' });
    }
    if (!amount || Number(amount) <= 0) {
      return response(400, { error: 'amount must be a positive number' });
    }
    if (!externalRef) {
      return response(400, { error: 'externalRef is required' });
    }

    const secret = process.env.MODEMPAY_SECRET_KEY;
    const publicKey = process.env.MODEMPAY_PUBLIC_KEY;
    const baseUrl = process.env.MODEMPAY_BASE_URL || 'https://api.modempay.com';
    const merchantName = process.env.MODEMPAY_MERCHANT_NAME || 'Betese PMU';

    if (!secret) {
      return response(503, { error: 'ModemPay secret key not configured' });
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
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    const checkoutUrl =
      data.checkout_url ||
      data.url ||
      data.payment_url ||
      data.session_url ||
      data.data?.checkout_url ||
      data.data?.url;

    if (upstream.ok && checkoutUrl) {
      return response(200, {
        ok: true,
        checkoutUrl,
        sessionId: data.id || data.session_id || data.data?.id || null,
        provider: normalizedProvider,
        externalRef,
      });
    }

    return response(upstream.status || 502, {
      error: data.error || data.message || 'ModemPay checkout creation failed',
      details: data,
    });
  } catch (err) {
    return response(500, { error: String(err?.message || err) });
  }
};
