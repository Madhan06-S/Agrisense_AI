import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPhoneNumber } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBjbUSMsg4U_nhIuGQJCgbopZk87JOJvQg",
  authDomain: "agrisense-ai-cd54b.firebaseapp.com",
  projectId: "agrisense-ai-cd54b",
  storageBucket: "agrisense-ai-cd54b.firebasestorage.app",
  messagingSenderId: "348640092",
  appId: "1:348640092:web:59d8ec7506aaafa227a799",
  measurementId: "G-5400T6VWWP",
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { auth, signInWithPhoneNumber };
