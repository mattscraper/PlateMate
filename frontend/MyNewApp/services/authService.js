// authService.js
import { auth, db } from "./firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

// Register a new user
export const registerUser = async (email, password, displayName) => {
  try {
    // Create user account
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Create user document in Firestore
    await setDoc(doc(db, "users", user.uid), {
      email,
      displayName,
      createdAt: serverTimestamp(),
      subscription: {
        status: "free",
        startDate: null,
        endDate: null,
      },
      preferences: {
        dietaryRestrictions: [],
        favoriteCategories: [],
        mealSize: 4,
      },
    });

    return user;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
};

// Sign in existing user
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

// Sign out
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return true;
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Check if user is premium
export const checkUserPremiumStatus = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      return false;
    }

    const userData = userDoc.data();
    if (userData.subscription && userData.subscription.status === "premium") {
      // Check if subscription is still valid
      const endDate = userData.subscription.endDate?.toDate();
      if (endDate && endDate > new Date()) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking premium status:", error);
    return false;
  }
};
