import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
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
import { fetchRecipesByIngredients } from "../utils/api";
import { useNavigation } from "@react-navigation/native";
import { BlurView } from "expo-blur";

const { width, height } = Dimensions.get("window");

export default function FindByIngredients() {
  const navigation = useNavigation();

  // Core state
  const [ingredients, setIngredients] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [newAllergy, setNewAllergy] = useState("");

  // Modal states
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // Animation
  const [fadeAnim] = useState(new Animated.Value(0));
  const ingredientInputRef = useRef(null);

  // Loading animation texts
  const loadingTexts = [
    "Checking your ingredients...",
    "Mixing and matching...",
    "Finding perfect recipes...",
    "Whisking up some ideas...",
    "Chopping through options...",
    "Sautéing some inspiration...",
    "Seasoning to perfection...",
    "Simmering the magic...",
    "Tasting for quality...",
    "Sprinkling some love...",
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

  // Modal handlers
  const openIngredientModal = () => {
    setShowIngredientModal(true);
    setNewIngredient("");
  };

  const closeIngredientModal = () => {
    setShowIngredientModal(false);
    setNewIngredient("");
  };

  const openAllergyModal = () => {
    setShowAllergyModal(true);
    setNewAllergy("");
  };

  const closeAllergyModal = () => {
    setShowAllergyModal(false);
    setNewAllergy("");
  };

  // Ingredient handlers
  const addIngredient = () => {
    const trimmed = newIngredient.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients([...ingredients, trimmed]);
      setNewIngredient("");
      // Clear the input but keep modal open for adding more ingredients
    }
  };

  const removeIngredient = (ingredientToRemove) => {
    setIngredients(ingredients.filter((ingredient) => ingredient !== ingredientToRemove));
  };

  // Allergy handlers
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
    if (ingredients.length === 0) return;

    setIsLoading(true);
    try {
      const recipes = await fetchRecipesByIngredients(ingredients, allergies);
      navigation.navigate("ResultsIngredients", {
        recipes,
        ingredients,
        allergies,
      });
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setIsLoading(false);
    }
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
                <Ionicons name="basket" size={40} color="#008b8b" />
              </View>
              <ActivityIndicator size="large" color="#008b8b" style={styles.spinner} />
            </View>
            <Text style={styles.loadingText}>{loadingText}</Text>
            <Text style={styles.loadingSubtext}>Creating recipes from your ingredients</Text>
          </View>
        </BlurView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f2f7" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#008b8b" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>What's in Your Kitchen?</Text>
          <Text style={styles.headerSubtitle}>Find recipes with your ingredients</Text>
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
              <Ionicons name="basket-outline" size={32} color="#008b8b" />
            </View>
            <Text style={styles.heroTitle}>Cook with what you have</Text>
            <Text style={styles.heroSubtitle}>
              Tell us what's in your kitchen and we'll find delicious recipes you can make right now
            </Text>
          </View>

          {/* Ingredients Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="basket" size={20} color="#008b8b" />
              </View>
              <Text style={styles.cardTitle}>Your Ingredients</Text>
              <TouchableOpacity style={styles.addButton} onPress={openIngredientModal}>
                <Ionicons name="add" size={20} color="#008b8b" />
              </TouchableOpacity>
            </View>

            {ingredients.length > 0 ? (
              <View style={styles.tagsContainer}>
                {ingredients.map((ingredient, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.tag}
                    onPress={() => removeIngredient(ingredient)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagText}>{ingredient}</Text>
                    <Ionicons name="close" size={16} color="#008b8b" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="basket-outline" size={24} color="#c7c7cc" />
                <Text style={styles.emptyStateText}>No ingredients added yet</Text>
                <Text style={styles.emptyStateSubtext}>Tap + to add what you have in your kitchen</Text>
              </View>
            )}
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

          {/* Requirements Note */}
          {ingredients.length > 0 && ingredients.length < 4 && (
            <View style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Ionicons name="bulb" size={20} color="#ff9500" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Pro Tip</Text>
                <Text style={styles.tipText}>
                  Add {4 - ingredients.length} more ingredient{4 - ingredients.length === 1 ? '' : 's'} for better recipe suggestions
                </Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, ingredients.length === 0 && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={ingredients.length === 0}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={24} color="white" />
            <Text style={styles.submitButtonText}>
              {ingredients.length === 0
                ? "Add ingredients to start"
                : `Find Recipes (${ingredients.length} ingredient${ingredients.length === 1 ? '' : 's'})`
              }
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Ingredient Modal - FIXED VERSION */}
      <Modal
        visible={showIngredientModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeIngredientModal}
        statusBarTranslucent={false}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Ingredients</Text>
                <TouchableOpacity style={styles.modalCloseButton} onPress={closeIngredientModal}>
                  <Ionicons name="close" size={24} color="#8e8e93" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={styles.modalSubtitle}>
                  What ingredients do you have available?
                </Text>

                {/* Current Ingredients Display */}
                {ingredients.length > 0 && (
                  <View style={styles.currentIngredientsSection}>
                    <Text style={styles.currentIngredientsTitle}>Your ingredients:</Text>
                    <View style={styles.modalTagsContainer}>
                      {ingredients.map((ingredient, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.modalTag}
                          onPress={() => removeIngredient(ingredient)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.modalTagText}>{ingredient}</Text>
                          <Ionicons name="close" size={14} color="#008b8b" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Add New Ingredient */}
                <View style={styles.inputSection}>
                  <View style={styles.inputContainer}>
                    <TextInput
                      ref={ingredientInputRef}
                      style={styles.textInput}
                      value={newIngredient}
                      onChangeText={setNewIngredient}
                      placeholder="e.g., Chicken, Rice, Tomatoes, Onions..."
                      placeholderTextColor="#c7c7cc"
                      returnKeyType="done"
                      onSubmitEditing={addIngredient}
                      autoCapitalize="words"
                      autoFocus={true}
                    />
                    <TouchableOpacity
                      style={[
                        styles.quickAddButton,
                        !newIngredient.trim() && styles.quickAddButtonDisabled
                      ]}
                      onPress={addIngredient}
                      disabled={!newIngredient.trim()}
                    >
                      <Ionicons name="add" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Quick Add Suggestions */}
                <View style={styles.suggestionsSection}>
                  <Text style={styles.suggestionsTitle}>Popular ingredients:</Text>
                  <View style={styles.suggestionsGrid}>
                    {['Chicken', 'Rice', 'Eggs', 'Onions', 'Garlic', 'Tomatoes', 'Pasta', 'Cheese'].map((suggestion) => (
                      <TouchableOpacity
                        key={suggestion}
                        style={[
                          styles.suggestionChip,
                          ingredients.includes(suggestion) && styles.suggestionChipDisabled
                        ]}
                        onPress={() => {
                          if (!ingredients.includes(suggestion)) {
                            setIngredients([...ingredients, suggestion]);
                          }
                        }}
                        disabled={ingredients.includes(suggestion)}
                      >
                        <Text style={[
                          styles.suggestionChipText,
                          ingredients.includes(suggestion) && styles.suggestionChipTextDisabled
                        ]}>
                          {suggestion}
                        </Text>
                        {ingredients.includes(suggestion) && (
                          <Ionicons name="checkmark" size={14} color="#c7c7cc" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.doneButton} onPress={closeIngredientModal}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Allergy Modal - FIXED VERSION */}
      <Modal
        visible={showAllergyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeAllergyModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
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
        </View>
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
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    textAlign: 'center',
  },

  // Tip Card
  tipCard: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.2)',
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff9500',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 13,
    color: '#8e8e93',
    lineHeight: 18,
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
    backgroundColor: '#c7c7cc',
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
    minHeight: 22,
    lineHeight: 22,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
  },

  // Modal Base - FIXED
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start', // Changed from flex-end
    paddingTop: height * 0.1, // Add top padding
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-start', // Changed from flex-end
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.9, // Fixed height instead of maxHeight
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
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20, // Add bottom padding to ensure content doesn't get cut off
  },
  modalScrollContent: {
    paddingTop: 20,
    paddingBottom: 40, // Increased bottom padding for better scrolling
    flexGrow: 1, // Ensure content can grow
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#8e8e93',
    marginBottom: 20,
    textAlign: 'center',
  },

  // Current Ingredients in Modal
  currentIngredientsSection: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  currentIngredientsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 8,
  },
  modalTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  modalTagText: {
    fontSize: 13,
    color: '#008b8b',
    fontWeight: '500',
  },

  // Input Section
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1c1c1e',
  },
  quickAddButton: {
    backgroundColor: '#008b8b',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAddButtonDisabled: {
    backgroundColor: '#c7c7cc',
  },

  // Suggestions
  suggestionsSection: {
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#f2f2f7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  suggestionChipDisabled: {
    backgroundColor: '#e5e5ea',
  },
  suggestionChipText: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  suggestionChipTextDisabled: {
    color: '#c7c7cc',
  },

  // Modal Footer
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f7',
  },
  doneButton: {
    backgroundColor: '#008b8b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },

  // Allergy Modal - FIXED
  allergyModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.6,
    minHeight: height * 0.4,
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
  allergyModalContent: {
    padding: 20,
    flex: 1,
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
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
});
