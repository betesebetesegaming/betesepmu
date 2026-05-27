import type { Request, Response } from 'express';
import { createHash, randomInt } from 'node:crypto';
import { logger } from 'firebase-functions';
import { adminDb } from '../admin';

const OTP_TTL_SECONDS = 300;
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;

function normalizeMsisdn(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('220') && digits.length >= 10) return digits;
  if (digits.startsWith('221') && digits.length >= 12) return digits;
  if (digits.length === 7) return `220${digits}`;
  return digits;
}

function hashOtp(code: string, phone: string, salt: string): string {
  return createHash('sha256').update(`${code}|${phone}|${salt}`).digest('hex');
}

export async function sendOtpHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as { phone?: string; code?: string; message?: string };

  const phoneInput = (body.phone || '').trim();
  if (!phoneInput) {
    res.status(400).json({ error: 'phone is required' });
    return;
  }
  const msisdn = normalizeMsisdn(phoneInput);
  if (!msisdn) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }

  const username = process.env.AFRICELL_SMS_USERNAME;
  const password = process.env.AFRICELL_SMS_PASSWORD;
  const sender = process.env.AFRICELL_SMS_SENDER || 'Betese';
  const baseUrl = process.env.AFRICELL_SMS_URL || 'https://esme.africell.gm:5991';
  const otpSalt = process.env.OTP_HASH_SALT || 'betese-otp-default-salt';

  if (!username || !password) {
    res.status(503).json({
      error: 'Africell SMS credentials not configured (AFRICELL_SMS_USERNAME / AFRICELL_SMS_PASSWORD)',
    });
    return;
  }

  const suppliedCode = (body.code || '').trim();
  let code: string;
  let storeHashForVerification = false;
  if (suppliedCode) {
    code = suppliedCode;
  } else {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH;
    code = String(randomInt(min, max));
    storeHashForVerification = true;
  }

  const messageTemplate = body.message
    || process.env.OTP_MESSAGE_TEMPLATE
    || 'Your BETESE verification code is: {{code}}. It expires in 5 minutes. Do not share this code with anyone.';
  const message = messageTemplate.replace('{{code}}', code);

  if (storeHashForVerification) {
    try {
      const expiresAt = Date.now() + OTP_TTL_SECONDS * 1000;
      await adminDb.collection('otp_codes').doc(msisdn).set({
        phone: msisdn,
        code_hash: hashOtp(code, msisdn, otpSalt),
        expires_at: new Date(expiresAt).toISOString(),
        attempts: 0,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('OTP persistence failed', err);
      res.status(500).json({ error: `Failed to persist OTP: ${err instanceof Error ? err.message : String(err)}` });
      return;
    }
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/api/sendsms?sender=${encodeURIComponent(sender)}&msisdn=${encodeURIComponent(msisdn)}`;
  const basic = Buffer.from(`${username}:${password}`).toString('base64');
  const smsTimeoutMs = Number(process.env.AFRICELL_SMS_TIMEOUT_MS || 8000);

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        Authorization: `Basic ${basic}`,
      },
      body: message,
      signal: AbortSignal.timeout(smsTimeoutMs),
    });
    const text = await upstream.text();
    const statusMatch = text.match(/<Status>(\d+)<\/Status>/i);
    const messageMatch = text.match(/<Message>([^<]+)<\/Message>/i);
    const messageIdMatch = text.match(/<MessageId>([^<]+)<\/MessageId>/i);
    const statusCode = statusMatch ? Number(statusMatch[1]) : upstream.status;
    const gatewayMessage = messageMatch ? messageMatch[1] : text;

    if (statusCode === 200) {
      res.json({ ok: true, messageId: messageIdMatch?.[1] || null, expirySeconds: OTP_TTL_SECONDS });
      return;
    }
    res.status(502).json({ error: `SMS gateway error (${statusCode}): ${gatewayMessage}`, statusCode });
  } catch (err) {
    logger.error('SMS dispatch failed', { url: baseUrl, msisdn, err });
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = /timeout|abort|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(message);
    if (timedOut) {
      res.status(502).json({
        error: 'SMS gateway unreachable from cloud (connection timed out). The Africell ESME endpoint on port 5991 is not reachable from Google Cloud — ask Africell to provide a public HTTPS API or whitelist your Cloud Functions egress IP.',
        detail: message,
      });
      return;
    }
    res.status(500).json({ error: message });
  }
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as { phone?: string; code?: string };

  const phoneInput = (body.phone || '').trim();
  const code = (body.code || '').trim();
  if (!phoneInput || !code) {
    res.status(400).json({ error: 'phone and code are required' });
    return;
  }
  const msisdn = normalizeMsisdn(phoneInput);
  if (!msisdn) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }

  const otpSalt = process.env.OTP_HASH_SALT || 'betese-otp-default-salt';

  try {
    const ref = adminDb.collection('otp_codes').doc(msisdn);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'No OTP request found for this number. Please request a new code.' });
      return;
    }
    const data = snap.data() as { code_hash?: string; expires_at?: string; attempts?: number };

    const expiresAt = data.expires_at ? Date.parse(data.expires_at) : 0;
    if (!expiresAt || Date.now() > expiresAt) {
      await ref.delete().catch(() => undefined);
      res.status(410).json({ error: 'OTP code expired. Please request a new code.' });
      return;
    }

    const attempts = Number(data.attempts || 0);
    if (attempts >= MAX_ATTEMPTS) {
      await ref.delete().catch(() => undefined);
      res.status(429).json({ error: 'Too many failed attempts. Please request a new code.' });
      return;
    }

    const expectedHash = data.code_hash || '';
    const actualHash = hashOtp(code, msisdn, otpSalt);

    if (expectedHash !== actualHash) {
      await ref.update({ attempts: attempts + 1 }).catch(() => undefined);
      res.status(401).json({
        error: 'Invalid OTP code.',
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (attempts + 1)),
      });
      return;
    }

    await ref.delete().catch(() => undefined);
    res.json({ ok: true, verified: true, phone: msisdn });
  } catch (err) {
    logger.error('OTP verification failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
