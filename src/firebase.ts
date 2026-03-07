import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase initialization failed:", e);
  // Create a dummy app if it fails
  app = {} as any;
}

export const db = (() => {
  try {
    return getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId);
  } catch (e) {
    console.error("Firestore initialization failed:", e);
    return {} as any;
  }
})();

export const auth = (() => {
  try {
    return getAuth(app);
  } catch (e) {
    console.error("Firebase Auth initialization failed:", e);
    return {} as any;
  }
})();

export const storage = (() => {
  try {
    return getStorage(app);
  } catch (e) {
    console.error("Firebase Storage initialization failed:", e);
    return {} as any;
  }
})();
