import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, setDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { randomUUID } from 'crypto';

const firebaseConfig = {
  apiKey: "AIzaSyAY9EHkmtuv1l3hRwIP_u1T5PIhlN_zoCs",
  authDomain: "betesepmu-32905.firebaseapp.com",
  databaseURL: "https://betesepmu-32905-default-rtdb.firebaseio.com",
  projectId: "betesepmu-32905",
  storageBucket: "betesepmu-32905.firebasestorage.app",
  messagingSenderId: "123234050813",
  appId: "1:123234050813:web:3bc7ca01166dd345d2d494",
  measurementId: "G-1QWPLJ3QQB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('name', '==', 'admin'));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      console.log('⚠️ An admin user with the username "admin" already exists.');
      const docId = snapshot.docs[0].id;
      await updateDoc(doc(db, 'users', docId), {
        password: 'password',
        role: 'Admin',
        isLocked: false
      });
      console.log('✅ Updated existing admin account credentials to username: admin / password: password');
      process.exit(0);
    }

    await setDoc(doc(db, 'users', adminId), adminUser);
    
    console.log('🎉 Admin account successfully created!');
    console.log('----------------------------------------------------');
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