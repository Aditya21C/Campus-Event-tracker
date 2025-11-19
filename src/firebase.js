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
  apiKey: "AIzaSyDTvILNK5HmtTAOD2IW0jQjn0m93ixAC_oDvc",
  authDomain: "event-tracker-5830d.firebaseapp.com",
  projectId: "event-tracker-5830d",
  storageBucket: "event-tracker-5830d.appspot.com",
  messagingSenderId: "1024149495028",
  appId: "1:1024149495028:web:f9ee2f376f99876c0492a1",
  measurementId: "G-YQ5SQYDFTT"
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
