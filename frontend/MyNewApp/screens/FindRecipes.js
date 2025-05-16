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
import { fetchRecipes } from "../utils/api";
import { useNavigation } from "@react-navigation/native";

export default function FindRecipes() {
  const navigation = useNavigation();

  // Core state
  const [mealType, setMealType] = useState("");
  const [healthy, setHealthy] = useState(false);
  const [allergies, setAllergies] = useState([]);

  // Modal states
  const [mealTypeModalVisible, setMealTypeModalVisible] = useState(false);
  const [allergyModalVisible, setAllergyModalVisible] = useState(false);
  const [newAllergy, setNewAllergy] = useState("");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAnim] = useState(new Animated.Value(0));
  const [loadingProgress] = useState(new Animated.Value(0));
  const [loadingText, setLoadingText] = useState("");

  // Constants
  const predefinedMealTypes = [
    { id: "custom", label: "Custom...", value: "" },
    { id: "breakfast", label: "Breakfast", value: "Breakfast" },
    { id: "lunch", label: "Lunch", value: "Lunch" },
    { id: "dinner", label: "Dinner", value: "Dinner" },
    { id: "dessert", label: "Dessert", value: "Dessert" },
    { id: "snack", label: "Snack", value: "Snack" },
    { id: "any", label: "Any", value: "Any" },
  ];

  // Selected meal type state with custom input handling
  const [selectedMealTypeId, setSelectedMealTypeId] = useState("");
  const [customMealType, setCustomMealType] = useState("");
  const customMealTypeRef = useRef("");

  const loadingTexts = [
    "Simmering some ideas... 🍲",
    "Whisking up creativity... 🥚",
    "Adding a pinch of inspiration... ✨",
    "Sautéing the code... 🍳",
    "Grating some fresh puns... 🧀",
    "Rolling out the flavor... 🥖",
    "Glazing over the details... 🍯",
    "Marinating in the possibilities... 🍋",
    "Spicing things up... 🌶️",
    "Mixing the perfect blend... 🧂",
    "Preheating the imagination... 🔥",
    "Frosting the finishing touch... 🧁",
    "Infusing some magic... 🌟",
    "Flipping pancakes of innovation... 🥞",
    "Kneading some creativity... 🍞",
    "Sprinkling joy on top... 🍪",
    "Blending flavors of genius... 🍹",
    "Skewering new ideas... 🍢",
    "Steaming up perfection... 🥟",
    "Dishing out brilliance... 🍽️",
    "Cracking open new ideas... 🥥",
    "Rolling sushi-grade concepts... 🍣",
    "Toasting to inspiration... 🥂",
    "Seeding new flavors... 🍉",
    "Stuffing it with creativity... 🌮",
    "Whipping up culinary dreams... 🍨",
    "Layering the goodness... 🍰",
    "Grilling some fresh concepts... 🍔",
    "Drizzling some extra flavor... 🥗",
    "Stirring the pot of genius... 🥘",
    "Tasting for perfection... 🍷",
    "Carving out new ideas... 🍗",
    "Piping hot brilliance incoming... ☕",
    "Rolling out endless possibilities... 🌯",
    "Firing up the grill of creativity... 🔥",
    "Catching the freshest catch... 🐟",
    "Serving it with style... 🍴",
    "Crafting a recipe for success... 🧑‍🍳",
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

  // Handle meal type selection
  const handleMealTypeSelect = (id, value) => {
    setSelectedMealTypeId(id);
    if (id === "custom") {
      setCustomMealType(mealType || ""); // Initialize with current value if exists
    } else {
      setMealType(value);
      setCustomMealType("");
      setMealTypeModalVisible(false);
    }
  };

  // Handle custom meal type input
  const handleCustomMealTypeSubmit = () => {
    const trimmedValue = customMealTypeRef.current.trim();
    if (trimmedValue) {
      setMealType(trimmedValue);
      setCustomMealType(trimmedValue);
      setMealTypeModalVisible(false);
    }
  };

  // Handler functions
  const handleSubmit = async () => {
    if (!mealType) return;

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

      // change this in production, will host backend to a server
      const recipes = await fetchRecipes(mealType, healthy, allergies);

      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();

      await new Promise((resolve) => setTimeout(resolve, 200));
      navigation.navigate("Results", { recipes, mealType, healthy, allergies });
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthyDescription = () => {
    if (healthy) {
      return "Focusing on nutritious, balanced meals";
    }
    return "Including all recipe types";
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

  // Modal Components
  const MealTypeModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={mealTypeModalVisible}
      onRequestClose={() => setMealTypeModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <TouchableWithoutFeedback
          onPress={() => setMealTypeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setMealTypeModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color="#2c3e50" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Choose Meal Type</Text>
                  <View style={styles.modalCloseButton} />
                </View>

                <ScrollView
                  style={styles.modalBody}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.modalSubtitle}>
                    Select a type or create your own
                  </Text>

                  {/* Quick Select Grid */}
                  <View style={styles.quickSelectGrid}>
                    {predefinedMealTypes
                      .filter((type) => type.id !== "custom")
                      .map((type) => (
                        <TouchableOpacity
                          key={type.id}
                          style={[
                            styles.quickSelectButton,
                            selectedMealTypeId === type.id &&
                              styles.quickSelectButtonSelected,
                          ]}
                          onPress={() =>
                            handleMealTypeSelect(type.id, type.value)
                          }
                        >
                          <Text
                            style={[
                              styles.quickSelectText,
                              selectedMealTypeId === type.id &&
                                styles.quickSelectTextSelected,
                            ]}
                          >
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>

                  {/* Custom Input Section */}
                  <View style={styles.customInputSection}>
                    <Text style={styles.customInputLabel}>
                      Or type your own
                    </Text>
                    <View style={styles.customInputWrapper}>
                      <TextInput
                        style={styles.customInput}
                        defaultValue={customMealTypeRef.current}
                        onChangeText={(text) => {
                          customMealTypeRef.current = text;
                          setSelectedMealTypeId("custom");
                        }}
                        placeholder="e.g., Summer BBQ, Italian Night..."
                        placeholderTextColor="#a0a0a0"
                        returnKeyType="done"
                        onFocus={() => setMealTypeModalVisible(true)} // Ensures modal stays open
                      />
                      <TouchableOpacity
                        style={[
                          styles.customConfirmButton,
                          !customMealTypeRef.current?.trim() &&
                            styles.buttonDisabled,
                        ]}
                        onPress={handleCustomMealTypeSubmit}
                        disabled={!customMealTypeRef.current?.trim()}
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Discover New Recipes</Text>
          <Text style={styles.subtitle}>Find your next culinary adventure</Text>
        </View>

        {/* Meal Type Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What would you like to cook?</Text>
          <TouchableOpacity
            style={styles.inputContainer}
            onPress={() => setMealTypeModalVisible(true)}
          >
            <Text style={[styles.input, !mealType && styles.inputPlaceholder]}>
              {mealType || "Select or type meal type"}
            </Text>
            <Ionicons name="chevron-down" size={24} color="#008b8b" />
          </TouchableOpacity>
        </View>
        <MealTypeModal />

        {/* Healthy Switch */}
        <View style={styles.card}>
          <View style={styles.switchContainer}>
            <View>
              <Text style={styles.sectionTitle}>Healthy Options</Text>
              <Text style={styles.description}>{getHealthyDescription()}</Text>
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

        {/* Find Recipes Button */}
        <TouchableOpacity
          style={[
            styles.findButton,
            (!mealType || isLoading) && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!mealType || isLoading}
        >
          {isLoading ? (
            <Animated.View style={{ opacity: loadingAnim }}>
              <Ionicons name="restaurant" size={24} color="white" />
            </Animated.View>
          ) : (
            <>
              <Ionicons name="search" size={24} color="white" />
              <Text style={styles.buttonText}>Find Recipes</Text>
            </>
          )}
        </TouchableOpacity>
       
      </ScrollView>

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
  },
  backButton: {
    padding: 4,
    marginRight: 310,
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    marginTop: -5,
    fontWeight: "800",
    color: "black", // Deep blue for a premium look
    textAlign: "center",
    textTransform: "capitalize",
    letterSpacing: 0.8,
  },

  subtitle: {
    fontSize: 17,
    fontWeight: "40",
    color: "#008b8b", // Subtle contrast for hierarchy
    textAlign: "center",
    maxWidth: "80%",
    lineHeight: 22,
    marginTop: 20,
    marginBottom: -2,
    opacity: 0.9,
    fontStyle: "italic",
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

  // Meal Type Selection Styles
  quickSelectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
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
  customInputSection: {
    marginTop: 16,
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
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  allergyChipText: {
    color: "#008b8b",
    fontSize: 15,
    fontWeight: "600",
  },
  allergyModalBody: {
    padding: 20,
  },
  allergyInput: {
    marginBottom: 16,
  },
  placeholderText: {
    color: "#a0a0a0",
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },

  // Button Styles
  findButton: {
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

  // Modal Input & Button Styles
  modalInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    color: "#2c3e50",
    marginBottom: 16,
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
  secondaryButton: {
    backgroundColor: "#e6f3f3",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#008b8b20",
  },
  secondaryButtonText: {
    color: "#008b8b",
    fontSize: 18,
    fontWeight: "600",
  },
});
