import 'server-only';
import { initializeApp, getApps, applicationDefault, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getStorage, type Storage } from 'firebase-admin/storage';

/**
 * Admin SDK initialiser used by Next.js API routes during local dev. In
 * production all backend logic runs as Firebase Cloud Functions
 * (see `functions/`), where the SDK auto-discovers credentials.
 *
 * Locally we prefer an explicit service-account JSON (via
 * FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY); if those aren't set we fall
 * back to Application Default Credentials so a developer who has run
 * `gcloud auth application-default login` can still hit the Admin SDK.
 */
function initAdmin(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT
    ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Missing FIREBASE_PROJECT_ID / GCLOUD_PROJECT / NEXT_PUBLIC_FIREBASE_PROJECT_ID for Admin SDK.');
  }
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    ?? `https://${projectId}-default-rtdb.firebaseio.com`;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    ?? `${projectId}.firebasestorage.app`;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL,
      storageBucket,
    });
  }

  // No explicit service account — fall back to ADC. This works in Cloud
  // Functions and on any host where Google ADC is configured.
  return initializeApp({
    credential: applicationDefault(),
    projectId,
    databaseURL,
    storageBucket,
  });
}

const adminApp = initAdmin();
export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
export const adminRtdb: Database = getDatabase(adminApp);
export const adminStorage: Storage = getStorage(adminApp);
