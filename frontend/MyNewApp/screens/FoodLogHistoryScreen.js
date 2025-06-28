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
  Animated,
  LayoutAnimation,
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
  const [expandedDays, setExpandedDays] = useState(new Set(['today'])); // Today expanded by default

  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  // Enhanced color scheme
  const colors = {
    primary: "#2563EB",
    secondary: "#10B981",
    accent: "#F59E0B",
    success: "#059669",
    error: "#DC2626",
    purple: "#8B5CF6",
    pink: "#EC4899",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    text: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    border: "#E2E8F0",
    muted: "#F1F5F9",
  };

  const mealTypes = [
    { id: "breakfast", label: "Breakfast", icon: "sunny", color: colors.accent, bgColor: "#FEF3C7" },
    { id: "lunch", label: "Lunch", icon: "partly-sunny", color: colors.secondary, bgColor: "#D1FAE5" },
    { id: "dinner", label: "Dinner", icon: "moon", color: colors.purple, bgColor: "#EDE9FE" },
    { id: "snack", label: "Snack", icon: "nutrition", color: colors.pink, bgColor: "#FCE7F3" },
    { id: "other", label: "Other", icon: "restaurant", color: colors.primary, bgColor: "#DBEAFE" },
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
      
      const response = await foodLogService.getFoodLogs(userId, { limitCount: 200 });
      
      if (response.success) {
        setFoodLogs(response.food_logs);
        groupLogsByDate(response.food_logs);
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

    const sections = Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => {
        const dayId = getDayId(date);
        return {
          id: dayId,
          title: formatDateHeader(date),
          date: date,
          data: grouped[date].sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at)),
          totalCalories: grouped[date].reduce((sum, log) => sum + (log.calories || 0), 0),
          totalProtein: grouped[date].reduce((sum, log) => sum + (log.protein || 0), 0),
          totalCarbs: grouped[date].reduce((sum, log) => sum + (log.carbs || 0), 0),
          totalFat: grouped[date].reduce((sum, log) => sum + (log.fat || 0), 0),
          entriesCount: grouped[date].length,
        };
      });

    setGroupedLogs(sections);
  };

  const getDayId = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateString === today.toISOString().split('T')[0]) {
      return "today";
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return "yesterday";
    } else {
      return dateString;
    }
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
    return mealTypes.find(type => type.id === mealType) || mealTypes[4];
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

  const toggleDayExpansion = (dayId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayId)) {
        newSet.delete(dayId);
      } else {
        newSet.add(dayId);
      }
      return newSet;
    });
  };

  const onRefresh = async () => {
    if (user) {
      setIsRefreshing(true);
      await loadFoodLogs(user.uid);
      setIsRefreshing(false);
    }
  };

  const DayCard = ({ section }) => {
    const isExpanded = expandedDays.has(section.id);
    
    return (
      <View style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.dayCardHeader}
          onPress={() => toggleDayExpansion(section.id)}
          activeOpacity={0.7}
        >
          <View style={styles.dayCardHeaderLeft}>
            <Text style={[styles.dayTitle, { color: colors.text }]}>{section.title}</Text>
            <Text style={[styles.dayDate, { color: colors.textMuted }]}>{section.date}</Text>
          </View>
          
          <View style={styles.dayCardHeaderCenter}>
            <View style={styles.dayStatsRow}>
              <View style={styles.dayStatItem}>
                <Text style={[styles.dayStatValue, { color: colors.secondary }]}>{section.totalCalories}</Text>
                <Text style={[styles.dayStatLabel, { color: colors.textMuted }]}>cal</Text>
              </View>
              <View style={styles.dayStatItem}>
                <Text style={[styles.dayStatValue, { color: colors.primary }]}>{section.totalProtein}g</Text>
                <Text style={[styles.dayStatLabel, { color: colors.textMuted }]}>protein</Text>
              </View>
              <View style={styles.dayStatItem}>
                <Text style={[styles.dayStatValue, { color: colors.textSecondary }]}>{section.entriesCount}</Text>
                <Text style={[styles.dayStatLabel, { color: colors.textMuted }]}>entries</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.dayCardHeaderRight}>
            <Animated.View
              style={{
                transform: [{
                  rotate: isExpanded ? '180deg' : '0deg'
                }]
              }}
            >
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </Animated.View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.dayCardContent}>
            {section.data.map((item, index) => (
              <FoodLogItem key={item.id} item={item} isLast={index === section.data.length - 1} />
            ))}
          </View>
        )}
      </View>
    );
  };

  const FoodLogItem = ({ item, isLast }) => {
    const mealInfo = getMealTypeInfo(item.meal_type);
    
    return (
      <View style={[
        styles.logItem,
        { backgroundColor: colors.muted, borderColor: colors.border },
        !isLast && styles.logItemBorder
      ]}>
        <View style={styles.logItemHeader}>
          <View style={styles.mealTypeContainer}>
            <View style={[styles.mealTypeIcon, { backgroundColor: mealInfo.bgColor }]}>
              <Ionicons name={mealInfo.icon} size={14} color={mealInfo.color} />
            </View>
            <Text style={[styles.mealTypeText, { color: mealInfo.color }]}>
              {mealInfo.label}
            </Text>
          </View>
          <View style={styles.logItemActions}>
            <Text style={[styles.logTime, { color: colors.textMuted }]}>
              {new Date(item.logged_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
            <TouchableOpacity
              onPress={() => handleDeleteEntry(item.id, item.food_name)}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={14} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={[styles.foodName, { color: colors.text }]}>{item.food_name}</Text>
        
        <View style={styles.nutritionInfo}>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.secondary + '20' }]}>
              <Ionicons name="flame" size={10} color={colors.secondary} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{item.calories}</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="fitness" size={10} color={colors.primary} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{item.protein}g</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.purple + '20' }]}>
              <Ionicons name="leaf" size={10} color={colors.purple} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{item.carbs}g</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="water" size={10} color={colors.accent} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{item.fat}g</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>fat</Text>
          </View>
        </View>
      </View>
    );
  };

  const SummaryCard = () => {
    if (!summary) return null;
    
    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="analytics" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Last 7 Days Summary</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.secondary }]}>{summary.weeklyEntries}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Entries</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{summary.daysLogged}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Days Logged</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.purple }]}>{summary.averageDailyCalories}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Avg Daily Cal</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>{summary.weeklyCalories}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Calories</Text>
          </View>
        </View>
      </View>
    );
  };

  const Toast = ({ visible, message, type }) => {
    if (!visible) return null;

    const getToastConfig = () => {
      switch (type) {
        case "success":
          return { backgroundColor: colors.success, iconName: "checkmark-circle" };
        case "error":
          return { backgroundColor: colors.error, iconName: "alert-circle" };
        case "info":
          return { backgroundColor: colors.primary, iconName: "information-circle" };
        default:
          return { backgroundColor: colors.textSecondary, iconName: "chatbubble-ellipses" };
      }
    };

    const { backgroundColor, iconName } = getToastConfig();

    return (
      <View style={[styles.toast, { backgroundColor }]}>
        <Ionicons name={iconName} size={20} color={colors.surface} />
        <Text style={[styles.toastText, { color: colors.surface }]}>{message}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Food History</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <View style={[styles.loadingSpinner, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your food history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Food History</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("FoodLog")}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={20} color={colors.surface} />
        </TouchableOpacity>
      </View>

      {groupedLogs.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        >
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Food Logs Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Start tracking your meals to see your food history here
          </Text>
          <TouchableOpacity
            style={[styles.startLoggingButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("FoodLog")}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.surface} />
            <Text style={[styles.startLoggingButtonText, { color: colors.surface }]}>Start Logging Food</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          <SummaryCard />
          {groupedLogs.map((section) => (
            <DayCard key={section.id} section={section} />
          ))}
        </ScrollView>
      )}

      <Toast visible={showToast} message={toastMessage} type={toastType} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
  },

  // List
  listContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  
  // Summary Card
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
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
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
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
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },

  // Day Cards
  dayCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  dayCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  dayCardHeaderLeft: {
    flex: 1,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  dayDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  dayCardHeaderCenter: {
    flex: 2,
    alignItems: "center",
  },
  dayStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  dayStatItem: {
    alignItems: "center",
  },
  dayStatValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  dayStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  dayCardHeaderRight: {
    width: 40,
    alignItems: "flex-end",
  },

  // Day Card Content
  dayCardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Log Items
  logItem: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  logItemBorder: {
    marginBottom: 8,
  },
  logItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mealTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  mealTypeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  mealTypeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  logItemActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  logTime: {
    fontSize: 11,
    fontWeight: "500",
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  foodName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
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
  nutritionIconBg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  nutritionValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  nutritionLabel: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  startLoggingButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  startLoggingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },

  // Toast
  toast: {
    position: "absolute",
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 9999,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
    flex: 1,
  },
});
