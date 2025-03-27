import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import SaveMealPlanButton from "../components/SaveMealPlanButton";
//import SaveFeedback from "../components/saveFeedback";

export default function MealPlanResults() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    mealPlan,
    days,
    mealsPerDay,
    healthy,
    allergies = [],
    dietType,
    caloriesPerDay,
  } = route.params;

  // Parse meal plan data
  const [parsedDays, setParsedDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);

  // Refs for scrolling
  const mainScrollRef = useRef(null);
  const dayTabsRef = useRef(null);

  // Store positions of each day section
  const [dayPositions, setDayPositions] = useState({});

  // Screen dimensions
  const screenWidth = Dimensions.get("window").width;
  const DAY_TAB_WIDTH = 88; // Width of day tab

  // Parse the meal plan text when component mounts
  useEffect(() => {
    const days = parseMealPlan(mealPlan);
    setParsedDays(days);
  }, [mealPlan]);

  // Parse the meal plan text into structured data
  const parseMealPlan = (mealPlanText) => {
    // Check if mealPlanText is undefined or not a string
    if (!mealPlanText || typeof mealPlanText !== "string") {
      console.warn("Invalid meal plan text:", mealPlanText);
      return []; // Return an empty array or some default structure
    }

    // Split by day separator
    const dayTexts = mealPlanText.split("=====").filter((text) => text.trim());
    const days = [];

    dayTexts.forEach((dayText) => {
      const dayLines = dayText.trim().split("\n");
      let dayTitle = "";
      let currentMeal = null;
      let meals = [];

      // Extract day title (should be in first line)
      if (dayLines[0] && /Day\s+\d+/i.test(dayLines[0])) {
        dayTitle = dayLines[0].trim();
      } else {
        // If no day title found, use default
        dayTitle = `Day ${days.length + 1}`;
      }

      // Process remaining lines
      let currentSection = null;
      let mealContent = [];

      for (let i = 1; i < dayLines.length; i++) {
        const line = dayLines[i].trim();

        if (!line) continue;

        // Check for meal type markers
        if (/^(Breakfast|Lunch|Dinner|Snack)/i.test(line)) {
          // If we already have a meal, save it before starting a new one
          if (currentMeal) {
            meals.push({
              type: currentMeal,
              content: mealContent.join("\n"),
            });
          }

          currentMeal = line;
          mealContent = [currentMeal];
        } else if (currentMeal) {
          // Add this line to the current meal content
          mealContent.push(line);
        }
      }

      // Don't forget to add the last meal
      if (currentMeal && mealContent.length) {
        meals.push({
          type: currentMeal,
          content: mealContent.join("\n"),
        });
      }

      days.push({
        title: dayTitle,
        meals: meals,
      });
    });

    return days;
  };

  // Parse an individual meal into structured data
  const parseMeal = (mealContent) => {
    const lines = mealContent.split("\n").filter((line) => line.trim());

    // Extract meal type and title
    let mealType = "";
    let title = "";
    let ingredients = [];
    let instructions = [];
    let nutrition = "";
    let timings = [];

    // First line should be the meal type (Breakfast, Lunch, etc.)
    if (lines.length > 0) {
      mealType = lines[0].trim();
    }

    // Look for the title (first line that's not a meal type, ingredient, instruction)
    let titleIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        !line.startsWith("•") &&
        !line.match(/^\d+\./) &&
        !line.startsWith("Preparation") &&
        !line.startsWith("Cooking") &&
        !line.startsWith("Servings")
      ) {
        title = line;
        titleIndex = i;
        break;
      }
    }

    // Process remaining lines based on their content patterns
    for (let i = titleIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Timing information
      if (
        line.startsWith("Preparation") ||
        line.startsWith("Cooking") ||
        line.startsWith("Servings")
      ) {
        timings.push(line);
      }
      // Ingredients (bullet points)
      else if (line.startsWith("•")) {
        ingredients.push(line.substring(1).trim());
      }
      // Instructions (numbered)
      else if (line.match(/^\d+\./)) {
        instructions.push(line);
      }
      // Nutrition info
      else if (
        line.toLowerCase().includes("calorie") ||
        line.toLowerCase().includes("nutritional")
      ) {
        nutrition = line;
      }
    }

    return {
      mealType,
      title,
      ingredients,
      instructions,
      nutrition,
      timings,
    };
  };

  // Format the meal plan for sharing
  const formatMealPlanForSharing = () => {
    let text = `${days}-Day Meal Plan\n`;
    text += `${mealsPerDay} meals per day\n`;
    text += `${caloriesPerDay} calories per day\n`;

    if (healthy) text += "Healthy options\n";
    if (dietType) text += `Diet type: ${dietType}\n`;
    if (allergies.length) text += `Restrictions: ${allergies.join(", ")}\n`;

    text += "\n\n";

    // Add each day's content
    parsedDays.forEach((day) => {
      text += `${day.title}\n\n`;

      day.meals.forEach((meal) => {
        text += meal.content + "\n\n";
      });

      text += "=====\n\n";
    });

    return text;
  };

  // Share the meal plan
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

  // Register the position of a day in the scroll view
  const registerDayPosition = (dayNumber, yPosition) => {
    setDayPositions((prev) => ({
      ...prev,
      [dayNumber]: yPosition,
    }));
  };

  // Scroll to a specific day
  const scrollToDay = (dayNumber) => {
    setSelectedDay(dayNumber);

    // Scroll the day tabs to center the selected day
    if (dayTabsRef.current) {
      const scrollX = Math.max(0, (dayNumber - 2) * DAY_TAB_WIDTH);
      dayTabsRef.current.scrollTo({ x: scrollX, animated: true });
    }

    // Scroll the main content to the day
    const yPosition = dayPositions[dayNumber];
    if (yPosition !== undefined && mainScrollRef.current) {
      mainScrollRef.current.scrollTo({
        y: yPosition,
        animated: true,
      });
    }
  };

  // Render the day tabs at the top
  const renderDayTabs = () => (
    <View style={styles.dayTabsContainer}>
      <ScrollView
        ref={dayTabsRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabsContent}
      >
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
          <TouchableOpacity
            key={`tab-${day}`}
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

  // Render a meal card
  const renderMealCard = (meal) => {
    const parsedMeal = parseMeal(meal.content);

    return (
      <View
        key={`${parsedMeal.mealType}-${parsedMeal.title}`}
        style={styles.mealCard}
      >
        <View style={styles.mealTypeContainer}>
          <Text style={styles.mealTypeText}>{parsedMeal.mealType}</Text>
        </View>

        <Text style={styles.mealTitle}>{parsedMeal.title}</Text>

        {parsedMeal.timings.length > 0 && (
          <View style={styles.timingsContainer}>
            {parsedMeal.timings.map((timing, index) => (
              <View key={`timing-${index}`} style={styles.timingItem}>
                <Ionicons name="time-outline" size={16} color="#008b8b" />
                <Text style={styles.timingText}>{timing}</Text>
              </View>
            ))}
          </View>
        )}

        {parsedMeal.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {parsedMeal.ingredients.map((ingredient, index) => (
              <View key={`ingredient-${index}`} style={styles.ingredientRow}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.ingredientText}>{ingredient}</Text>
              </View>
            ))}
          </View>
        )}

        {parsedMeal.instructions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {parsedMeal.instructions.map((instruction, index) => (
              <Text key={`instruction-${index}`} style={styles.instructionText}>
                {instruction}
              </Text>
            ))}
          </View>
        )}

        {parsedMeal.nutrition && (
          <View style={styles.nutritionContainer}>
            <Ionicons name="fitness-outline" size={16} color="#008b8b" />
            <Text style={styles.nutritionText}>{parsedMeal.nutrition}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render a day section with all its meals
  const renderDay = (day, index) => {
    const dayNumber = index + 1;

    return (
      <View
        key={`day-${dayNumber}`}
        style={styles.dayContainer}
        onLayout={(event) => {
          const layout = event.nativeEvent.layout;
          registerDayPosition(dayNumber, layout.y);
        }}
      >
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{day.title}</Text>
          <View style={styles.dayStats}>
            <View style={styles.statItem}>
              <Ionicons name="restaurant-outline" size={18} color="#008b8b" />
              <Text style={styles.statText}>{mealsPerDay} meals</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={18} color="#008b8b" />
              <Text style={styles.statText}>{caloriesPerDay} cal</Text>
            </View>
          </View>
        </View>

        {day.meals.map((meal) => renderMealCard(meal))}
      </View>
    );
  };

  // Render the plan summary
  const renderPlanSummary = () => (
    <View style={styles.planSummary}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Ionicons name="calendar-outline" size={22} color="#008b8b" />
          <Text style={styles.summaryValue}>{days}</Text>
          <Text style={styles.summaryLabel}>Days</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Ionicons name="restaurant-outline" size={22} color="#008b8b" />
          <Text style={styles.summaryValue}>{mealsPerDay}</Text>
          <Text style={styles.summaryLabel}>Meals/Day</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Ionicons name="flame-outline" size={22} color="#008b8b" />
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
            <View
              key={`allergy-${index}`}
              style={[styles.tag, styles.allergyTag]}
            >
              <Text style={[styles.tagText, styles.allergyTagText]}>
                {allergy}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Your Meal Plan</Text>

        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Day tabs */}
      {renderDayTabs()}

      {/* Plan summary */}
      {renderPlanSummary()}

      {/* Save Meal Plan Button - This was missing */}
      <View style={styles.saveMealPlanContainer}>
        <SaveMealPlanButton
          mealPlan={mealPlan}
          days={days}
          mealsPerDay={mealsPerDay}
          caloriesPerDay={caloriesPerDay}
          allergies={allergies}
          healthy={healthy}
          dietType={dietType}
          onSaved={(savedPlan) => {
            console.log("Meal plan saved:", savedPlan.id);
          }}
          onLoginRequired={() => {
            navigation.navigate("LandingPage");
          }}
        />
      </View>

      <ScrollView
        ref={mainScrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          // Detect which day is currently in view based on scroll position
          const y = event.nativeEvent.contentOffset.y;

          // Find the day that's currently most visible
          let currentDay = 1;
          let minDistance = Number.MAX_VALUE;

          Object.entries(dayPositions).forEach(([day, position]) => {
            const distance = Math.abs(y - position);
            if (distance < minDistance) {
              minDistance = distance;
              currentDay = parseInt(day);
            }
          });

          if (currentDay !== selectedDay) {
            setSelectedDay(currentDay);

            // Update the day tabs
            if (dayTabsRef.current) {
              const scrollX = Math.max(0, (currentDay - 2) * DAY_TAB_WIDTH);
              dayTabsRef.current.scrollTo({ x: scrollX, animated: true });
            }
          }
        }}
        scrollEventThrottle={16}
      >
        {parsedDays.map((day, index) => renderDay(day, index))}

        {/* Add space at the bottom for better UX */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Quick scroll to top button */}
      <TouchableOpacity
        style={styles.scrollTopButton}
        onPress={() => {
          mainScrollRef.current?.scrollTo({ y: 0, animated: true });
          setSelectedDay(1);
        }}
      >
        <Ionicons name="chevron-up" size={24} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  saveMealPlanContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
    marginBottom: 8,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#008b8b",
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginTop: -2,
    shadowColor: "#000",
    shadowOffset: { width: -10, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  headerButton: {
    padding: 8,
    color: "white",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    marginTop: 12,
  },
  dayTabsContainer: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
    paddingVertical: 12,
  },
  dayTabsContent: {
    paddingHorizontal: 16,
  },
  dayTab: {
    minWidth: 88,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  dayTabSelected: {
    backgroundColor: "#e6f3f3",
    borderWidth: 1,
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
    borderBottomColor: "#eaeaea",
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
    backgroundColor: "#eaeaea",
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
    fontSize: 13,
    color: "#008b8b",
    fontWeight: "600",
  },
  allergyTagText: {
    color: "#ff9800",
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  dayContainer: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  dayTitle: {
    fontSize: 22,
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eaeaea",
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
  mealTypeContainer: {
    backgroundColor: "#e6f3f3",
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  mealTypeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#008b8b",
    textTransform: "uppercase",
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 12,
  },
  timingsContainer: {
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
  scrollTopButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#008b8b",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});
