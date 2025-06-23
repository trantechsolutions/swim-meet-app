import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from './config.js';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export instances of auth and firestore to be used throughout the app
export const auth = getAuth(app);
export const db = getFirestore(app);