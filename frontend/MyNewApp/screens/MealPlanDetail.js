import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
  Dimensions,
  StatusBar,
  Modal,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

const { width } = Dimensions.get('window');

export default function MealPlanDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const mealPlanData = route.params?.mealPlan || {};

  // Extract meal plan properties
  const {
    mealPlan, // This is the actual plan content text
    days = 7,
    mealsPerDay = 3,
    healthy = false,
    allergies = [],
    dietType = "",
    caloriesPerDay = 2000,
  } = mealPlanData;

  // Parse meal plan data
  const [parsedDays, setParsedDays] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [isLoading, setIsLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef();

  // Create smooth animated values for summary card
  const summaryOpacity = scrollY.interpolate({
    inputRange: [0, 50, 120],
    outputRange: [1, 0.8, 0],
    extrapolate: 'clamp',
  });

  const summaryTranslateY = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -60],
    extrapolate: 'clamp',
  });

  const summaryScale = scrollY.interpolate({
    inputRange: [0, 50, 120],
    outputRange: [1, 0.98, 0.95],
    extrapolate: 'clamp',
  });

  // Animated height for collapsing the summary card
  const summaryHeight = scrollY.interpolate({
    inputRange: [0, 80, 120],
    outputRange: [180, 80, 0],
    extrapolate: 'clamp',
  });

  // Animated margin for smooth spacing
  const summaryMargin = scrollY.interpolate({
    inputRange: [0, 80, 120],
    outputRange: [8, 4, 0],
    extrapolate: 'clamp',
  });

  // Animated spacing for toggle container to move up and touch header
  const toggleMarginTop = scrollY.interpolate({
    inputRange: [0, 80, 120],
    outputRange: [8, 4, 0],
    extrapolate: 'clamp',
  });

  const togglePaddingVertical = scrollY.interpolate({
    inputRange: [0, 80, 120],
    outputRange: [8, 4, 0],
    extrapolate: 'clamp',
  });

  // Parse the meal plan text when component mounts
  useEffect(() => {
    console.log("MealPlanDetail props:", {
      mealPlanType: typeof mealPlan,
      mealPlanLength: mealPlan ? mealPlan.length : 0,
      days,
      mealsPerDay,
      parsedDays,
    });

    if (mealPlan && typeof mealPlan === "string") {
      const parsedData = parseMealPlanRobust(mealPlan);
      setParsedDays(parsedData);
    } else {
      console.warn("Invalid meal plan format:", mealPlanData);
      setParsedDays([]);
    }
    setIsLoading(false);
  }, [mealPlan, days, mealsPerDay]);

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

      // Split by day separators - handle both formats
      let dayTexts = [];
      
      if (cleanedText.includes('=====')) {
        dayTexts = cleanedText.split('=====').filter(text => text.trim());
      } else if (cleanedText.includes('====================')) {
        dayTexts = cleanedText.split('====================').filter(text => text.trim());
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

    // Calculate totals for the day
    const totals = orderedMeals.slice(0, mealsPerDay).reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      title: `Day ${dayNumber}`,
      dayNumber: dayNumber,
      meals: orderedMeals.slice(0, mealsPerDay),
      ...totals
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
    let timings = [];
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    // SIMPLIFIED AND MORE EFFECTIVE TITLE EXTRACTION
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and obvious non-titles
      if (!line ||
          line.startsWith('•') ||
          line.startsWith('-') ||
          line.match(/^\d+\./) ||
          line.toLowerCase().includes('preparation') ||
          line.toLowerCase().includes('cooking') ||
          line.toLowerCase().includes('servings') ||
          line.toLowerCase().includes('calorie') ||
          line.toLowerCase().includes('protein') ||
          line.toLowerCase().includes('carb') ||
          line.toLowerCase().includes('fat') ||
          line.toLowerCase().includes('ingredients:') ||
          line.toLowerCase().includes('instructions:') ||
          line.toLowerCase().includes('nutritional') ||
          line === '-----' ||
          line === '----' ||
          line.match(/^=+$/)) {
        continue;
      }
      
      // Look for a substantial line that could be a title
      if (line.length >= 3 && !line.endsWith(':')) {
        title = line.replace(/[^\w\s\-'&(),.]/g, '').trim();
        
        // Only reject if it's clearly an ingredient (has measurements)
        if (!title.match(/\d+\s*(cup|tbsp|tsp|lb|oz|gram|ml|liter)/i)) {
          break;
        }
      }
    }

    // Only generate fallback title if we truly have nothing
    if (!title || title.length < 3) {
      const titleWords = ['Delicious', 'Healthy', 'Fresh', 'Nutritious', 'Gourmet', 'Classic', 'Hearty', 'Tasty'];
      const randomWord = titleWords[Math.floor(Math.random() * titleWords.length)];
      title = `${randomWord} ${mealType}`;
    }

    // Extract other components with better filtering
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine === title) continue;

      // Parse nutrition values
      if (trimmedLine.toLowerCase().includes('calorie') && calories === 0) {
        const patterns = [
          /calories?\s*:?\s*(\d+)/i,
          /(\d+)\s*calories?/i,
          /(\d+)\s*kcal/i,
          /cal\s*:?\s*(\d+)/i
        ];
        for (const pattern of patterns) {
          const match = trimmedLine.match(pattern);
          if (match) {
            calories = parseInt(match[1]);
            break;
          }
        }
      }
      
      if (trimmedLine.toLowerCase().includes('protein') && protein === 0) {
        const match = trimmedLine.match(/(\d+)/);
        if (match) {
          protein = parseInt(match[1]);
        }
      }
      
      if (trimmedLine.toLowerCase().includes('carb') && carbs === 0) {
        const match = trimmedLine.match(/(\d+)/);
        if (match) {
          carbs = parseInt(match[1]);
        }
      }
      
      if (trimmedLine.toLowerCase().includes('fat') && fat === 0) {
        const match = trimmedLine.match(/(\d+)/);
        if (match) {
          fat = parseInt(match[1]);
        }
      }

      // Timing information
      if ((trimmedLine.toLowerCase().includes('preparation') && (trimmedLine.toLowerCase().includes('time') || trimmedLine.match(/\d+\s*min/i))) ||
          (trimmedLine.toLowerCase().includes('cooking') && (trimmedLine.toLowerCase().includes('time') || trimmedLine.match(/\d+\s*min/i))) ||
          (trimmedLine.toLowerCase().includes('servings') && trimmedLine.match(/\d+/)) ||
          (trimmedLine.toLowerCase().startsWith('prep') && trimmedLine.match(/\d+\s*min/i)) ||
          (trimmedLine.toLowerCase().startsWith('cook') && trimmedLine.match(/\d+\s*min/i)) ||
          (trimmedLine.match(/^(prep|cook|preparation|cooking).*time.*\d+/i)) ||
          (trimmedLine.match(/^servings?\s*:\s*\d+/i)) ||
          (trimmedLine.match(/^\d+\s*(minute|hour|serving)/i) && !trimmedLine.match(/^\d+\.\s/))) {
        timings.push(trimmedLine);
      }
      // Ingredients (bullet points or dashes)
      else if (trimmedLine.match(/^[•\-\*]\s/)) {
        const ingredient = trimmedLine.replace(/^[•\-\*]\s*/, '').trim();
        
        if (ingredient &&
            ingredient !== '-----' &&
            ingredient !== '----' &&
            ingredient.length > 1 &&
            !ingredient.match(/^=+$/) &&
            !ingredient.toLowerCase().startsWith('instruction') &&
            !ingredient.match(/^\d+\.\s/)) {
          ingredients.push(ingredient);
        }
      }
      // Instructions (numbered)
      else if (trimmedLine.match(/^\d+\./)) {
        instructions.push(trimmedLine);
      }
    }

    // Set default values if not found
    if (calories === 0) {
      calories = Math.round(caloriesPerDay / mealsPerDay);
    }
    if (protein === 0) protein = Math.round(calories * 0.25 / 4);
    if (carbs === 0) carbs = Math.round(calories * 0.45 / 4);
    if (fat === 0) fat = Math.round(calories * 0.30 / 9);

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

    if (timings.length === 0) {
      timings = ['Prep: 15 min', 'Cook: 20 min'];
    }

    return {
      mealType,
      title,
      ingredients,
      instructions,
      timings,
      calories,
      protein,
      carbs,
      fat
    };
  };

  const generateFallbackMeal = (mealType, mealIndex) => {
    const avgCals = Math.round(caloriesPerDay / mealsPerDay);
    const mealTitles = {
      'Breakfast': ['Protein Power Bowl', 'Morning Energy Plate', 'Sunrise Special', 'Hearty Breakfast Skillet', 'Golden Morning Toast'],
      'Lunch': ['Midday Balance Bowl', 'Power Lunch Plate', 'Afternoon Fuel', 'Fresh Garden Salad', 'Savory Lunch Wrap'],
      'Dinner': ['Evening Comfort Meal', 'Dinner Delight', 'Night Nourishment', 'Sunset Feast', 'Cozy Dinner Bowl'],
      'Snack': ['Energy Boost', 'Quick Bite', 'Healthy Snack', 'Power Snack', 'Midday Treat']
    };

    const titles = mealTitles[mealType] || ['Healthy Meal'];
    const randomTitle = titles[Math.floor(Math.random() * titles.length)];

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
      timings: ['Prep: 15 min', 'Cook: 20 min'],
      calories: avgCals,
      protein: Math.round(avgCals * 0.25 / 4),
      carbs: Math.round(avgCals * 0.45 / 4),
      fat: Math.round(avgCals * 0.30 / 9)
    };
  };

  const generateFallbackDay = (dayNumber) => {
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'].slice(0, mealsPerDay);
    const meals = mealTypes.map((type, index) => generateFallbackMeal(type, index + 1));
    
    const totals = meals.reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      title: `Day ${dayNumber}`,
      dayNumber,
      meals,
      ...totals
    };
  };

  const generateFallbackMealPlan = () => {
    return Array.from({ length: days }, (_, index) =>
      generateFallbackDay(index + 1)
    );
  };

  const getMealTypeColor = (mealType) => {
    const colors = {
      'Breakfast': '#f39c12',
      'Lunch': '#3498db',
      'Dinner': '#9b59b6',
      'Snack': '#27ae60'
    };
    return colors[mealType] || '#008b8b';
  };

  // Share the meal plan
  const handleShare = async () => {
    try {
      const shareText = `My ${days}-Day Meal Plan\n\n` +
        parsedDays.map(day =>
          `${day.title}: ${day.calories} calories\n` +
          day.meals.map(meal => `• ${meal.title} (${meal.calories} cal)`).join('\n')
        ).join('\n\n');
      
      await Share.share({ message: shareText });
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  // Calculate averages for compact summary
  const avgCalories = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.calories, 0) / days) : caloriesPerDay;
  const avgProtein = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.protein, 0) / days) : Math.round(caloriesPerDay * 0.25 / 4);
  const avgCarbs = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.carbs, 0) / days) : Math.round(caloriesPerDay * 0.45 / 4);
  const avgFat = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.fat, 0) / days) : Math.round(caloriesPerDay * 0.30 / 9);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="restaurant" size={48} color="#008b8b" />
          </View>
          <Text style={styles.loadingTitle}>Loading Your Saved Plan</Text>
          <Text style={styles.loadingSubtitle}>Preparing nutrition data</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{mealPlanData.name || "Saved Meal Plan"}</Text>
          <Text style={styles.headerStats}>
            {days} days
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#008b8b" />
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.compactSummaryCard,
          {
            opacity: summaryOpacity,
            height: summaryHeight,
            marginTop: summaryMargin,
            marginBottom: summaryMargin,
            overflow: 'hidden',
            transform: [
              { translateY: summaryTranslateY },
              { scale: summaryScale }
            ]
          }
        ]}
      >
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryMainInfo}>
            <Text style={styles.summaryTitle}>{days} Day Plan</Text>
            <Text style={styles.summarySubtitle}>{caloriesPerDay} cal/day</Text>
            {dietType && (
              <View style={styles.dietTypeBadge}>
                <Text style={styles.dietTypeBadgeText}>{dietType}</Text>
              </View>
            )}
          </View>
          <View style={styles.summaryRecipeCount}>
            <Text style={styles.recipeCountNumber}>{days * mealsPerDay}</Text>
            <Text style={styles.recipeCountLabel}>recipes</Text>
          </View>
        </View>
        
        <View style={styles.avgNutritionSection}>
          <Text style={styles.avgSectionTitle}>Daily Averages</Text>
          <View style={styles.avgStatsGrid}>
            <View style={styles.avgStatItem}>
              <Text style={styles.avgStatValue}>{avgCalories}</Text>
              <Text style={styles.avgStatLabel}>Calories</Text>
            </View>
            <View style={styles.avgStatItem}>
              <Text style={styles.avgStatValue}>{avgProtein}g</Text>
              <Text style={styles.avgStatLabel}>Protein</Text>
            </View>
            <View style={styles.avgStatItem}>
              <Text style={styles.avgStatValue}>{avgCarbs}g</Text>
              <Text style={styles.avgStatLabel}>Carbs</Text>
            </View>
            <View style={styles.avgStatItem}>
              <Text style={styles.avgStatValue}>{avgFat}g</Text>
              <Text style={styles.avgStatLabel}>Fat</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.toggleContainer,
          {
            marginTop: toggleMarginTop,
            paddingVertical: togglePaddingVertical,
          }
        ]}
      >
        <View style={styles.toggleWrapper}>
          <TouchableOpacity
            style={[styles.toggleOption, viewMode === 'cards' && styles.toggleOptionActive]}
            onPress={() => setViewMode('cards')}
          >
            <Ionicons name="grid" size={18} color={viewMode === 'cards' ? '#fff' : '#7f8c8d'} />
            <Text style={[styles.toggleText, viewMode === 'cards' && styles.toggleTextActive]}>Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, viewMode === 'list' && styles.toggleOptionActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={18} color={viewMode === 'list' ? '#fff' : '#7f8c8d'} />
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {parsedDays.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Meal Plan Data</Text>
          <Text style={styles.emptyStateText}>
            The meal plan data couldn't be loaded properly.
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: false,
              listener: (event) => {
                // Optional: Add any additional scroll logic here
              }
            }
          )}
          scrollEventThrottle={1}
          decelerationRate="normal"
          bounces={true}
        >
          {viewMode === 'cards' ? (
            <View style={styles.cardsContainer}>
              {parsedDays.map((day) => (
                <View key={day.dayNumber} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayHeaderLeft}>
                      <Text style={styles.dayTitle}>{day.title}</Text>
                      <Text style={styles.dayCalories}>{day.calories} calories</Text>
                    </View>
                    <View style={styles.dayProgress}>
                      <View style={styles.progressRing}>
                        <Text style={styles.progressText}>{Math.round((day.calories / caloriesPerDay) * 100)}%</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.macroSection}>
                    <View style={styles.macroBar}>
                      <View style={[styles.macroBarSegment, { backgroundColor: '#f39c12', flex: day.protein }]} />
                      <View style={[styles.macroBarSegment, { backgroundColor: '#3498db', flex: day.carbs }]} />
                      <View style={[styles.macroBarSegment, { backgroundColor: '#9b59b6', flex: day.fat }]} />
                    </View>
                    <View style={styles.macroLabels}>
                      <Text style={styles.macroLabel}>
                        <Text style={styles.macroBold}>{day.protein}g</Text> Protein
                      </Text>
                      <Text style={styles.macroLabel}>
                        <Text style={styles.macroBold}>{day.carbs}g</Text> Carbs
                      </Text>
                      <Text style={styles.macroLabel}>
                        <Text style={styles.macroBold}>{day.fat}g</Text> Fat
                      </Text>
                    </View>
                  </View>

                  <View style={styles.mealsGrid}>
                    {day.meals.map((meal, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.mealGridItem}
                        onPress={() => setSelectedMeal(meal)}
                      >
                        <View style={[styles.mealIcon, { backgroundColor: getMealTypeColor(meal.mealType) }]}>
                          <Ionicons
                            name={
                              meal.mealType === 'Breakfast' ? 'sunny' :
                              meal.mealType === 'Lunch' ? 'partly-sunny' :
                              meal.mealType === 'Dinner' ? 'moon' : 'cafe'
                            }
                            size={16}
                            color="#fff"
                          />
                        </View>
                        <Text style={styles.mealGridType}>{meal.mealType}</Text>
                        <Text style={styles.mealGridTitle} numberOfLines={2}>{meal.title}</Text>
                        <Text style={styles.mealGridCalories}>{meal.calories} cal</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {parsedDays.flatMap(day =>
                day.meals.map((meal, mealIndex) => ({
                  ...meal,
                  dayTitle: day.title,
                  key: `${day.dayNumber}-${meal.mealType}`,
                  dayNumber: day.dayNumber
                }))
              ).map((meal) => (
                <TouchableOpacity
                  key={meal.key}
                  style={styles.listItem}
                  onPress={() => setSelectedMeal(meal)}
                >
                  <View style={styles.listItemLeft}>
                    <View style={[styles.listMealIcon, { backgroundColor: getMealTypeColor(meal.mealType) }]}>
                      <Ionicons
                        name={
                          meal.mealType === 'Breakfast' ? 'sunny' :
                          meal.mealType === 'Lunch' ? 'partly-sunny' :
                          meal.mealType === 'Dinner' ? 'moon' : 'cafe'
                        }
                        size={20}
                        color="#fff"
                      />
                    </View>
                    <View style={styles.listMealInfo}>
                      <Text style={styles.listMealType}>{meal.mealType} • Day {meal.dayNumber}</Text>
                      <Text style={styles.listMealTitle}>{meal.title}</Text>
                      <View style={styles.listMealMacros}>
                        <Text style={styles.listMealMacro}>{meal.protein}g P</Text>
                        <Text style={styles.listMealMacro}>{meal.carbs}g C</Text>
                        <Text style={styles.listMealMacro}>{meal.fat}g F</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.listItemRight}>
                    <Text style={styles.listMealCalories}>{meal.calories}</Text>
                    <Text style={styles.listMealCaloriesLabel}>cal</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          <View style={styles.scrollBottom} />
        </Animated.ScrollView>
      )}

      <Modal
        visible={selectedMeal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMeal(null)}
      >
        {selectedMeal && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedMeal(null)}
              >
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
              
              <View style={styles.modalHeaderCenter}>
                <Text style={styles.modalTitle} numberOfLines={2}>{selectedMeal.title}</Text>
                <View style={styles.modalMealTypeBadge}>
                  <Text style={styles.modalMealTypeText}>{selectedMeal.mealType}</Text>
                </View>
              </View>
              
              <View style={styles.modalCaloriesDisplay}>
                <Text style={styles.modalCaloriesNumber}>{selectedMeal.calories}</Text>
                <Text style={styles.modalCaloriesLabel}>calories</Text>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.nutritionSection}>
                <Text style={styles.sectionTitle}>Nutrition Breakdown</Text>
                <View style={styles.nutritionCards}>
                  <View style={styles.nutritionCard}>
                    <View style={[styles.nutritionIconContainer, { backgroundColor: '#f39c12' }]}>
                      <Ionicons name="fitness" size={16} color="#fff" />
                    </View>
                    <Text style={styles.nutritionValue}>{selectedMeal.protein}g</Text>
                    <Text style={styles.nutritionLabel}>Protein</Text>
                  </View>
                  <View style={styles.nutritionCard}>
                    <View style={[styles.nutritionIconContainer, { backgroundColor: '#3498db' }]}>
                      <Ionicons name="leaf" size={16} color="#fff" />
                    </View>
                    <Text style={styles.nutritionValue}>{selectedMeal.carbs}g</Text>
                    <Text style={styles.nutritionLabel}>Carbs</Text>
                  </View>
                  <View style={styles.nutritionCard}>
                    <View style={[styles.nutritionIconContainer, { backgroundColor: '#9b59b6' }]}>
                      <Ionicons name="water" size={16} color="#fff" />
                    </View>
                    <Text style={styles.nutritionValue}>{selectedMeal.fat}g</Text>
                    <Text style={styles.nutritionLabel}>Fat</Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>⏱️ Timing</Text>
                <View style={styles.timingGrid}>
                  {selectedMeal.timings.map((timing, index) => (
                    <View key={index} style={styles.timingCard}>
                      <Ionicons name="time" size={16} color="#008b8b" />
                      <Text style={styles.timingText}>{timing}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>🛒 Ingredients</Text>
                <View style={styles.ingredientsList}>
                  {selectedMeal.ingredients.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientItem}>
                      <View style={styles.ingredientBullet} />
                      <Text style={styles.ingredientText}>{ingredient}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>👨‍🍳 Instructions</Text>
                <View style={styles.instructionsList}>
                  {selectedMeal.instructions.map((instruction, index) => (
                    <View key={index} style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.instructionText}>
                        {instruction.replace(/^\d+\.\s*/, '')}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.modalBottom} />
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 2,
  },
  headerStats: {
    fontSize: 12,
    color: '#7f8c8d',
  },

  // Compact Summary Card - improved design with smooth animations and collapsing
  compactSummaryCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
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
  summaryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryMainInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  dietTypeBadge: {
    backgroundColor: '#008b8b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  dietTypeBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  summaryRecipeCount: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  recipeCountNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#008b8b',
  },
  recipeCountLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  avgNutritionSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  avgSectionTitle: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: 12,
  },
  avgStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avgStatItem: {
    alignItems: 'center',
  },
  avgStatValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '700',
    marginBottom: 2,
  },
  avgStatLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  toggleContainer: {
    paddingHorizontal: 20,
    // paddingVertical is now animated, removed from here
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
  },
  toggleOptionActive: {
    backgroundColor: '#008b8b',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7f8c8d',
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  cardsContainer: {
    paddingHorizontal: 20,
    gap: 16,
    paddingTop: 12,
  },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
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
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayHeaderLeft: {},
  dayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  dayCalories: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  dayProgress: {},
  progressRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#008b8b',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#008b8b',
  },

  macroSection: {
    marginBottom: 16,
  },
  macroBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  macroBarSegment: {
    height: '100%',
  },
  macroLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  macroBold: {
    fontWeight: '600',
    color: '#2c3e50',
  },

  mealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mealGridItem: {
    width: (width - 64) / 2,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealGridType: {
    fontSize: 10,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 4,
  },
  mealGridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
    minHeight: 36,
  },
  mealGridCalories: {
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '600',
  },

  listContainer: {
    paddingHorizontal: 20,
    gap: 8,
    paddingTop: 12,
  },
  listItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  listItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listMealIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listMealInfo: {
    flex: 1,
  },
  listMealType: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
    marginBottom: 2,
  },
  listMealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  listMealMacros: {
    flexDirection: 'row',
    gap: 8,
  },
  listMealMacro: {
    fontSize: 11,
    color: '#7f8c8d',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listMealCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: '#008b8b',
  },
  listMealCaloriesLabel: {
    fontSize: 10,
    color: '#7f8c8d',
  },

  scrollBottom: {
    height: 20,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalMealTypeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modalMealTypeText: {
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '600',
  },
  modalCaloriesDisplay: {
    alignItems: 'flex-end',
  },
  modalCaloriesNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#008b8b',
  },
  modalCaloriesLabel: {
    fontSize: 10,
    color: '#7f8c8d',
  },

  modalContent: {
    flex: 1,
    padding: 20,
  },

  nutritionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  nutritionCards: {
    flexDirection: 'row',
    gap: 12,
  },
  nutritionCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  nutritionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#7f8c8d',
  },

  modalSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  timingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  timingText: {
    fontSize: 14,
    color: '#7f8c8d',
  },

  ingredientsList: {
    gap: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#008b8b',
    marginTop: 8,
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },

  instructionsList: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#008b8b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },

  modalBottom: {
    height: 40,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});
