import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { randomUUID } from 'crypto';

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

async function seedAdmin() {
  console.log(`⏳ Seeding admin account into Firestore project: ${firebaseConfig.projectId}...`);

  const adminId = randomUUID();
  const adminUser = {
    id: adminId,
    name: 'admin',
    role: 'Admin',
    password: 'password',
    isLocked: false,
    phone: '',
    createdAt: new Date().toISOString(),
  };

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('name', '==', 'admin'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      console.log('⚠️ An admin user with the username "admin" already exists.');
      const docId = snapshot.docs[0].id;
      await updateDoc(doc(db, 'users', docId), {
        password: 'password',
        role: 'Admin',
        is_locked: false,
      });
      console.log('✅ Updated existing admin account credentials to username: admin / password: password');
      process.exit(0);
    }

    await setDoc(doc(db, 'users', adminId), {
      ...adminUser,
      is_locked: false,
      wallet_balance: 0,
      bonus_balance: 0,
    });

    console.log('🎉 Admin account successfully created!');
    console.log('----------------------------------------------------');
    console.log(`Project: ${firebaseConfig.projectId}`);
    console.log(`Username: ${adminUser.name}`);
    console.log(`Password: ${adminUser.password}`);
    console.log(`Role: ${adminUser.role}`);
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin account:', error.message);
    if (error.message.includes('Missing or insufficient permissions')) {
      console.error('⚠️ Note: You need to temporarily allow open writes in your Firestore security rules, or use the Admin SDK.');
    }
    process.exit(1);
  }
}

seedAdmin();
