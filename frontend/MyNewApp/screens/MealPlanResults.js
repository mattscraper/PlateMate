import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

export default function MealPlanResults() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    mealPlan,
    days,
    mealsPerDay,
    healthy,
    allergies,
    dietType,
    caloriesPerDay,
  } = route.params;

  const [selectedDay, setSelectedDay] = useState(1);
  const [dayPositions, setDayPositions] = useState({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const mainScrollRef = useRef(null);
  const daysScrollRef = useRef(null);

  // Calculate screen width for scrolling
  const screenWidth = Dimensions.get("window").width;

  const formatMealPlanForSharing = () => {
    const planDetails =
      `${days}-Day Meal Plan\n` +
      `${mealsPerDay} meals per day\n` +
      `${caloriesPerDay} calories per day\n` +
      `${healthy ? "🥗 Healthy options" : ""}\n` +
      `${dietType ? `🍽️ Diet type: ${dietType}` : ""}\n` +
      `${
        allergies.length ? `⚠️ Restrictions: ${allergies.join(", ")}` : ""
      }\n\n`;

    const mealPlanText = mealPlan.split("=====").join("\n\n");

    return planDetails + mealPlanText;
  };

  const validatePositions = (positions) => {
    console.log("Current positions:", positions);
    return Object.entries(positions).every(
      ([key, value]) => !isNaN(value) && value !== undefined && value !== null
    );
  };

  const handleShare = async () => {
    try {
      const shareText = formatMealPlanForSharing();
      await Share.share({
        message: shareText,
        title: "My Meal Plan",
      });
    } catch (error) {
      console.error("Error sharing meal plan:", error);
    }
  };

  const scrollToDay = (dayNumber) => {
    console.log("Attempting to scroll to day:", dayNumber);
    console.log("Current positions:", dayPositions);
    console.log("Header height:", headerHeight);

    setSelectedDay(dayNumber);

    // Scroll the day selector
    const dayWidth = 80;
    const scrollPosition =
      (dayNumber - 1) * dayWidth - (screenWidth - dayWidth) / 2;
    daysScrollRef.current?.scrollTo({
      x: Math.max(0, scrollPosition),
      animated: true,
    });

    // Scroll main content
    const yPosition = dayPositions[dayNumber];
    if (yPosition !== undefined && mainScrollRef.current) {
      const finalPosition = Math.max(0, yPosition - headerHeight);
      console.log("Scrolling to final position:", finalPosition);
      mainScrollRef.current.scrollTo({
        y: finalPosition,
        animated: true,
      });
    } else {
      console.log("Invalid position for day:", dayNumber);
    }
  };
  const DaySelector = () => (
    <View style={styles.daySelectorContainer}>
      <ScrollView
        ref={daysScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daySelector}
      >
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayTab,
              selectedDay === day && styles.dayTabSelected,
            ]}
            onPress={() => scrollToDay(day)}
          >
            <Text
              style={[
                styles.dayTabText,
                selectedDay === day && styles.dayTabTextSelected,
              ]}
            >
              Day {day}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderMealCard = (meal, index) => {
    if (!meal || typeof meal !== "string") {
      return null;
    }

    const lines = meal.split("\n");
    let currentSection = "";
    let title = "";
    let details = {
      timings: [],
      ingredients: [],
      instructions: [],
      nutrition: "",
    };

    // Find the meal type first (Breakfast, Lunch, Dinner, Snack)
    const mealType = lines[0].trim().split(" ")[0];

    // Process the remaining lines
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Skip the first line if it's just the meal type
      if (trimmedLine === mealType) return;

      // If we don't have a title yet and it's not a special line, it's probably the title
      if (
        !title &&
        !trimmedLine.startsWith("•") &&
        !trimmedLine.startsWith("Preparation") &&
        !trimmedLine.startsWith("Cooking") &&
        !trimmedLine.startsWith("Servings") &&
        !trimmedLine.match(/^\d+\./)
      ) {
        title = trimmedLine;
        return;
      }

      // Process other lines
      if (
        trimmedLine.startsWith("Preparation") ||
        trimmedLine.startsWith("Cooking") ||
        trimmedLine.startsWith("Servings")
      ) {
        details.timings.push(trimmedLine);
      } else if (trimmedLine.startsWith("•")) {
        details.ingredients.push(trimmedLine.substring(1).trim());
      } else if (trimmedLine.match(/^\d+\./)) {
        details.instructions.push(trimmedLine);
      } else if (
        trimmedLine.toLowerCase().includes("calorie") ||
        trimmedLine.toLowerCase().includes("nutritional")
      ) {
        details.nutrition = trimmedLine;
      }
    });
    return (
      <View key={index} style={styles.mealCard}>
        <Text style={styles.mealTypeLabel}>{mealType}</Text>
        <Text style={styles.mealTitle}>{title}</Text>

        {details.timings.length > 0 && (
          <View style={styles.timingContainer}>
            {details.timings.map((timing, i) => (
              <View key={i} style={styles.timingItem}>
                <Ionicons name="time-outline" size={16} color="#008b8b" />
                <Text style={styles.timingText}>{timing}</Text>
              </View>
            ))}
          </View>
        )}

        {details.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {details.ingredients.map((ingredient, i) => (
              <View key={i} style={styles.ingredientRow}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.ingredientText}>{ingredient}</Text>
              </View>
            ))}
          </View>
        )}

        {details.instructions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {details.instructions.map((instruction, i) => (
              <Text key={i} style={styles.instructionText}>
                {instruction}
              </Text>
            ))}
          </View>
        )}

        {details.nutrition && (
          <View style={styles.nutritionContainer}>
            <Ionicons name="nutrition-outline" size={16} color="#008b8b" />
            <Text style={styles.nutritionText}>{details.nutrition}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderDayPlan = (day, index) => {
    if (!day || typeof day !== "string") return null;

    const dayNumber = index + 1; // This ensures correct day numbering
    const meals = day.split(/(?=Breakfast|Lunch|Dinner|Snack)/).filter(Boolean);

    let dayTitle = `Day ${dayNumber}`;
    const firstLine = meals[0].trim();
    if (firstLine.startsWith("Day")) {
      dayTitle = firstLine.split("\n")[0].trim();
    }

    return (
      <View
        key={index}
        onLayout={(event) => {
          const layout = event.nativeEvent.layout;
          const yPosition = layout.y;
          console.log(`Setting position for Day ${dayNumber}:`, yPosition);
          setDayPositions((prev) => {
            const updated = { ...prev, [dayNumber]: yPosition };
            console.log("Updated positions:", updated);
            return updated;
          });
        }}
        style={styles.dayContainer}
      >
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{dayTitle}</Text>
          <View style={styles.dayStats}>
            <View style={styles.statItem}>
              <Ionicons name="restaurant-outline" size={20} color="#008b8b" />
              <Text style={styles.statText}>{mealsPerDay} meals</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={20} color="#008b8b" />
              <Text style={styles.statText}>{caloriesPerDay} cal</Text>
            </View>
          </View>
        </View>

        {meals
          .slice(1)
          .map((meal, mealIndex) => renderMealCard(meal, mealIndex))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Meal Plan</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#2c3e50" />
        </TouchableOpacity>
      </View>

      <View
        onLayout={(event) => {
          const layout = event.nativeEvent.layout;
          const height = layout.height;
          console.log("Setting header height:", height);
          setHeaderHeight(height);
        }}
      >
        <DaySelector />
        <View style={styles.planSummary}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-outline" size={24} color="#008b8b" />
              <Text style={styles.summaryValue}>{days}</Text>
              <Text style={styles.summaryLabel}>Days</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="restaurant-outline" size={24} color="#008b8b" />
              <Text style={styles.summaryValue}>{mealsPerDay}</Text>
              <Text style={styles.summaryLabel}>Meals/Day</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="flame-outline" size={24} color="#008b8b" />
              <Text style={styles.summaryValue}>{caloriesPerDay}</Text>
              <Text style={styles.summaryLabel}>Cal/Day</Text>
            </View>
          </View>

          {(dietType || allergies.length > 0) && (
            <View style={styles.tagsContainer}>
              {dietType && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{dietType}</Text>
                </View>
              )}
              {allergies.map((allergy, index) => (
                <View key={index} style={[styles.tag, styles.allergyTag]}>
                  <Text style={[styles.tagText, styles.allergyTagText]}>
                    {allergy}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <ScrollView
        ref={mainScrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          console.log("Current day positions:", dayPositions);
        }}
        onContentSizeChange={() => {
          // Only reset positions if they're invalid
          if (!validatePositions(dayPositions)) {
            console.log("Resetting positions due to invalid state");
            setDayPositions({});
          }
        }}
      >
        {mealPlan.split("=====").map((day, index) => renderDayPlan(day, index))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    marginTop: 1, // try to handle the blank space on top screen
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12, // change this later when we are testingS
    marginTop: 1,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20, // maybe reduce some padding here while testing?
    fontWeight: "700",
    color: "#2c3e50",
  },
  daySelectorContainer: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  daySelector: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dayTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#f0f0f0",
    minWidth: 80,
    alignItems: "center",
  },
  dayTabSelected: {
    backgroundColor: "#e6f3f3",
    borderColor: "#008b8b",
  },
  dayTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7f8c8d",
  },
  dayTabTextSelected: {
    color: "#008b8b",
  },
  planSummary: {
    backgroundColor: "white",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#f0f0f0",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: "#e6f3f3",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#008b8b20",
  },
  allergyTag: {
    backgroundColor: "#fff3e6",
    borderColor: "#ffa50020",
  },
  tagText: {
    fontSize: 14,
    color: "#008b8b",
    fontWeight: "600",
  },
  allergyTagText: {
    color: "#ff9800",
  },
  scrollView: {
    flex: 1,
  },
  dayContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dayTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2c3e50",
  },
  dayStats: {
    flexDirection: "row",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  mealCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  mealTypeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#008b8b",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 12,
  },
  timingContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  timingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timingText: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },
  ingredientRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletPoint: {
    fontSize: 16,
    color: "#008b8b",
    marginRight: 8,
  },
  ingredientText: {
    fontSize: 15,
    color: "#2c3e50",
    flex: 1,
  },
  instructionText: {
    fontSize: 15,
    color: "#2c3e50",
    marginBottom: 8,
    lineHeight: 22,
  },
  nutritionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  nutritionText: {
    fontSize: 14,
    color: "#7f8c8d",
    flex: 1,
  },
});
