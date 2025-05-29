const API_URL = "https://platemate-6.onrender.com"; // make sure this is changed during production to backends url

// Helper function to get current user ID
const getCurrentUserId = () => {
  const user = authService.getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated. Please log in to continue.');
  }
  return user.uid;
};

export const fetchRecipes = async (mealType, healthy, allergies) => {
  try {
    console.log("Fetching from:", API_URL); // Debug log

    const response = await fetch(`${API_URL}/api/recipes`, {
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

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server error:", errorData);
      return [];
    }

    const data = await response.json();
    return data.recipes || [];
  } catch (error) {
    console.error("Error fetching recipes:", error);
    return [];
  }
};

export const fetchRecipesByIngredients = async (ingredients, allergies) => {
  try {
    console.log("Fetching from:", API_URL); // Debug log

    const response = await fetch(`${API_URL}/api/recipes/ingredients`, {
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
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch recipes");
    }

    const data = await response.json();
    return data.recipes || [];
  } catch (error) {
    console.error("Error fetching recipes by ingredients:", error);
    throw error;
  }
};
// function to fetch meal plans
export const fetchMealPlans = async (
  days,
  mealsPerDay,
  healthy,
  allergies,
  preferences,
  caloriesPerDay
) => {
  try {
    // User ID is REQUIRED for meal plans to prevent duplicates
    const userId = getCurrentUserId(); // This will throw if user not authenticated

    console.log("Fetching meal plan from:", API_URL); // Debug log

    const response = await fetch(`${API_URL}/api/mealplans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        days,
        meals_per_day: mealsPerDay,
        healthy,
        allergies: Array.isArray(allergies) ? allergies : [],
        preferences: Array.isArray(preferences) ? preferences : [],
        calories_per_day: caloriesPerDay,
        user_id: userId, // ONLY addition - for duplicate prevention
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      
      // Handle specific authentication errors
      if (errorData.Error && errorData.Error.includes('user_id')) {
        throw new Error('Please log in to create personalized meal plans');
      }
      
      throw new Error(errorData.Error || errorData.error || "Failed to fetch meal plans");
    }

    const data = await response.json();
    return data.meal_plan || {};
  } catch (error) {
    console.error("Error fetching meal plans:", error);
    
    // Re-throw authentication errors with user-friendly message
    if (error.message.includes('not authenticated')) {
      throw new Error('Please log in to create personalized meal plans');
    }
    
    throw error;
  }
};
