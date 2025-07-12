// Enhanced authService.js
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export const authService = {
  // Cache for premium status to avoid excessive Firestore calls
  _premiumStatusCache: null,
  _cacheTimestamp: null,
  _cacheValidityMs: 30000, // 30 seconds

  getCurrentUser() {
    return auth.currentUser;
  },

  async register(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create comprehensive user document
      const userData = {
        email: user.email,
        createdAt: new Date().toISOString(),
        isPremium: false,
        savedRecipes: [],
        mealPlans: [],
        preferences: {
          dietaryRestrictions: [],
          allergies: [],
          cuisinePreferences: []
        },
        usage: {
          recipesViewed: 0,
          mealPlansCreated: 0,
          lastActive: new Date().toISOString()
        }
      };

      await setDoc(doc(db, "users", user.uid), userData);
      console.log('✅ User registered and document created');

      return { ...user, ...userData };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get or create user document
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      let userData;
      if (userDoc.exists()) {
        userData = userDoc.data();
        
        // Update last active timestamp
        await updateDoc(userRef, {
          'usage.lastActive': new Date().toISOString()
        });
      } else {
        // Create missing user document
        userData = {
          email: user.email,
          createdAt: new Date().toISOString(),
          isPremium: false,
          savedRecipes: [],
          mealPlans: [],
          preferences: {
            dietaryRestrictions: [],
            allergies: [],
            cuisinePreferences: []
          },
          usage: {
            recipesViewed: 0,
            mealPlansCreated: 0,
            lastActive: new Date().toISOString()
          }
        };
        
        await setDoc(userRef, userData);
        console.log('✅ Missing user document created during login');
      }

      // Clear premium cache since user just logged in
      this._premiumStatusCache = null;
      this._cacheTimestamp = null;

      console.log('✅ User logged in successfully');
      return { ...user, ...userData };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  async logout() {
    try {
      await signOut(auth);
      
      // Clear caches
      this._premiumStatusCache = null;
      this._cacheTimestamp = null;
      
      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error("Error during logout:", error);
      throw error;
    }
  },

  async forgotPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Password reset email sent');
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  },

  // Enhanced premium status checking with caching
  async checkPremiumStatus(useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache && this._premiumStatusCache !== null && this._cacheTimestamp) {
        const cacheAge = Date.now() - this._cacheTimestamp;
        if (cacheAge < this._cacheValidityMs) {
          console.log('📋 Using cached premium status:', this._premiumStatusCache);
          return this._premiumStatusCache;
        }
      }

      const user = auth.currentUser;
      if (!user) {
        this._premiumStatusCache = false;
        this._cacheTimestamp = Date.now();
        return false;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const isPremium = userDoc.exists() ? userDoc.data().isPremium || false : false;
      
      // Update cache
      this._premiumStatusCache = isPremium;
      this._cacheTimestamp = Date.now();
      
      console.log('✅ Premium status checked:', isPremium);
      return isPremium;
    } catch (error) {
      console.error("Error checking premium status:", error);
      // Return cached value if available, otherwise false
      return this._premiumStatusCache !== null ? this._premiumStatusCache : false;
    }
  },

  // Enhanced method to get premium status from multiple sources
  async getPremiumStatusWithSource() {
    try {
      const user = auth.currentUser;
      if (!user) {
        return { isPremium: false, source: 'no_user' };
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        return { isPremium: false, source: 'no_document' };
      }

      const userData = userDoc.data();
      const isPremium = userData.isPremium || false;
      const subscriptionInfo = userData.subscriptionInfo;
      const lastSynced = userData.lastSyncedAt;

      return {
        isPremium,
        source: 'firestore',
        subscriptionInfo,
        lastSynced,
        cacheAge: this._cacheTimestamp ? Date.now() - this._cacheTimestamp : null
      };
    } catch (error) {
      console.error("Error getting premium status with source:", error);
      return { isPremium: false, source: 'error', error: error.message };
    }
  },

  // Clear premium cache (useful after purchases)
  clearPremiumCache() {
    this._premiumStatusCache = null;
    this._cacheTimestamp = null;
    console.log('🗑️ Premium status cache cleared');
  },

  // Enhanced recipe operations with premium checks
  async saveRecipe(recipeData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      // Check if user has premium for unlimited saves
      const isPremium = await this.checkPremiumStatus();
      
      if (!isPremium) {
        // Check current saved recipes count for free users
        const currentRecipes = await this.getSavedRecipes();
        const FREE_RECIPE_LIMIT = 10; // Adjust as needed
        
        if (currentRecipes.length >= FREE_RECIPE_LIMIT) {
          throw new Error(`Free users can only save ${FREE_RECIPE_LIMIT} recipes. Upgrade to Premium for unlimited saves.`);
        }
      }

      if (!recipeData.id) {
        recipeData.id = `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      recipeData.savedAt = new Date().toISOString();

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedRecipes = userData.savedRecipes || [];
        const recipeExists = savedRecipes.some(recipe => recipe.id === recipeData.id);

        if (!recipeExists) {
          await updateDoc(userRef, {
            savedRecipes: arrayUnion(recipeData),
          });
          
          console.log('✅ Recipe saved successfully');
        } else {
          console.log('ℹ️ Recipe already saved');
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
      return userDoc.exists() ? userDoc.data().savedRecipes || [] : [];
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
        const recipeToRemove = savedRecipes.find(recipe => recipe.id === recipeId);

        if (recipeToRemove) {
          await updateDoc(userRef, {
            savedRecipes: arrayRemove(recipeToRemove),
          });
          console.log('✅ Recipe removed successfully');
        }
      }

      return true;
    } catch (error) {
      console.error("Error removing recipe:", error);
      throw error;
    }
  },

  // Enhanced meal plan operations with premium checks
  async saveMealPlan(mealPlanData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      // Check if user has premium for meal plans
      const isPremium = await this.checkPremiumStatus();
      if (!isPremium) {
        throw new Error("Meal plans are a premium feature. Please upgrade to access this functionality.");
      }

      if (!mealPlanData.id) {
        mealPlanData.id = `mealplan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      mealPlanData.savedAt = new Date().toISOString();

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        mealPlans: arrayUnion(mealPlanData),
        'usage.mealPlansCreated': arrayUnion(new Date().toISOString())
      });

      console.log('✅ Meal plan saved successfully');
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
      return userDoc.exists() ? userDoc.data().mealPlans || [] : [];
    } catch (error) {
      console.error("Error getting meal plans:", error);
      throw error;
    }
  },

  async removeMealPlan(mealPlanId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const mealPlans = userData.mealPlans || [];
        const mealPlanToRemove = mealPlans.find(plan => plan.id === mealPlanId);

        if (mealPlanToRemove) {
          await updateDoc(userRef, {
            mealPlans: arrayRemove(mealPlanToRemove),
          });
          console.log('✅ Meal plan removed successfully');
        }
      }

      return true;
    } catch (error) {
      console.error("Error removing meal plan:", error);
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
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error("Error getting user data:", error);
      throw error;
    }
  },

  // Utility method for debugging
  async debugUserState() {
    try {
      const user = auth.currentUser;
      if (!user) return { error: 'No user logged in' };

      const userData = await this.getUserData();
      const premiumStatus = await this.getPremiumStatusWithSource();

      return {
        userId: user.uid,
        email: user.email,
        userData,
        premiumStatus,
        cacheInfo: {
          cached: this._premiumStatusCache,
          timestamp: this._cacheTimestamp,
          age: this._cacheTimestamp ? Date.now() - this._cacheTimestamp : null
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }
};
