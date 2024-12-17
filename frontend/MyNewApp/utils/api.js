import Constants from "expo-constants";
import { Platform } from "react-native";

const getHost = () => {
  const localIpAddress = "192.168.0.14"; // Update this to match your IP

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
