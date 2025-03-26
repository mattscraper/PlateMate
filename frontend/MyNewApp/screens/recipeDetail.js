import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SaveRecipeButton from "../components/SaveRecipeButton";

export default function RecipeDetailScreen({ navigation, route }) {
  const { recipe } = route.params || {
    title: "Sample Recipe",
    cookTime: "30 min",
    difficulty: "Easy",
    ingredients: ["2 cups flour", "1 cup sugar", "3 eggs", "1/2 cup milk"],
    instructions: [
      "Preheat oven to 350°F (175°C).",
      "Mix dry ingredients in a bowl.",
      "Add wet ingredients and mix until smooth.",
      "Pour batter into a greased pan.",
      "Bake for 25-30 minutes or until a toothpick comes out clean.",
    ],
    tags: ["dessert", "baking", "vegetarian"],
  };

  const handleLoginRequired = () => {
    Alert.alert("Login Required", "Please login to save recipes", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Login",
        onPress: () => navigation.navigate("LandingPage"),
      },
    ]);
  };

  const handleRecipeSaved = (savedRecipe) => {
    console.log("Recipe saved:", savedRecipe.title);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.heroSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.recipeTitle}>{recipe.title}</Text>

              <View style={styles.metaInfo}>
                {recipe.cookTime && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={18} color="#008b8b" />
                    <Text style={styles.metaText}>{recipe.cookTime}</Text>
                  </View>
                )}

                {recipe.difficulty && (
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="fitness-outline"
                      size={18}
                      color="#008b8b"
                    />
                    <Text style={styles.metaText}>{recipe.difficulty}</Text>
                  </View>
                )}

                {recipe.servings && (
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={18} color="#008b8b" />
                    <Text style={styles.metaText}>
                      {recipe.servings} servings
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.tagsContainer}>
                {recipe.tags &&
                  recipe.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>

          <View style={styles.saveButtonContainer}>
            <SaveRecipeButton
              recipe={recipe}
              onSaved={handleRecipeSaved}
              onLoginRequired={handleLoginRequired}
            />
          </View>

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.ingredientsList}>
                {recipe.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.bulletPoint} />
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {recipe.instructions && recipe.instructions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              <View style={styles.instructionsList}>
                {recipe.instructions.map((instruction, index) => (
                  <View key={index} style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={styles.instructionText}>{instruction}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginTop: -2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    flex: 1,
    textAlign: "center",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  heroSection: {
    marginBottom: 20,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  titleContainer: {
    width: "100%",
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 4,
    color: "#2c3e50",
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#e6f3f3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: "#008b8b",
  },
  saveButtonContainer: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 16,
  },
  ingredientsList: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#008b8b",
    marginRight: 10,
  },
  ingredientText: {
    fontSize: 16,
    color: "#2c3e50",
    flex: 1,
  },
  instructionsList: {
    marginTop: 8,
  },
  instructionItem: {
    flexDirection: "row",
    marginBottom: 20,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#008b8b",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  instructionText: {
    fontSize: 16,
    color: "#2c3e50",
    flex: 1,
    lineHeight: 24,
  },
});
