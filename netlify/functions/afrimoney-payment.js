const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, { ok: true });
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const { customerPhone, amount, externalRef, customerName } = body;

    if (!customerPhone || !amount || !externalRef) {
      return response(400, { error: 'customerPhone, amount and externalRef are required' });
    }

    const accessToken = process.env.AFRIMONEY_ACCESS_TOKEN;
    const mpin = process.env.AFRIMONEY_MPIN;
    const tpin = process.env.AFRIMONEY_TPIN;
    const merchantMsisdn = process.env.AFRIMONEY_MERCHANT_MSISDN;
    const productId = process.env.AFRIMONEY_MERCHANT_PRODUCT_ID || '12';
    const baseUrl = process.env.AFRIMONEY_BASE_URL || 'https://api.afrimoney.gm';

    if (!accessToken || !mpin || !tpin || !merchantMsisdn) {
      return response(503, { error: 'AfriMoney credentials not configured' });
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
      remarks: `BETESE deposit for ${customerName || customerPhone}`,
      transactionMode: 'transactionMode',
      transactor: {
        idType: 'mobileNumber',
        productId: productId,
        tpin: tpin,
        idValue: merchantMsisdn,
        mpin: mpin,
        pin: mpin
      },
      sender: {
        idType: 'mobileNumber',
        productId: productId,
        idValue: String(customerPhone).replace(/^\+220/, '').replace(/\D/g, '')
      },
      extensibleFields: { field1: 'WEB', field3: 'BETESE PMU' }
    };

    const upstream = await fetch(`${baseUrl}/MERCHPAY`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(payload)
    });

    const result = await upstream.json().catch(() => ({}));
    const map = result?.Map || result;
    const status = String(map?.status || map?.transactionStatus || '').toUpperCase();

    if (status === 'SUCCEEDED' || status === 'SUCCESS') {
      return response(200, {
        ok: true,
        transactionId: map?.transactionId || externalRef,
        message: map?.message || 'Payment successful'
      });
    }

    return response(502, {
      error: map?.message || 'AfriMoney payment failed',
      status: status
    });

  } catch (err) {
    return response(500, { error: String(err?.message || err) });
  }
};
