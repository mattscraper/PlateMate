import { authService } from "../services/auth";

/**
 * Save a recipe text to Firebase
 * @param {string} recipeText - The full recipe text
 * @returns {Promise<Object>} - The saved recipe data
 */
export const saveRecipeToFirebase = async (recipeText) => {
  try {
    // Check if user is logged in
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error("User not logged in");
    }

    // Parse recipe text into structured data
    const recipeData = parseRecipeText(recipeText);

    // Save to Firebase
    await authService.saveRecipe(recipeData);

    return recipeData;
  } catch (error) {
    console.error("Error saving recipe to Firebase:", error);
    throw error;
  }
};

/**
 * Parse recipe text into structured data
 * @param {string} recipeText - The full recipe text
 * @returns {Object} - Structured recipe data
 */
export const parseRecipeText = (recipeText) => {
  const sections = recipeText.split("\n\n");
  const title = sections[0];

  // Find ingredients section (with bullet points)
  const ingredientsSection = sections.find((s) => s.includes("•"));
  const ingredients = ingredientsSection
    ? ingredientsSection
        .split("\n")
        .map((ingredient) => ingredient.replace("•", "").trim())
        .filter((ingredient) => ingredient.length > 0)
    : [];

  // Find instructions section (with numbered steps)
  const instructionsSection = sections.find((s) => s.match(/^\d\./m));
  const instructions = instructionsSection
    ? instructionsSection
        .split("\n")
        .map((instruction) => instruction.replace(/^\d+\./, "").trim())
        .filter((instruction) => instruction.length > 0)
    : [];

  // Extract time and serving info if available
  const nutritionSection = sections.find(
    (s) =>
      s.toLowerCase().includes("time") || s.toLowerCase().includes("servings")
  );

  // Extract tags based on recipe content
  const tags = generateRecipeTags(recipeText);

  // Extract cooking time if available
  let cookTime = extractCookingTime(nutritionSection || recipeText);

  // Extract difficulty if available (or estimate based on recipe complexity)
  let difficulty = estimateDifficulty(ingredients, instructions);

  // Create recipe object
  return {
    id: `recipe_${Date.now()}`,
    title,
    ingredients,
    instructions,
    fullText: recipeText, // Store the full text for reference
    tags,
    cookTime,
    difficulty,
    savedAt: new Date().toISOString(),
  };
};

/**
 * Generate tags based on recipe content
 * @param {string} recipeText - The full recipe text
 * @returns {Array} - Array of tags
 */
export const generateRecipeTags = (recipeText) => {
  const tags = [];
  const lowerCaseRecipe = recipeText.toLowerCase();

  // Add some common diet tags based on content

  // Add meal type tags
  if (lowerCaseRecipe.includes("breakfast")) {
    tags.push("breakfast");
  } else if (lowerCaseRecipe.includes("lunch")) {
    tags.push("lunch");
  } else if (lowerCaseRecipe.includes("dinner")) {
    tags.push("dinner");
  } else if (
    lowerCaseRecipe.includes("dessert") ||
    lowerCaseRecipe.includes("cake") ||
    lowerCaseRecipe.includes("cookie") ||
    lowerCaseRecipe.includes("sweet")
  ) {
    tags.push("dessert");
  }

  // Add cuisine type if detected
  const cuisines = [
    "italian",
    "mexican",
    "chinese",
    "indian",
    "japanese",
    "thai",
    "french",
    "mediterranean",
    "greek",
    "spanish",
    "middle eastern",
  ];

  for (const cuisine of cuisines) {
    if (lowerCaseRecipe.includes(cuisine)) {
      tags.push(cuisine);
      break; // Only add one cuisine tag
    }
  }

  return tags;
};

/**
 * Extract cooking time from recipe text
 * @param {string} text - Recipe text to search for cooking time
 * @returns {string} - Cooking time in minutes
 */
export const extractCookingTime = (text) => {
  if (!text) return "30 min"; // Default value

  // Try to find cooking time patterns
  const totalTimeMatch = text.match(/total time:?\s*(\d+)\s*(?:minute|min)/i);
  const cookTimeMatch = text.match(
    /cook(?:ing)? time:?\s*(\d+)\s*(?:minute|min)/i
  );
  const prepTimeMatch = text.match(
    /prep(?:aration)? time:?\s*(\d+)\s*(?:minute|min)/i
  );

  if (totalTimeMatch) {
    return `${totalTimeMatch[1]} min`;
  } else if (cookTimeMatch && prepTimeMatch) {
    // If we have both prep and cooking time, add them
    const totalTime = parseInt(cookTimeMatch[1]) + parseInt(prepTimeMatch[1]);
    return `${totalTime} min`;
  } else if (cookTimeMatch) {
    return `${cookTimeMatch[1]} min`;
  }

  return "30 min"; // Default value
};

/**
 * Estimate recipe difficulty based on ingredients and instructions
 * @param {Array} ingredients - List of ingredients
 * @param {Array} instructions - List of instructions
 * @returns {string} - Difficulty level (Easy, Medium, Hard)
 */
export const estimateDifficulty = (ingredients, instructions) => {
  // Simple algorithm: more ingredients and steps = more difficult
  const ingredientCount = ingredients.length;
  const instructionCount = instructions.length;

  const complexityScore = ingredientCount * 0.3 + instructionCount * 0.7;

  if (complexityScore < 7.5) {
    return "Easy";
  } else if (complexityScore <= 9) {
    return "Medium";
  } else {
    return "Hard";
  }
};
