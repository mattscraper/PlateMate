// Enhanced authService.js with Fixed Grocery List Persistence
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
import PremiumService from "./PremiumService";

export const authService = {
  // Initialize auth service
  async initialize() {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        await this.saveToken(token);
        
        // Initialize PremiumService for current user
        await PremiumService.initialize(user);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Auth initialization error:', error);
      return false;
    }
  },

  // Set up auth state change listener
  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, async (user) => {
      console.log('🔥 Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      
      if (user) {
        // Initialize PremiumService for authenticated user
        await PremiumService.initialize(user);
      } else {
        // Cleanup PremiumService when user logs out
        PremiumService.cleanup();
      }
      
      // Call the original callback
      callback(user);
    });
  },

  async getToken() {
    try {
      return await SecureStore.getItemAsync("auth_token");
    } catch (error) {
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

      // Get token
      const token = await user.getIdToken();
      await this.saveToken(token);

      // Create enhanced user document with grocery list support
      const userData = {
        email: user.email,
        uid: user.uid,
        createdAt: new Date().toISOString(),
        isPremium: false,
        savedRecipes: [],
        mealPlans: [], // Enhanced to include grocery lists
        groceryLists: [], // Standalone grocery lists
        preferences: {
          dietaryRestrictions: [],
          allergies: [],
          cuisinePreferences: [],
          shoppingPreferences: {
            preferredStores: [],
            budgetLimits: {},
            organicPreference: false
          }
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
          groceryListsGenerated: 0,
          lastActive: new Date().toISOString()
        }
      };

      // Create document with retry logic
      let retries = 3;
      let documentCreated = false;
      
      while (retries > 0 && !documentCreated) {
        try {
          await setDoc(doc(db, "users", user.uid), userData);
          documentCreated = true;
          console.log('✅ Enhanced user document created successfully');
        } catch (docError) {
          retries--;
          console.log(`⚠️ Document creation failed, retries left: ${retries}`);
          
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
          }
        }
      }

      // Initialize PremiumService for new user
      await PremiumService.initialize(user);

      return { ...user, ...userData };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const token = await user.getIdToken();
      await this.saveToken(token);

      // Get user document and migrate if needed
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      let userData;
      if (userDoc.exists()) {
        userData = userDoc.data();
        
        // Migrate existing user documents to support grocery lists
        if (!userData.groceryLists) {
          console.log('📝 Migrating user document for grocery list support');
          await updateDoc(userRef, {
            groceryLists: [],
            'preferences.shoppingPreferences': {
              preferredStores: [],
              budgetLimits: {},
              organicPreference: false
            },
            'usage.groceryListsGenerated': 0,
            'usage.lastActive': new Date().toISOString()
          });
          userData.groceryLists = [];
          userData.preferences.shoppingPreferences = {
            preferredStores: [],
            budgetLimits: {},
            organicPreference: false
          };
          userData.usage.groceryListsGenerated = 0;
        } else {
          // Update last active
          try {
            await updateDoc(userRef, {
              'usage.lastActive': new Date().toISOString()
            });
          } catch (updateError) {
            console.log('⚠️ Failed to update last active:', updateError);
          }
        }
      } else {
        // Create missing document with full grocery support
        console.log('📝 Creating missing user document with grocery support');
        userData = {
          email: user.email,
          uid: user.uid,
          createdAt: new Date().toISOString(),
          isPremium: false,
          savedRecipes: [],
          mealPlans: [],
          groceryLists: [],
          preferences: {
            dietaryRestrictions: [],
            allergies: [],
            cuisinePreferences: [],
            shoppingPreferences: {
              preferredStores: [],
              budgetLimits: {},
              organicPreference: false
            }
          },
          profile: {
            height: null, weight: null, targetWeight: null, age: null,
            activityLevel: null, healthGoals: [], onboardingCompleted: false, onboardingData: null
          },
          usage: {
            recipesViewed: 0,
            mealPlansCreated: 0,
            groceryListsGenerated: 0,
            lastActive: new Date().toISOString()
          }
        };
        await setDoc(userRef, userData);
      }

      // Initialize PremiumService for logged in user
      await PremiumService.initialize(user);

      return { ...user, ...userData };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  // Enhanced meal plan operations with grocery list persistence
  async saveMealPlanWithGroceryList(mealPlanData, groceryListData = null) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const isPremium = PremiumService.getCurrentStatus();
      if (!isPremium) {
        throw new Error("Meal plans are a premium feature. Please upgrade to access this functionality.");
      }

      // Generate IDs if not provided
      if (!mealPlanData.id) {
        mealPlanData.id = `mealplan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Prepare enhanced meal plan data
      const enhancedMealPlanData = {
        ...mealPlanData,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasGroceryList: !!groceryListData,
        groceryListId: groceryListData?.grocery_list_id || null
      };

      // If grocery list provided, save it
      if (groceryListData) {
        groceryListData.meal_plan_id = mealPlanData.id;
        groceryListData.created_at = new Date().toISOString();
        groceryListData.updated_at = new Date().toISOString();
        
        await this.saveGroceryList(groceryListData);
      }

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        mealPlans: arrayUnion(enhancedMealPlanData),
        'usage.mealPlansCreated': arrayUnion(new Date().toISOString()),
        'usage.lastActive': new Date().toISOString()
      });

      console.log('✅ Enhanced meal plan with grocery list saved successfully');
      return await this.getMealPlans();
    } catch (error) {
      console.error('Save enhanced meal plan error:', error);
      throw error;
    }
  },

  // FIXED: Grocery list operations with proper update/persistence logic
  async saveGroceryList(groceryListData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      console.log('💾 Saving grocery list...', groceryListData.meal_plan_id);

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document does not exist");
      }

      const userData = userDoc.data();
      const existingGroceryLists = userData.groceryLists || [];

      // Check if this grocery list already exists (by meal_plan_id)
      const existingIndex = existingGroceryLists.findIndex(
        list => list.meal_plan_id === groceryListData.meal_plan_id
      );

      // Generate ID if not provided
      if (!groceryListData.grocery_list_id) {
        groceryListData.grocery_list_id = `grocery_${groceryListData.meal_plan_id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Prepare the grocery list data
      const groceryListToSave = {
        ...groceryListData,
        user_id: user.uid,
        updated_at: new Date().toISOString()
      };

      // If it's the first time saving, add created_at
      if (existingIndex === -1) {
        groceryListToSave.created_at = new Date().toISOString();
        groceryListToSave.saved_at = new Date().toISOString();
      } else {
        // Preserve original creation date
        groceryListToSave.created_at = existingGroceryLists[existingIndex].created_at;
        groceryListToSave.saved_at = existingGroceryLists[existingIndex].saved_at;
      }

      let updatedGroceryLists;
      if (existingIndex === -1) {
        // Add new grocery list
        updatedGroceryLists = [...existingGroceryLists, groceryListToSave];
        console.log('📝 Creating new grocery list entry');
      } else {
        // Update existing grocery list
        updatedGroceryLists = [...existingGroceryLists];
        updatedGroceryLists[existingIndex] = groceryListToSave;
        console.log('🔄 Updating existing grocery list entry');
      }

      // Update the user document with the complete array
      await updateDoc(userRef, {
        groceryLists: updatedGroceryLists,
        'usage.groceryListsGenerated': arrayUnion(new Date().toISOString()),
        'usage.lastActive': new Date().toISOString()
      });

      console.log('✅ Grocery list saved/updated successfully');
      return groceryListToSave;
    } catch (error) {
      console.error('❌ Save grocery list error:', error);
      throw error;
    }
  },

  async getGroceryLists() {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in for getGroceryLists');
        return [];
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        console.log('⚠️ User document does not exist');
        return [];
      }

      const userData = userDoc.data();
      return userData.groceryLists || [];
    } catch (error) {
      console.error('Get grocery lists error:', error);
      return [];
    }
  },

  async getGroceryListByMealPlanId(mealPlanId) {
    try {
      const groceryLists = await this.getGroceryLists();
      return groceryLists.find(list => list.meal_plan_id === mealPlanId) || null;
    } catch (error) {
      console.error('Get grocery list by meal plan ID error:', error);
      return null;
    }
  },

  // FIXED: Update grocery list check states with proper persistence
  async updateGroceryListCheckStates(groceryListId, itemUpdates) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      console.log('🔄 Updating grocery list check states...', groceryListId);

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document does not exist");
      }

      const userData = userDoc.data();
      const groceryLists = userData.groceryLists || [];
      
      // Find the grocery list to update (by ID or meal_plan_id)
      const listIndex = groceryLists.findIndex(list =>
        list.grocery_list_id === groceryListId ||
        list.meal_plan_id === groceryListId
      );
      
      if (listIndex === -1) {
        throw new Error("Grocery list not found");
      }

      // Clone the grocery list for updating
      const updatedList = JSON.parse(JSON.stringify(groceryLists[listIndex]));
      
      // Create lookup for updates
      const updatesLookup = {};
      itemUpdates.forEach(update => {
        updatesLookup[update.name] = update;
      });

      let checkedCount = 0;
      
      // Update check states in grocery_list array
      if (updatedList.grocery_list && Array.isArray(updatedList.grocery_list)) {
        updatedList.grocery_list.forEach(item => {
          if (updatesLookup[item.name]) {
            const update = updatesLookup[item.name];
            item.is_checked = update.is_checked;
            item.checked_at = update.is_checked ? new Date().toISOString() : null;
          }
          if (item.is_checked) checkedCount++;
        });
      }

      // Update check states in categories array if it exists
      if (updatedList.categories && Array.isArray(updatedList.categories)) {
        updatedList.categories.forEach(category => {
          if (category.items && Array.isArray(category.items)) {
            category.items.forEach(item => {
              if (updatesLookup[item.name]) {
                const update = updatesLookup[item.name];
                item.checked = update.is_checked;
                item.checkedAt = update.is_checked ? new Date().toISOString() : null;
                
                // Also update originalItem if it exists
                if (item.originalItem) {
                  item.originalItem.is_checked = update.is_checked;
                  item.originalItem.checked_at = item.checkedAt;
                }
              }
            });
          }
        });
      }

      // Update metadata
      updatedList.updated_at = new Date().toISOString();
      updatedList.last_interaction = new Date().toISOString();
      updatedList.checked_items_count = checkedCount;
      
      const totalItems = updatedList.grocery_list ? updatedList.grocery_list.length : 0;
      updatedList.completion_percentage = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

      // Replace the grocery list in the array
      const updatedGroceryLists = [...groceryLists];
      updatedGroceryLists[listIndex] = updatedList;

      // Update the document
      await updateDoc(userRef, {
        groceryLists: updatedGroceryLists,
        'usage.lastActive': new Date().toISOString()
      });

      console.log(`✅ Grocery list check states updated: ${checkedCount}/${totalItems} items checked (${updatedList.completion_percentage}%)`);
      return updatedList;
    } catch (error) {
      console.error('❌ Update grocery list check states error:', error);
      throw error;
    }
  },

  // FIXED: Remove grocery list with proper array filtering
  async removeGroceryList(groceryListId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      console.log('🗑️ Removing grocery list...', groceryListId);

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document does not exist");
      }

      const userData = userDoc.data();
      const groceryLists = userData.groceryLists || [];
      
      // Find and remove the grocery list (by ID or meal_plan_id)
      const filteredLists = groceryLists.filter(list =>
        list.grocery_list_id !== groceryListId &&
        list.meal_plan_id !== groceryListId
      );

      if (filteredLists.length === groceryLists.length) {
        console.log('⚠️ Grocery list not found for removal');
        return false;
      }

      // Update the document with filtered array
      await updateDoc(userRef, {
        groceryLists: filteredLists,
        'usage.lastActive': new Date().toISOString()
      });

      console.log('✅ Grocery list removed successfully');
      return true;
    } catch (error) {
      console.error('❌ Remove grocery list error:', error);
      throw error;
    }
  },

  // Enhanced meal plan operations with grocery list support
  async getMealPlanWithGroceryList(mealPlanId) {
    try {
      const mealPlans = await this.getMealPlans();
      const mealPlan = mealPlans.find(plan => plan.id === mealPlanId);
      
      if (!mealPlan) {
        return null;
      }

      // Get associated grocery list if it exists
      let groceryList = null;
      if (mealPlan.hasGroceryList && mealPlan.groceryListId) {
        groceryList = await this.getGroceryListById(mealPlan.groceryListId);
      }

      return {
        mealPlan,
        groceryList
      };
    } catch (error) {
      console.error('Get meal plan with grocery list error:', error);
      return null;
    }
  },

  async getGroceryListById(groceryListId) {
    try {
      const groceryLists = await this.getGroceryLists();
      return groceryLists.find(list => list.grocery_list_id === groceryListId) || null;
    } catch (error) {
      console.error('Get grocery list by ID error:', error);
      return null;
    }
  },

  // Simplified premium status check - delegates to PremiumService
  async checkPremiumStatus() {
    return await PremiumService.checkPremiumStatus();
  },

  // Subscribe to premium status changes
  subscribeToPremiumStatus(callback) {
    return PremiumService.subscribe(callback);
  },

  // Get current premium status synchronously
  getCurrentPremiumStatus() {
    return PremiumService.getCurrentStatus();
  },

  // Force refresh premium status
  async forceRefreshPremiumStatus() {
    return await PremiumService.forceRefresh();
  },

  // Handle purchase success
  async handlePurchaseSuccess(purchaseInfo) {
    await PremiumService.handlePurchaseSuccess(purchaseInfo);
  },

  // Recipe operations with premium checks
  async saveRecipe(recipeData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      // Check premium status for limit enforcement
      const isPremium = PremiumService.getCurrentStatus();
      
      if (!isPremium) {
        const currentRecipes = await this.getSavedRecipes();
        const FREE_RECIPE_LIMIT = 10;
        
        if (currentRecipes.length >= FREE_RECIPE_LIMIT) {
          throw new Error(`Free users can only save ${FREE_RECIPE_LIMIT} recipes. Upgrade to Premium for unlimited saves.`);
        }
      }

      // Ensure recipe has proper ID
      if (!recipeData.id) {
        recipeData.id = `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      recipeData.savedAt = new Date().toISOString();

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document does not exist");
      }

      const userData = userDoc.data();
      const savedRecipes = userData.savedRecipes || [];
      const recipeExists = savedRecipes.some(recipe => recipe.id === recipeData.id);

      if (!recipeExists) {
        await updateDoc(userRef, {
          savedRecipes: arrayUnion(recipeData),
          'usage.lastActive': new Date().toISOString()
        });
        console.log('✅ Recipe saved successfully');
      } else {
        console.log('ℹ️ Recipe already exists');
      }

      return await this.getSavedRecipes();
    } catch (error) {
      console.error('Save recipe error:', error);
      throw error;
    }
  },

  async getSavedRecipes() {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in for getSavedRecipes');
        return [];
      }

      console.log('📖 Getting saved recipes for user:', user.uid);
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        console.log('⚠️ User document does not exist');
        return [];
      }

      const userData = userDoc.data();
      const savedRecipes = userData.savedRecipes || [];
      console.log('📖 Found', savedRecipes.length, 'saved recipes');
      
      return savedRecipes;
    } catch (error) {
      console.error('Get saved recipes error:', error);
      return [];
    }
  },

  async removeRecipe(recipeId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document does not exist");
      }

      const userData = userDoc.data();
      const savedRecipes = userData.savedRecipes || [];
      const recipeToRemove = savedRecipes.find(recipe => recipe.id === recipeId);

      if (recipeToRemove) {
        await updateDoc(userRef, {
          savedRecipes: arrayRemove(recipeToRemove),
          'usage.lastActive': new Date().toISOString()
        });
        console.log('✅ Recipe removed successfully');
      } else {
        console.log('⚠️ Recipe not found for removal');
      }

      return true;
    } catch (error) {
      console.error('Remove recipe error:', error);
      throw error;
    }
  },

  // Legacy meal plan operations (updated to work with enhanced system)
  async saveMealPlan(mealPlanData) {
    // Redirect to enhanced version without grocery list
    return await this.saveMealPlanWithGroceryList(mealPlanData, null);
  },

  async getMealPlans() {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in for getMealPlans');
        return [];
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        console.log('⚠️ User document does not exist');
        return [];
      }

      const userData = userDoc.data();
      return userData.mealPlans || [];
    } catch (error) {
      console.error('Get meal plans error:', error);
      return [];
    }
  },

  async removeMealPlan(mealPlanId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new Error("User document does not exist");
      }

      const userData = userDoc.data();
      const mealPlans = userData.mealPlans || [];
      const mealPlanToRemove = mealPlans.find(plan => plan.id === mealPlanId);

      if (mealPlanToRemove) {
        // Also remove associated grocery list if it exists
        if (mealPlanToRemove.hasGroceryList && mealPlanToRemove.groceryListId) {
          try {
            await this.removeGroceryList(mealPlanToRemove.groceryListId);
          } catch (groceryError) {
            console.log('⚠️ Failed to remove associated grocery list:', groceryError);
          }
        }

        await updateDoc(userRef, {
          mealPlans: arrayRemove(mealPlanToRemove),
          'usage.lastActive': new Date().toISOString()
        });
        console.log('✅ Meal plan and associated grocery list removed successfully');
      }

      return true;
    } catch (error) {
      console.error('Remove meal plan error:', error);
      throw error;
    }
  },

  // Shopping preferences
  async updateShoppingPreferences(preferences) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        'preferences.shoppingPreferences': preferences,
        'usage.lastActive': new Date().toISOString()
      });

      console.log('✅ Shopping preferences updated successfully');
      return true;
    } catch (error) {
      console.error('Update shopping preferences error:', error);
      throw error;
    }
  },

  async getShoppingPreferences() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.preferences?.shoppingPreferences || {
          preferredStores: [],
          budgetLimits: {},
          organicPreference: false
        };
      }
      return {
        preferredStores: [],
        budgetLimits: {},
        organicPreference: false
      };
    } catch (error) {
      console.error('Get shopping preferences error:', error);
      return {
        preferredStores: [],
        budgetLimits: {},
        organicPreference: false
      };
    }
  },

  // Other methods remain the same...
  async saveOnboardingData(answers) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      
      const profileData = this.processOnboardingAnswers(answers);
      
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
      console.error('Save onboarding data error:', error);
      throw error;
    }
  },

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

    if (answers.physical_stats) {
      const stats = answers.physical_stats;
      
      if (stats.height) {
        profile.height = this.parseHeight(stats.height);
      }
      
      if (stats.weight) {
        profile.weight = this.parseWeight(stats.weight);
      }
      
      if (stats.target_weight) {
        profile.targetWeight = this.parseWeight(stats.target_weight);
      }
      
      if (stats.age) {
        profile.age = parseInt(stats.age);
      }
    }

    if (answers.activity_level) {
      profile.activityLevel = answers.activity_level;
    }

    if (answers.health_goals && Array.isArray(answers.health_goals)) {
      profile.healthGoals = answers.health_goals;
    }

    if (answers.dietary_restrictions && Array.isArray(answers.dietary_restrictions)) {
      profile.dietaryRestrictions = answers.dietary_restrictions.filter(item => item !== 'none');
    }

    return profile;
  },

  parseHeight(heightStr) {
    if (!heightStr) return null;
    
    const str = heightStr.toLowerCase().trim();
    
    const feetInchesMatch = str.match(/(\d+)'?\s*(\d+)"/);
    if (feetInchesMatch) {
      const feet = parseInt(feetInchesMatch[1]);
      const inches = parseInt(feetInchesMatch[2]);
      return (feet * 12 + inches) * 2.54;
    }
    
    const cmMatch = str.match(/(\d+)\s*cm/);
    if (cmMatch) {
      return parseInt(cmMatch[1]);
    }
    
    const inchesMatch = str.match(/(\d+)\s*in/);
    if (inchesMatch) {
      return parseInt(inchesMatch[1]) * 2.54;
    }
    
    const numberMatch = str.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num <= 8) {
        return num * 30.48;
      }
      return num;
    }
    
    return null;
  },

  parseWeight(weightStr) {
    if (!weightStr) return null;
    
    const str = weightStr.toLowerCase().trim();
    
    const lbsMatch = str.match(/(\d+)\s*lbs?/);
    if (lbsMatch) {
      return parseInt(lbsMatch[1]) * 0.453592;
    }
    
    const kgMatch = str.match(/(\d+)\s*kg/);
    if (kgMatch) {
      return parseInt(kgMatch[1]);
    }
    
    const numberMatch = str.match(/(\d+)/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 50) {
        return num * 0.453592;
      }
      return num;
    }
    
    return null;
  },

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
      console.error('Get user profile error:', error);
      throw error;
    }
  },

  async updateUserProfile(profileData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not logged in");

      const userRef = doc(db, "users", user.uid);
      const updateData = {};
      
      Object.keys(profileData).forEach(key => {
        updateData[`profile.${key}`] = profileData[key];
      });
      
      updateData['usage.lastActive'] = new Date().toISOString();
      
      await updateDoc(userRef, updateData);
      console.log('✅ User profile updated successfully');
      return true;
    } catch (error) {
      console.error('Update user profile error:', error);
      throw error;
    }
  },

  calculateHealthMetrics(profile) {
    if (!profile || !profile.height || !profile.weight) {
      return null;
    }

    const heightInMeters = profile.height / 100;
    const weightInKg = profile.weight;
    
    const bmi = weightInKg / (heightInMeters * heightInMeters);
    
    let bmiCategory = 'normal';
    if (bmi < 18.5) bmiCategory = 'underweight';
    else if (bmi >= 25 && bmi < 30) bmiCategory = 'overweight';
    else if (bmi >= 30) bmiCategory = 'obese';

    let bmr = 0;
    if (profile.age) {
      bmr = (10 * weightInKg) + (6.25 * profile.height) - (5 * profile.age) + 5;
    }

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
      console.error('Save token error:', error);
      throw error;
    }
  },

  async logout() {
    try {
      await signOut(auth);
      await SecureStore.deleteItemAsync("auth_token");
      delete axios.defaults.headers.common["Authorization"];
      
      // Cleanup PremiumService
      PremiumService.cleanup();
      
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  async forgotPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Password reset email sent');
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  },

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
        
        if (retryCount >= MAX_RETRIES) {
          console.error('❌ Token refresh failed after all retries:', error);
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  },

  // Debug method
  async debugUserState() {
    const debugInfo = await PremiumService.getDebugInfo();
    const user = auth.currentUser;
    
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        debugInfo.groceryListsCount = userData.groceryLists?.length || 0;
        debugInfo.mealPlansCount = userData.mealPlans?.length || 0;
        debugInfo.savedRecipesCount = userData.savedRecipes?.length || 0;
      }
    }
    
    return debugInfo;
  }
};

export default authService;
