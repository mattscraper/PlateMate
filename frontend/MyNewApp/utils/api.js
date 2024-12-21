import Constants from "expo-constants";
import { Platform } from "react-native";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";

const getHost = () => {
  const localIpAddress = "192.168.0.14";

  return Platform.select({
    android: `http://${localIpAddress}:5000`,
    ios: `http://${localIpAddress}:5000`,
    default: `http://${localIpAddress}:5000`,
  });
};

export const fetchRecipes = async (mealType, healthy, allergies) => {
  try {
    const host = getHost();

    const response = await fetch(`${host}/api/recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meal_type: mealType,
        healthy,
        allergies: Array.isArray(allergies) ? allergies : [],
        count: 10,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Server error:", data.error);
      return [];
    }

    if (data.success && data.recipes && Array.isArray(data.recipes)) {
      // Return the recipes array directly
      return data.recipes;
    }

    return [];
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return [];
  }
};

export const fetchRecipesByIngredients = async (ingredients, allergies) => {
  try {
    const host = getHost();
    const response = await fetch(`${host}/api/recipes/ingredients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ingredients,
        allergies,
        count: 10,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch recipes");
    }

    const data = await response.json();
    return data.recipes;
  } catch (error) {
    console.error("Error fetching recipes:", error);
    throw error;
  }
};
