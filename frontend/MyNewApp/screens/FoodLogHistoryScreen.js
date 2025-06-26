import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  SectionList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import { foodLogService } from "../services/foodLogService";

export default function FoodLogHistoryScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [foodLogs, setFoodLogs] = useState([]);
  const [groupedLogs, setGroupedLogs] = useState([]);
  const [summary, setSummary] = useState(null);

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const mealTypes = [
    { id: "breakfast", label: "Breakfast", icon: "sunny", color: "#FFB74D" },
    { id: "lunch", label: "Lunch", icon: "partly-sunny", color: "#4FC3F7" },
    { id: "dinner", label: "Dinner", icon: "moon", color: "#9575CD" },
    { id: "snack", label: "Snack", icon: "nutrition", color: "#81C784" },
    { id: "other", label: "Other", icon: "restaurant", color: "#A1887F" },
  ];

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      await loadFoodLogs(currentUser.uid);
    } else {
      navigation.navigate("Landing");
    }
  };

  const loadFoodLogs = async (userId) => {
    try {
      setIsLoading(true);
      
      // Get food logs for the last 30 days
      const response = await foodLogService.getFoodLogs(userId, { limitCount: 200 });
      
      if (response.success) {
        setFoodLogs(response.food_logs);
        groupLogsByDate(response.food_logs);
        
        // Calculate summary for the last 7 days
        await calculateSummary(userId);
      } else {
        showCustomToast("Failed to load food history", "error");
      }
    } catch (error) {
      console.error("Error loading food logs:", error);
      showCustomToast("Network error. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const groupLogsByDate = (logs) => {
    const grouped = {};
    
    logs.forEach(log => {
      if (!grouped[log.date]) {
        grouped[log.date] = [];
      }
      grouped[log.date].push(log);
    });

    // Convert to array format for SectionList
    const sections = Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a)) // Most recent first
      .map(date => ({
        title: formatDateHeader(date),
        date: date,
        data: grouped[date].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at)),
        totalCalories: grouped[date].reduce((sum, log) => sum + (log.calories || 0), 0),
        totalProtein: grouped[date].reduce((sum, log) => sum + (log.protein || 0), 0),
      }));

    setGroupedLogs(sections);
  };

  const calculateSummary = async (userId) => {
    try {
      const weeklyData = await foodLogService.getWeeklyProgress(userId);
      if (weeklyData.success) {
        const totalCalories = weeklyData.weekly_data.reduce((sum, day) => sum + day.calories, 0);
        const totalEntries = weeklyData.weekly_data.reduce((sum, day) => sum + day.entries, 0);
        const daysWithEntries = weeklyData.weekly_data.filter(day => day.entries > 0).length;
        
        setSummary({
          weeklyCalories: totalCalories,
          weeklyEntries: totalEntries,
          daysLogged: daysWithEntries,
          averageDailyCalories: daysWithEntries > 0 ? Math.round(totalCalories / daysWithEntries) : 0,
        });
      }
    } catch (error) {
      console.error("Error calculating summary:", error);
    }
  };

  const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateString === today.toISOString().split('T')[0]) {
      return "Today";
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getMealTypeInfo = (mealType) => {
    return mealTypes.find(type => type.id === mealType) || mealTypes[4]; // Default to "other"
  };

  const showCustomToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleDeleteEntry = (entryId, entryName) => {
    Alert.alert(
      "Delete Entry",
      `Are you sure you want to delete "${entryName}"?`,
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
              await foodLogService.deleteFoodLogEntry(entryId);
              showCustomToast("Entry deleted successfully", "success");
              
              // Reload data
              if (user) {
                await loadFoodLogs(user.uid);
              }
            } catch (error) {
              console.error("Error deleting entry:", error);
              showCustomToast("Failed to delete entry", "error");
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    if (user) {
      setIsRefreshing(true);
      await loadFoodLogs(user.uid);
      setIsRefreshing(false);
    }
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
        <Text style={styles.sectionHeaderDate}>{section.date}</Text>
      </View>
      <View style={styles.sectionHeaderRight}>
        <Text style={styles.sectionHeaderCalories}>{section.totalCalories} cal</Text>
        <Text style={styles.sectionHeaderProtein}>{section.totalProtein}g protein</Text>
      </View>
    </View>
  );

  const renderFoodLogItem = ({ item }) => {
    const mealInfo = getMealTypeInfo(item.meal_type);
    
    return (
      <View style={styles.logItem}>
        <View style={styles.logItemHeader}>
          <View style={styles.mealTypeContainer}>
            <View style={[styles.mealTypeIcon, { backgroundColor: mealInfo.color + '20' }]}>
              <Ionicons name={mealInfo.icon} size={16} color={mealInfo.color} />
            </View>
            <Text style={[styles.mealTypeText, { color: mealInfo.color }]}>
              {mealInfo.label}
            </Text>
          </View>
          <View style={styles.logItemActions}>
            <Text style={styles.logTime}>
              {new Date(item.logged_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
            <TouchableOpacity
              onPress={() => handleDeleteEntry(item.id, item.food_name)}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.foodName}>{item.food_name}</Text>
        <Text style={styles.foodDescription}>{item.food_description}</Text>
        
        <View style={styles.nutritionInfo}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{item.calories}</Text>
            <Text style={styles.nutritionLabel}>cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{item.protein}g</Text>
            <Text style={styles.nutritionLabel}>protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{item.carbs}g</Text>
            <Text style={styles.nutritionLabel}>carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{item.fat}g</Text>
            <Text style={styles.nutritionLabel}>fat</Text>
          </View>
        </View>
        
        {item.confidence && (
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceText}>
              Confidence: {Math.round(item.confidence * 100)}%
            </Text>
          </View>
        )}
      </View>
    );
  };

  const SummaryCard = () => {
    if (!summary) return null;
    
    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Last 7 Days Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.weeklyEntries}</Text>
            <Text style={styles.summaryLabel}>Total Entries</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.daysLogged}</Text>
            <Text style={styles.summaryLabel}>Days Logged</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.averageDailyCalories}</Text>
            <Text style={styles.summaryLabel}>Avg Daily Cal</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.weeklyCalories}</Text>
            <Text style={styles.summaryLabel}>Total Calories</Text>
          </View>
        </View>
      </View>
    );
  };

  const Toast = ({ visible, message, type }) => {
    if (!visible) return null;

    let backgroundColor, iconName;
    switch (type) {
      case "success":
        backgroundColor = "#10B981";
        iconName = "checkmark-circle";
        break;
      case "error":
        backgroundColor = "#EF4444";
        iconName = "alert-circle";
        break;
      case "info":
        backgroundColor = "#3B82F6";
        iconName = "information-circle";
        break;
      default:
        backgroundColor = "#374151";
        iconName = "chatbubble-ellipses";
    }

    return (
      <View style={[styles.toast, { backgroundColor }]}>
        <Ionicons name={iconName} size={24} color="white" />
        <Text style={styles.toastText}>{message}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Food History</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#008b8b" />
          <Text style={styles.loadingText}>Loading your food history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food History</Text>
        <TouchableOpacity onPress={() => navigation.navigate("FoodLog")}>
          <Ionicons name="add" size={24} color="#008b8b" />
        </TouchableOpacity>
      </View>

      {groupedLogs.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons name="restaurant-outline" size={64} color="#bdc3c7" />
          <Text style={styles.emptyTitle}>No Food Logs Yet</Text>
          <Text style={styles.emptyText}>
            Start tracking your meals to see your food history here
          </Text>
          <TouchableOpacity
            style={styles.startLoggingButton}
            onPress={() => navigation.navigate("FoodLog")}
          >
            <Text style={styles.startLoggingButtonText}>Start Logging Food</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <SectionList
          sections={groupedLogs}
          keyExtractor={(item) => item.id}
          renderItem={renderFoodLogItem}
          renderSectionHeader={renderSectionHeader}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={<SummaryCard />}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}

      <Toast visible={showToast} message={toastMessage} type={toastType} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2c3e50",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#7f8c8d",
  },
  listContainer: {
    paddingVertical: 20,
  },
  
  // Summary Card
  summaryCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#008b8b",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#7f8c8d",
    textAlign: "center",
  },

  // Section Headers
  sectionHeader: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  sectionHeaderLeft: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
  },
  sectionHeaderDate: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 2,
  },
  sectionHeaderRight: {
    alignItems: "flex-end",
  },
  sectionHeaderCalories: {
    fontSize: 14,
    fontWeight: "600",
    color: "#008b8b",
  },
  sectionHeaderProtein: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 2,
  },

  // Log Items
  logItem: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  logItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mealTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  mealTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  mealTypeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  logItemActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  logTime: {
    fontSize: 12,
    color: "#7f8c8d",
    marginRight: 12,
  },
  deleteButton: {
    padding: 4,
  },
  foodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  foodDescription: {
    fontSize: 14,
    color: "#7f8c8d",
    marginBottom: 12,
    lineHeight: 18,
  },
  nutritionInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1,
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
  },
  nutritionLabel: {
    fontSize: 11,
    color: "#7f8c8d",
    marginTop: 2,
  },
  confidenceContainer: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  confidenceText: {
    fontSize: 11,
    color: "#95a5a6",
    fontStyle: "italic",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#2c3e50",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  startLoggingButton: {
    backgroundColor: "#008b8b",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startLoggingButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // Toast
  toast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
  },
  toastText: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 12,
    color: "white",
    flex: 1,
  },
});
