import React, { useState, useEffect } from "react";
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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import CategorySelector from "../components/CategorySelector";
import { fetchRecipes } from "../utils/api";
import { useNavigation } from "@react-navigation/native";

export default function FindRecipes() {
  const [mealType, setMealType] = useState("");
  const [healthy, setHealthy] = useState(false);
  const [allergies, setAllergies] = useState([]);
  const [newAllergy, setNewAllergy] = useState("");
  const [allergyModalVisible, setAllergyModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAnim] = useState(new Animated.Value(0));
  const [loadingProgress] = useState(new Animated.Value(0));
  const [loadingText, setLoadingText] = useState("");
  const navigation = useNavigation();

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
    "Baking brilliance to perfection... 🎂",
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

  const handleSubmit = async () => {
    if (!mealType) return;

    setIsLoading(true);
    loadingProgress.setValue(0);

    try {
      // Start loading animation that will run until API responds
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingProgress, {
            toValue: 0.9, // Go to 90% to indicate still waiting for response
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

      // Actual API call
      const recipes = await fetchRecipes(mealType, healthy, allergies);

      // Once API responds, quickly fill to 100%
      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();

      // Short delay to show completion before navigation
      await new Promise((resolve) => setTimeout(resolve, 200));

      navigation.navigate("Results", { recipes, mealType, healthy, allergies });
    } catch (error) {
      console.error("Error fetching recipes:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const getHealthyDescription = () => {
    if (healthy) {
      return "Focusing on nutritious, balanced meals";
    }
    return " Including all recipe types";
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Discover New Recipes</Text>
          <Text style={styles.subtitle}>Find your next culinary adventure</Text>
        </View>

        {/* Meal Type Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What would you like to cook?</Text>
          <CategorySelector setMealType={setMealType} />
        </View>

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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Dietary Restriction</Text>
            <TextInput
              style={styles.modalInput}
              value={newAllergy}
              onChangeText={setNewAllergy}
              placeholder="e.g., Peanuts, Dairy, Gluten"
              placeholderTextColor="#a0a0a0"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setAllergyModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
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
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  allergyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: {
    padding: 4,
  },
  allergyChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  allergyChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6f3f3",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  allergyChipText: {
    color: "#008b8b",
    fontSize: 14,
    fontWeight: "500",
  },
  placeholderText: {
    color: "#a0a0a0",
    fontSize: 14,
    fontStyle: "italic",
  },
  findButton: {
    backgroundColor: "#008b8b",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    marginBottom: 10,
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 30,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: "#2c3e50",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  modalCancelText: {
    color: "#2c3e50",
    fontSize: 16,
    fontWeight: "600",
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: "#008b8b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalAddText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#008b8b",
    marginBottom: 20,
    textAlign: "center",
    minHeight: 24,
  },
  progressBarContainer: {
    width: "100%",
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#008b8b",
    borderRadius: 3,
  },
});
