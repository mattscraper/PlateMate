import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fetchRecipes } from "../utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { authService, APIURL } from "../services/auth";
import axios from "axios";

const { width } = Dimensions.get("window");

export default function ResultsScreen({ route }) {
  const navigation = useNavigation();
  const [recipes, setRecipes] = useState(route.params?.recipes || []);
  const [loading, setLoading] = useState(false);
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
  const [slideAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(1));
  const [itemAnimations] = useState([]);

  const { mealType = "", healthy = false, allergies = [] } = route.params || {};

  useEffect(() => {
    itemAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    });
  }, [selectedRecipeIndex]);

  const getNewAnimation = () => {
    const anim = new Animated.Value(0);
    itemAnimations.push(anim);
    return anim;
  };

  const handleRecipeSave = async (recipeText) => {
    try {
      const sections = recipeText.split("\n\n");
      const title = sections[0];
      const ingredients = sections.find((s) => s.includes("•"));
      const instructions = sections.find((s) => s.match(/^\d\./m));
      const nutrition = sections.find(
        (s) =>
          s.toLowerCase().includes("time") ||
          s.toLowerCase().includes("servings")
      );

      const response = await axios.post(`${APIURL}/api/recipes/save`, {
        title,
        ingredients,
        instructions,
        nutrition,
      });

      Alert.alert(
        "Success",
        "Recipe saved successfully! You can view it in My Recipes.",
        [
          {
            text: "View Now",
            onPress: () => navigation.navigate("MyRecipes"),
          },
          {
            text: "Keep Browsing",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert("Error", "Please log in to save recipes");
      } else {
        Alert.alert("Error", "Failed to save recipe. Please try again.");
      }
      console.error("Error saving recipe:", error);
    }
  };

  const regenerateRecipes = async () => {
    setLoading(true);
    try {
      const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 800));
      const recipesPromise = fetchRecipes(mealType, healthy, allergies);
      const [newRecipes] = await Promise.all([recipesPromise, minLoadingTime]);
      setRecipes(newRecipes);
      setSelectedRecipeIndex(0);
    } catch (error) {
      console.error("Error regenerating recipes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecipeChange = (direction) => {
    const newIndex =
      direction === "next"
        ? selectedRecipeIndex < recipes.length - 1
          ? selectedRecipeIndex + 1
          : 0
        : selectedRecipeIndex > 0
        ? selectedRecipeIndex - 1
        : recipes.length - 1;

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction === "next" ? -width : width,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedRecipeIndex(newIndex);
      slideAnim.setValue(direction === "next" ? width : -width);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const formatRecipeSection = (section, type) => {
    switch (type) {
      case "ingredients":
        return section.split("\n").map((ingredient, i) => {
          const fadeIn = getNewAnimation();
          return (
            <Animated.View
              key={i}
              style={[styles.ingredientItem, { opacity: fadeIn }]}
            >
              <View style={styles.ingredientIconContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#008b8b" />
              </View>
              <Text style={styles.ingredientText}>
                {ingredient.replace("•", "").trim()}
              </Text>
            </Animated.View>
          );
        });

      case "instructions":
        return section.split("\n").map((instruction, i) => {
          const fadeIn = getNewAnimation();
          return (
            <Animated.View
              key={i}
              style={[styles.instructionItem, { opacity: fadeIn }]}
            >
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.instructionText}>
                {instruction.replace(/^\d+\./, "").trim()}
              </Text>
            </Animated.View>
          );
        });

      case "time":
        return section.split("\n").map((info, i) => {
          const fadeIn = getNewAnimation();
          return (
            <Animated.View
              key={i}
              style={[styles.timeItem, { opacity: fadeIn }]}
            >
              <Ionicons name="time" size={18} color="#008b8b" />
              <Text style={styles.timeText}>{info}</Text>
            </Animated.View>
          );
        });

      default:
        return <Text style={styles.regularText}>{section}</Text>;
    }
  };

  const formatRecipeText = (recipeText) => {
    if (!recipeText) return null;
    itemAnimations.length = 0;
    const sections = recipeText
      .split("\n\n")
      .map((section) => section.trim())
      .filter((section) => section.length > 0);

    return sections.map((section, index) => {
      const fadeIn = getNewAnimation();

      if (index === 0) {
        return (
          <Animated.View
            key={index}
            style={[styles.titleContainer, { opacity: fadeIn }]}
          >
            <Text style={styles.recipeTitle}>{section}</Text>
          </Animated.View>
        );
      }

      if (section.includes("•")) {
        return (
          <Animated.View
            key={index}
            style={[styles.section, { opacity: fadeIn }]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="restaurant" size={24} color="#008b8b" />
              <Text style={styles.sectionTitle}>Ingredients</Text>
            </View>
            {formatRecipeSection(section, "ingredients")}
          </Animated.View>
        );
      }

      if (section.match(/^\d\./m)) {
        return (
          <Animated.View
            key={index}
            style={[styles.section, { opacity: fadeIn }]}
          >
            <View style={styles.sectionHeader}>
              <Ionicons name="list" size={24} color="#008b8b" />
              <Text style={styles.sectionTitle}>Instructions</Text>
            </View>
            {formatRecipeSection(section, "instructions")}
          </Animated.View>
        );
      }

      if (
        section.toLowerCase().includes("time") ||
        section.toLowerCase().includes("servings")
      ) {
        return (
          <Animated.View
            key={index}
            style={[styles.timeSection, { opacity: fadeIn }]}
          >
            {formatRecipeSection(section, "time")}
          </Animated.View>
        );
      }

      return (
        <Animated.View
          key={index}
          style={[styles.section, { opacity: fadeIn }]}
        >
          {formatRecipeSection(section, "regular")}
        </Animated.View>
      );
    });
  };

  if (!recipes || recipes.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={80} color="#008b8b" />
          <Text style={styles.emptyText}>No recipes found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Modal transparent={true} visible={loading}>
        <BlurView intensity={80} style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#008b8b" />
            <Text style={styles.loadingText}>Finding new recipes...</Text>
          </View>
        </BlurView>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              Recipe {selectedRecipeIndex + 1}
            </Text>
            <Text style={styles.headerSubtitle}>of {recipes.length}</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleRecipeSave(recipes[selectedRecipeIndex])}
            >
              <Ionicons name="bookmark-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={regenerateRecipes}
              disabled={loading}
            >
              <Ionicons name="refresh" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <Animated.View
          style={[
            styles.recipeContainer,
            {
              transform: [{ translateX: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {formatRecipeText(recipes[selectedRecipeIndex])}
        </Animated.View>
      </ScrollView>

      <View style={styles.navigationBar}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => handleRecipeChange("prev")}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => handleRecipeChange("next")}
        >
          <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: "#008b8b",
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginTop: -50,
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
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,139,139,0.2)",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,139,139,0.2)",
  },
  contentContainer: {
    paddingBottom: 100,
  },
  content: {
    flex: 1,
  },
  recipeContainer: {
    padding: 16,
  },
  titleContainer: {
    marginBottom: 24,
    paddingBottom: 16,
  },
  recipeTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "center",
    lineHeight: 34,
  },
  section: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginLeft: 10,
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  ingredientIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,139,139,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  ingredientText: {
    fontSize: 16,
    color: "#2c3e50",
    flex: 1,
    lineHeight: 22,
  },
  instructionItem: {
    flexDirection: "row",
    marginBottom: 20,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#008b8b",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  instructionNumberText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  instructionText: {
    fontSize: 16,
    color: "#2c3e50",
    flex: 1,
    lineHeight: 24,
  },
  timeSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  timeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,139,139,0.1)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  timeText: {
    fontSize: 14,
    color: "#008b8b",
    marginLeft: 8,
    fontWeight: "500",
  },
  regularText: {
    fontSize: 16,
    color: "#2c3e50",
    lineHeight: 24,
  },
  navigationBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#008b8b",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    color: "#2c3e50",
    marginVertical: 20,
    fontWeight: "500",
  },
  backButton: {
    backgroundColor: "#008b8b",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    backgroundColor: "white",
    padding: 28,
    borderRadius: 20,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#008b8b",
    fontWeight: "500",
  },
});
