import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/print-receipt?data=<base64>
 *
 * Acts as the "Response URL" for the Thermer (Bluetooth Mini Thermal Printer)
 * Browser-Print integration. The Thermer Android app fetches this URL and
 * expects a JSON array of print entries:
 *
 *   Text    : { type:0, content, bold:0|1, align:0|1|2, format:0..4 }
 *   Image   : { type:1, path, align }
 *   Barcode : { type:2, value, height, align }
 *   QR      : { type:3, value, size, align }
 *
 * The payload is encoded as base64 of the JSON in the `data` query param so
 * this endpoint stays stateless — no DB lookup, no auth, no business logic.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('data');

  if (!raw) {
    return NextResponse.json({ error: 'Missing data parameter' }, { status: 400 });
  }

  // Accept both base64url and standard base64.
  const normalised = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);

  let entries: unknown;
  try {
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    entries = JSON.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid payload', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  if (!Array.isArray(entries)) {
    return NextResponse.json(
      { error: 'Payload must be a JSON array of print entries' },
      { status: 400 },
    );
  }

  return new NextResponse(JSON.stringify(entries), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}
