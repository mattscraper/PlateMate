// recipeService.js
import { db } from "../firebaseConfig";
import { saveRecipeToFirebase } from "../utils/recipeUtils";
s;
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getCurrentUser,
  saveRecipe,
  removeRecipe,
  getSavedRecipes,
  checkPremiumStatus,
} from "../authService";

// Get all recipes (filtering premium ones for non-premium users)
export const getAllRecipes = async (userId) => {
  try {
    const recipesSnapshot = await getDocs(collection(db, "recipes"));
    const isPremium = await checkPremiumStatus(userId);

    const recipes = [];
    recipesSnapshot.forEach((doc) => {
      const recipeData = doc.data();

      // Include recipe if it's not premium or if user is premium
      if (!recipeData.isPremium || isPremium) {
        recipes.push({
          id: doc.id,
          ...recipeData,
        });
      }
    });

    return recipes;
  } catch (error) {
    console.error("Error getting recipes:", error);
    throw error;
  }
};

// Get a single recipe by ID
export const getRecipeById = async (recipeId, userId) => {
  try {
    const recipeDoc = await getDoc(doc(db, "recipes", recipeId));

    if (!recipeDoc.exists()) {
      throw new Error("Recipe not found");
    }

    const recipeData = recipeDoc.data();

    // Check if recipe is premium and user is not premium
    if (recipeData.isPremium) {
      const isPremium = await checkPremiumStatus(userId);
      if (!isPremium) {
        throw new Error("Premium subscription required");
      }
    }

    return {
      id: recipeDoc.id,
      ...recipeData,
    };
  } catch (error) {
    console.error("Error getting recipe:", error);
    throw error;
  }
};

// Save a recipe for a user
export const saveRecipeForUser = async (userId, recipeId, notes = "") => {
  try {
    // Check if user is premium
    const isPremium = await checkPremiumStatus(userId);
    if (!isPremium) {
      throw new Error("Premium subscription required");
    }

    // Check if recipe exists
    const recipeDoc = await getDoc(doc(db, "recipes", recipeId));
    if (!recipeDoc.exists()) {
      throw new Error("Recipe not found");
    }

    // Check if already saved
    const existingQuery = query(
      collection(db, "userSavedRecipes"),
      where("userId", "==", userId),
      where("recipeId", "==", recipeId)
    );

    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      throw new Error("Recipe already saved");
    }

    // Save the recipe
    await addDoc(collection(db, "userSavedRecipes"), {
      userId,
      recipeId,
      savedAt: serverTimestamp(),
      notes,
    });

    return true;
  } catch (error) {
    console.error("Error saving recipe:", error);
    throw error;
  }
};

// Get user's saved recipes
export const getUserSavedRecipes = async (userId) => {
  try {
    // Check if user is premium
    const isPremium = await checkPremiumStatus(userId);
    if (!isPremium) {
      throw new Error("Premium subscription required");
    }

    const savedRecipesQuery = query(
      collection(db, "userSavedRecipes"),
      where("userId", "==", userId)
    );

    const savedRecipesSnapshot = await getDocs(savedRecipesQuery);

    const recipes = [];
    for (const docSnapshot of savedRecipesSnapshot.docs) {
      const savedRecipeData = docSnapshot.data();
      const recipeDoc = await getDoc(
        doc(db, "recipes", savedRecipeData.recipeId)
      );
      //check if the recipe exisits
      if (recipeDoc.exists()) {
        recipes.push({
          id: recipeDoc.id,
          savedId: docSnapshot.id,
          savedAt: savedRecipeData.savedAt,
          notes: savedRecipeData.notes,
          ...recipeDoc.data(),
        });
      }
    }

    return recipes;
  } catch (error) {
    console.error("Error getting saved recipes:", error);
    throw error;
  }
};
