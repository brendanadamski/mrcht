import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth, type User } from "firebase/auth";
import { addDoc, collection, getFirestore, serverTimestamp, type Firestore } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import type { TraceEvent } from "../types";

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);

let services: FirebaseServices | null = null;

export const getFirebaseServices = () => {
  if (!isFirebaseConfigured) return null;
  if (!services) {
    const app = initializeApp(firebaseConfig);
    services = {
      app,
      auth: getAuth(app),
      firestore: getFirestore(app),
      storage: getStorage(app)
    };
  }

  return services;
};

export const signInWithGoogle = async () => {
  const firebase = getFirebaseServices();
  if (!firebase) throw new Error("Firebase is not configured. Add Vite Firebase environment variables first.");

  const provider = new GoogleAuthProvider();
  await signInWithPopup(firebase.auth, provider);
};

export const signOutOfFirebase = async () => {
  const firebase = getFirebaseServices();
  if (!firebase) return;

  await signOut(firebase.auth);
};

export const saveTrace = async (user: User | null, trace: TraceEvent) => {
  const firebase = getFirebaseServices();
  if (!firebase || !user) return;

  await addDoc(collection(firebase.firestore, "users", user.uid, "traces"), {
    ...trace,
    createdAt: serverTimestamp()
  });
};

export const uploadSourceFile = async (user: User | null, file: File) => {
  const firebase = getFirebaseServices();
  if (!firebase || !user) return null;

  const fileRef = ref(firebase.storage, `users/${user.uid}/uploads/${Date.now()}-${file.name}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
};
