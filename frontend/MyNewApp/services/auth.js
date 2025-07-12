// Enhanced authService.js with onboarding data handling
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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const token = await user.getIdToken();
      await this.saveToken(token);

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
        profile: {
          height: null,
          weight: null,
          targetWeight: null,
          age: null,
          activityLevel: null,
          healthGoals: [],
          onboardingCompleted: false,
          onboardingData: null
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

      const token = await user.getIdToken();
      await this.saveToken(token);

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
          profile: {
            height: null,
            weight: null,
            targetWeight: null,
            age: null,
            activityLevel: null,
            healthGoals: [],
            onboardingCompleted: false,
            onboardingData: null
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

      return { ...user, ...userData };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  // New method to save onboarding data
  async saveOnboardingData(answers) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      
      // Process the answers into structured profile data
      const profileData = this.processOnboardingAnswers(answers);
      
      // Update user document with onboarding data
      await updateDoc(userRef, {
        'profile.height': profileData.height,
        'profile.weight': profileData.weight,
        'profile.targetWeight': profileData.targetWeight,
        'profile.age': profileData.age,
        'profile.activityLevel': profileData.activityLevel,
        'profile.healthGoals': profileData.healthGoals,
        'profile.onboardingCompleted': true,
        'profile.onboardingData': {
          answers: answers,
          completedAt: new Date().toISOString(),
          version: '1.0'
        },
        'preferences.dietaryRestrictions': profileData.dietaryRestrictions,
        'usage.lastActive': new Date().toISOString()
      });

      console.log('✅ Onboarding data saved successfully');
      return true;
    } catch (error) {
      console.error("Error saving onboarding data:", error);
      throw error;
    }
  },

  // Helper method to process onboarding answers into structured data
  processOnboardingAnswers(answers) {
    const profile = {
      height: null,
      weight: null,
      targetWeight: null,
      age: null,
      activityLevel: null,
      healthGoals: [],
      dietaryRestrictions: []
    };

    // Process physical stats
    if (answers.physical_stats) {
      const stats = answers.physical_stats;
      
      // Parse height (handle both formats: "5'8\"" and "173 cm")
      if (stats.height) {
        profile.height = this.parseHeight(stats.height);
      }
      
      // Parse weight (handle both formats: "150 lbs" and "68 kg")
      if (stats.weight) {
        profile.weight = this.parseWeight(stats.weight);
      }
      
      // Parse target weight
      if (stats.target_weight) {
        profile.targetWeight = this.parseWeight(stats.target_weight);
      }
      
      // Parse age
      if (stats.age) {
        profile.age = parseInt(stats.age);
      }
    }

    // Process activity level
    if (answers.activity_level) {
      profile.activityLevel = answers.activity_level;
    }

    // Process health goals
    if (answers.health_goals && Array.isArray(answers.health_goals)) {
      profile.healthGoals = answers.health_goals;
    }

    // Process dietary restrictions
    if (answers.dietary_restrictions && Array.isArray(answers.dietary_restrictions)) {
      profile.dietaryRestrictions = answers.dietary_restrictions.filter(item => item !== 'none');
    }

    return profile;
  },

  // Helper method to parse height from various formats
  parseHeight(heightStr) {
    if (!heightStr) return null;
    
    const str = heightStr.toLowerCase().trim();
    
    // Handle feet and inches format (5'8")
    const feetInchesMatch = str.match(/(\d+)'?\s*(\d+)"/);
    if (feetInchesMatch) {
      const feet = parseInt(feetInchesMatch[1]);
      const inches = parseInt(feetInchesMatch[2]);
      return (feet * 12 + inches) * 2.54; // Convert to cm
    }
    
    // Handle cm format (173 cm)
    const cmMatch = str.match(/(\d+)\s*cm/);
    if (cmMatch) {
      return parseInt(cmMatch[1]);
    }
    
    // Handle inches format (68 in)
    const inchesMatch = str.match(/(\d+)\s*in/);
    if (inchesMatch) {
      return parseInt(inchesMatch[1]) * 2.54; // Convert to cm
    }
    
    // Try to parse as plain number (assume cm)
    const numberMatch = str.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      // If number is likely feet (under 8), convert to cm
      if (num <= 8) {
        return num * 30.48; // feet to cm
      }
      return num; // assume cm
    }
    
    return null;
  },

  // Helper method to parse weight from various formats
  parseWeight(weightStr) {
    if (!weightStr) return null;
    
    const str = weightStr.toLowerCase().trim();
    
    // Handle lbs format (150 lbs)
    const lbsMatch = str.match(/(\d+)\s*lbs?/);
    if (lbsMatch) {
      return parseInt(lbsMatch[1]) * 0.453592; // Convert to kg
    }
    
    // Handle kg format (68 kg)
    const kgMatch = str.match(/(\d+)\s*kg/);
    if (kgMatch) {
      return parseInt(kgMatch[1]);
    }
    
    // Try to parse as plain number (assume lbs if > 50, kg if <= 50)
    const numberMatch = str.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 50) {
        return num * 0.453592; // assume lbs, convert to kg
      }
      return num; // assume kg
    }
    
    return null;
  },

  // Method to get user's profile data
  async getUserProfile() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        return userDoc.data().profile || null;
      }
      return null;
    } catch (error) {
      console.error("Error getting user profile:", error);
      throw error;
    }
  },

  // Method to update user profile
  async updateUserProfile(profileData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const updateData = {};
      
      // Create update object with profile prefix
      Object.keys(profileData).forEach(key => {
        updateData[`profile.${key}`] = profileData[key];
      });
      
      await updateDoc(userRef, updateData);
      console.log('✅ User profile updated successfully');
      return true;
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  },

  // Method to calculate BMI and other health metrics
  calculateHealthMetrics(profile) {
    if (!profile || !profile.height || !profile.weight) {
      return null;
    }

    const heightInMeters = profile.height / 100; // Convert cm to meters
    const weightInKg = profile.weight;
    
    const bmi = weightInKg / (heightInMeters * heightInMeters);
    
    let bmiCategory = 'normal';
    if (bmi < 18.5) bmiCategory = 'underweight';
    else if (bmi >= 25 && bmi < 30) bmiCategory = 'overweight';
    else if (bmi >= 30) bmiCategory = 'obese';

    // Calculate BMR using Mifflin-St Jeor Equation
    let bmr = 0;
    if (profile.age) {
      // Assuming average for mixed population (can be refined with gender data)
      bmr = (10 * weightInKg) + (6.25 * profile.height) - (5 * profile.age) + 5;
    }

    // Calculate TDEE based on activity level
    let tdee = 0;
    if (bmr > 0 && profile.activityLevel) {
      const activityMultipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        very: 1.725
      };
      tdee = bmr * (activityMultipliers[profile.activityLevel] || 1.2);
    }

    return {
      bmi: Math.round(bmi * 10) / 10,
      bmiCategory,
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      heightCm: profile.height,
      weightKg: Math.round(profile.weight * 10) / 10,
      targetWeightKg: profile.targetWeight ? Math.round(profile.targetWeight * 10) / 10 : null
    };
  },

  async saveToken(token) {
    try {
      await SecureStore.setItemAsync("auth_token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } catch (error) {
      console.error("Error saving token:", error);
      throw error;
    }
  },

  async logout() {
    try {
      await signOut(auth);
      await SecureStore.deleteItemAsync("auth_token");
      delete axios.defaults.headers.common["Authorization"];
      
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

  // this is a function to refresh token
  async refreshToken() {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    
    while (retryCount < MAX_RETRIES) {
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No current user');
        }
        
        const token = await user.getIdToken(true);
        await this.saveToken(token);
        console.log('✅ Token refreshed successfully');
        return token;
      } catch (error) {
        retryCount++;
        console.error(`Token refresh attempt ${retryCount} failed:`, error);
        
        if (retryCount >= MAX_RETRIES) {
          console.error('❌ Token refresh failed after all retries');
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
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

  // Premium upgrade methods (keep existing functionality)
  async upgradeToPremium() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        isPremium: true,
        premiumUpgradedAt: new Date().toISOString(),
        'usage.lastActive': new Date().toISOString()
      });

      // Clear cache to force refresh
      this.clearPremiumCache();
      
      console.log('✅ User upgraded to premium');
      return true;
    } catch (error) {
      console.error("Error upgrading to premium:", error);
      throw error;
    }
  },

  async updatePremiumStatus(isPremium, subscriptionInfo = null) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const updateData = {
        isPremium: isPremium,
        lastSyncedAt: new Date().toISOString(),
        'usage.lastActive': new Date().toISOString()
      };

      if (subscriptionInfo) {
        updateData.subscriptionInfo = subscriptionInfo;
      }

      if (isPremium) {
        updateData.premiumUpgradedAt = new Date().toISOString();
      }

      await updateDoc(userRef, updateData);

      // Update cache
      this._premiumStatusCache = isPremium;
      this._cacheTimestamp = Date.now();
      
      console.log('✅ Premium status updated:', isPremium);
      return true;
    } catch (error) {
      console.error("Error updating premium status:", error);
      throw error;
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

  async initialize() {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          try {
            const token = await user.getIdToken();
            await this.saveToken(token);
            console.log('✅ Auth service initialized for user:', user.uid);
            resolve(true);
          } catch (error) {
            console.error('❌ Auth initialization failed:', error);
            resolve(false);
          }
        } else {
          console.log('ℹ️ No user found during initialization');
          resolve(false);
        }
      });
    });
  },

  // Utility method for debugging
  async debugUserState() {
    try {
      const user = auth.currentUser;
      if (!user) return { error: 'No user logged in' };

      const userData = await this.getUserData();
      const premiumStatus = await this.getPremiumStatusWithSource();
      const token = await this.getToken();

      return {
        userId: user.uid,
        email: user.email,
        userData,
        premiumStatus,
        hasToken: !!token,
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
