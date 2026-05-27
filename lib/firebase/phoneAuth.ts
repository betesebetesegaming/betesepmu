import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from './client';

const RECAPTCHA_CONTAINER_ID = 'firebase-phone-recaptcha';

let recaptchaVerifier: RecaptchaVerifier | null = null;
let pendingConfirmation: ConfirmationResult | null = null;
let pendingPhoneE164: string | null = null;

function ensureRecaptchaContainer(): void {
  if (typeof document === 'undefined') {
    throw new Error('Phone verification is only available in the browser.');
  }
  if (!document.getElementById(RECAPTCHA_CONTAINER_ID)) {
    const el = document.createElement('div');
    el.id = RECAPTCHA_CONTAINER_ID;
    el.setAttribute('aria-hidden', 'true');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.overflow = 'hidden';
    document.body.appendChild(el);
  }
}

function resetRecaptcha(): void {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      // ignore — verifier may already be destroyed
    }
    recaptchaVerifier = null;
  }
}

function getRecaptchaVerifier(): RecaptchaVerifier {
  ensureRecaptchaContainer();
  resetRecaptcha();
  recaptchaVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
    size: 'invisible',
  });
  return recaptchaVerifier;
}

/** Normalise to E.164 (+220… / +221…) for Firebase Phone Auth. */
export function toFirebasePhoneE164(phone: string): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('220') && digits.length === 10) return `+${digits}`;
  if (digits.startsWith('221') && digits.length === 12) return `+${digits}`;
  if (digits.length === 7) return `+220${digits}`;
  if (phone.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Invalid phone number format.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/captcha-check-failed':
      return 'Security check failed. Refresh the page and try again.';
    case 'auth/invalid-verification-code':
      return 'Invalid verification code.';
    case 'auth/code-expired':
      return 'Verification code expired. Request a new one.';
    case 'auth/missing-verification-code':
      return 'Enter the verification code from your SMS.';
    case 'auth/quota-exceeded':
      return 'SMS quota exceeded. Try again later or contact support.';
    default:
      return err instanceof Error ? err.message : 'Phone verification failed.';
  }
}

/** Send an OTP via Firebase Phone Auth (replaces Africell SMS for signup). */
export async function sendFirebasePhoneOtp(
  phone: string,
): Promise<{ expirySeconds: number }> {
  const e164 = toFirebasePhoneE164(phone);
  if (!e164) {
    throw new Error('Invalid phone number. Use a valid Gambia (+220) or Senegal (+221) mobile number.');
  }

  // Avoid carrying over an unrelated Firebase Auth session during signup.
  try {
    await signOut(auth);
  } catch {
    // no session — fine
  }

  try {
    const verifier = getRecaptchaVerifier();
    pendingConfirmation = await signInWithPhoneNumber(auth, e164, verifier);
    pendingPhoneE164 = e164;
    // Firebase SMS codes typically expire in ~60s; UI countdown uses this hint.
    return { expirySeconds: 60 };
  } catch (err) {
    resetRecaptcha();
    pendingConfirmation = null;
    pendingPhoneE164 = null;
    throw new Error(mapFirebaseAuthError(err));
  }
}

/** Confirm the Firebase OTP, then sign out (signup uses custom Firestore auth). */
export async function verifyFirebasePhoneOtp(code: string): Promise<void> {
  if (!pendingConfirmation) {
    throw new Error('No verification in progress. Request a new code first.');
  }

  try {
    await pendingConfirmation.confirm(String(code).trim());
  } catch (err) {
    throw new Error(mapFirebaseAuthError(err));
  } finally {
    pendingConfirmation = null;
    pendingPhoneE164 = null;
    resetRecaptcha();
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  }
}

export function clearFirebasePhoneOtpSession(): void {
  pendingConfirmation = null;
  pendingPhoneE164 = null;
  resetRecaptcha();
}

export function getPendingFirebasePhone(): string | null {
  return pendingPhoneE164;
}
