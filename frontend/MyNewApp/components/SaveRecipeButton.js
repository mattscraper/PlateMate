// File: components/SaveRecipeButton.js
import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  View,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import { saveRecipeToFirebase } from "../utils/recipeUtils";
import { useNavigation } from "@react-navigation/native";

const SaveRecipeButton = ({ recipe, onSaved, onLoginRequired }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigation = useNavigation();

  // Animation for success indicator
  const scaleAnim = useState(new Animated.Value(0))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    checkLoginStatus();
    checkIfSaved();
  }, []);

  const checkLoginStatus = async () => {
    const user = authService.getCurrentUser();
    setIsLoggedIn(!!user);
  };

  const checkIfSaved = async () => {
    try {
      // Check if user is logged in
      const user = authService.getCurrentUser();
      if (!user) return;

      // Get saved recipes
      const savedRecipes = await authService.getSavedRecipes();

      // Check if current recipe is already saved
      const found = savedRecipes.some(
        (savedRecipe) => savedRecipe.id === recipe.id
      );
      setIsSaved(found);
    } catch (error) {
      console.error("Error checking if recipe is saved:", error);
    }
  };

  const handleSaveRecipe = async () => {
    // Check if user is logged in
    if (!isLoggedIn) {
      if (onLoginRequired) {
        onLoginRequired();
      } else {
        Alert.alert("Login Required", "Please log in to save recipes", [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log In",
            // You might need to adjust this navigation based on your app's structure
            onPress: () => navigation.navigate("LandingPage"),
          },
        ]);
      }
      return;
    }

    if (isSaved) {
      // Recipe is already saved, do nothing
      return;
    }

    setIsSaving(true);

    try {
      await saveRecipeToFirebase(recipe);
      setIsSaved(true);

      // Show success animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Show toast
      setShowToast(true);

      // Hide toast after 2 seconds
      setTimeout(() => {
        // Fade out animation
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowToast(false);
          scaleAnim.setValue(0);
        });
      }, 2000);

      // Notify parent component if provided
      if (onSaved) {
        onSaved(recipe);
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      Alert.alert("Error", "Failed to save recipe. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.saveButton, isSaved && styles.savedButton]}
        onPress={handleSaveRecipe}
        disabled={isSaving || isSaved}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={20}
              color="white"
            />
            <Text style={styles.buttonText}>
              {isSaved ? "Saved" : "Save Recipe"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={20} color="white" />
          <Text style={styles.toastText}>Recipe saved!</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  saveButton: {
    backgroundColor: "#008b8b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  savedButton: {
    backgroundColor: "#27ae60",
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  toast: {
    position: "absolute",
    top: -50,
    right: 0,
    backgroundColor: "#27ae60",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  toastText: {
    color: "white",
    fontWeight: "500",
  },
});

export default SaveRecipeButton;
