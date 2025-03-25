import * as SecureStore from "expo-secure-store";
import axios from "axios";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig"; // Import from the centralized file

export const authService = {
  async getToken() {
    try {
      return await SecureStore.getItemAsync("auth_token");
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  },

  getCurrentUser() {
    return auth.currentUser;
  },

  async register(email, password) {
    try {
      // Create user with Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Save the token
      const token = await user.getIdToken();
      await this.saveToken(token);

      // Create a user document in Firestore with default non-premium status
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        createdAt: new Date(),
        isPremium: false,
        savedRecipes: [],
        mealPlans: [],
      });

      return user;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  async login(email, password) {
    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Save the token
      const token = await user.getIdToken();
      await this.saveToken(token);

      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        return { ...user, ...userDoc.data() };
      } else {
        // If user document doesn't exist, create one
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          createdAt: new Date(),
          isPremium: false,
          savedRecipes: [],
          mealPlans: [],
        });
        return { ...user, isPremium: false, savedRecipes: [], mealPlans: [] };
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  async saveToken(token) {
    try {
      await SecureStore.setItemAsync("auth_token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } catch (error) {
      console.error("Error saving token:", error);
    }
  },

  async logout() {
    try {
      await signOut(auth);
      await SecureStore.deleteItemAsync("auth_token");
      delete axios.defaults.headers.common["Authorization"];
    } catch (error) {
      console.error("Error during logout:", error);
      throw error;
    }
  },

  async forgotPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  },

  async refreshToken() {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken(true); // Force refresh
        await this.saveToken(token);
        return token;
      }
      return null;
    } catch (error) {
      console.error("Token refresh error:", error);
      throw error;
    }
  },

  async checkPremiumStatus() {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        return userDoc.data().isPremium || false;
      }
      return false;
    } catch (error) {
      console.error("Error checking premium status:", error);
      return false;
    }
  },

  async upgradeToPremuim() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      // Update user document in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        isPremium: true,
      });

      return true;
    } catch (error) {
      console.error("Error upgrading to premium:", error);
      throw error;
    }
  },

  async saveRecipe(recipeData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Check if recipe already exists
        const savedRecipes = userData.savedRecipes || [];
        const recipeExists = savedRecipes.some(
          (recipe) => recipe.id === recipeData.id
        );

        if (!recipeExists) {
          savedRecipes.push(recipeData);
          await updateDoc(userRef, {
            savedRecipes: savedRecipes,
          });
        }

        return savedRecipes;
      } else {
        throw new Error("User document does not exist");
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      throw error;
    }
  },

  async getSavedRecipes() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        return userDoc.data().savedRecipes || [];
      }
      return [];
    } catch (error) {
      console.error("Error getting saved recipes:", error);
      throw error;
    }
  },

  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  async getUserData() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error("Error getting user data:", error);
      throw error;
    }
  },

  async initialize() {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          const token = await user.getIdToken();
          await this.saveToken(token);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },
};
