import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import {
  getCurrentUser,
  saveRecipe,
  removeRecipe,
  removeMealPlan,
  getSavedRecipes,
  checkPremiumStatus,
} from "../services/authService";

const { width } = Dimensions.get("window");

export default function MyRecipesScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("recipes");
  const [recipes, setRecipes] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animation value for tab indicator
  const tabIndicatorPosition = useState(new Animated.Value(0))[0];

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    // Animate tab indicator
    Animated.spring(tabIndicatorPosition, {
      toValue: activeTab === "recipes" ? 0 : width / 2,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [activeTab]);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      // Load both saved recipes and meal plans
      const userData = await authService.getUserData();

      if (userData) {
        setRecipes(userData.savedRecipes || []);
        setMealPlans(userData.mealPlans || []);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert(
        "Error",
        "Failed to load your saved content. Please try again."
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUserData();
  };

  const navigateToRecipeDetail = (recipe) => {
    navigation.navigate("RecipeDetail", { recipe });
  };

  const navigateToMealPlanDetail = (mealPlan) => {
    navigation.navigate("MealPlanDetail", { mealPlan });
  };

  const handleDelete = (item,type) => {
    if (type == "recipe") {
      removeRecipe(item)

    } else {
      removeMealPlan(item)
    }
  } 
  const renderRecipeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => navigateToRecipeDetail(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recipeHeader}>
        <View style={styles.recipeTitleContainer}>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.recipeMetaContainer}>
            <View style={styles.recipeMeta}>
              <Ionicons name="time-outline" size={16} color="#7f8c8d" />
              <Text style={styles.recipeMetaText}>
                {item.cookTime || "30 min"}
              </Text>
            </View>

            <View style={styles.recipeMeta}>
              <Ionicons name="restaurant-outline" size={16} color="#7f8c8d" />
              <Text style={styles.recipeMetaText}>
                {item.difficulty || "Easy"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.recipeIcon}>
          <Ionicons name="restaurant" size={24} color="#008b8b" />
        </View>
      </View>

      <View style={styles.recipeInfo}>
        <View style={styles.recipeTagsContainer}>
          {item.tags &&
            item.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.recipeTag}>
                <Text style={styles.recipeTagText}>{tag}</Text>
              </View>
            ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            "Remove Recipe",
            "Are you sure you want to remove this recipe from your saved list?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                onPress: () => handleDelete(item.id, "recipe"),
                style: "destructive",
              },
            ]
          );
        }}
      >
        <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderMealPlanItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mealPlanCard}
      onPress={() => navigateToMealPlanDetail(item)}
      activeOpacity={0.7}
    >
      <View style={styles.mealPlanHeader}>
        <View style={styles.mealPlanInfo}>
          <Text style={styles.mealPlanTitle}>
            {item.name || "Weekly Meal Plan"}
          </Text>
          <Text style={styles.mealPlanDate}>
            {item.savedAt ? new Date(item.savedAt).toLocaleDateString() : ""}
          </Text>
        </View>
        <View style={styles.mealPlanIcon}>
          <Ionicons name="calendar" size={24} color="#008b8b" />
        </View>
      </View>

      <View style={styles.mealPlanContent}>
        <View style={styles.mealPlanStats}>
          <View style={styles.mealPlanStat}>
            <Ionicons name="calendar-outline" size={16} color="#008b8b" />
            <Text style={styles.mealPlanStatText}>{item.days} days</Text>
          </View>

          <View style={styles.mealPlanStat}>
            <Ionicons name="restaurant-outline" size={16} color="#008b8b" />
            <Text style={styles.mealPlanStatText}>
              {item.mealsPerDay} meals/day
            </Text>
          </View>

          {item.dietType && (
            <View style={styles.mealPlanStat}>
              <Ionicons name="leaf-outline" size={16} color="#008b8b" />
              <Text style={styles.mealPlanStatText}>{item.dietType}</Text>
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            "Remove Meal Plan",
            "Are you sure you want to remove this meal plan?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                onPress: () => handleDelete(item.id, "mealPlan"),
                style: "destructive",
              },
            ]
          );
        }}
      >
        <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const EmptyRecipesComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bookmark-outline" size={64} color="#008b8b" />
      <Text style={styles.emptyTitle}>No Saved Recipes Yet</Text>
      <Text style={styles.emptyText}>
        Your saved recipes will appear here. Start exploring to find delicious
        dishes!
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate("FindRecipes")}
      >
        <Text style={styles.exploreButtonText}>Explore Recipes</Text>
      </TouchableOpacity>
    </View>
  );

  const EmptyMealPlansComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={64} color="#008b8b" />
      <Text style={styles.emptyTitle}>No Meal Plans Yet</Text>
      <Text style={styles.emptyText}>
        Create your first meal plan to organize your weekly meals and shopping
        list!
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.navigate("MealPlans")}
      >
        <Text style={styles.exploreButtonText}>Create Meal Plan</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Saved Content</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "recipes" && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("recipes")}
        >
          <Ionicons
            name="bookmark"
            size={18}
            color={activeTab === "recipes" ? "#008b8b" : "#95a5a6"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "recipes" && styles.activeTabButtonText,
            ]}
          >
            Recipes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === "mealPlans" && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab("mealPlans")}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={activeTab === "mealPlans" ? "#008b8b" : "#95a5a6"}
          />
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "mealPlans" && styles.activeTabButtonText,
            ]}
          >
            Meal Plans
          </Text>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [{ translateX: tabIndicatorPosition }],
            },
          ]}
        />
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#008b8b" />
        </View>
      ) : (
        <>
          {activeTab === "recipes" && (
            <FlatList
              data={recipes}
              renderItem={renderRecipeItem}
              keyExtractor={(item, index) =>
                item.id?.toString() || `recipe-${index}`
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={EmptyRecipesComponent}
              initialNumToRender={6}
            />
          )}

          {activeTab === "mealPlans" && (
            <FlatList
              data={mealPlans}
              renderItem={renderMealPlanItem}
              keyExtractor={(item, index) =>
                item.id?.toString() || `mealplan-${index}`
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={EmptyMealPlansComponent}
              initialNumToRender={6}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    marginTop: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    position: "relative",
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  activeTabButton: {
    borderBottomColor: "#008b8b",
  },
  tabButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#95a5a6",
  },
  activeTabButtonText: {
    color: "#008b8b",
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: width / 2,
    height: 2,
    backgroundColor: "#008b8b",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  // Recipe card styles
  recipeCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  recipeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recipeTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  recipeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e6f3f3",
    justifyContent: "center",
    alignItems: "center",
  },
  recipeInfo: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  recipeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  recipeMetaContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  recipeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  recipeMetaText: {
    fontSize: 14,
    color: "#7f8c8d",
    marginLeft: 4,
  },
  recipeTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  recipeTag: {
    backgroundColor: "#e6f3f3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 4,
  },
  recipeTagText: {
    fontSize: 12,
    color: "#008b8b",
  },
  // Meal plan card styles
  mealPlanCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  mealPlanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mealPlanInfo: {
    flex: 1,
    marginRight: 12,
  },
  mealPlanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e6f3f3",
    justifyContent: "center",
    alignItems: "center",
  },
  mealPlanTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 4,
  },
  mealPlanDate: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  mealPlanContent: {
    padding: 16,
  },
  mealPlanStats: {
    flexDirection: "row",
    marginBottom: 12,
  },
  mealPlanStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  mealPlanStatText: {
    fontSize: 14,
    color: "#2c3e50",
    marginLeft: 4,
  },
  mealsPreview: {
    marginTop: 8,
  },
  mealPreviewItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  mealDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#008b8b",
    marginRight: 8,
  },
  mealPreviewText: {
    fontSize: 14,
    color: "#2c3e50",
  },
  moreMealsText: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 4,
    fontStyle: "italic",
  },
  // Delete button
  deleteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "white",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  // Empty state
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  exploreButton: {
    backgroundColor: "#008b8b",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
