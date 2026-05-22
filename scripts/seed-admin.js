import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

// Initialize Firebase Admin
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Firebase Admin credentials are not fully configured in your .env.local file.');
  console.error('Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.');
  process.exit(1);
}

try {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  console.log('✅ Firebase Admin initialized.');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error);
  process.exit(1);
}

const db = getFirestore();

async function seedAdmin() {
  console.log('⏳ Seeding admin account into Firestore...');
  
  const adminId = randomUUID();
  const adminUser = {
    id: adminId,
    name: 'admin',
    role: 'Admin',
    password: 'password', // Storing in plain text as per current system config
    isLocked: false,
    phone: '',
    createdAt: new Date().toISOString()
  };

  try {
    // Check if an admin user already exists
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('name', '==', 'admin').get();
    
    if (!snapshot.empty) {
      console.log('⚠️ An admin user with the username "admin" already exists.');
      // Update it anyway to ensure it has the requested credentials
      const docId = snapshot.docs[0].id;
      await usersRef.doc(docId).update({
        password: 'password',
        role: 'Admin',
        isLocked: false
      });
      console.log('✅ Updated existing admin account credentials to username: admin / password: password');
      process.exit(0);
    }

    // Create the new admin document
    await usersRef.doc(adminId).set(adminUser);
    
    console.log('🎉 Admin account successfully created!');
    console.log('----------------------------------------------------');
    console.log(`Username: ${adminUser.name}`);
    console.log(`Password: ${adminUser.password}`);
    console.log(`Role: ${adminUser.role}`);
    console.log('----------------------------------------------------');
  } catch (error) {
    console.error('❌ Failed to seed admin account:', error);
  }
}

seedAdmin();