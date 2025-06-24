import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  View,
  Alert,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/authService";
import { saveMealPlanToFirebase } from "../utils/mealPlanUtils";
import { useNavigation } from "@react-navigation/native";

const SaveMealPlanButton = ({
  mealPlan,
  days,
  mealsPerDay,
  caloriesPerDay,
  allergies = [],
  healthy,
  dietType,
  onSaved,
  onLoginRequired,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [mealPlanName, setMealPlanName] = useState("");
  const navigation = useNavigation();

  // Animation for success indicator
  const scaleAnim = useState(new Animated.Value(0))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    checkLoginStatus();

    // Generate a default meal plan name
    const date = new Date();
    const defaultName = `Meal Plan (${date.toLocaleDateString()})`;
    setMealPlanName(defaultName);
  }, []);

  const checkLoginStatus = async () => {
    const user = authService.getCurrentUser();
    setIsLoggedIn(!!user);
  };

  // Generate a unique ID for the meal plan based on its content and name
  const generateMealPlanId = (mealPlan, days, mealsPerDay, name) => {
    // Check if mealPlan is undefined or not a string
    if (!mealPlan || typeof mealPlan !== "string") {
      return `mealplan_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 10)}`;
    }

    // Create a unique ID that includes the name and timestamp
    return `mealplan_${name.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}`;
  };

  const handleSaveBtnPress = async () => {
    // Check if user is logged in
    if (!isLoggedIn) {
      if (onLoginRequired) {
        onLoginRequired();
      } else {
        Alert.alert("Login Required", "Please log in to save meal plans", [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log In",
            onPress: () => navigation.navigate("LandingPage"),
          },
        ]);
      }
      return;
    }

    if (isSaved) {
      // Meal plan is already saved, do nothing
      return;
    }

    // Show the name input modal
    setNameModalVisible(true);
  };

  const handleSaveMealPlan = async () => {
    setNameModalVisible(false);
    setIsSaving(true);

    try {
      // Create meal plan object with the user-provided name
      const mealPlanObject = {
        mealPlan: mealPlan,
        name: mealPlanName, // Add the name property
        days: days,
        mealsPerDay: mealsPerDay,
        caloriesPerDay: caloriesPerDay,
        allergies: allergies || [],
        healthy: healthy || false,
        dietType: dietType || "",
        id: generateMealPlanId(mealPlan, days, mealsPerDay, mealPlanName),
        savedAt: new Date().toISOString(),
        type: "mealPlan",
      };

      await saveMealPlanToFirebase(mealPlanObject);
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
        onSaved(mealPlanObject);
      }
    } catch (error) {
      console.error("Error saving meal plan:", error);
      Alert.alert("Error", "Failed to save meal plan. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.saveButton, isSaved && styles.savedButton]}
        onPress={handleSaveBtnPress}
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
              {isSaved ? "Saved" : "Save Meal Plan"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Name Input Modal */}
      <Modal
        visible={nameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Name Your Meal Plan</Text>
              <Text style={styles.modalDescription}>
                Give your meal plan a name to easily find it later.
              </Text>

              <TextInput
                style={styles.nameInput}
                value={mealPlanName}
                onChangeText={setMealPlanName}
                placeholder="Enter a name for your meal plan"
                autoFocus={true}
                maxLength={50}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setNameModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveModalButton}
                  onPress={handleSaveMealPlan}
                  disabled={!mealPlanName.trim()}
                >
                  <Text style={styles.saveModalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
          <Text style={styles.toastText}>Meal plan saved!</Text>
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
      backgroundColor: "#000",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 14,
      gap: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
        
    },
    savedButton: {
      backgroundColor: "#333", // dark gray to indicate it's saved
    },
    saveModalButton: {
      backgroundColor: "#000",
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 20,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 12,
  },
  cancelButtonText: {
    color: "#7f8c8d",
    fontSize: 16,
    fontWeight: "600",
  },

  saveModalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SaveMealPlanButton;
