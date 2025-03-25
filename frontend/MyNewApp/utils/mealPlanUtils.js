import { authService } from "../services/authService";

/**
 * Save a meal plan to Firebase
 * @param {Object} mealPlanData - The meal plan data
 * @returns {Promise<Object>} - The saved meal plan data
 */
export const saveMealPlanToFirebase = async (mealPlanData) => {
  try {
    // Check if user is logged in
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error("User not logged in");
    }

    // Make sure the mealPlanData has an ID
    if (!mealPlanData.id) {
      mealPlanData.id = `mealplan_${Date.now()}`;
    }

    // Make sure it has a savedAt timestamp
    if (!mealPlanData.savedAt) {
      mealPlanData.savedAt = new Date().toISOString();
    }

    // Save to Firebase using the auth service
    await authService.saveMealPlan(mealPlanData);

    return mealPlanData;
  } catch (error) {
    console.error("Error saving meal plan to Firebase:", error);
    throw error;
  }
};

/**
 * Parse meal plan text into structured data
 * @param {string} mealPlanText - The full meal plan text
 * @param {Object} metadata - Additional meal plan metadata
 * @returns {Object} - Structured meal plan data
 */
export const parseMealPlanText = (mealPlanText, metadata = {}) => {
  // Split by day separator
  const days = mealPlanText.split("=====").filter((day) => day.trim());

  // Parse each day
  const parsedDays = days.map((dayText, index) => {
    const dayLines = dayText.trim().split("\n");
    let dayTitle = `Day ${index + 1}`;
    let meals = [];

    // Extract day title (should be in first line)
    if (dayLines[0] && /Day\s+\d+/i.test(dayLines[0])) {
      dayTitle = dayLines[0].trim();
    }

    // Process lines to identify meals
    let currentMeal = null;
    let mealContent = [];

    for (let i = 1; i < dayLines.length; i++) {
      const line = dayLines[i].trim();

      if (!line) continue;

      // Check for meal type markers
      if (/^(Breakfast|Lunch|Dinner|Snack)/i.test(line)) {
        // If we already have a meal, save it before starting a new one
        if (currentMeal) {
          meals.push({
            type: currentMeal,
            content: mealContent.join("\n"),
          });
        }

        currentMeal = line;
        mealContent = [currentMeal];
      } else if (currentMeal) {
        // Add this line to the current meal content
        mealContent.push(line);
      }
    }

    // Add the last meal
    if (currentMeal && mealContent.length) {
      meals.push({
        type: currentMeal,
        content: mealContent.join("\n"),
      });
    }

    return {
      title: dayTitle,
      meals,
    };
  });

  // Create meal plan object
  return {
    id: `mealplan_${Date.now()}`,
    days: metadata.days || parsedDays.length,
    mealsPerDay: metadata.mealsPerDay || parsedDays[0]?.meals.length || 3,
    caloriesPerDay: metadata.caloriesPerDay || 2000,
    healthy: metadata.healthy || false,
    allergies: metadata.allergies || [],
    dietType: metadata.dietType || "",
    parsedContent: parsedDays,
    fullText: mealPlanText,
    savedAt: new Date().toISOString(),
    type: "mealPlan",
  };
};

/**
 * Get meal plan tags based on content
 * @param {Object} mealPlanData - The meal plan data
 * @returns {Array} - Array of tags
 */
export const getMealPlanTags = (mealPlanData) => {
  const tags = [];

  // Add days tag
  tags.push(`${mealPlanData.days} days`);

  // Add meals per day tag
  tags.push(`${mealPlanData.mealsPerDay} meals/day`);

  // Add diet type if present
  if (mealPlanData.dietType) {
    tags.push(mealPlanData.dietType);
  }

  // Add healthy tag if applicable
  if (mealPlanData.healthy) {
    tags.push("healthy");
  }

  // Add tags for allergies/restrictions
  if (mealPlanData.allergies && mealPlanData.allergies.length) {
    mealPlanData.allergies.forEach((allergy) => {
      if (allergy.trim()) {
        tags.push(allergy.trim().toLowerCase());
      }
    });
  }

  return tags;
};

/**
 * Extract meal plan statistics
 * @param {Object} mealPlanData - The meal plan data
 * @returns {Object} - Statistics about the meal plan
 */
export const getMealPlanStats = (mealPlanData) => {
  return {
    days: mealPlanData.days,
    mealsPerDay: mealPlanData.mealsPerDay,
    caloriesPerDay: mealPlanData.caloriesPerDay,
    totalMeals: mealPlanData.days * mealPlanData.mealsPerDay,
    dietType: mealPlanData.dietType || "Standard",
    healthy: mealPlanData.healthy || false,
    restrictions: mealPlanData.allergies || [],
    savedDate: new Date(mealPlanData.savedAt).toLocaleDateString(),
  };
};
