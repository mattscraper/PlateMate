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

  const [parsedDays, setParsedDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const mainScrollRef = useRef(null);
  const dayTabsRef = useRef(null);
  const [dayPositions, setDayPositions] = useState({});

  const DAY_TAB_WIDTH = 80;

  useEffect(() => {
    const parsedData = parseMealPlanRobust(mealPlan);
    setParsedDays(parsedData);
    setIsLoading(false);
  }, [mealPlan]);

  // ROBUST PARSING WITH PROPER MEAL ORDER AND TITLE EXTRACTION
  const parseMealPlanRobust = (mealPlanText) => {
    if (!mealPlanText || typeof mealPlanText !== "string") {
      console.warn("Invalid meal plan text");
      return generateFallbackMealPlan();
    }

    try {
      // Clean the text first
      const cleanedText = mealPlanText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

      // Split by day separators
      let dayTexts = [];
      
      if (cleanedText.includes('=====')) {
        dayTexts = cleanedText.split('=====').filter(text => text.trim());
      } else {
        const dayPattern = /(?=Day\s+\d+)/gi;
        dayTexts = cleanedText.split(dayPattern).filter(text => text.trim());
      }
      
      if (dayTexts.length < days) {
        dayTexts = cleanedText.split(/\n\s*\n/).filter(text => text.trim());
      }

      const parsedDays = [];
      
      for (let i = 0; i < Math.max(dayTexts.length, days); i++) {
        const dayText = dayTexts[i] || '';
        const dayNumber = i + 1;
        
        if (dayNumber > days) break;
        
        const dayData = parseDayContent(dayText, dayNumber);
        parsedDays.push(dayData);
      }

      // Ensure we have the right number of days
      while (parsedDays.length < days) {
        const missingDay = parsedDays.length + 1;
        parsedDays.push(generateFallbackDay(missingDay));
      }

      return parsedDays;
    } catch (error) {
      console.error("Parsing error:", error);
      return generateFallbackMealPlan();
    }
  };

  const parseDayContent = (dayText, dayNumber) => {
    const lines = dayText.split('\n').map(line => line.trim()).filter(line => line);
    
    // Extract meals and ensure proper order
    const extractedMeals = extractMealsFromLines(lines);
    const orderedMeals = ensureProperMealOrder(extractedMeals);
    
    // Ensure we have the right number of meals
    while (orderedMeals.length < mealsPerDay) {
      const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
      const missingMealType = mealTypes[orderedMeals.length] || 'Meal';
      orderedMeals.push(generateFallbackMeal(missingMealType, orderedMeals.length + 1));
    }

    return {
      title: `Day ${dayNumber}`,
      dayNumber: dayNumber,
      meals: orderedMeals.slice(0, mealsPerDay)
    };
  };

  const extractMealsFromLines = (lines) => {
    const meals = [];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    
    let currentMealType = null;
    let currentMealLines = [];

    for (const line of lines) {
      // Check if this line indicates a new meal
      const foundMealType = mealTypes.find(type =>
        line.toLowerCase().includes(type.toLowerCase()) &&
        (line.toLowerCase().indexOf(type.toLowerCase()) < 5 || line.toLowerCase().startsWith(type.toLowerCase()))
      );

      if (foundMealType) {
        // Save previous meal if exists
        if (currentMealType && currentMealLines.length > 0) {
          meals.push(parseIndividualMeal(currentMealLines, currentMealType));
        }
        
        // Start new meal
        currentMealType = foundMealType;
        currentMealLines = [line];
      } else if (currentMealType) {
        currentMealLines.push(line);
      }
    }

    // Don't forget the last meal
    if (currentMealType && currentMealLines.length > 0) {
      meals.push(parseIndividualMeal(currentMealLines, currentMealType));
    }

    return meals;
  };

  // Ensure meals are in proper order: Breakfast, Lunch, Dinner, Snack
  const ensureProperMealOrder = (meals) => {
    const mealOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const orderedMeals = [];
    
    // Add meals in the correct order
    for (const mealType of mealOrder) {
      const meal = meals.find(m => m.mealType === mealType);
      if (meal) {
        orderedMeals.push(meal);
      }
    }
    
    // If we don't have enough meals, generate missing ones
    while (orderedMeals.length < mealsPerDay && orderedMeals.length < mealOrder.length) {
      const missingMealType = mealOrder[orderedMeals.length];
      orderedMeals.push(generateFallbackMeal(missingMealType, orderedMeals.length + 1));
    }
    
    return orderedMeals;
  };

  const parseIndividualMeal = (lines, mealType) => {
    let title = '';
    let ingredients = [];
    let instructions = [];
    let nutrition = '';
    let timings = [];

    // ENHANCED TITLE EXTRACTION - Find the actual recipe title
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip obvious non-titles
      if (line.startsWith('•') ||
          line.startsWith('-') ||
          line.match(/^\d+\./) ||
          line.toLowerCase().includes('preparation') ||
          line.toLowerCase().includes('cooking') ||
          line.toLowerCase().includes('servings') ||
          line.toLowerCase().includes('calorie') ||
          line.toLowerCase().includes('ingredients') ||
          line.toLowerCase().includes('instructions') ||
          line.toLowerCase().includes('nutritional') ||
          line === '-----' ||
          line === '----' ||
          line.match(/^=+$/) ||
          line.length < 3) {
        continue;
      }
      
      // Look for title patterns - should be a substantial line
      if (line.length > 3 &&
          !line.includes(':') &&
          !line.match(/^\d/) &&
          !line.toLowerCase().startsWith('step') &&
          !line.toLowerCase().startsWith('mix') &&
          !line.toLowerCase().startsWith('add') &&
          !line.toLowerCase().startsWith('cook') &&
          !line.toLowerCase().startsWith('heat') &&
          !line.toLowerCase().startsWith('serve')) {
        
        // Clean up the title
        title = line.replace(/[^\w\s\-'&]/g, '').trim();
        
        // Validate it's a real title
        if (title.length > 3 &&
            !title.toLowerCase().includes('ingredient') &&
            !title.toLowerCase().includes('instruction')) {
          break;
        }
      }
    }

    // If no title found or title looks like an ingredient, generate one
    if (!title ||
        title.length < 3 ||
        title === '-----' ||
        title.toLowerCase().includes('cup') ||
        title.toLowerCase().includes('tablespoon') ||
        title.toLowerCase().includes('teaspoon') ||
        title.toLowerCase().includes('pound') ||
        title.toLowerCase().includes('gram') ||
        title.toLowerCase().includes('ounce')) {
      
      const titleWords = ['Delicious', 'Healthy', 'Fresh', 'Nutritious', 'Gourmet', 'Classic', 'Hearty', 'Tasty'];
      const randomWord = titleWords[Math.floor(Math.random() * titleWords.length)];
      title = `${randomWord} ${mealType}`;
    }

    // Extract other components with better filtering
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine === title) continue;

      // Timing information
      if (trimmedLine.toLowerCase().includes('preparation') ||
          trimmedLine.toLowerCase().includes('cooking') ||
          trimmedLine.toLowerCase().includes('servings') ||
          trimmedLine.match(/prep.*time/i) ||
          trimmedLine.match(/cook.*time/i)) {
        timings.push(trimmedLine);
      }
      // Ingredients (bullet points or dashes)
      else if (trimmedLine.match(/^[•\-\*]\s/)) {
        const ingredient = trimmedLine.replace(/^[•\-\*]\s*/, '').trim();
        
        // Enhanced ingredient filtering
        if (ingredient &&
            ingredient !== '-----' &&
            ingredient !== '----' &&
            ingredient.length > 2 &&
            !ingredient.match(/^=+$/) &&
            !ingredient.toLowerCase().includes('instruction') &&
            !ingredient.toLowerCase().includes('step ') &&
            !ingredient.match(/^\d+\.\s/)) {
          ingredients.push(ingredient);
        }
      }
      // Instructions (numbered)
      else if (trimmedLine.match(/^\d+\./)) {
        instructions.push(trimmedLine);
      }
      // Nutrition info
      else if (trimmedLine.toLowerCase().includes('calorie') ||
               trimmedLine.toLowerCase().includes('protein') ||
               trimmedLine.toLowerCase().includes('fat') ||
               trimmedLine.toLowerCase().includes('carb') ||
               trimmedLine.toLowerCase().includes('kcal') ||
               trimmedLine.toLowerCase().includes('nutritional')) {
        nutrition = trimmedLine;
      }
    }

    // Ensure we have some content with better defaults
    if (ingredients.length === 0) {
      ingredients = [
        'Fresh, high-quality ingredients as specified',
        'Seasonings and spices to taste',
        'Additional ingredients per complete recipe'
      ];
    }

    if (instructions.length === 0) {
      instructions = [
        '1. Prepare all ingredients according to recipe specifications',
        '2. Follow proper cooking techniques for this meal type',
        '3. Season and adjust flavors as needed',
        '4. Serve immediately while fresh and hot'
      ];
    }

    if (!nutrition) {
      const caloriesPerMeal = Math.round(caloriesPerDay / mealsPerDay);
      const protein = Math.round(caloriesPerMeal * 0.2 / 4); // 20% protein
      const carbs = Math.round(caloriesPerMeal * 0.5 / 4); // 50% carbs
      const fat = Math.round(caloriesPerMeal * 0.3 / 9); // 30% fat
      nutrition = `${caloriesPerMeal} calories • ${protein}g protein • ${carbs}g carbs • ${fat}g fat`;
    }

    if (timings.length === 0) {
      timings = ['Preparation: 15 minutes', 'Cooking: 20 minutes'];
    }

    return {
      mealType,
      title,
      ingredients,
      instructions,
      nutrition,
      timings
    };
  };

  const generateFallbackMeal = (mealType, mealIndex) => {
    const mealTitles = {
      'Breakfast': ['Protein Power Bowl', 'Morning Energy Plate', 'Sunrise Special'],
      'Lunch': ['Midday Balance Bowl', 'Power Lunch Plate', 'Afternoon Fuel'],
      'Dinner': ['Evening Comfort Meal', 'Dinner Delight', 'Night Nourishment'],
      'Snack': ['Energy Boost', 'Quick Bite', 'Healthy Snack']
    };

    const titles = mealTitles[mealType] || ['Healthy Meal'];
    const randomTitle = titles[Math.floor(Math.random() * titles.length)];

    const caloriesPerMeal = Math.round(caloriesPerDay / mealsPerDay);
    const protein = Math.round(caloriesPerMeal * 0.2 / 4);
    const carbs = Math.round(caloriesPerMeal * 0.5 / 4);
    const fat = Math.round(caloriesPerMeal * 0.3 / 9);

    return {
      mealType,
      title: randomTitle,
      ingredients: [
        'Premium quality ingredients',
        'Fresh vegetables and proteins',
        'Healthy fats and complex carbohydrates'
      ],
      instructions: [
        '1. Prepare ingredients using proper food safety techniques',
        '2. Cook according to dietary requirements and preferences',
        '3. Season appropriately and serve fresh'
      ],
      nutrition: `${caloriesPerMeal} calories • ${protein}g protein • ${carbs}g carbs • ${fat}g fat`,
      timings: ['Prep: 15 min', 'Cook: 20 min']
    };
  };

  const generateFallbackDay = (dayNumber) => {
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'].slice(0, mealsPerDay);
    const meals = mealTypes.map((type, index) => generateFallbackMeal(type, index + 1));
    
    return {
      title: `Day ${dayNumber}`,
      dayNumber,
      meals
    };
  };

  const generateFallbackMealPlan = () => {
    return Array.from({ length: days }, (_, index) =>
      generateFallbackDay(index + 1)
    );
  };

  const handleShare = async () => {
    try {
      let shareText = `🍽️ KITCH MEAL PLAN\n`;
      shareText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      shareText += `📊 PLAN DETAILS\n`;
      shareText += `Duration: ${days} days\n`;
      shareText += `Meals per day: ${mealsPerDay}\n`;
      shareText += `Daily calories: ${caloriesPerDay}\n`;
      if (dietType) shareText += `Diet type: ${dietType}\n`;
      if (allergies.length) shareText += `Restrictions: ${allergies.join(', ')}\n`;
      shareText += '\n';

      parsedDays.forEach((day, dayIndex) => {
        shareText += `📅 ${day.title.toUpperCase()}\n`;
        shareText += '─'.repeat(40) + '\n';
        
        day.meals.forEach((meal, mealIndex) => {
          shareText += `\n${meal.mealType.toUpperCase()}: ${meal.title}\n`;
          shareText += `⏱️ ${meal.timings.join(' • ')}\n`;
          shareText += `📋 ${meal.ingredients.length} ingredients\n`;
          shareText += `👨‍🍳 ${meal.instructions.length} steps\n`;
          shareText += `💪 ${meal.nutrition}\n`;
        });
        
        if (dayIndex < parsedDays.length - 1) {
          shareText += '\n' + '═'.repeat(40) + '\n';
        }
      });

      await Share.share({
        message: shareText,
        title: "My Kitch Meal Plan",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const registerDayPosition = (dayNumber, yPosition) => {
    setDayPositions((prev) => ({
      ...prev,
      [dayNumber]: yPosition,
    }));
  };

  const scrollToDay = (dayNumber) => {
    setSelectedDay(dayNumber);

    if (dayTabsRef.current) {
      const scrollX = Math.max(0, (dayNumber - 2) * DAY_TAB_WIDTH);
      dayTabsRef.current.scrollTo({ x: scrollX, animated: true });
    }

    const yPosition = dayPositions[dayNumber];
    if (yPosition !== undefined && mainScrollRef.current) {
      mainScrollRef.current.scrollTo({
        y: yPosition - 80,
        animated: true,
      });
    }
  };

  const handleSavePlan = () => {
    // This function is no longer needed - we'll use the actual SaveMealPlanButton component
    console.log("Save function called - this should not be used");
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <Ionicons name="restaurant" size={32} color="#0066cc" />
          </View>
          <Text style={styles.loadingText}>Preparing your meal plan...</Text>
          <Text style={styles.loadingSubtext}>Kitch Nutrition Platform</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Your Meal Plan</Text>
          <Text style={styles.headerSubtitle}>Kitch Nutrition Platform</Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#333" />
        </TouchableOpacity>
      </View>

      {/* System Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View style={styles.statusIndicator} />
          <Text style={styles.statusText}>Plan Ready</Text>
        </View>
        <View style={styles.statusRight}>
          <Text style={styles.statusDetails}>
            {days}D • {mealsPerDay}M/D • {caloriesPerDay}cal/D
          </Text>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          ref={dayTabsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {parsedDays.map((day, index) => {
            const isSelected = selectedDay === day.dayNumber;
            return (
              <TouchableOpacity
                key={day.dayNumber}
                style={[styles.tab, isSelected && styles.tabActive]}
                onPress={() => scrollToDay(day.dayNumber)}
              >
                <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                  Day {day.dayNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Control Panel */}
      {(dietType || allergies.length > 0) && (
        <View style={styles.controlPanel}>
          <View style={styles.controlLeft}>
            {dietType && (
              <View style={styles.controlTag}>
                <Text style={styles.controlTagText}>{dietType}</Text>
              </View>
            )}
            {allergies.map((allergy, index) => (
              <View key={index} style={styles.controlTagWarning}>
                <Text style={styles.controlTagWarningText}>{allergy}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Main Content */}
      <ScrollView
        ref={mainScrollRef}
        style={styles.dataGrid}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          let currentDay = 1;
          let minDistance = Number.MAX_VALUE;

          Object.entries(dayPositions).forEach(([day, position]) => {
            const distance = Math.abs(y - (position - 80));
            if (distance < minDistance) {
              minDistance = distance;
              currentDay = parseInt(day);
            }
          });

          if (currentDay !== selectedDay) {
            setSelectedDay(currentDay);
          }
        }}
        scrollEventThrottle={16}
      >
        {/* Save Button - Using actual SaveMealPlanButton component */}
        <View style={styles.saveSection}>
          <Text style={styles.saveSectionTitle}>PLAN MANAGEMENT</Text>
          <View style={styles.saveButtonWrapper}>
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
        </View>

        {parsedDays.map((day, dayIndex) => (
          <View
            key={day.dayNumber}
            style={styles.daySection}
            onLayout={(event) => {
              const layout = event.nativeEvent.layout;
              registerDayPosition(day.dayNumber, layout.y);
            }}
          >
            {/* Day Header Panel */}
            <View style={styles.dayPanel}>
              <View style={styles.dayPanelLeft}>
                <Text style={styles.dayPanelTitle}>{day.title}</Text>
                <Text style={styles.dayPanelMeta}>
                  {day.meals.length} meals configured • Ready to cook
                </Text>
              </View>
              <View style={styles.dayPanelRight}>
                <View style={styles.dayPanelStats}>
                  <Text style={styles.dayPanelStatsNumber}>{caloriesPerDay}</Text>
                  <Text style={styles.dayPanelStatsLabel}>CALORIES</Text>
                </View>
              </View>
            </View>

            {/* Meal Records */}
            <View style={styles.mealRecords}>
              {day.meals.map((meal, mealIndex) => (
                <View key={`${day.dayNumber}-${mealIndex}`} style={styles.mealRecord}>
                  {/* Record Header */}
                  <View style={styles.recordHeader}>
                    <View style={styles.recordHeaderLeft}>
                      <View style={styles.recordIcon}>
                        <Ionicons
                          name={
                            meal.mealType === 'Breakfast' ? 'sunny' :
                            meal.mealType === 'Lunch' ? 'partly-sunny' :
                            meal.mealType === 'Dinner' ? 'moon' : 'cafe'
                          }
                          size={16}
                          color="#0066cc"
                        />
                      </View>
                      <View>
                        <Text style={styles.recordType}>{meal.mealType}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.recordHeaderRight}>
                      <View style={styles.recordStatus}>
                        <View style={styles.recordStatusDot} />
                        <Text style={styles.recordStatusText}>READY</Text>
                      </View>
                    </View>
                  </View>

                  {/* Record Title */}
                  <Text style={styles.recordTitle}>{meal.title}</Text>

                  {/* Record Metadata */}
                  <View style={styles.recordMeta}>
                    {meal.timings.map((timing, index) => (
                      <View key={index} style={styles.recordMetaItem}>
                        <Ionicons name="time" size={12} color="#7f8c8d" />12} color="#666" />
                        <Text style={styles.recordMetaText}>{timing}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Record Data Sections */}
                  <View style={styles.recordSections}>
                    {/* Ingredients Data */}
                    <View style={styles.dataSection}>
                      <View style={styles.dataSectionHeader}>
                        <Ionicons name="list" size={14} color="#008b8b" />
                        <Text style={styles.dataSectionTitle}>INGREDIENTS</Text>
                        <Text style={styles.dataSectionCount}>({meal.ingredients.length})</Text>
                      </View>
                      <View style={styles.dataSectionContent}>
                        {meal.ingredients.map((ingredient, index) => (
                          <View key={index} style={styles.dataRow}>
                            <Text style={styles.dataRowNumber}>{String(index + 1).padStart(2, '0')}</Text>
                            <Text style={styles.dataRowText}>{ingredient}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Instructions Data */}
                    <View style={styles.dataSection}>
                      <View style={styles.dataSectionHeader}>
                        <Ionicons name="clipboard" size={14} color="#008b8b" />
                        <Text style={styles.dataSectionTitle}>INSTRUCTIONS</Text>
                        <Text style={styles.dataSectionCount}>({meal.instructions.length})</Text>
                      </View>
                      <View style={styles.dataSectionContent}>
                        {meal.instructions.map((instruction, index) => (
                          <Text key={index} style={styles.instructionText}>
                            {instruction}
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Record Footer - Always shows complete macros */}
                  <View style={styles.recordFooter}>
                    <Ionicons name="bar-chart" size={12} color="#008b8b" />
                    <Text style={styles.recordFooterText}>{meal.nutrition}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
        
        <View style={styles.endSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingSpinner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerButton: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7f8c8d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // System Status Bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#34D399',
  },
  statusRight: {},
  statusDetails: {
    fontSize: 13,
    color: '#7f8c8d',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Navigation Tabs
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    minWidth: 60,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#008b8b',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#7f8c8d',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },

  // Control Panel
  controlPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  controlLeft: {
    flexDirection: 'row',
    gap: 8,
  },
  controlTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  controlTagText: {
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '500',
  },
  controlTagWarning: {
    backgroundColor: '#fff2f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  controlTagWarningText: {
    fontSize: 12,
    color: '#d63031',
    fontWeight: '500',
  },

  // Save Section - Styled to match your app
  saveSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  saveSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  saveButtonWrapper: {
    // Container for the SaveMealPlanButton to inherit proper styling
  },

  // Main Data Grid
  dataGrid: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Day Section
  daySection: {
    marginBottom: 20,
  },

  // Day Panel
  dayPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  dayPanelLeft: {
    flex: 1,
  },
  dayPanelTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
  },
  dayPanelMeta: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  dayPanelRight: {},
  dayPanelStats: {
    alignItems: 'center',
  },
  dayPanelStatsNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dayPanelStatsLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  // Meal Records
  mealRecords: {
    marginHorizontal: 20,
    marginTop: 12,
    gap: 16,
  },

  // Individual Meal Record
  mealRecord: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // Record Header
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordType: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  recordHeaderRight: {},
  recordStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  recordStatusText: {
    fontSize: 12,
    color: '#34D399',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Record Title
  recordTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    lineHeight: 28,
  },

  // Record Metadata
  recordMeta: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  recordMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recordMetaText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  // Record Data Sections
  recordSections: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },

  // Data Section
  dataSection: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dataSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  dataSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    letterSpacing: 0.5,
  },
  dataSectionCount: {
    fontSize: 12,
    color: '#7f8c8d',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dataSectionContent: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
  },

  // Data Rows
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 12,
  },
  dataRowNumber: {
    fontSize: 12,
    color: '#7f8c8d',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 24,
    marginTop: 2,
  },
  dataRowText: {
    flex: 1,
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
  },

  // Instructions
  instructionText: {
    fontSize: 15,
    color: '#2c3e50',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  // Record Footer
  recordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 8,
  },
  recordFooterText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  // End Spacer
  endSpacer: {
    height: 80,
  },
});
