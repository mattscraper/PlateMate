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
        style={[
          styles.toggleButton,
          (isSaved || isSaving) && styles.toggleButtonActive
        ]}
        onPress={handleSaveBtnPress}
        disabled={isSaving || isSaved}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={16}
              color={isSaved ? "white" : "#6b7280"}
            />
            <Text style={[
              styles.toggleButtonText,
              (isSaved || isSaving) && styles.toggleButtonTextActive
            ]}>
              {isSaved ? "Saved" : "Save Plan"}
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
                  style={[styles.toggleButton, styles.toggleButtonActive]}
                  onPress={handleSaveMealPlan}
                  disabled={!mealPlanName.trim()}
                >
                  <Text style={[styles.toggleButtonText, styles.toggleButtonTextActive]}>
                    Save
                  </Text>
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
          <Ionicons name="checkmark-circle" size={16} color="white" />
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
  // Updated to match toggle button style
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  toggleButtonActive: {
    backgroundColor: '#1e293b',
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },
  // Toast positioned to the left of the button
  toast: {
    position: "absolute",
    top: 0, // Align with the button vertically
    left: -140, // Position to the left of the button
    backgroundColor: "#27ae60",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toastText: {
    color: "white",
    fontWeight: "500",
    fontSize: 12,
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
    alignItems: "center",
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    color: "#7f8c8d",
    fontSize: 13,
    fontWeight: "500",
  },
});

export default SaveMealPlanButton;
