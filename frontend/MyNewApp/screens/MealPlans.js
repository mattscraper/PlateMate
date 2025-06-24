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
import { fetchMealPlans } from "../utils/api";
import { useNavigation } from "@react-navigation/native";
import { BlurView } from "expo-blur";

const { width, height } = Dimensions.get("window");

export default function MealPlans() {
  const navigation = useNavigation();

  // Core state - Updated max days to 3
  const [days, setDays] = useState(1);
  const [caloriesPerDay, setCaloriesPerDay] = useState(2000);
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [healthy, setHealthy] = useState(false);
  const [allergies, setAllergies] = useState([]);
  const [dietType, setDietType] = useState("");

  // Modal states
  const [showDietTypeModal, setShowDietTypeModal] = useState(false);
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [newAllergy, setNewAllergy] = useState("");

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  // Animation
  const [fadeAnim] = useState(new Animated.Value(0));

  // Expanded diet type options
  const predefinedDietTypes = [
    { id: "keto", label: "Keto", value: "Keto", icon: "nutrition", color: "#ff6b35" },
    { id: "paleo", label: "Paleo", value: "Paleo", icon: "leaf", color: "#34c759" },
    { id: "vegan", label: "Vegan", value: "Vegan", icon: "leaf-outline", color: "#30d158" },
    { id: "vegetarian", label: "Vegetarian", value: "Vegetarian", icon: "flower", color: "#32d74b" },
    { id: "lowCarb", label: "Low Carb", value: "Low Carb", icon: "barbell", color: "#007aff" },
    { id: "glutenFree", label: "Gluten Free", value: "Gluten Free", icon: "checkmark-circle", color: "#5856d6" },
    { id: "mediterranean", label: "Mediterranean", value: "Mediterranean", icon: "sunny", color: "#ff9500" },
    { id: "pescatarian", label: "Pescatarian", value: "Pescatarian", icon: "fish", color: "#5ac8fa" },
    { id: "dairyFree", label: "Dairy Free", value: "Dairy Free", icon: "close-circle", color: "#ff3b30" },
    { id: "highProtein", label: "High Protein", value: "High Protein", icon: "fitness", color: "#ff2d92" },
  ];

  // Updated loading texts for shorter plans
  const loadingTexts = [
    "Crafting your perfect meals...",
    "Planning delicious combinations...",
    "Balancing nutrition and flavor...",
    "Creating your custom menu...",
    "Optimizing meal variety...",
    "Selecting fresh ingredients...",
    "Building your meal schedule...",
    "Personalizing your plan...",
    "Almost ready to serve...",
    "Finalizing your menu...",
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
  const openDietTypeModal = () => {
    setShowDietTypeModal(true);
  };

  const closeDietTypeModal = () => {
    setShowDietTypeModal(false);
  };

  const selectDietType = (value) => {
    setDietType(value);
    closeDietTypeModal();
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
    setIsLoading(true);
    try {
      const mealPlan = await fetchMealPlans(
        days,
        mealsPerDay,
        healthy,
        allergies,
        [dietType],
        caloriesPerDay
      );

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

  const getHealthyDescription = () => {
    return healthy
      ? "Focusing on nutritious, balanced meals with fresh ingredients"
      : "Including all meal types from comfort food to gourmet";
  };

  // Helper function to get day text
  const getDayText = (dayCount) => {
    if (dayCount === 1) return "Quick day plan";
    if (dayCount === 2) return "Weekend planning";
    return "Short week plan";
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
                <Ionicons name="calendar" size={40} color="#008b8b" />
              </View>
              <ActivityIndicator size="large" color="#008b8b" style={styles.spinner} />
            </View>
            <Text style={styles.loadingText}>{loadingText}</Text>
            <Text style={styles.loadingSubtext}>Creating your personalized meal plan</Text>
          </View>
        </BlurView>
      </View>
    );
  }

  // Counter Component
  const Counter = ({ label, value, onChange, min, max, unit = "", description }) => (
    <View style={styles.counterContainer}>
      <View style={styles.counterHeader}>
        <Text style={styles.counterLabel}>{label}</Text>
        {description && <Text style={styles.counterDescription}>{description}</Text>}
      </View>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={[styles.counterButton, value <= min && styles.counterButtonDisabled]}
          onPress={() => onChange(Math.max(min, value - (label === "Daily Calories" ? 100 : 1)))}
          disabled={value <= min}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={20} color={value <= min ? "#c7c7cc" : "#008b8b"} />
        </TouchableOpacity>
        
        <View style={styles.counterValueContainer}>
          <Text style={styles.counterValue}>{value}</Text>
          {unit && <Text style={styles.counterUnit}>{unit}</Text>}
        </View>
        
        <TouchableOpacity
          style={[styles.counterButton, value >= max && styles.counterButtonDisabled]}
          onPress={() => onChange(Math.min(max, value + (label === "Daily Calories" ? 100 : 1)))}
          disabled={value >= max}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color={value >= max ? "#c7c7cc" : "#008b8b"} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f2f2f7" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#008b8b" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Quick Meal Planner</Text>
          <Text style={styles.headerSubtitle}>Plan up to 3 days of perfect meals</Text>
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
              <Ionicons name="calendar-outline" size={32} color="#008b8b" />
            </View>
            <Text style={styles.heroTitle}>Quick meal planning</Text>
            <Text style={styles.heroSubtitle}>
              Create a personalized 1-3 day meal plan that fits your lifestyle and dietary needs
            </Text>
          </View>

          {/* Plan Settings Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="settings" size={20} color="#008b8b" />
              </View>
              <Text style={styles.cardTitle}>Plan Settings</Text>
            </View>

            <Counter
              label="Plan Duration"
              value={days}
              onChange={setDays}
              min={1}
              max={3}
              unit={days === 1 ? "day" : "days"}
              description={getDayText(days)}
            />

            <Counter
              label="Meals Per Day"
              value={mealsPerDay}
              onChange={setMealsPerDay}
              min={1}
              max={4}
              unit={mealsPerDay === 1 ? "meal" : "meals"}
              description="Number of meals each day"
            />

            <Counter
              label="Daily Calories"
              value={caloriesPerDay}
              onChange={setCaloriesPerDay}
              min={1000}
              max={5000}
              unit="cal"
              description="Target calories per day"
            />
          </View>

          {/* Diet Type Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="leaf" size={20} color="#008b8b" />
              </View>
              <Text style={styles.cardTitle}>Diet Type</Text>
            </View>
            
            <TouchableOpacity
              style={styles.selector}
              onPress={openDietTypeModal}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.selectorText,
                !dietType && styles.selectorPlaceholder
              ]}>
                {dietType || "Choose your diet preference"}
              </Text>
              <View style={styles.selectorArrow}>
                <Ionicons name="chevron-forward" size={20} color="#008b8b" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Healthy Focus Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons name="heart" size={20} color="#008b8b" />
              </View>
              <View style={styles.switchContent}>
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

          {/* Dietary Restrictions Card */}
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

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateButton, isLoading && styles.generateButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar" size={24} color="white" />
            <Text style={styles.generateButtonText}>Create My Meal Plan</Text>
          </TouchableOpacity>

          {/* Quick Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={20} color="#008b8b" />
              <Text style={styles.infoTitle}>Quick Planning</Text>
            </View>
            <Text style={styles.infoText}>
              Perfect for meal prep, weekend planning, or trying new recipes
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Diet Type Modal */}
      <Modal
        visible={showDietTypeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeDietTypeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Diet Type</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeDietTypeModal}>
                <Ionicons name="close" size={24} color="#8e8e93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                Select a diet type that matches your lifestyle
              </Text>

              {/* Diet Types Grid */}
              <View style={styles.dietTypesGrid}>
                {predefinedDietTypes.map((diet) => (
                  <TouchableOpacity
                    key={diet.id}
                    style={[
                      styles.dietTypeCard,
                      dietType === diet.value && styles.dietTypeCardSelected
                    ]}
                    onPress={() => selectDietType(diet.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.dietTypeIcon,
                      { backgroundColor: `${diet.color}15` },
                      dietType === diet.value && styles.dietTypeIconSelected
                    ]}>
                      <Ionicons
                        name={diet.icon}
                        size={24}
                        color={dietType === diet.value ? "#fff" : diet.color}
                      />
                    </View>
                    <Text style={[
                      styles.dietTypeText,
                      dietType === diet.value && styles.dietTypeTextSelected
                    ]}>
                      {diet.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Clear Selection Option */}
              {dietType && (
                <TouchableOpacity
                  style={styles.clearSelectionButton}
                  onPress={() => selectDietType("")}
                >
                  <Ionicons name="close-circle" size={20} color="#ff3b30" />
                  <Text style={styles.clearSelectionText}>Clear Selection</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
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
                placeholder="e.g., Peanuts, Dairy, Gluten, Shellfish"
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
  cardDescription: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
    lineHeight: 18,
  },
  switchContent: {
    flex: 1,
  },

  // Counter Component
  counterContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  counterHeader: {
    marginBottom: 12,
  },
  counterLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  counterDescription: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 8,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  counterButtonDisabled: {
    backgroundColor: '#f2f2f7',
  },
  counterValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  counterUnit: {
    fontSize: 14,
    color: '#8e8e93',
    marginLeft: 4,
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
    textAlign: 'center',
  },

  // Generate Button
  generateButton: {
    backgroundColor: '#008b8b',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
    marginTop: 20,
    marginBottom: 16,
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
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
  },

  // Info Card
  infoCard: {
    backgroundColor: 'rgba(0, 139, 139, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#008b8b',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008b8b',
  },
  infoText: {
    fontSize: 14,
    color: '#5a6169',
    lineHeight: 20,
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
  modalSubtitle: {
    fontSize: 16,
    color: '#8e8e93',
    marginBottom: 20,
    textAlign: 'center',
  },

  // Diet Types Grid
  dietTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  dietTypeCard: {
    width: 150,
    backgroundColor: '#f2f2f7',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dietTypeCardSelected: {
    backgroundColor: '#008b8b',
    borderColor: '#006666',
  },
  dietTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dietTypeIconSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dietTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1c1c1e',
    textAlign: 'center',
  },
  dietTypeTextSelected: {
    color: 'white',
    fontWeight: '600',
  },

  // Clear Selection Button
  clearSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  clearSelectionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ff3b30',
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
