import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Animated,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchMealPlans } from "../utils/api";
import { useNavigation } from "@react-navigation/native";

export default function MealPlans() {
  const navigation = useNavigation();

  // Core state
  const [days, setDays] = useState(7);
  const [caloriesPerDay, setCaloriesPerDay] = useState(2000); // Default to 2000 calories
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [healthy, setHealthy] = useState(false);
  const [allergies, setAllergies] = useState([]);
  const [dietType, setDietType] = useState("");

  // Modal states
  const [dietTypeModalVisible, setDietTypeModalVisible] = useState(false);
  const [allergyModalVisible, setAllergyModalVisible] = useState(false);
  const [newAllergy, setNewAllergy] = useState("");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAnim] = useState(new Animated.Value(0));
  const [loadingProgress] = useState(new Animated.Value(0));
  const [loadingText, setLoadingText] = useState("");

  // Diet type options
  const predefinedDietTypes = [
    { id: "custom", label: "Custom...", value: "" },
    { id: "keto", label: "Keto", value: "Keto" },
    { id: "paleo", label: "Paleo", value: "Paleo" },
    { id: "vegan", label: "Vegan", value: "Vegan" },
    { id: "vegetarian", label: "Vegetarian", value: "Vegetarian" },
    { id: "lowCarb", label: "Low Carb", value: "Low Carb" },
    { id: "glutenFree", label: "Gluten Free", value: "Gluten Free" },
  ];

  // Selected diet type state with custom input handling
  const [selectedDietTypeId, setSelectedDietTypeId] = useState("");
  const [customDietType, setCustomDietType] = useState("");
  const customDietTypeRef = useRef("");

  const loadingTexts = [
    "Planning your perfect menu... 📝",
    "Crafting balanced meals... 🥗",
    "Organizing your week... 📅",
    "Adding variety to your diet... 🍽️",
    "Calculating nutritional balance... 🥑",
    "Personalizing your meal plan... 👨‍🍳",
    "Making healthy choices... 🥬",
    "Creating delicious combinations... 🍳",
    "Designing your food journey... 🗺️",
    "Adding finishing touches... ✨",
  ];

  useEffect(() => {
    if (isLoading) {
      let currentIndex = 0;
      const textInterval = setInterval(() => {
        setLoadingText(loadingTexts[currentIndex]);
        currentIndex = (currentIndex + 1) % loadingTexts.length;
      }, 1200);

      return () => clearInterval(textInterval);
    }
  }, [isLoading]);

  const handleDietTypeSelect = (id, value) => {
    setSelectedDietTypeId(id);
    if (id === "custom") {
      setCustomDietType(dietType || "");
    } else {
      setDietType(value);
      setCustomDietType("");
      setDietTypeModalVisible(false);
    }
  };

  const handleCustomDietTypeSubmit = () => {
    const trimmedValue = customDietTypeRef.current.trim();
    if (trimmedValue) {
      setDietType(trimmedValue);
      setCustomDietType(trimmedValue);
      setDietTypeModalVisible(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    loadingProgress.setValue(0);

    try {
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingProgress, {
            toValue: 0.9,
            duration: 3000,
            useNativeDriver: false,
          }),
          Animated.timing(loadingProgress, {
            toValue: 0.4,
            duration: 1500,
            useNativeDriver: false,
          }),
        ])
      ).start();

      const mealPlan = await fetchMealPlans(
        days,
        mealsPerDay,
        healthy,
        allergies,
        [dietType],
        caloriesPerDay // Add this parameter
      );

      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();

      await new Promise((resolve) => setTimeout(resolve, 200));
      navigation.navigate("MealPlanResults", {
        mealPlan,
        days,
        mealsPerDay,
        healthy,
        allergies,
        dietType,
        caloriesPerDay,
      });
    } catch (error) {
      console.error("Error fetching meal plans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addAllergy = () => {
    if (newAllergy.trim() && !allergies.includes(newAllergy.trim())) {
      setAllergies([...allergies, newAllergy.trim()]);
      setNewAllergy("");
    }
  };

  const removeAllergy = (allergyToRemove) => {
    setAllergies(allergies.filter((allergy) => allergy !== allergyToRemove));
  };

  // Duration selector component
  const DurationSelector = ({ value, onChange, min, max, label }) => (
    <View style={styles.durationSelector}>
      <Text style={styles.durationLabel}>{label}</Text>
      <View style={styles.durationControls}>
        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Ionicons name="remove" size={24} color="#008b8b" />
        </TouchableOpacity>
        <Text style={styles.durationValue}>{value}</Text>
        <TouchableOpacity
          style={styles.durationButton}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Ionicons name="add" size={24} color="#008b8b" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Diet Type Modal Component
  const DietTypeModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={dietTypeModalVisible}
      onRequestClose={() => setDietTypeModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback
          onPress={() => setDietTypeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setDietTypeModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color="#2c3e50" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Choose Diet Type</Text>
                  <View style={styles.modalCloseButton} />
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalSubtitle}>
                    Select a diet type or create your own
                  </Text>

                  <View style={styles.quickSelectGrid}>
                    {predefinedDietTypes
                      .filter((type) => type.id !== "custom")
                      .map((type) => (
                        <TouchableOpacity
                          key={type.id}
                          style={[
                            styles.quickSelectButton,
                            selectedDietTypeId === type.id &&
                              styles.quickSelectButtonSelected,
                          ]}
                          onPress={() =>
                            handleDietTypeSelect(type.id, type.value)
                          }
                        >
                          <Text
                            style={[
                              styles.quickSelectText,
                              selectedDietTypeId === type.id &&
                                styles.quickSelectTextSelected,
                            ]}
                          >
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>

                  <View style={styles.customInputSection}>
                    <Text style={styles.customInputLabel}>
                      Or type your own
                    </Text>
                    <View style={styles.customInputWrapper}>
                      <TextInput
                        style={styles.customInput}
                        defaultValue={customDietTypeRef.current}
                        onChangeText={(text) => {
                          customDietTypeRef.current = text;
                          setSelectedDietTypeId("custom");
                        }}
                        placeholder="e.g., Low FODMAP, Pescatarian..."
                        placeholderTextColor="#a0a0a0"
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        style={[
                          styles.customConfirmButton,
                          !customDietTypeRef.current?.trim() &&
                            styles.buttonDisabled,
                        ]}
                        onPress={handleCustomDietTypeSubmit}
                        disabled={!customDietTypeRef.current?.trim()}
                      >
                        <Ionicons name="checkmark" size={24} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Meal Plan</Text>
          <Text style={styles.subtitle}>
            Plan your perfect menu for the week
          </Text>
        </View>

        {/* Duration Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Plan Duration</Text>
          <DurationSelector
            value={days}
            onChange={setDays}
            min={1}
            max={10}
            label="Days"
          />
          <DurationSelector
            value={mealsPerDay}
            onChange={setMealsPerDay}
            min={1}
            max={5}
            label="Meals per Day"
          />
        </View>

        {/* calorie selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Daily Calories</Text>
          <View style={styles.calorieSelector}>
            <TouchableOpacity
              style={styles.calorieButton}
              onPress={() =>
                setCaloriesPerDay(Math.max(1000, caloriesPerDay - 100))
              }
            >
              <Ionicons name="remove" size={24} color="#008b8b" />
            </TouchableOpacity>
            <View style={styles.calorieInputContainer}>
              <TextInput
                style={styles.calorieInput}
                value={caloriesPerDay.toString()}
                onChangeText={(text) => {
                  const value = parseInt(text) || 1000;
                  setCaloriesPerDay(Math.min(Math.max(value, 1000), 5000));
                }}
                keyboardType="numeric"
                maxLength={4}
              />
              <Text style={styles.calorieUnit}>cal</Text>
            </View>
            <TouchableOpacity
              style={styles.calorieButton}
              onPress={() =>
                setCaloriesPerDay(Math.min(5000, caloriesPerDay + 100))
              }
            >
              <Ionicons name="add" size={24} color="#008b8b" />
            </TouchableOpacity>
          </View>
          <Text style={styles.calorieDescription}>
            Target calories per day. Range: 1000-5000 cal
          </Text>
        </View>

        {/* Diet Type Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Diet Type</Text>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setDietTypeModalVisible(true)}
          >
            <Text style={[styles.input, !dietType && styles.inputPlaceholder]}>
              {dietType || "Select or type diet type"}
            </Text>
            <Ionicons name="chevron-down" size={24} color="#008b8b" />
          </TouchableOpacity>
        </View>
        <DietTypeModal />

        {/* Healthy Switch */}
        <View style={styles.card}>
          <View style={styles.switchContainer}>
            <View>
              <Text style={styles.sectionTitle}>Healthy Options</Text>
              <Text style={styles.description}>
                {healthy
                  ? "Focusing on nutritious, balanced meals"
                  : "Including all recipe types"}
              </Text>
            </View>
            <Switch
              value={healthy}
              onValueChange={setHealthy}
              trackColor={{ false: "#e0e0e0", true: "#b2dfdb" }}
              thumbColor={healthy ? "#008b8b" : "#f4f3f4"}
              ios_backgroundColor="#e0e0e0"
            />
          </View>
        </View>

        {/* Allergies Section */}
        <View style={styles.card}>
          <View style={styles.allergyHeader}>
            <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setAllergyModalVisible(true)}
            >
              <Ionicons name="add-circle" size={24} color="#008b8b" />
            </TouchableOpacity>
          </View>

          {allergies.length > 0 ? (
            <View style={styles.allergyChipsContainer}>
              {allergies.map((allergy, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.allergyChip}
                  onPress={() => removeAllergy(allergy)}
                >
                  <Text style={styles.allergyChipText}>{allergy}</Text>
                  <Ionicons name="close-circle" size={18} color="#008b8b" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>
              Tap + to add any dietary restrictions
            </Text>
          )}
        </View>

        {/* Generate Plan Button */}
        <TouchableOpacity
          style={[styles.generateButton, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <Animated.View style={{ opacity: loadingAnim }}>
              <Ionicons name="restaurant" size={24} color="white" />
            </Animated.View>
          ) : (
            <>
              <Ionicons name="calendar" size={24} color="white" />
              <Text style={styles.buttonText}>Generate Meal Plan</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Loading Modal */}
        <Modal transparent={true} visible={isLoading}>
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingTitle}>Creating Your Menu</Text>
              <Text style={styles.loadingText}>{loadingText}</Text>
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: loadingProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* Allergy Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={allergyModalVisible}
          onRequestClose={() => setAllergyModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setAllergyModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#2c3e50" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Add Dietary Restriction</Text>
                <View style={styles.modalCloseButton} />
              </View>

              <View style={styles.allergyModalBody}>
                <Text style={styles.modalSubtitle}>
                  Enter any food allergies or dietary restrictions
                </Text>
                <TextInput
                  style={[styles.modalInput, styles.allergyInput]}
                  value={newAllergy}
                  onChangeText={setNewAllergy}
                  placeholder="e.g., Peanuts, Dairy, Gluten"
                  placeholderTextColor="#a0a0a0"
                  autoFocus
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[
                    styles.modalAddButton,
                    !newAllergy.trim() && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    addAllergy();
                    setAllergyModalVisible(false);
                  }}
                  disabled={!newAllergy.trim()}
                >
                  <Text style={styles.modalAddText}>Add Restriction</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Base Layout
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flexGrow: 1,
    padding: 20,
  },

  // Header Styles
  header: {
    marginBottom: 32,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)", // Soft glassmorphic effect
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4, // For Android shadow
    backdropFilter: "blur(10px)", // Works with some libraries for blur effect
  },

  title: {
    fontSize: 34,
    marginTop: -31,
    fontWeight: "800",
    color: "black", // Deep blue for a premium look
    textAlign: "center",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },

  subtitle: {
    fontSize: 17,
    fontWeight: "400",
    color: "#008b8b", // Subtle contrast for hierarchy
    textAlign: "center",
    maxWidth: "80%",
    lineHeight: 22,
    marginTop: 22,
    marginBottom: -10,
    opacity: 0.9,
    fontStyle: "italic",
  },

  headerAccent: {
    height: 5,
    width: "55%",
    backgroundColor: "linear-gradient(90deg, #00c6ff, #0072ff)", // Gradient effect
    borderRadius: 50,
    marginTop: 10,
  },

  // Card Styles
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  // Duration Selector Styles
  durationSelector: {
    marginBottom: 16,
  },
  durationLabel: {
    fontSize: 16,
    color: "#2c3e50",
    marginBottom: 8,
  },
  durationControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    padding: 8,
  },
  durationButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#e6f3f3",
  },
  durationValue: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    width: 50,
    textAlign: "center",
  },
  calorieSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  calorieButton: {
    width: 44,
    height: 44,
    backgroundColor: "#e6f3f3",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  calorieInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    paddingHorizontal: 16,
    flex: 1,
    marginHorizontal: 12,
  },
  calorieInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    paddingVertical: 8,
    textAlign: "center",
  },
  calorieUnit: {
    fontSize: 16,
    color: "#7f8c8d",
    marginLeft: 8,
  },
  calorieDescription: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 8,
    textAlign: "center",
  },

  // Input Styles
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#f0f0f0",
    borderRadius: 16,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    marginTop: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 17,
    color: "#2c3e50",
  },
  inputPlaceholder: {
    color: "#a0a0a0",
  },

  // Modal Base Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
    flex: 1,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 24,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: 20,
  },

  // Diet Type Selection Styles
  quickSelectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  quickSelectButton: {
    width: "47%",
    backgroundColor: "#f8f9fa",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    alignItems: "center",
    marginBottom: 8,
  },
  quickSelectButtonSelected: {
    backgroundColor: "#e6f3f3",
    borderColor: "#008b8b",
  },
  quickSelectText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
  },
  quickSelectTextSelected: {
    color: "#008b8b",
    fontWeight: "700",
  },

  // Section Styles
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: "#7f8c8d",
    marginTop: 4,
    lineHeight: 20,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },

  // Allergy Section Styles
  allergyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addButton: {
    padding: 8,
    marginRight: -8,
  },
  allergyChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  allergyChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6f3f3",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#008b8b20",
  },
  allergyChipText: {
    color: "#008b8b",
    fontSize: 15,
    fontWeight: "600",
  },
  placeholderText: {
    color: "#a0a0a0",
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },

  // Button Styles
  generateButton: {
    backgroundColor: "#008b8b",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },

  // Loading Styles
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 28,
    width: "85%",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 17,
    color: "#008b8b",
    marginBottom: 24,
    textAlign: "center",
    minHeight: 24,
    fontWeight: "600",
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#008b8b",
    borderRadius: 4,
  },

  // Custom Input Section Styles
  customInputSection: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  customInputLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 12,
  },
  customInputWrapper: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  customInput: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    color: "#2c3e50",
  },
  customConfirmButton: {
    backgroundColor: "#008b8b",
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  // Modal Input & Button Styles
  modalInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    color: "#2c3e50",
  },
  modalAddButton: {
    backgroundColor: "#008b8b",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    margin: 20,
    marginTop: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalAddText: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
  },
  allergyModalBody: {
    padding: 20,
  },
  allergyInput: {
    marginBottom: 16,
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
});
