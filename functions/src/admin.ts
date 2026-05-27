import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getStorage, type Storage } from 'firebase-admin/storage';

/**
 * Initialise the Admin SDK once for the whole Cloud Functions runtime. When
 * running on Functions the SDK auto-discovers project, credentials, and the
 * default bucket via the Application Default Credentials provided by Google.
 */
function ensureApp(): App {
  return getApps()[0] ?? initializeApp();
}

const app = ensureApp();
export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
export const adminRtdb: Database = getDatabase(app);
export const adminStorage: Storage = getStorage(app);
