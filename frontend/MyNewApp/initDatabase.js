// initDatabase.js
import { db } from "./firebaseConfig";
import { collection, doc, setDoc } from "firebase/firestore";

export const initializeDatabase = async () => {
  try {
    // Create initial recipes collection with a sample recipe
    await setDoc(doc(db, "recipes", "sample-recipe-1"), {
      title: "Simple Pasta",
      description: "A quick and easy pasta dish",
      prepTime: 10,
      cookTime: 15,
      servings: 4,
      difficulty: "easy",
      ingredients: [
        { name: "Pasta", amount: 500, unit: "g" },
        { name: "Tomato Sauce", amount: 350, unit: "ml" },
        { name: "Parmesan", amount: 50, unit: "g" },
      ],
      instructions: [
        "Boil pasta according to package instructions",
        "Heat tomato sauce in a pan",
        "Drain pasta and mix with sauce",
        "Serve with grated parmesan",
      ],
      tags: ["pasta", "quick", "italian"],
      category: "main",
      isPremium: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create a sample premium recipe
    await setDoc(doc(db, "recipes", "sample-recipe-2"), {
      title: "Gourmet Risotto",
      description: "A creamy mushroom risotto",
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      difficulty: "medium",
      ingredients: [
        { name: "Arborio Rice", amount: 350, unit: "g" },
        { name: "Mushrooms", amount: 250, unit: "g" },
        { name: "Vegetable Stock", amount: 1, unit: "liter" },
        { name: "Parmesan", amount: 100, unit: "g" },
        { name: "White Wine", amount: 150, unit: "ml" },
      ],
      instructions: [
        "Sauté mushrooms and set aside",
        "Toast rice in butter",
        "Add wine and stir until absorbed",
        "Gradually add hot stock, stirring continuously",
        "Fold in mushrooms and parmesan",
      ],
      tags: ["risotto", "italian", "gourmet"],
      category: "main",
      isPremium: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("Sample data initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
};
