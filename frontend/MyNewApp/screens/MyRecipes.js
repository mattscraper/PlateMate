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
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get("window");

export default function MyRecipesScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("recipes");
  const [recipes, setRecipes] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animation value for tab indicator
  const tabIndicatorPosition = useState(new Animated.Value(0))[0];

  // Load data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

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
      console.log('🔄 Loading user data in MyRecipes...');
      setIsLoading(true);
      
      // Check if user is logged in
      const user = authService.getCurrentUser();
      if (!user) {
        console.log('❌ No user logged in');
        Alert.alert(
          "Authentication Required",
          "Please log in to view your saved content.",
          [
            {
              text: "OK",
              onPress: () => navigation.goBack()
            }
          ]
        );
        return;
      }

      console.log('👤 Loading data for user:', user.uid);

      // Load saved recipes and meal plans separately
      const [savedRecipes, savedMealPlans] = await Promise.all([
        authService.getSavedRecipes(),
        authService.getMealPlans()
      ]);

      console.log('📖 Loaded recipes:', savedRecipes.length);
      console.log('📅 Loaded meal plans:', savedMealPlans.length);

      setRecipes(savedRecipes || []);
      setMealPlans(savedMealPlans || []);

    } catch (error) {
      console.error("❌ Error loading user data:", error);
      
      let errorMessage = "Failed to load your saved content. Please try again.";
      
      // Handle specific error cases
      if (error.message.includes("User not logged in")) {
        errorMessage = "Please log in to view your saved content.";
        setTimeout(() => navigation.goBack(), 2000);
      } else if (error.message.includes("network") || error.message.includes("offline")) {
        errorMessage = "Network error. Please check your connection and try again.";
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    console.log('🔄 Refreshing user data...');
    setRefreshing(true);
    loadUserData();
  };

  const navigateToRecipeDetail = (recipe) => {
    console.log('🍳 Navigating to recipe detail:', recipe.title);
    navigation.navigate("RecipeDetail", { recipe });
  };

  const navigateToMealPlanDetail = (mealPlan) => {
    console.log('📅 Navigating to meal plan detail:', mealPlan.name);
    navigation.navigate("MealPlanDetail", { mealPlan });
  };

  const handleDelete = async (item, type) => {
    try {
      console.log(`🗑️ Deleting ${type}:`, item.id);
      
      if (type === "recipe") {
        await authService.removeRecipe(item.id);
        // Update local state to remove the deleted recipe
        setRecipes(prevRecipes => {
          const updated = prevRecipes.filter(recipe => recipe.id !== item.id);
          console.log('📖 Recipes after deletion:', updated.length);
          return updated;
        });
        Alert.alert("Success", "Recipe removed successfully!");
      } else {
        await authService.removeMealPlan(item.id);
        // Update local state to remove the deleted meal plan
        setMealPlans(prevMealPlans => {
          const updated = prevMealPlans.filter(plan => plan.id !== item.id);
          console.log('📅 Meal plans after deletion:', updated.length);
          return updated;
        });
        Alert.alert("Success", "Meal plan removed successfully!");
      }
    } catch (error) {
      console.error(`❌ Error deleting ${type}:`, error);
      
      let errorMessage = `Failed to remove ${type}. Please try again.`;
      if (error.message.includes("User not logged in")) {
        errorMessage = "Please log in to manage your saved content.";
      }
      
      Alert.alert("Error", errorMessage);
    }
  };

  const renderRecipeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => navigateToRecipeDetail(item)}
      activeOpacity={0.7}
    >
      <View style={styles.recipeHeader}>
        <View style={styles.recipeTitleContainer}>
          <Text style={styles.recipeTitle} numberOfLines={1}>
            {item.title || "Untitled Recipe"}
          </Text>
          <View style={styles.recipeMetaContainer}>
            <View style={styles.recipeMeta}>
              <Ionicons name="time-outline" size={16} color="#7f8c8d" />
              <Text style={styles.recipeMetaText}>
                {item.cookTime || item.readyInMinutes || "30 min"}
              </Text>
            </View>

            <View style={styles.recipeMeta}>
              <Ionicons name="restaurant-outline" size={16} color="#7f8c8d" />
              <Text style={styles.recipeMetaText}>
                {item.difficulty || item.spoonacularScore ? "Easy" : "Medium"}
              </Text>
            </View>

            {item.servings && (
              <View style={styles.recipeMeta}>
                <Ionicons name="people-outline" size={16} color="#7f8c8d" />
                <Text style={styles.recipeMetaText}>
                  {item.servings} servings
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.recipeIcon}>
          <Ionicons name="restaurant" size={24} color="#008b8b" />
        </View>
      </View>

      <View style={styles.recipeInfo}>
        <View style={styles.recipeTagsContainer}>
          {/* Handle different tag formats */}
          {item.tags &&
            item.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.recipeTag}>
                <Text style={styles.recipeTagText}>{tag}</Text>
              </View>
            ))}
          {item.cuisines &&
            item.cuisines.slice(0, 2).map((cuisine, index) => (
              <View key={`cuisine-${index}`} style={styles.recipeTag}>
                <Text style={styles.recipeTagText}>{cuisine}</Text>
              </View>
            ))}
          {item.dishTypes &&
            item.dishTypes.slice(0, 1).map((dishType, index) => (
              <View key={`dish-${index}`} style={styles.recipeTag}>
                <Text style={styles.recipeTagText}>{dishType}</Text>
              </View>
            ))}
        </View>
        
        {/* Show saved date */}
        {item.savedAt && (
          <Text style={styles.savedDateText}>
            Saved on {new Date(item.savedAt).toLocaleDateString()}
          </Text>
        )}
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
                onPress: () => handleDelete(item, "recipe"),
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
            {item.name || item.title || "Weekly Meal Plan"}
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
            <Text style={styles.mealPlanStatText}>
              {item.days || item.duration || "7"} days
            </Text>
          </View>

          <View style={styles.mealPlanStat}>
            <Ionicons name="restaurant-outline" size={16} color="#008b8b" />
            <Text style={styles.mealPlanStatText}>
              {item.mealsPerDay || "3"} meals/day
            </Text>
          </View>

          {(item.dietType || item.diet) && (
            <View style={styles.mealPlanStat}>
              <Ionicons name="leaf-outline" size={16} color="#008b8b" />
              <Text style={styles.mealPlanStatText}>
                {item.dietType || item.diet}
              </Text>
            </View>
          )}
        </View>

        {/* Show meal preview if available */}
        {item.meals && item.meals.length > 0 && (
          <View style={styles.mealsPreview}>
            {item.meals.slice(0, 3).map((meal, index) => (
              <View key={index} style={styles.mealPreviewItem}>
                <View style={styles.mealDot} />
                <Text style={styles.mealPreviewText} numberOfLines={1}>
                  {meal.title || meal.name || `Meal ${index + 1}`}
                </Text>
              </View>
            ))}
            {item.meals.length > 3 && (
              <Text style={styles.moreMealsText}>
                +{item.meals.length - 3} more meals
              </Text>
            )}
          </View>
        )}
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
                onPress: () => handleDelete(item, "mealPlan"),
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

  // Show authentication required if no user
  const user = authService.getCurrentUser();
  if (!user) {
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
        
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={64} color="#008b8b" />
          <Text style={styles.emptyTitle}>Login Required</Text>
          <Text style={styles.emptyText}>
            Please log in to view your saved recipes and meal plans.
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate("LandingPage")}
          >
            <Text style={styles.exploreButtonText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#008b8b" />
          ) : (
            <Ionicons name="refresh" size={20} color="#008b8b" />
          )}
        </TouchableOpacity>
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
            Recipes ({recipes.length})
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
            Meal Plans ({mealPlans.length})
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
          <Text style={styles.loadingText}>Loading your saved content...</Text>
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
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
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
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
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
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f8f9fa",
  },
  backButton: {
    padding: 4,
  },
  refreshButton: {
    padding: 4,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
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
    fontSize: 14,
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
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#7f8c8d",
    fontWeight: "500",
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
    flexWrap: "wrap",
  },
  recipeMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
  },
  recipeMetaText: {
    fontSize: 14,
    color: "#7f8c8d",
    marginLeft: 4,
  },
  recipeTagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
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
  savedDateText: {
    fontSize: 12,
    color: "#95a5a6",
    fontStyle: "italic",
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
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  mealPlanStats: {
    flexDirection: "row",
    marginBottom: 12,
    flexWrap: "wrap",
  },
  mealPlanStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 4,
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
    flex: 1,
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
