import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name}. Run with: node --env-file=.env.local scripts/seed-admin.js`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv('NEXT_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requireEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  databaseURL: requireEnv('NEXT_PUBLIC_FIREBASE_DATABASE_URL'),
  projectId: requireEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('NEXT_PUBLIC_FIREBASE_APP_ID'),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_DOC_ID = 'admin';
const ADMIN_NAME = 'admin';
const ADMIN_PASSWORD = 'password';

async function seedAdmin() {
  console.log(`⏳ Seeding admin account into Firestore project: ${firebaseConfig.projectId}...`);

  const adminRef = doc(db, 'users', ADMIN_DOC_ID);
  const adminSnap = await getDoc(adminRef);

  const baseRecord = {
    id: ADMIN_DOC_ID,
    name: ADMIN_NAME,
    name_lower: ADMIN_NAME.toLowerCase(),
    role: 'Admin',
    password: ADMIN_PASSWORD,
    is_locked: false,
    phone: '',
    correction_pin: '0000',
    wallet_balance: 0,
    bonus_balance: 0,
    total_deposited_amount: 0,
    created_at: new Date().toISOString(),
  };

  try {
    if (adminSnap.exists()) {
      console.log('⚠️  Admin user already exists — resetting credentials.');
      await setDoc(adminRef, {
        ...adminSnap.data(),
        ...baseRecord,
      });
      console.log('✅ Admin reset to id: admin / password: password');
    } else {
      await setDoc(adminRef, baseRecord);
      console.log('🎉 Admin account created.');
    }

    console.log('----------------------------------------------------');
    console.log(`Project:  ${firebaseConfig.projectId}`);
    console.log(`ID:       ${ADMIN_DOC_ID}`);
    console.log(`Username: ${ADMIN_NAME}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log(`Role:     Admin`);
    console.log('----------------------------------------------------');
    console.log('Login tip: type "admin" in the mobile number field, then password = password.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin account:', error.message);
    if (String(error.message || '').includes('Missing or insufficient permissions')) {
      console.error('⚠️  Temporarily relax Firestore rules for users/, or use the Admin SDK.');
    }
    process.exit(1);
  }
}

seedAdmin();
