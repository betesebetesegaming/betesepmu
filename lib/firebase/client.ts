import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getPublicFirebaseConfig } from '../env/publicConfig';

const firebaseConfig = getPublicFirebaseConfig();

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
// Use initializeFirestore instead of getFirestore so we can pass settings.
// experimentalAutoDetectLongPolling: true — on cellular / restricted networks
// (common on Sunmi terminals) Firestore automatically probes whether WebSocket
// is reachable and falls back to long-polling. This eliminates connection
// establishment delays when WebSocket is blocked or unreliable.
export const db: Firestore = initializeFirestore(firebaseApp, {
    experimentalAutoDetectLongPolling: true,
});
export const rtdb: Database = getDatabase(firebaseApp);
export const storage: FirebaseStorage = getStorage(firebaseApp);
