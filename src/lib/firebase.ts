import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAkH1jIdwCkKZvTII0cmqKwSUM1xZI8xD8",
  authDomain: "bts-logistics-pro.firebaseapp.com",
  projectId: "bts-logistics-pro",
  storageBucket: "bts-logistics-pro.firebasestorage.app",
  messagingSenderId: "206903589264",
  appId: "1:206903589264:web:3cebeb529532b189245b15"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
