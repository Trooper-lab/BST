import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAkH1jIdwCkKZvTII0cmqKwSUM1xZI8xD8",
  authDomain: "bts-logistics-pro.firebaseapp.com",
  projectId: "bts-logistics-pro",
  storageBucket: "bts-logistics-pro.firebasestorage.app",
  messagingSenderId: "206903589264",
  appId: "1:206903589264:web:3cebeb529532b189245b15"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const accounts = [
  { email: 'superadmin@test.es', pass: 'TestTest12345', data: { role: 'superadmin', firstName: 'Super', lastName: 'Admin', status: 'active', email: 'superadmin@test.es' } },
  { email: 'admin@test.es', pass: 'TestTest12345', data: { role: 'admin', firstName: 'Admin', lastName: 'Test', status: 'active', email: 'admin@test.es' } },
  { email: 'manager@test.es', pass: 'TestTest12345', data: { role: 'admin', firstName: 'Manager', lastName: 'Test', status: 'active', email: 'manager@test.es' } },
  { email: 'company1@test.es', pass: 'TestTest12345', data: { role: 'company', firstName: 'Company', lastName: 'One', status: 'active', email: 'company1@test.es' } },
  { email: 'drivercompany1@test.es', pass: 'TestTest12345', data: { role: 'driver', firstName: 'Driver', lastName: 'Company1', status: 'active', email: 'drivercompany1@test.es' } },
];

async function seed() {
  let company1Uid = '';
  try {
    const cred = await signInWithEmailAndPassword(auth, 'company1@test.es', 'TestTest12345');
    company1Uid = cred.user.uid;
    console.log('company1 UID:', company1Uid);
  } catch(e) {}

  for (const acc of accounts) {
    try {
      const cred = await signInWithEmailAndPassword(auth, acc.email, acc.pass);
      const uid = cred.user.uid;
      let data = acc.data as any;
      if (acc.email === 'drivercompany1@test.es') {
        data.companyId = company1Uid;
      }
      await setDoc(doc(db, 'users', uid), data, { merge: true });
      console.log('Set doc for', acc.email);
    } catch(e) {
      console.error('Failed for', acc.email, (e as any).message);
    }
  }
  process.exit(0);
}

seed();
