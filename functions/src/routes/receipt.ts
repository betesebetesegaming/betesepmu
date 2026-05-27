import type { Request, Response } from 'express';

/**
 * GET /api/print-receipt?data=<base64>
 *
 * Thermer "Response URL" endpoint — decodes the base64 JSON payload and
 * returns it back. Stateless; no DB lookup.
 */
export function printReceiptHandler(req: Request, res: Response): void {
  const raw = String(req.query.data || '');
  if (!raw) {
    res.status(400).json({ error: 'Missing data parameter' });
    return;
  }
  const normalised = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);

  let entries: unknown;
  try {
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    entries = JSON.parse(json);
  } catch (err) {
    res.status(400).json({
      error: 'Invalid payload',
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!Array.isArray(entries)) {
    res.status(400).json({ error: 'Payload must be a JSON array of print entries' });
    return;
  }

  res.set({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.status(200).send(JSON.stringify(entries));
}
