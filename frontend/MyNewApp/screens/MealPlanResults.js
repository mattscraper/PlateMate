import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  StatusBar,
  Modal,
  Dimensions,
  Animated,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import SaveMealPlanButton from "../components/SaveMealPlanButton";

const { width } = Dimensions.get('window');

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
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [parsingStats, setParsingStats] = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef();

  const MAX_RETRIES = 3;

  // Create smooth animated values for summary card with proper easing
  const summaryOpacity = scrollY.interpolate({
    inputRange: [0, 40, 100],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });

  const summaryTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  const summaryScale = scrollY.interpolate({
    inputRange: [0, 40, 100],
    outputRange: [1, 0.96, 0.92],
    extrapolate: 'clamp',
  });

  // Animated height for collapsing the summary card
  const summaryHeight = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [200, 100, 0],
    extrapolate: 'clamp',
  });

  // Controls spacing for smooth layout transitions
  const controlsMarginTop = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [16, 8, 0],
    extrapolate: 'clamp',
  });

  const controlsTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -16],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    console.log("=== MEAL PLAN PARSING WITH RETRY MECHANISM ===");
    console.log("Raw meal plan length:", mealPlan?.length);
    console.log("Expected:", `${days} days × ${mealsPerDay} meals = ${days * mealsPerDay} total recipes`);
    
    const parsed = bulletproofParseMealPlan(mealPlan);
    
    // Check if parsing was successful
    if (!parsed.stats.success && retryCount < MAX_RETRIES) {
      console.log(`❌ Parsing failed, initiating retry ${retryCount + 1}/${MAX_RETRIES}`);
      retryMealPlanGeneration();
    } else if (!parsed.stats.success && retryCount >= MAX_RETRIES) {
      console.log("❌ Max retries reached, showing error to user");
      showRetryFailedAlert();
    } else {
      console.log("✅ Parsing successful");
      setParsedDays(parsed.days);
      setParsingStats(parsed.stats);
      setIsLoading(false);
    }
  }, [mealPlan, retryCount]);

  const retryMealPlanGeneration = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      console.log("🔄 Calling backend to regenerate meal plan...");
      
      // Use your existing fetchMealPlans function with retry flag
      const { fetchMealPlans } = await import('../utils/api');
      
      const newMealPlan = await fetchMealPlans(
        days,
        mealsPerDay,
        healthy,
        allergies,
        [dietType],
        caloriesPerDay,
        true // isRetry = true
      );
      
      if (newMealPlan) {
        console.log("✅ Successfully received new meal plan from backend");
        
        // Parse the new meal plan
        const parsed = bulletproofParseMealPlan(newMealPlan);
        
        if (parsed.stats.success) {
          console.log("✅ New meal plan parsed successfully");
          setParsedDays(parsed.days);
          setParsingStats(parsed.stats);
          setIsLoading(false);
          setIsRetrying(false);
        } else {
          console.log("❌ New meal plan also failed to parse, will retry again");
          setIsRetrying(false);
          // The useEffect will trigger another retry
        }
      } else {
        throw new Error('Backend did not return a valid meal plan');
      }
    } catch (error) {
      console.error("❌ Error during retry:", error);
      setIsRetrying(false);
      
      if (retryCount >= MAX_RETRIES - 1) {
        showRetryFailedAlert();
      }
      // If not max retries, the useEffect will trigger another retry
    }
  };

  const showRetryFailedAlert = () => {
    Alert.alert(
      "Unable to Generate Meal Plan",
      "We're having trouble generating your complete meal plan. Please try again or adjust your preferences.",
      [
        {
          text: "Try Again",
          onPress: () => {
            setRetryCount(0);
            setIsLoading(true);
            // This will trigger the useEffect again
            const parsed = bulletproofParseMealPlan(mealPlan);
            if (!parsed.stats.success) {
              retryMealPlanGeneration();
            }
          }
        },
        {
          text: "Go Back",
          onPress: () => navigation.goBack(),
          style: "cancel"
        }
      ]
    );
  };

  const bulletproofParseMealPlan = (text) => {
    if (!text || text.trim().length === 0) {
      console.log("❌ No meal plan text provided");
      return {
        days: [],
        stats: { found: 0, expected: days * mealsPerDay, success: false, reason: 'no_text' }
      };
    }

    try {
      console.log("\n🔥 Starting BULLETPROOF parsing...");
      
      const cleanedText = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

      let dayTexts = [];
      
      // Try different separation methods
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

      console.log(`🔥 Found ${dayTexts.length} day blocks using separation`);

      const parsedDays = [];
      const allMeals = [];
      
      for (let i = 0; i < Math.max(dayTexts.length, days); i++) {
        const dayText = dayTexts[i] || '';
        const dayNumber = i + 1;
        
        if (dayNumber > days) break;
        
        const dayData = parseDayContentRobust(dayText, dayNumber);
        
        // Check if this day has meaningful content
        const hasRealContent = dayData.meals.some(meal =>
          meal.title &&
          meal.title.length > 10 &&
          !meal.title.includes('Fallback') &&
          !meal.title.includes('Delicious') &&
          !meal.title.includes('Healthy') &&
          !meal.title.includes('Fresh') &&
          !meal.title.includes('Nutritious') &&
          meal.ingredients.length > 0 &&
          meal.instructions.length > 0 &&
          meal.ingredients.some(ing => !ing.includes('Premium quality') && !ing.includes('Fresh vegetables'))
        );

        if (!hasRealContent) {
          console.log(`❌ Day ${dayNumber} has no real content, marking as failed`);
          return {
            days: [],
            stats: { found: 0, expected: days * mealsPerDay, success: false, reason: 'no_real_content' }
          };
        }
        
        parsedDays.push(dayData);
        allMeals.push(...dayData.meals);
      }

      // Check if we have enough days
      if (parsedDays.length < days) {
        console.log(`❌ Only found ${parsedDays.length} days, expected ${days}`);
        return {
          days: [],
          stats: { found: parsedDays.length, expected: days, success: false, reason: 'insufficient_days' }
        };
      }

      // Check if we have enough meals with real content
      const realMealsCount = allMeals.filter(meal =>
        meal.title &&
        meal.title.length > 10 &&
        !meal.title.includes('Fallback') &&
        !meal.title.includes('Delicious') &&
        !meal.title.includes('Healthy') &&
        !meal.title.includes('Fresh') &&
        !meal.title.includes('Nutritious')
      ).length;

      const requiredMeals = days * mealsPerDay;
      const successThreshold = Math.floor(requiredMeals * 0.9); // At least 90% real meals

      console.log(`📊 Real meals: ${realMealsCount}/${requiredMeals} (threshold: ${successThreshold})`);

      if (realMealsCount < successThreshold) {
        console.log(`❌ Not enough real meals: ${realMealsCount} < ${successThreshold}`);
        return {
          days: [],
          stats: {
            found: realMealsCount,
            expected: requiredMeals,
            success: false,
            reason: 'insufficient_real_meals'
          }
        };
      }

      const stats = {
        found: allMeals.length,
        expected: requiredMeals,
        realMeals: realMealsCount,
        strategy: 'bulletproof',
        success: true
      };

      console.log(`🔥 BULLETPROOF Results: ${stats.found}/${stats.expected} meals parsed (${stats.realMeals} real)`);

      return { days: parsedDays, stats };

    } catch (error) {
      console.error("❌ Bulletproof parsing failed:", error);
      return {
        days: [],
        stats: { found: 0, expected: days * mealsPerDay, success: false, error: error.message }
      };
    }
  };

  const parseDayContentRobust = (dayText, dayNumber) => {
    const lines = dayText.split('\n').map(line => line.trim()).filter(line => line);
    
    const extractedMeals = extractMealsFromLinesRobust(lines);
    const orderedMeals = ensureProperMealOrderRobust(extractedMeals);
    
    // Only add missing meals if we have some real content
    const hasRealMeals = orderedMeals.some(meal =>
      meal.title &&
      meal.title.length > 10 &&
      !meal.title.includes('Fallback')
    );

    if (!hasRealMeals) {
      // Return empty meals to trigger retry
      return {
        dayNumber: dayNumber,
        title: `Day ${dayNumber}`,
        meals: [],
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      };
    }

    // Only fill to required count if we have real meals
    while (orderedMeals.length < mealsPerDay) {
      const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
      const missingMealType = mealTypes[orderedMeals.length] || 'Meal';
      orderedMeals.push(generateFallbackMeal(missingMealType));
    }

    const totals = orderedMeals.slice(0, mealsPerDay).reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      dayNumber: dayNumber,
      title: `Day ${dayNumber}`,
      meals: orderedMeals.slice(0, mealsPerDay),
      ...totals
    };
  };

  const extractMealsFromLinesRobust = (lines) => {
    const meals = [];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    
    let currentMealType = null;
    let currentMealLines = [];

    for (const line of lines) {
      const foundMealType = mealTypes.find(type =>
        line.toLowerCase().includes(type.toLowerCase()) &&
        (line.toLowerCase().indexOf(type.toLowerCase()) < 5 || line.toLowerCase().startsWith(type.toLowerCase()))
      );

      if (foundMealType) {
        if (currentMealType && currentMealLines.length > 0) {
          meals.push(parseIndividualMealRobust(currentMealLines, currentMealType));
        }
        
        currentMealType = foundMealType;
        currentMealLines = [line];
      } else if (currentMealType) {
        currentMealLines.push(line);
      }
    }

    if (currentMealType && currentMealLines.length > 0) {
      meals.push(parseIndividualMealRobust(currentMealLines, currentMealType));
    }

    return meals;
  };

  const ensureProperMealOrderRobust = (meals) => {
    const mealOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const orderedMeals = [];
    
    for (const mealType of mealOrder) {
      const meal = meals.find(m => m.mealType === mealType);
      if (meal) {
        orderedMeals.push(meal);
      }
    }
    
    return orderedMeals;
  };

  const parseIndividualMealRobust = (lines, mealType) => {
    let title = '';
    let ingredients = [];
    let instructions = [];
    let timings = [];
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    // Extract title more carefully
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
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
      
      if (line.length >= 3 && !line.endsWith(':')) {
        title = line.replace(/[^\w\s\-'&(),.]/g, '').trim();
        
        // Don't accept titles that look like ingredients
        if (!title.match(/\d+\s*(cup|tbsp|tsp|lb|oz|gram|ml|liter)/i)) {
          break;
        }
      }
    }

    // Parse nutritional information and other details
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine === title) continue;

      // Extract calories
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
      
      // Extract protein
      if (trimmedLine.toLowerCase().includes('protein') && protein === 0) {
        const match = trimmedLine.match(/(\d+)/);
        if (match) {
          protein = parseInt(match[1]);
        }
      }
      
      // Extract carbs
      if (trimmedLine.toLowerCase().includes('carb') && carbs === 0) {
        const match = trimmedLine.match(/(\d+)/);
        if (match) {
          carbs = parseInt(match[1]);
        }
      }
      
      // Extract fat
      if (trimmedLine.toLowerCase().includes('fat') && fat === 0) {
        const match = trimmedLine.match(/(\d+)/);
        if (match) {
          fat = parseInt(match[1]);
        }
      }

      // Extract timing information
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
      // Extract ingredients
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
      // Extract instructions
      else if (trimmedLine.match(/^\d+\./)) {
        instructions.push(trimmedLine);
      }
    }

    // Set default nutritional values if not found
    if (calories === 0) {
      calories = Math.round(caloriesPerDay / mealsPerDay);
    }
    if (protein === 0) protein = Math.round(calories * 0.25 / 4);
    if (carbs === 0) carbs = Math.round(calories * 0.45 / 4);
    if (fat === 0) fat = Math.round(calories * 0.30 / 9);

    return {
      mealType,
      title: title || `${mealType} Recipe`,
      ingredients,
      instructions,
      timings: timings.length > 0 ? timings : ['Prep: 15 min', 'Cook: 20 min'],
      calories,
      protein,
      carbs,
      fat
    };
  };

  const generateFallbackMeal = (mealType) => {
    const avgCals = Math.round(caloriesPerDay / mealsPerDay);
    
    return {
      mealType,
      title: `${mealType} Recipe`,
      ingredients: ['Recipe ingredients will be provided'],
      instructions: ['1. Recipe instructions will be provided'],
      timings: ['Prep: 15 min', 'Cook: 20 min'],
      calories: avgCals,
      protein: Math.round(avgCals * 0.25 / 4),
      carbs: Math.round(avgCals * 0.45 / 4),
      fat: Math.round(avgCals * 0.30 / 9)
    };
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
  const avgCalories = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.calories, 0) / days) : 0;
  const avgProtein = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.protein, 0) / days) : 0;
  const avgCarbs = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.carbs, 0) / days) : 0;
  const avgFat = parsedDays.length > 0 ? Math.round(parsedDays.reduce((sum, day) => sum + day.fat, 0) / days) : 0;

  if (isLoading || isRetrying) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="restaurant" size={48} color="#008b8b" />
          </View>
          <Text style={styles.loadingTitle}>
            {isRetrying ? `Regenerating Plan (${retryCount}/${MAX_RETRIES})` : 'Crafting Your Perfect Plan'}
          </Text>
          <Text style={styles.loadingSubtitle}>
            {isRetrying ? 'Ensuring quality recipes • Please wait' : 'Analyzing nutrition • Optimizing flavors'}
          </Text>
          {isRetrying && (
            <View style={styles.retryIndicator}>
              <Text style={styles.retryText}>
                Previous attempt didn't meet our quality standards, trying again...
              </Text>
            </View>
          )}
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
          <Text style={styles.headerTitle}>Your Meal Plan</Text>
          <Text style={styles.headerStats}>
            {days} days
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#008b8b" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
          }
        )}
        scrollEventThrottle={16}
        bounces={true}
      >
        {/* Summary Card that smoothly disappears */}
        <Animated.View
          style={[
            styles.compactSummaryCard,
            {
              opacity: summaryOpacity,
              height: summaryHeight,
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

        {/* Controls that smoothly move up */}
        <Animated.View
          style={[
            styles.controlsContainer,
            {
              marginTop: controlsMarginTop,
              transform: [{ translateY: controlsTranslateY }]
            }
          ]}
        >
          {/* Toggle Container */}
          <View style={styles.toggleContainer}>
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
          </View>

          {/* Save Button */}
          <View style={styles.saveContainer}>
            <SaveMealPlanButton
              mealPlan={mealPlan}
              days={days}
              mealsPerDay={mealsPerDay}
              caloriesPerDay={caloriesPerDay}
              allergies={allergies}
              healthy={healthy}
              dietType={dietType}
              onSaved={() => console.log("Plan saved")}
              onLoginRequired={() => navigation.navigate("LandingPage")}
            />
          </View>
        </Animated.View>

        {/* Content */}
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

                {/* Full-width meal cards */}
                <View style={styles.mealsContainer}>
                  {day.meals.map((meal, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.mealCard}
                      onPress={() => setSelectedMeal(meal)}
                    >
                      <View style={styles.mealCardLeft}>
                        <View style={[styles.mealIcon, { backgroundColor: getMealTypeColor(meal.mealType) }]}>
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
                        <View style={styles.mealInfo}>
                          <Text style={styles.mealType}>{meal.mealType}</Text>
                          <Text style={styles.mealTitle} numberOfLines={2}>{meal.title}</Text>
                          <View style={styles.mealMacros}>
                            <Text style={styles.mealMacro}>{meal.protein}g P</Text>
                            <Text style={styles.mealMacro}>{meal.carbs}g C</Text>
                            <Text style={styles.mealMacro}>{meal.fat}g F</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.mealCardRight}>
                        <Text style={styles.mealCalories}>{meal.calories}</Text>
                        <Text style={styles.mealCaloriesLabel}>cal</Text>
                        <Ionicons name="chevron-forward" size={16} color="#bbb" />
                      </View>
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
  retryIndicator: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  retryText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
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

  scrollContent: {
    paddingBottom: 40,
  },

  // Improved Summary Card with better animations
  compactSummaryCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
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

  // Controls container that moves smoothly
  controlsContainer: {
    paddingHorizontal: 20,
  },

  toggleContainer: {
    marginBottom: 16,
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

  saveContainer: {
    // No additional margin needed
  },

  cardsContainer: {
    paddingHorizontal: 20,
    gap: 16,
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
    marginBottom: 20,
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

  // Full-width meal cards
  mealsContainer: {
    gap: 12,
  },
  mealCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  mealCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 4,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
    lineHeight: 20,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: 12,
  },
  mealMacro: {
    fontSize: 11,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  mealCardRight: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    fontSize: 18,
    fontWeight: '700',
    color: '#008b8b',
  },
  mealCaloriesLabel: {
    fontSize: 10,
    color: '#7f8c8d',
    marginBottom: 4,
  },

  listContainer: {
    paddingHorizontal: 20,
    gap: 8,
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
});
