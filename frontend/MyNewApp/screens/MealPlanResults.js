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
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [parsingError, setParsingError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef();

  // Create smooth animated values for summary card
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

  const summaryHeight = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [200, 100, 0],
    extrapolate: 'clamp',
  });

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
    console.log("=== MEAL PLAN PARSING ===");
    console.log("Raw meal plan length:", mealPlan?.length);
    console.log("Expected:", `${days} days × ${mealsPerDay} meals = ${days * mealsPerDay} total recipes`);
    
    if (!mealPlan || mealPlan.trim().length === 0) {
      setParsingError("No meal plan data received");
      setIsLoading(false);
      return;
    }

    try {
      const parsed = parseMealPlan(mealPlan);
      
      // Validate that we have complete data
      if (parsed.length !== days) {
        throw new Error(`Expected ${days} days, got ${parsed.length}`);
      }
      
      const totalMeals = parsed.reduce((sum, day) => sum + day.meals.length, 0);
      if (totalMeals < days * mealsPerDay * 0.9) { // Allow 10% tolerance
        throw new Error(`Expected ${days * mealsPerDay} meals, got ${totalMeals}`);
      }
      
      setParsedDays(parsed);
      setParsingError(null);
      
    } catch (error) {
      console.error("Parsing failed:", error);
      setParsingError(error.message);
    }
    
    setIsLoading(false);
  }, [mealPlan, days, mealsPerDay]);

  const parseMealPlan = (text) => {
    console.log("🔥 Starting simplified parsing...");
    
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    // Split by day separators
    let dayTexts = [];
    if (cleanedText.includes('=====')) {
      dayTexts = cleanedText.split('=====').filter(text => text.trim());
    } else {
      // Try to split by "Day X" pattern
      const dayPattern = /(?=Day\s+\d+)/gi;
      dayTexts = cleanedText.split(dayPattern).filter(text => text.trim());
    }

    console.log(`Found ${dayTexts.length} day blocks`);

    const parsedDays = [];
    
    for (let i = 0; i < days; i++) {
      const dayText = dayTexts[i] || '';
      const dayNumber = i + 1;
      
      if (!dayText.trim()) {
        throw new Error(`Day ${dayNumber} has no content`);
      }
      
      const dayData = parseDayContent(dayText, dayNumber);
      
      if (dayData.meals.length < mealsPerDay) {
        throw new Error(`Day ${dayNumber} only has ${dayData.meals.length} meals, expected ${mealsPerDay}`);
      }
      
      parsedDays.push(dayData);
    }

    return parsedDays;
  };

  const parseDayContent = (dayText, dayNumber) => {
    const lines = dayText.split('\n').map(line => line.trim()).filter(line => line);
    
    const meals = extractMealsFromLines(lines);
    
    if (meals.length < mealsPerDay) {
      throw new Error(`Day ${dayNumber}: Expected ${mealsPerDay} meals, found ${meals.length}`);
    }

    // Calculate totals
    const totals = meals.slice(0, mealsPerDay).reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      dayNumber: dayNumber,
      title: `Day ${dayNumber}`,
      meals: meals.slice(0, mealsPerDay),
      ...totals
    };
  };

  const extractMealsFromLines = (lines) => {
    const meals = [];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    
    let currentMealType = null;
    let currentMealLines = [];

    for (const line of lines) {
      const foundMealType = mealTypes.find(type =>
        line.toLowerCase().includes(type.toLowerCase()) &&
        line.toLowerCase().indexOf(type.toLowerCase()) < 10
      );

      if (foundMealType) {
        // Process previous meal if exists
        if (currentMealType && currentMealLines.length > 0) {
          const meal = parseIndividualMeal(currentMealLines, currentMealType);
          if (meal) {
            meals.push(meal);
          }
        }
        
        currentMealType = foundMealType;
        currentMealLines = [line];
      } else if (currentMealType) {
        currentMealLines.push(line);
      }
    }

    // Process final meal
    if (currentMealType && currentMealLines.length > 0) {
      const meal = parseIndividualMeal(currentMealLines, currentMealType);
      if (meal) {
        meals.push(meal);
      }
    }

    return meals;
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

    // Find title (usually the first substantive line after meal type)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line &&
          !line.includes(':') &&
          !line.startsWith('•') &&
          !line.startsWith('-') &&
          !line.match(/^\d+\./) &&
          line.length > 3 &&
          !line.match(/\d+\s*(minutes?|hours?)/i)) {
        title = line;
        break;
      }
    }

    // Parse each line for different sections
    let inIngredients = false;
    let inInstructions = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      // Section headers
      if (trimmedLine.toLowerCase().includes('ingredients:')) {
        inIngredients = true;
        inInstructions = false;
        continue;
      }
      if (trimmedLine.toLowerCase().includes('instructions:')) {
        inIngredients = false;
        inInstructions = true;
        continue;
      }
      if (trimmedLine.toLowerCase().includes('nutritional')) {
        inIngredients = false;
        inInstructions = false;
        continue;
      }

      // Parse based on current section
      if (inIngredients && trimmedLine.match(/^[•\-\*]\s/)) {
        const ingredient = trimmedLine.replace(/^[•\-\*]\s*/, '').trim();
        if (ingredient) {
          ingredients.push(ingredient);
        }
      } else if (inInstructions && trimmedLine.match(/^\d+\./)) {
        instructions.push(trimmedLine);
      } else if (trimmedLine.match(/calories?\s*:?\s*(\d+)/i)) {
        const match = trimmedLine.match(/calories?\s*:?\s*(\d+)/i);
        if (match) calories = parseInt(match[1]);
      } else if (trimmedLine.match(/protein\s*:?\s*(\d+)/i)) {
        const match = trimmedLine.match(/protein\s*:?\s*(\d+)/i);
        if (match) protein = parseInt(match[1]);
      } else if (trimmedLine.match(/carbs?\s*:?\s*(\d+)/i)) {
        const match = trimmedLine.match(/carbs?\s*:?\s*(\d+)/i);
        if (match) carbs = parseInt(match[1]);
      } else if (trimmedLine.match(/fat\s*:?\s*(\d+)/i)) {
        const match = trimmedLine.match(/fat\s*:?\s*(\d+)/i);
        if (match) fat = parseInt(match[1]);
      } else if (trimmedLine.match(/(preparation|cooking|prep|cook).*time/i) ||
                 trimmedLine.match(/servings?\s*:/i)) {
        timings.push(trimmedLine);
      }
    }

    // Validate required fields
    if (!title) {
      throw new Error(`${mealType} is missing a title`);
    }
    if (ingredients.length === 0) {
      throw new Error(`${mealType} is missing ingredients`);
    }
    if (instructions.length === 0) {
      throw new Error(`${mealType} is missing instructions`);
    }
    if (calories === 0) {
      throw new Error(`${mealType} is missing calorie information`);
    }

    // Set defaults for missing nutrition info
    if (protein === 0) protein = Math.round(calories * 0.25 / 4);
    if (carbs === 0) carbs = Math.round(calories * 0.45 / 4);
    if (fat === 0) fat = Math.round(calories * 0.30 / 9);

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

  const handleRetry = () => {
    Alert.alert(
      "Regenerate Meal Plan",
      "This will generate a new meal plan with the same settings. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          onPress: () => {
            setRetryCount(prev => prev + 1);
            navigation.goBack();
          }
        }
      ]
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

  // Calculate averages for summary
  const avgCalories = parsedDays.length > 0 ?
    Math.round(parsedDays.reduce((sum, day) => sum + day.calories, 0) / days) : 0;
  const avgProtein = parsedDays.length > 0 ?
    Math.round(parsedDays.reduce((sum, day) => sum + day.protein, 0) / days) : 0;
  const avgCarbs = parsedDays.length > 0 ?
    Math.round(parsedDays.reduce((sum, day) => sum + day.carbs, 0) / days) : 0;
  const avgFat = parsedDays.length > 0 ?
    Math.round(parsedDays.reduce((sum, day) => sum + day.fat, 0) / days) : 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="restaurant" size={48} color="#008b8b" />
          </View>
          <Text style={styles.loadingTitle}>Processing Your Meal Plan</Text>
          <Text style={styles.loadingSubtitle}>Analyzing recipes and nutrition</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (parsingError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={48} color="#e74c3c" />
          </View>
          <Text style={styles.errorTitle}>Meal Plan Incomplete</Text>
          <Text style={styles.errorMessage}>
            The generated meal plan is missing some recipes or has formatting issues.
          </Text>
          <Text style={styles.errorDetails}>{parsingError}</Text>
          
          <View style={styles.errorActions}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Generate New Plan</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>Back to Settings</Text>
            </TouchableOpacity>
          </View>
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
            {days} days • {parsedDays.reduce((sum, day) => sum + day.meals.length, 0)} recipes
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
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        bounces={true}
      >
        {/* Summary Card */}
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

        {/* Controls */}
        <Animated.View
          style={[
            styles.controlsContainer,
            {
              marginTop: controlsMarginTop,
              transform: [{ translateY: controlsTranslateY }]
            }
          ]}
        >
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

      {/* Meal Detail Modal */}
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

  // Error handling styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffeaea',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e74c3c',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  errorDetails: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginBottom: 32,
    fontStyle: 'italic',
  },
  errorActions: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#008b8b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '500',
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

  // Summary Card styles
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

  saveContainer: {},

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
