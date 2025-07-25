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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import SaveMealPlanButton from "../components/SaveMealPlanButton";
import EnhancedGroceryListModal from "../components/EnhancedGroceryListModal";

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
  const [showGroceryList, setShowGroceryList] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef();

  // Animated values
  const controlsMarginTop = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [16, 8, 4],
    extrapolate: 'clamp',
  });

  const controlsTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -8],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    console.log("=== ENHANCED MEAL PLAN PARSING ===");
    console.log("Raw meal plan length:", mealPlan?.length);
    console.log("Expected:", `${days} days × ${mealsPerDay} meals = ${days * mealsPerDay} total recipes`);
    console.log("Target calories per day:", caloriesPerDay);
    
    if (!mealPlan || mealPlan.trim().length < 500) {
      console.error("❌ No meal plan data or too short");
      setIsLoading(false);
      return;
    }

    try {
      const parsed = parseEnhancedMealPlan(mealPlan);
      setParsedDays(parsed);
      setIsLoading(false);
    } catch (error) {
      console.error("❌ Parsing failed:", error);
      setIsLoading(false);
    }
  }, [mealPlan]);

  const parseEnhancedMealPlan = (text) => {
    console.log("🔥 Starting enhanced parsing...");
    
    const cleanedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    
    // Split by days first
    const dayPattern = /Day\s+(\d+)/gi;
    const dayMatches = [...cleanedText.matchAll(dayPattern)];
    
    console.log(`Found ${dayMatches.length} day headers`);
    
    const parsedDays = [];
    
    for (let i = 0; i < days; i++) {
      const dayNumber = i + 1;
      console.log(`\n--- Processing Day ${dayNumber} ---`);
      
      let dayText = '';
      
      if (i < dayMatches.length) {
        const currentDayStart = dayMatches[i].index;
        const nextDayStart = i + 1 < dayMatches.length ? dayMatches[i + 1].index : cleanedText.length;
        dayText = cleanedText.substring(currentDayStart, nextDayStart).trim();
      }
      
      if (!dayText) {
        console.warn(`⚠️ No content for Day ${dayNumber}, creating basic day`);
        parsedDays.push(createBasicDay(dayNumber));
        continue;
      }
      
      const dayData = parseDay(dayText, dayNumber);
      parsedDays.push(dayData);
    }
    
    // If we don't have enough days, create basic ones
    while (parsedDays.length < days) {
      const missingDay = parsedDays.length + 1;
      console.warn(`⚠️ Creating basic day ${missingDay}`);
      parsedDays.push(createBasicDay(missingDay));
    }
    
    console.log(`✅ Parsed ${parsedDays.length} days successfully`);
    
    return parsedDays;
  };

  const parseDay = (dayText, dayNumber) => {
    console.log(`\n=== Parsing Day ${dayNumber} ===`);
    
    // Split by ===== to get individual meals
    const mealBlocks = dayText.split('=====').filter(block => block.trim());
    
    console.log(`Found ${mealBlocks.length} meal blocks for Day ${dayNumber}`);
    
    const meals = [];
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    
    // Process each meal block
    for (let i = 0; i < mealBlocks.length && meals.length < mealsPerDay; i++) {
      const mealBlock = mealBlocks[i].trim();
      if (!mealBlock) continue;
      
      const meal = parseMeal(mealBlock, mealTypes[meals.length] || 'Meal');
      if (meal) {
        meals.push(meal);
        console.log(`✅ Successfully parsed: ${meal.title} (${meal.calories} cal)`);
      }
    }
    
    // If we don't have enough meals, create basic ones
    while (meals.length < mealsPerDay) {
      const mealType = mealTypes[meals.length] || 'Meal';
      console.warn(`⚠️ Creating basic ${mealType} for Day ${dayNumber}`);
      meals.push(createBasicMeal(mealType, meals.length));
    }
    
    // Calculate totals
    const totals = meals.reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    console.log(`✅ Day ${dayNumber} complete: ${meals.length} meals, ${totals.calories} calories`);

    return {
      dayNumber,
      title: `Day ${dayNumber}`,
      meals: meals.slice(0, mealsPerDay),
      ...totals
    };
  };

  const parseMeal = (mealBlock, expectedMealType) => {
    const lines = mealBlock.split('\n').map(line => line.trim()).filter(line => line);
    
    let mealType = expectedMealType;
    let title = '';
    let ingredients = [];
    let instructions = [];
    let timings = [];
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    console.log(`\nParsing meal block for ${expectedMealType}:`);

    // Find meal type in the first few lines
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const foundType = mealTypes.find(type =>
        lines[i].toLowerCase().includes(type.toLowerCase())
      );
      if (foundType) {
        mealType = foundType;
        console.log(`✅ Found meal type: ${mealType}`);
        break;
      }
    }

    // ENHANCED TITLE EXTRACTION
    let titleFound = false;
    for (let i = 0; i < lines.length && !titleFound; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Skip meal type headers, day headers, timing info, nutrition info, ingredients, instructions, separators
      if (mealTypes.some(type => lowerLine.includes(type.toLowerCase())) ||
          lowerLine.match(/^day\s+\d+/i) ||
          lowerLine.includes('preparation') || lowerLine.includes('cooking') || lowerLine.includes('servings') ||
          lowerLine.includes('prep:') || lowerLine.includes('cook:') ||
          lowerLine.match(/\d+\s*minutes?\b/i) || lowerLine.match(/\d+\s*hours?\b/i) ||
          lowerLine.includes('calories') || lowerLine.includes('protein') || lowerLine.includes('carbs') ||
          lowerLine.includes('fat') || lowerLine.includes('nutritional') ||
          line.match(/\d+g\b/) || line.match(/\d+\s*mg\b/) ||
          line.startsWith('•') || line.match(/^\d+\./) ||
          lowerLine.includes('ingredients') || lowerLine.includes('instructions') ||
          line === '=====' || line === '-----' || line.length < 3) {
        continue;
      }
      
      // This should be our title!
      if (line.length >= 3) {
        title = line;
        titleFound = true;
        console.log(`✅ Found title: "${title}"`);
        break;
      }
    }

    // If no title found, create one based on meal type
    if (!title || title.length < 3) {
      console.log(`⚠️ No title found, creating fallback title`);
      const adjectives = ['Delicious', 'Healthy', 'Fresh', 'Nutritious', 'Tasty', 'Hearty', 'Satisfying'];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      title = `${randomAdj} ${mealType} Bowl`;
    }

    // Parse ingredients (lines starting with •)
    for (const line of lines) {
      if (line.startsWith('•')) {
        const ingredient = line.substring(1).trim();
        if (ingredient && ingredient.length > 1) {
          ingredients.push(ingredient);
        }
      }
    }

    // Parse instructions (numbered lines)
    for (const line of lines) {
      if (line.match(/^\d+\./)) {
        instructions.push(line);
      }
    }

    // ENHANCED NUTRITION PARSING
    let nutritionLines = [];
    
    // First, look for dedicated nutrition section
    for (let i = 0; i < lines.length; i++) {
      const lowerLine = lines[i].toLowerCase();
      
      if (lowerLine.includes('nutritional information') ||
          lowerLine.includes('nutrition facts') ||
          lowerLine.includes('nutrition:') ||
          (lowerLine.includes('calories') && lowerLine.includes(':'))) {
        
        // Collect this line and next few lines for nutrition parsing
        for (let j = i; j < Math.min(i + 8, lines.length); j++) {
          const nutritionLine = lines[j];
          if (nutritionLine.trim()) {
            nutritionLines.push(nutritionLine);
          }
        }
        break;
      }
    }
    
    // If no dedicated section found, scan all lines for nutrition info
    if (nutritionLines.length === 0) {
      nutritionLines = lines.filter(line => {
        const lower = line.toLowerCase();
        return lower.includes('calories') || lower.includes('protein') ||
               lower.includes('carbs') || lower.includes('fat') ||
               lower.match(/\d+g\b/) || lower.match(/\d+\s*cal/);
      });
    }
    
    // Parse nutrition from collected lines
    for (const line of nutritionLines) {
      const lowerLine = line.toLowerCase();
      
      // Enhanced calorie parsing
      if (!calories && (lowerLine.includes('calories') || lowerLine.includes('cal'))) {
        const caloriePatterns = [
          /calories?\s*:?\s*(\d+)/i,
          /(\d+)\s*calories?/i,
          /cal\s*:?\s*(\d+)/i,
          /(\d+)\s*cal\b/i,
          /(\d+)\s*kcal/i,
          /energy\s*:?\s*(\d+)/i
        ];
        
        for (const pattern of caloriePatterns) {
          const match = line.match(pattern);
          if (match) {
            const extractedCals = parseInt(match[1]);
            if (extractedCals >= 50 && extractedCals <= 2000) {
              calories = extractedCals;
              console.log(`✅ Found calories: ${calories}`);
              break;
            }
          }
        }
      }
      
      // Enhanced protein parsing
      if (!protein && lowerLine.includes('protein')) {
        const proteinPatterns = [
          /protein\s*:?\s*(\d+)g?/i,
          /(\d+)g?\s*protein/i,
          /prot\s*:?\s*(\d+)/i
        ];
        
        for (const pattern of proteinPatterns) {
          const match = line.match(pattern);
          if (match) {
            const extractedProtein = parseInt(match[1]);
            if (extractedProtein >= 0 && extractedProtein <= 200) {
              protein = extractedProtein;
              console.log(`✅ Found protein: ${protein}g`);
              break;
            }
          }
        }
      }
      
      // Enhanced carbs parsing
      if (!carbs && (lowerLine.includes('carbs') || lowerLine.includes('carbohydrates'))) {
        const carbPatterns = [
          /carbs?\s*:?\s*(\d+)g?/i,
          /carbohydrates?\s*:?\s*(\d+)g?/i,
          /(\d+)g?\s*carbs?/i,
          /(\d+)g?\s*carbohydrates?/i
        ];
        
        for (const pattern of carbPatterns) {
          const match = line.match(pattern);
          if (match) {
            const extractedCarbs = parseInt(match[1]);
            if (extractedCarbs >= 0 && extractedCarbs <= 500) {
              carbs = extractedCarbs;
              console.log(`✅ Found carbs: ${carbs}g`);
              break;
            }
          }
        }
      }
      
      // Enhanced fat parsing
      if (!fat && lowerLine.includes('fat') && !lowerLine.includes('fatigue')) {
        const fatPatterns = [
          /fat\s*:?\s*(\d+)g?/i,
          /(\d+)g?\s*fat\b/i,
          /fats?\s*:?\s*(\d+)/i
        ];
        
        for (const pattern of fatPatterns) {
          const match = line.match(pattern);
          if (match) {
            const extractedFat = parseInt(match[1]);
            if (extractedFat >= 0 && extractedFat <= 200) {
              fat = extractedFat;
              console.log(`✅ Found fat: ${fat}g`);
              break;
            }
          }
        }
      }
    }

    // Parse timing info
    for (const line of lines) {
      if (line.toLowerCase().includes('preparation') ||
          line.toLowerCase().includes('cooking') ||
          line.toLowerCase().includes('servings') ||
          line.toLowerCase().includes('prep:') ||
          line.toLowerCase().includes('cook:')) {
        timings.push(line);
      }
    }

    // Set defaults if missing
    if (ingredients.length === 0) {
      ingredients = [
        'Fresh, high-quality ingredients',
        'Seasonings and spices to taste',
        'Additional ingredients as needed'
      ];
    }

    if (instructions.length === 0) {
      instructions = [
        '1. Prepare all ingredients according to recipe',
        '2. Cook using appropriate methods',
        '3. Season and serve as desired'
      ];
    }

    if (timings.length === 0) {
      timings = ['Prep: 15 min', 'Cook: 20 min', 'Servings: 1'];
    }

    // REALISTIC FALLBACK CALCULATION based on meal type
    if (!calories) {
      const mealCalorieEstimates = {
        'Breakfast': Math.round(caloriesPerDay * 0.25),  // 25% of daily
        'Lunch': Math.round(caloriesPerDay * 0.35),      // 35% of daily
        'Dinner': Math.round(caloriesPerDay * 0.35),     // 35% of daily
        'Snack': Math.round(caloriesPerDay * 0.10)       // 10% of daily
      };
      calories = mealCalorieEstimates[mealType] || Math.round(caloriesPerDay / mealsPerDay);
      console.log(`⚠️ No calories found, estimated ${calories} for ${mealType}`);
    }

    // Calculate realistic macros if missing
    if (!protein) {
      protein = Math.round(calories * 0.25 / 4); // 25% of calories from protein
    }
    
    if (!carbs) {
      carbs = Math.round(calories * 0.45 / 4); // 45% of calories from carbs
    }
    
    if (!fat) {
      fat = Math.round(calories * 0.30 / 9); // 30% of calories from fat
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

  const createBasicDay = (dayNumber) => {
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'].slice(0, mealsPerDay);
    const meals = mealTypes.map((type, index) => createBasicMeal(type, index));
    
    const totals = meals.reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      dayNumber,
      title: `Day ${dayNumber}`,
      meals,
      ...totals
    };
  };

  const createBasicMeal = (mealType, mealIndex = 0) => {
    // Use realistic calorie distribution instead of equal division
    const mealCalorieDistribution = {
      'Breakfast': Math.round(caloriesPerDay * 0.25),  // 25%
      'Lunch': Math.round(caloriesPerDay * 0.35),      // 35%
      'Dinner': Math.round(caloriesPerDay * 0.35),     // 35%
      'Snack': Math.round(caloriesPerDay * 0.10)       // 10%
    };
    
    const targetCalories = mealCalorieDistribution[mealType] || Math.round(caloriesPerDay / mealsPerDay);
    
    const mealTitles = {
      'Breakfast': ['Protein Power Bowl', 'Morning Energy Plate', 'Sunrise Special', 'Healthy Breakfast Bowl'],
      'Lunch': ['Balanced Midday Plate', 'Power Lunch Bowl', 'Afternoon Fuel', 'Nutritious Lunch'],
      'Dinner': ['Evening Comfort Meal', 'Dinner Delight', 'Sunset Feast', 'Hearty Dinner'],
      'Snack': ['Energy Boost', 'Quick Bite', 'Healthy Snack', 'Power Snack']
    };

    const titles = mealTitles[mealType] || ['Healthy Meal'];
    const randomTitle = titles[Math.floor(Math.random() * titles.length)];

    return {
      mealType,
      title: randomTitle,
      ingredients: [
        'High-quality protein source (portioned for target calories)',
        'Fresh seasonal vegetables',
        'Healthy whole grains',
        'Nutritious fats and oils'
      ],
      instructions: [
        '1. Prepare all ingredients according to preferences',
        '2. Cook using healthy cooking methods',
        '3. Season with herbs and spices to taste'
      ],
      timings: ['Prep: 15 min', 'Cook: 20 min', 'Servings: 1'],
      calories: targetCalories,
      protein: Math.round(targetCalories * 0.25 / 4),
      carbs: Math.round(targetCalories * 0.45 / 4),
      fat: Math.round(targetCalories * 0.30 / 9)
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

  const handleGroceryListPress = () => {
    setShowGroceryList(true);
  };

  const handleShare = async () => {
    try {
      const planLength = days === 1 ? 'Day' : `${days}-Day`;
      const shareText = `My ${planLength} Meal Plan\n\n` +
        parsedDays.map(day =>
          `${day.title}: ${day.calories} calories\n` +
          day.meals.map(meal => `• ${meal.title} (${meal.calories} cal)`).join('\n')
        ).join('\n\n');
      
      await Share.share({ message: shareText });
    } catch (error) {
      console.error("Share failed:", error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Ionicons name="restaurant" size={48} color="#008b8b" />
          </View>
          <Text style={styles.loadingTitle}>Crafting Your Perfect Plan</Text>
          <Text style={styles.loadingSubtitle}>Analyzing nutrition • Optimizing flavors</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#008b8b" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Your Meal Plan</Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#008b8b" />
          </TouchableOpacity>
        </View>
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
          {/* View Toggle */}
          <View style={styles.viewToggleContainer}>
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'cards' && styles.toggleButtonActive]}
                onPress={() => setViewMode('cards')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="grid-outline"
                  size={16}
                  color={viewMode === 'cards' ? '#ffffff' : '#6b7280'}
                />
                <Text style={[styles.toggleButtonText, viewMode === 'cards' && styles.toggleButtonTextActive]}>
                  Cards
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
                onPress={() => setViewMode('list')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="list-outline"
                  size={16}
                  color={viewMode === 'list' ? '#ffffff' : '#6b7280'}
                />
                <Text style={[styles.toggleButtonText, viewMode === 'list' && styles.toggleButtonTextActive]}>
                  List
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.saveButtonContainer}>
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

        {/* Prominent Grocery List Button */}
        <View style={styles.groceryButtonContainer}>
          <TouchableOpacity
            style={styles.prominentGroceryButton}
            onPress={handleGroceryListPress}
            activeOpacity={0.8}
          >
            <View style={styles.groceryButtonContent}>
              <View style={styles.groceryButtonLeft}>
                <View style={styles.groceryButtonIcon}>
                  <Ionicons name="basket" size={24} color="#ffffff" />
                </View>
                <View style={styles.groceryButtonText}>
                  <Text style={styles.groceryButtonTitle}>Generate Grocery List</Text>
                  <Text style={styles.groceryButtonSubtitle}>Get shopping list with cost estimates</Text>
                </View>
              </View>
              <View style={styles.groceryButtonArrow}>
                <Ionicons name="chevron-forward" size={20} color="#ffffff" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

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
                  {/* Simple calorie display instead of percentage */}
                  <View style={styles.dayCaloriesOnly}>
                    <Text style={styles.dayCaloriesNumber}>{day.calories}</Text>
                    <Text style={styles.dayCaloriesLabel}>cal</Text>
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

                {/* Meal cards */}
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

      {/* Enhanced Grocery List Modal */}
      <EnhancedGroceryListModal
        visible={showGroceryList}
        onClose={() => setShowGroceryList(false)}
        mealPlan={mealPlan}
        days={days}
        mealsPerDay={mealsPerDay}
        caloriesPerDay={caloriesPerDay}
        mealPlanId={null} // No meal plan ID for new plans
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    paddingBottom: 40,
  },

  controlsContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  viewToggleContainer: {},
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  toggleButtonActive: {
    backgroundColor: '#1e293b',
  },
  toggleButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },

  saveButtonContainer: {},

  // Grocery List Button
  groceryButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  prominentGroceryButton: {
    backgroundColor: '#008b8b',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  groceryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groceryButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groceryButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  groceryButtonText: {
    flex: 1,
  },
  groceryButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  groceryButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  groceryButtonArrow: {
    marginLeft: 12,
  },

  cardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dayHeaderLeft: {},
  dayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  dayCalories: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  
  // Simple calorie display (no percentage)
  dayCaloriesOnly: {
    alignItems: 'flex-end',
  },
  dayCaloriesNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#008b8b',
  },
  dayCaloriesLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },

  macroSection: {
    marginBottom: 20,
  },
  macroBar: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#f1f5f9',
  },
  macroBarSegment: {
    height: '100%',
  },
  macroLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  macroBold: {
    fontWeight: '600',
    color: '#1e293b',
  },

  mealsContainer: {
    gap: 8,
  },
  mealCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mealCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
    lineHeight: 18,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: 8,
  },
  mealMacro: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  mealCardRight: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    fontSize: 15,
    fontWeight: '600',
    color: '#008b8b',
  },
  mealCaloriesLabel: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 2,
    fontWeight: '500',
  },

  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 6,
  },
  listItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
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
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  listMealInfo: {
    flex: 1,
  },
  listMealType: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listMealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 3,
  },
  listMealMacros: {
    flexDirection: 'row',
    gap: 6,
  },
  listMealMacro: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  listItemRight: {
    alignItems: 'flex-end',
  },
  listMealCalories: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008b8b',
  },
  listMealCaloriesLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
  },

  scrollBottom: {
    height: 20,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
