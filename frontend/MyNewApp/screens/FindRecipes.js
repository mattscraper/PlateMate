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
  ActivityIndicator,
  KeyboardAvoidingView,
  StatusBar,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchRecipes } from "../utils/api";
import { useNavigation } from "@react-navigation/native";
import { BlurView } from "expo-blur";

const { width, height } = Dimensions.get("window");

export default function FindRecipes() {
  const navigation = useNavigation();

  // Core state
  const [mealType, setMealType] = useState("");
  const [healthy, setHealthy] = useState(false);
  const [allergies, setAllergies] = useState([]);

  // Modal states - completely separated
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMealInput, setCustomMealInput] = useState("");
  const [newAllergy, setNewAllergy] = useState("");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // Animation
  const [fadeAnim] = useState(new Animated.Value(0));
  const customInputRef = useRef(null);

  // Constants
  const predefinedMealTypes = [
    { id: "breakfast", label: "Breakfast", value: "Breakfast", icon: "sunny", color: "#ff9500" },
    { id: "lunch", label: "Lunch", value: "Lunch", icon: "restaurant", color: "#34c759" },
    { id: "dinner", label: "Dinner", value: "Dinner", icon: "moon", color: "#5856d6" },
    { id: "dessert", label: "Dessert", value: "Dessert", icon: "ice-cream", color: "#ff2d92" },
    { id: "snack", label: "Snack", value: "Snack", icon: "nutrition", color: "#ff9500" },
    { id: "any", label: "Surprise Me", value: "Any", icon: "shuffle", color: "#8e8e93" },
  ];

  const loadingTexts = [
    "Simmering some ideas...",
    "Whisking up creativity...",
    "Adding a pinch of inspiration...",
    "Sautéing the perfect recipes...",
    "Grating some fresh ideas...",
    "Rolling out delicious options...",
    "Marinating in possibilities...",
    "Spicing things up...",
    "Mixing the perfect blend...",
    "Preheating the imagination...",
  ];

  useEffect(() => {
    // Animate in on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isLoading) {
      let currentIndex = 0;
      const textInterval = setInterval(() => {
        setLoadingText(loadingTexts[currentIndex]);
        currentIndex = (currentIndex + 1) % loadingTexts.length;
      }, 1500);
      return () => clearInterval(textInterval);
    }
  }, [isLoading]);

  // Modal handlers - completely rewritten
  const openMealTypeModal = () => {
    setShowMealTypeModal(true);
    setShowCustomInput(false);
    setCustomMealInput("");
  };

  const closeMealTypeModal = () => {
    setShowMealTypeModal(false);
    setShowCustomInput(false);
    setCustomMealInput("");
  };

  const selectPredefinedMeal = (value) => {
    setMealType(value);
    closeMealTypeModal();
  };

  const openCustomInput = () => {
    setShowCustomInput(true);
    // Focus input after a short delay to ensure modal is fully rendered
    setTimeout(() => {
      if (customInputRef.current) {
        customInputRef.current.focus();
      }
    }, 300);
  };

  const confirmCustomMeal = () => {
    if (customMealInput.trim()) {
      setMealType(customMealInput.trim());
      closeMealTypeModal();
    }
  };

  const cancelCustomInput = () => {
    setShowCustomInput(false);
    setCustomMealInput("");
  };

  // Allergy handlers
  const openAllergyModal = () => {
    setShowAllergyModal(true);
    setNewAllergy("");
  };

  const closeAllergyModal = () => {
    setShowAllergyModal(false);
    setNewAllergy("");
  };

  const addAllergy = () => {
    const trimmed = newAllergy.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
      closeAllergyModal();
    }
  };

  const removeAllergy = (allergyToRemove) => {
    setAllergies(allergies.filter((allergy) => allergy !== allergyToRemove));
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!mealType) return;

    setIsLoading(true);
    try {
      const recipes = await fetchRecipes(mealType, healthy, allergies);
      navigation.navigate("Results", { recipes, mealType, healthy, allergies });
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthyDescription = () => {
    return healthy
      ? "Focusing on nutritious, balanced meals with fresh ingredients"
      : "Including all recipe types from comfort food to gourmet";
  };

  // Loading screen
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.8)" />
        <BlurView intensity={90} style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <View style={styles.loadingAnimation}>
              <View style={styles.loadingIconWrapper}>
                <Ionicons name="restaurant" size={40} color="#008b8b" />
              </View>
              <ActivityIndicator size="large" color="#008b8b" style={styles.spinner} />
            </View>
            <Text style={styles.loadingText}>{loadingText}</Text>
            <Text style={styles.loadingSubtext}>Finding the perfect recipes for you</Text>
          </View>
        </BlurView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#008b8b" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Recipe Builder</Text>
          <Text style={styles.headerSubtitle}>Find your perfect meal</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroIconContainer}>
              <Ionicons name="restaurant-outline" size={32} color="#008b8b" />
            </View>
            <Text style={styles.heroTitle}>What are you craving?</Text>
            <Text style={styles.heroSubtitle}>
              Tell us your preferences and we'll find amazing recipes just for you
            </Text>
          </View>

          {/* Meal Type Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="restaurant" size={20} color="#008b8b" />
              </View>
              <Text style={styles.cardTitle}>Meal Type</Text>
            </View>
            
            <TouchableOpacity
              style={styles.selector}
              onPress={openMealTypeModal}
              activeOpacity={0.7}
            >
              <Text style={[styles.selectorText, !mealType && styles.selectorPlaceholder]}>
                {mealType || "Choose what you want to cook"}
              </Text>
              <View style={styles.selectorArrow}>
                <Ionicons name="chevron-forward" size={20} color="#008b8b" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Healthy Toggle Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="leaf" size={20} color="#008b8b" />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Healthy Focus</Text>
                <Text style={styles.cardDescription}>{getHealthyDescription()}</Text>
              </View>
              <Switch
                value={healthy}
                onValueChange={setHealthy}
                trackColor={{ false: "#e5e5ea", true: "#34c759" }}
                thumbColor={healthy ? "#ffffff" : "#ffffff"}
                ios_backgroundColor="#e5e5ea"
              />
            </View>
          </View>

          {/* Allergies Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="shield-checkmark" size={20} color="#008b8b" />
              </View>
              <Text style={styles.cardTitle}>Dietary Restrictions</Text>
              <TouchableOpacity style={styles.addButton} onPress={openAllergyModal}>
                <Ionicons name="add" size={20} color="#008b8b" />
              </TouchableOpacity>
            </View>

            {allergies.length > 0 ? (
              <View style={styles.tagsContainer}>
                {allergies.map((allergy, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.tag}
                    onPress={() => removeAllergy(allergy)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagText}>{allergy}</Text>
                    <Ionicons name="close" size={16} color="#008b8b" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="add-circle-outline" size={24} color="#c7c7cc" />
                <Text style={styles.emptyStateText}>No restrictions added</Text>
                <Text style={styles.emptyStateSubtext}>Tap + to add dietary restrictions</Text>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, !mealType && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!mealType}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={24} color="white" />
            <Text style={styles.submitButtonText}>Find My Recipes</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Meal Type Modal */}
      <Modal
        visible={showMealTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeMealTypeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Meal Type</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeMealTypeModal}>
                <Ionicons name="close" size={24} color="#8e8e93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {!showCustomInput ? (
                <>
                  {/* Predefined Options */}
                  <View style={styles.optionsGrid}>
                    {predefinedMealTypes.map((type) => (
                      <TouchableOpacity
                        key={type.id}
                        style={styles.optionCard}
                        onPress={() => selectPredefinedMeal(type.value)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.optionIcon, { backgroundColor: `${type.color}15` }]}>
                          <Ionicons name={type.icon} size={24} color={type.color} />
                        </View>
                        <Text style={styles.optionText}>{type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom Option Trigger */}
                  <TouchableOpacity style={styles.customTrigger} onPress={openCustomInput}>
                    <View style={styles.customTriggerIcon}>
                      <Ionicons name="create-outline" size={24} color="#008b8b" />
                    </View>
                    <View style={styles.customTriggerContent}>
                      <Text style={styles.customTriggerTitle}>Custom Meal Type</Text>
                      <Text style={styles.customTriggerSubtitle}>Create your own meal category</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#c7c7cc" />
                  </TouchableOpacity>
                </>
              ) : (
                /* Custom Input Mode */
                <View style={styles.customInputSection}>
                  <View style={styles.customInputHeader}>
                    <TouchableOpacity onPress={cancelCustomInput}>
                      <Ionicons name="chevron-back" size={24} color="#008b8b" />
                    </TouchableOpacity>
                    <Text style={styles.customInputTitle}>Custom Meal Type</Text>
                    <View style={{ width: 24 }} />
                  </View>

                  <Text style={styles.customInputLabel}>What type of meal are you planning?</Text>
                  
                  <TextInput
                    ref={customInputRef}
                    style={styles.customTextInput}
                    value={customMealInput}
                    onChangeText={setCustomMealInput}
                    placeholder="e.g., Italian Night, Summer BBQ, Holiday Feast..."
                    placeholderTextColor="#c7c7cc"
                    returnKeyType="done"
                    onSubmitEditing={confirmCustomMeal}
                    autoCapitalize="words"
                  />

                  <View style={styles.customInputActions}>
                    <TouchableOpacity
                      style={styles.customCancelButton}
                      onPress={cancelCustomInput}
                    >
                      <Text style={styles.customCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.customConfirmButton,
                        !customMealInput.trim() && styles.customConfirmButtonDisabled
                      ]}
                      onPress={confirmCustomMeal}
                      disabled={!customMealInput.trim()}
                    >
                      <Text style={[
                        styles.customConfirmText,
                        !customMealInput.trim() && styles.customConfirmTextDisabled
                      ]}>
                        Use This
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Allergy Modal */}
      <Modal
        visible={showAllergyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeAllergyModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.allergyModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Restriction</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeAllergyModal}>
                <Ionicons name="close" size={24} color="#8e8e93" />
              </TouchableOpacity>
            </View>

            <View style={styles.allergyModalContent}>
              <Text style={styles.allergyInputLabel}>
                Enter any allergies or dietary preferences
              </Text>
              
              <TextInput
                style={styles.allergyTextInput}
                value={newAllergy}
                onChangeText={setNewAllergy}
                placeholder="e.g., Peanuts, Dairy, Gluten, Vegetarian"
                placeholderTextColor="#c7c7cc"
                returnKeyType="done"
                onSubmitEditing={addAllergy}
                autoFocus={true}
                autoCapitalize="words"
              />

              <TouchableOpacity
                style={[
                  styles.allergyAddButton,
                  !newAllergy.trim() && styles.allergyAddButtonDisabled
                ]}
                onPress={addAllergy}
                disabled={!newAllergy.trim()}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.allergyAddButtonText}>Add Restriction</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  
  // Header
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: "#008b8b",
      backgroundColor: "#f8f9fa",
      marginTop: -10,
      borderRadius: 10,
      borderBlockColor: "#008b8b",
    },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },

  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  heroIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1c1c1e',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  // Cards
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1c1e',
    flex: 1,
  },
  cardContent: {
    flex: 1,
  },
  cardDescription: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
    lineHeight: 18,
  },

  // Selector
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  selectorText: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  selectorPlaceholder: {
    color: '#8e8e93',
    fontWeight: '400',
  },
  selectorArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Add Button
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tagText: {
    fontSize: 14,
    color: '#008b8b',
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#8e8e93',
    fontWeight: '500',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#c7c7cc',
    marginTop: 4,
  },

  // Submit Button
  submitButton: {
    backgroundColor: '#008b8b',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  loadingAnimation: {
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  spinner: {
    transform: [{ scale: 1.2 }],
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#008b8b',
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 22, // Fixed height to prevent size changes
    lineHeight: 22,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },

  // Modal Base
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f7',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f2f2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 20,
  },

  // Options Grid
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    width: (width - 64) / 2,
    backgroundColor: '#f2f2f7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1c1e',
    textAlign: 'center',
  },

  // Custom Trigger
  customTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 16,
    padding: 16,
  },
  customTriggerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customTriggerContent: {
    flex: 1,
  },
  customTriggerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c1c1e',
  },
  customTriggerSubtitle: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },

  // Custom Input Section
  customInputSection: {
    paddingTop: 8,
  },
  customInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  customInputTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
    flex: 1,
    textAlign: 'center',
  },
  customInputLabel: {
    fontSize: 16,
    color: '#1c1c1e',
    marginBottom: 12,
  },
  customTextInput: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1c1c1e',
    marginBottom: 20,
  },
  customInputActions: {
    flexDirection: 'row',
    gap: 12,
  },
  customCancelButton: {
    flex: 1,
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  customCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8e8e93',
  },
  customConfirmButton: {
    flex: 1,
    backgroundColor: '#008b8b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  customConfirmButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },
  customConfirmText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  customConfirmTextDisabled: {
    color: '#8e8e93',
  },

  // Allergy Modal
  allergyModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.5,
  },
  allergyModalContent: {
    padding: 20,
  },
  allergyInputLabel: {
    fontSize: 16,
    color: '#1c1c1e',
    marginBottom: 12,
  },
  allergyTextInput: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1c1c1e',
    marginBottom: 20,
  },
  allergyAddButton: {
    backgroundColor: '#008b8b',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  allergyAddButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },
  allergyAddButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
});
