/**
 * Single source of truth for public (browser-safe) environment variables.
 * No hardcoded project IDs or API keys — values must come from Vercel / .env.local.
 */

function requirePublicEnv(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local (dev) or Vercel project settings (production).`,
    );
  }
  return value;
}

export function getPublicFirebaseConfig() {
  return {
    apiKey: requirePublicEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
    authDomain: requirePublicEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    databaseURL: requirePublicEnv('NEXT_PUBLIC_FIREBASE_DATABASE_URL'),
    projectId: requirePublicEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: requirePublicEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: requirePublicEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: requirePublicEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
  };
}

/** Firebase project id — used to scope browser caches per project. */
export function getFirebaseProjectId(): string {
  return getPublicFirebaseConfig().projectId;
}

/**
 * Cloud Functions base URL. Prefer explicit NEXT_PUBLIC_API_BASE_URL; otherwise
 * derive from project id (us-central1 default region for this project).
 */
export function getApiBaseUrl(): string {
  const explicit = String(process.env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  if (explicit) {
    return explicit.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  const projectId = getFirebaseProjectId();
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}
