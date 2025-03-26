import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import { getMealPlanStats } from "../utils/mealPlanUtils";

export const SavedMealPlansScreen = ({ navigation }) => {
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMealPlans();

    // Set up a listener for when the screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      loadMealPlans();
    });

    return unsubscribe;
  }, [navigation]);

  const loadMealPlans = async () => {
    try {
      setLoading(true);
      const savedMealPlans = await authService.getMealPlans();

      // Sort by saved date (newest first)
      const sortedMealPlans = savedMealPlans.sort((a, b) => {
        return new Date(b.savedAt) - new Date(a.savedAt);
      });

      setMealPlans(sortedMealPlans);
    } catch (error) {
      console.error("Error loading meal plans:", error);
      Alert.alert("Error", "Could not load your saved meal plans.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMealPlans();
  };
  // we need to user to name the meal plan themself when they save...NO DUPLICATES!!!
  const deleteMealPlan = async (mealPlanId) => {
    Alert.alert(
      "Delete Meal Plan",
      "Are you sure you want to delete this meal plan?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await authService.removeMealPlan(mealPlanId);
              // Remove from local state
              setMealPlans(mealPlans.filter((plan) => plan.id !== mealPlanId));
            } catch (error) {
              console.error("Error deleting meal plan:", error);
              Alert.alert("Error", "Could not delete the meal plan.");
            }
          },
        },
      ]
    );
  };

  const renderMealPlanItem = ({ item }) => {
    const stats = getMealPlanStats(item);
    const savedDate = new Date(item.savedAt).toLocaleDateString();

    return (
      <TouchableOpacity
        style={styles.mealPlanCard}
        onPress={() => {
          navigation.navigate("MealPlanDetail", {
            mealPlan: item.mealPlan,
            days: item.days,
            mealsPerDay: item.mealsPerDay,
            healthy: item.healthy,
            allergies: item.allergies,
            dietType: item.dietType,
            caloriesPerDay: item.caloriesPerDay,
          });
        }}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.daysTitle}>{item.days}-Day Meal Plan</Text>
            <Text style={styles.savedDate}>Saved on {savedDate}</Text>
          </View>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteMealPlan(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="restaurant-outline" size={18} color="#008b8b" />
            <Text style={styles.statText}>{item.mealsPerDay} meals/day</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="flame-outline" size={18} color="#008b8b" />
            <Text style={styles.statText}>{item.caloriesPerDay} cal/day</Text>
          </View>
        </View>

        {(item.dietType || (item.allergies && item.allergies.length > 0)) && (
          <View style={styles.tagsContainer}>
            {item.dietType && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.dietType}</Text>
              </View>
            )}

            {item.allergies &&
              item.allergies.map((allergy, index) => (
                <View key={index} style={[styles.tag, styles.allergyTag]}>
                  <Text style={[styles.tagText, styles.allergyTagText]}>
                    {allergy}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#008b8b" />
        <Text style={styles.loadingText}>Loading your meal plans...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Meal Plans</Text>
        <View style={{ width: 24 }} />
      </View>

      {mealPlans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Saved Meal Plans</Text>
          <Text style={styles.emptyText}>
            Your saved meal plans will appear here.
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate("CreateMealPlan")}
          >
            <Text style={styles.createButtonText}>Create a Meal Plan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={mealPlans}
          renderItem={renderMealPlanItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginTop: 10,
  },

  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#2c3e50",
  },
  listContainer: {
    padding: 16,
  },
  mealPlanCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  daysTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 4,
  },
  savedDate: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  deleteButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    marginLeft: 4,
    fontSize: 14,
    color: "#2c3e50",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 8,
  },
  tag: {
    backgroundColor: "#e6f3f3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#008b8b20",
  },
  allergyTag: {
    backgroundColor: "#fff3e6",
    borderColor: "#ffa50020",
  },
  tagText: {
    fontSize: 12,
    color: "#008b8b",
    fontWeight: "500",
  },
  allergyTagText: {
    color: "#ff9800",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: "#008b8b",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  createButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
