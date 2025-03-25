import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import * as SecureStore from "expo-secure-store";

// figure out if our delete functions are properly integrated
export const authService = {
  // Basic auth operations
  getCurrentUser() {
    return auth.currentUser;
  },

  async getToken() {
    try {
      return await SecureStore.getItemAsync("auth_token");
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  },

  async saveToken(token) {
    try {
      await SecureStore.setItemAsync("auth_token", token);
    } catch (error) {
      console.error("Error saving token:", error);
    }
  },

  async register(email, password, displayName) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Save token
      const token = await user.getIdToken();
      await this.saveToken(token);

      // Initialize user document
      await setDoc(doc(db, "users", user.uid), {
        email,
        displayName,
        createdAt: serverTimestamp(),
        savedRecipes: [],
        mealPlans: [],
        isPremium: false,
      });

      return { user };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Save token
      const token = await user.getIdToken();
      await this.saveToken(token);

      return { user };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  async logout() {
    try {
      await firebaseSignOut(auth);
      await SecureStore.deleteItemAsync("auth_token");
      return true;
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

  // Premium status
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

      await updateDoc(doc(db, "users", user.uid), {
        isPremium: true,
      });

      return true;
    } catch (error) {
      console.error("Error upgrading to premium:", error);
      throw error;
    }
  },

  // Recipe operations
  async saveRecipe(recipeData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      // Ensure recipe has an ID
      if (!recipeData.id) {
        recipeData.id = `recipe_${Date.now()}`;
      }

      // Add saved timestamp
      recipeData.savedAt = new Date().toISOString();

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedRecipes = userData.savedRecipes || [];
        const recipeExists = savedRecipes.some(
          (recipe) => recipe.id === recipeData.id
        );

        if (!recipeExists) {
          // Using array update for Firestore
          await updateDoc(userRef, {
            savedRecipes: arrayUnion(recipeData),
          });
        }

        return await this.getSavedRecipes();
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

  async removeRecipe(recipeId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedRecipes = userData.savedRecipes || [];

        const recipeToRemove = savedRecipes.find(
          (recipe) => recipe.id === recipeId
        );

        if (recipeToRemove) {
          await updateDoc(userRef, {
            savedRecipes: arrayRemove(recipeToRemove),
          });
        }
      }

      return true;
    } catch (error) {
      console.error("Error removing recipe:", error);
      throw error;
    }
  },

  // Meal plan operations
  async saveMealPlan(mealPlanData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      // Ensure meal plan has an ID
      if (!mealPlanData.id) {
        mealPlanData.id = `mealplan_${Date.now()}`;
      }

      // Add saved timestamp
      mealPlanData.savedAt = new Date().toISOString();

      const userRef = doc(db, "users", user.uid);

      // Using arrayUnion for Firestore
      await updateDoc(userRef, {
        mealPlans: arrayUnion(mealPlanData),
      });

      return await this.getMealPlans();
    } catch (error) {
      console.error("Error saving meal plan:", error);
      throw error;
    }
  },

  async getMealPlans() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        return userDoc.data().mealPlans || [];
      }
      return [];
    } catch (error) {
      console.error("Error getting meal plans:", error);
      throw error;
    }
  },

  // we need to fix this if we plan on having users name their meal plans for saving
  async removeMealPlan(mealPlanId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const mealPlans = userData.mealPlans || [];

        const mealPlanToRemove = mealPlans.find(
          (plan) => plan.id === mealPlanId
        );

        if (mealPlanToRemove) {
          await updateDoc(userRef, {
            mealPlans: arrayRemove(mealPlanToRemove),
          });
        }
      }

      return true;
    } catch (error) {
      console.error("Error removing meal plan:", error);
      throw error;
    }
  },

  // Auth state
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, callback);
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
