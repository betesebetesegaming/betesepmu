import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PaymentBody {
  customerPhone?: string;
  amount?: number | string;
  externalRef?: string;
  customerName?: string;
}

export async function POST(request: Request) {
  let body: PaymentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { customerPhone, amount, externalRef, customerName } = body;

  if (!customerPhone || !amount || !externalRef) {
    return NextResponse.json(
      { error: 'customerPhone, amount and externalRef are required' },
      { status: 400 }
    );
  }

  const accessToken = process.env.AFRIMONEY_ACCESS_TOKEN;
  const mpin = process.env.AFRIMONEY_MPIN;
  const tpin = process.env.AFRIMONEY_TPIN;
  const merchantMsisdn = process.env.AFRIMONEY_MERCHANT_MSISDN;
  const productId = process.env.AFRIMONEY_MERCHANT_PRODUCT_ID || '12';
  const baseUrl = process.env.AFRIMONEY_BASE_URL || 'https://api.afrimoney.gm';

  if (!accessToken || !mpin || !tpin || !merchantMsisdn) {
    return NextResponse.json(
      { error: 'AfriMoney credentials not configured' },
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
    remarks: `BETESE deposit for ${customerName || customerPhone}`,
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
      idValue: String(customerPhone).replace(/^\+220/, '').replace(/\D/g, ''),
    },
    extensibleFields: { field1: 'WEB', field3: 'BETESE PMU' },
  };

  try {
    const upstream = await fetch(`${baseUrl}/MERCHPAY`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await upstream.json().catch(() => ({} as Record<string, unknown>));
    const map = (result as { Map?: Record<string, unknown> })?.Map || (result as Record<string, unknown>);
    const status = String((map as Record<string, unknown>)?.status || (map as Record<string, unknown>)?.transactionStatus || '').toUpperCase();

    if (status === 'SUCCEEDED' || status === 'SUCCESS') {
      return NextResponse.json({
        ok: true,
        transactionId: (map as Record<string, unknown>)?.transactionId || externalRef,
        message: (map as Record<string, unknown>)?.message || 'Payment successful',
      });
    }

    return NextResponse.json(
      {
        error: (map as Record<string, unknown>)?.message || 'AfriMoney payment failed',
        status,
      },
      { status: 502 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
