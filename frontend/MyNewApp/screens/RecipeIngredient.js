import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchRecipesByIngredients } from "../utils/api";
import { useNavigation } from "@react-navigation/native";

export default function FindByIngredients() {
  const navigation = useNavigation();

  // State
  const [ingredients, setIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState("");
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);
  const [allergies, setAllergies] = useState([]);
  const [newAllergy, setNewAllergy] = useState("");
  const [allergyModalVisible, setAllergyModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress] = useState(new Animated.Value(0));
  const [loadingText, setLoadingText] = useState("");

  // Loading animation texts
  const loadingTexts = [
    "Checking your ingredients... 🧂",
    "Mixing and matching... 🥗",
    "Finding perfect recipes... 📖",
    "Almost ready to cook... 🍳",
    "Preheating the oven... 🔥",
    "Whisking up some ideas... 🍶",
    "Chopping veggies... 🥕",
    "Sautéing some inspiration... 🍴",
    "Rolling the dough... 🥖",
    "Seasoning to perfection... 🌿",
    "Simmering the magic... 🍲",
    "Tasting for quality... 👨‍🍳",
    "Fetching the secret sauce... 🥫",
    "Sprinkling some love... 💕",
    "Turning up the heat... 🔥",
    "Serving up deliciousness... 🍽️",
    "Plating your masterpiece... 🍛",
    "Finding the freshest produce... 🥬",
    "Melting butter for flavor... 🧈",
    "Whipping up something amazing... 🥄",
    "Marinating the goodness... 🧄",
  ];

  useEffect(() => {
    if (isLoading) {
      let currentIndex = 0;
      const textInterval = setInterval(() => {
        setLoadingText(loadingTexts[currentIndex]);
        currentIndex = (currentIndex + 1) % loadingTexts.length;
      }, 1300);

      return () => clearInterval(textInterval);
    }
  }, [isLoading]);

  const handleSubmit = async () => {
    if (ingredients.length === 0) return;

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

      // change this in production.. will host backend to server
      const recipes = await fetchRecipesByIngredients(ingredients, allergies);

      Animated.timing(loadingProgress, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();

      await new Promise((resolve) => setTimeout(resolve, 200));
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

  const addIngredient = () => {
    if (newIngredient.trim() && !ingredients.includes(newIngredient.trim())) {
      setIngredients([...ingredients, newIngredient.trim()]);
      setNewIngredient("");
    }
  };

  const removeIngredient = (ingredientToRemove) => {
    setIngredients(
      ingredients.filter((ingredient) => ingredient !== ingredientToRemove)
    );
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
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Cook with What You Have</Text>
          <Text style={styles.subtitle}>
            Find recipes using your ingredients
          </Text>
        </View>

        {/* Ingredients Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Your Ingredients</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setIngredientModalVisible(true)}
            >
              <Ionicons name="add-circle" size={24} color="#008b8b" />
            </TouchableOpacity>
          </View>

          {ingredients.length > 0 ? (
            <View style={styles.chipsContainer}>
              {ingredients.map((ingredient, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  onPress={() => removeIngredient(ingredient)}
                >
                  <Text style={styles.chipText}>{ingredient}</Text>
                  <Ionicons name="close-circle" size={18} color="#008b8b" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.placeholderText}>
              Add ingredients you want to cook with
            </Text>
          )}
        </View>

        {/* Allergies Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Dietary Restrictions</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setAllergyModalVisible(true)}
            >
              <Ionicons name="add-circle" size={24} color="#008b8b" />
            </TouchableOpacity>
          </View>

          {allergies.length > 0 ? (
            <View style={styles.chipsContainer}>
              {allergies.map((allergy, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  onPress={() => removeAllergy(allergy)}
                >
                  <Text style={styles.chipText}>{allergy}</Text>
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

        {/* Find Button */}
        <TouchableOpacity
          style={[
            styles.findButton,
            ingredients.length === 0 && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={ingredients.length === 0 || isLoading}
        >
          {isLoading ? (
            <Animated.View>
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

      {/* Ingredient Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={ingredientModalVisible}
        onRequestClose={() => setIngredientModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIngredientModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Ingredient</Text>
              <View style={styles.modalCloseButton} />
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                What ingredients do you have?
              </Text>
              <TextInput
                style={styles.modalInput}
                value={newIngredient}
                onChangeText={setNewIngredient}
                placeholder="e.g., Chicken, Rice, Tomatoes"
                placeholderTextColor="#a0a0a0"
                autoFocus
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  !newIngredient.trim() && styles.buttonDisabled,
                ]}
                onPress={() => {
                  addIngredient();
                  setIngredientModalVisible(false);
                }}
                disabled={!newIngredient.trim()}
              >
                <Text style={styles.modalAddText}>Add Ingredient</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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

            <View style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Enter any food allergies or dietary restrictions
              </Text>
              <TextInput
                style={styles.modalInput}
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
            <Text style={styles.loadingTitle}>Finding Recipes</Text>
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
    padding: 20,
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 17,
    color: "#7f8c8d",
    textAlign: "center",
    maxWidth: "80%",
  },
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
  },
  addButton: {
    padding: 8,
    marginRight: -8,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
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
  chipText: {
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
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Modal Styles
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
  modalCloseButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 20,
    textAlign: "center",
    lineHeight: 22,
  },
  modalInput: {
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    color: "#2c3e50",
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  modalAddButton: {
    backgroundColor: "#008b8b",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
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
  // Loading Modal Styles
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
});
