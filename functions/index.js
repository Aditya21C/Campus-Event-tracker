const functions = require("firebase-functions");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");

admin.initializeApp();
const db = admin.firestore();

// SIGNUP
exports.registerUser = functions.https.onCall(async (data, context) => {
  const { username, password, role, subjects, clubs } = data;

  // Check if username exists
  const existing = await db
    .collection("users")
    .where("username", "==", username)
    .get();

  if (!existing.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "Username already taken"
    );
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const userRef = await db.collection("users").add({
    username,
    passwordHash,
    role,
    subjects,
    clubs,
    createdAt: new Date().toISOString(),
  });

  return { userId: userRef.id };
});

// LOGIN
exports.loginUser = functions.https.onCall(async (data, context) => {
  const { username, password } = data;

  const snapshot = await db
    .collection("users")
    .where("username", "==", username)
    .get();

  if (snapshot.empty) {
    throw new functions.https.HttpsError(
      "not-found",
      "Invalid username"
    );
  }

  const userDoc = snapshot.docs[0];
  const user = userDoc.data();

  // Compare password
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Wrong password"
    );
  }

  return {
    userId: userDoc.id,
    username: user.username,
    role: user.role,
    subjects: user.subjects,
    clubs: user.clubs,
  };
});
