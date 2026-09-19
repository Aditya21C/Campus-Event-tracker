// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "-",
  authDomain: "-",
  projectId: "-",
  storageBucket: "-",
  messagingSenderId: "-",
  appId: "-",
  measurementId: "-"
};

// INIT
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ------------ USERS ------------
export async function createUser(userId, userData) {
  await setDoc(doc(db, "users", userId), userData);
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// ------------ EVENTS ------------
export async function createEvent(eventData) {
  await addDoc(collection(db, "events"), eventData);
}

export async function getAllEvents() {
  const snap = await getDocs(collection(db, "events"));
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export { db };
