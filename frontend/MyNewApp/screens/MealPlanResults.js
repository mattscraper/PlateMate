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
  Modal,
  Animated,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import SaveMealPlanButton from "../components/SaveMealPlanButton";

const { width: screenWidth } = Dimensions.get('window');

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
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
  const [selectedDayModal, setSelectedDayModal] = useState(null);
  const [selectedMealModal, setSelectedMealModal] = useState(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const parsedData = parseMealPlanRobust(mealPlan);
    setParsedDays(parsedData);
    setIsLoading(false);
  }, [mealPlan]);

  // ENHANCED PARSING TO USE AI-PROVIDED NUTRITION DATA
  const parseMealPlanRobust = (mealPlanText) => {
    if (!mealPlanText || typeof mealPlanText !== "string") {
      console.warn("Invalid meal plan text");
      return generateFallbackMealPlan();
    }

    console.log("=== RAW MEAL PLAN FROM AI ===");
    console.log(mealPlanText.substring(0, 500) + "...");

    try {
      const cleanedText = mealPlanText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

      // Split by day separators - prioritize ===== separators from AI
      let dayTexts = [];
      
      if (cleanedText.includes('=====')) {
        dayTexts = cleanedText.split('=====').filter(text => text.trim());
        console.log(`Found ${dayTexts.length} days using ===== separator`);
      } else {
        const dayPattern = /(?=Day\s+\d+)/gi;
        dayTexts = cleanedText.split(dayPattern).filter(text => text.trim());
        console.log(`Found ${dayTexts.length} days using Day pattern`);
      }
      
      if (dayTexts.length < days) {
        // Fallback splitting method
        dayTexts = cleanedText.split(/\n\s*\n/).filter(text => text.trim());
        console.log(`Fallback: Found ${dayTexts.length} sections`);
      }

      const parsedDays = [];
      
      for (let i = 0; i < Math.max(dayTexts.length, days); i++) {
        const dayText = dayTexts[i] || '';
        const dayNumber = i + 1;
        
        if (dayNumber > days) break;
        
        console.log(`=== PARSING DAY ${dayNumber} ===`);
        console.log(dayText.substring(0, 200) + "...");
        
        const dayData = parseDayContent(dayText, dayNumber);
        parsedDays.push(dayData);
      }

      // Only add fallback days if we have fewer than expected
      while (parsedDays.length < days) {
        const missingDay = parsedDays.length + 1;
        console.warn(`Adding fallback day ${missingDay}`);
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
    
    const extractedMeals = extractMealsFromLines(lines);
    const orderedMeals = ensureProperMealOrder(extractedMeals);
    
    while (orderedMeals.length < mealsPerDay) {
      const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
      const missingMealType = mealTypes[orderedMeals.length] || 'Meal';
      orderedMeals.push(generateFallbackMeal(missingMealType, orderedMeals.length + 1));
    }

    // Calculate day totals from actual meal macros
    const dayTotals = calculateDayTotals(orderedMeals.slice(0, mealsPerDay));

    return {
      title: `Day ${dayNumber}`,
      dayNumber: dayNumber,
      meals: orderedMeals.slice(0, mealsPerDay),
      totalCalories: dayTotals.calories,
      totalProtein: dayTotals.protein,
      totalCarbs: dayTotals.carbs,
      totalFat: dayTotals.fat
    };
  };

  const calculateDayTotals = (meals) => {
    return meals.reduce((totals, meal) => {
      const nutrition = meal.nutritionData || {};
      return {
        calories: totals.calories + (nutrition.calories || 0),
        protein: totals.protein + (nutrition.protein || 0),
        carbs: totals.carbs + (nutrition.carbs || 0),
        fat: totals.fat + (nutrition.fat || 0)
      };
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  const extractMealsFromLines = (lines) => {
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
          meals.push(parseIndividualMeal(currentMealLines, currentMealType));
        }
        
        currentMealType = foundMealType;
        currentMealLines = [line];
      } else if (currentMealType) {
        currentMealLines.push(line);
      }
    }

    if (currentMealType && currentMealLines.length > 0) {
      meals.push(parseIndividualMeal(currentMealLines, currentMealType));
    }

    return meals;
  };

  const ensureProperMealOrder = (meals) => {
    const mealOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const orderedMeals = [];
    
    for (const mealType of mealOrder) {
      const meal = meals.find(m => m.mealType === mealType);
      if (meal) {
        orderedMeals.push(meal);
      }
    }
    
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
    let nutritionData = { calories: 0, protein: 0, carbs: 0, fat: 0 };

    console.log(`=== PARSING ${mealType.toUpperCase()} ===`);
    console.log("Lines:", lines.slice(0, 10)); // Show first 10 lines for debugging

    // ENHANCED TITLE EXTRACTION
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
        title = line.replace(/[^\w\s\-'&()]/g, '').trim();
        
        if (!title.match(/\d+\s*(cup|tbsp|tsp|lb|oz|gram|ml|liter)/i)) {
          console.log(`Found title: "${title}"`);
          break;
        }
      }
    }

    if (!title || title.length < 3) {
      const titleWords = ['Delicious', 'Healthy', 'Fresh', 'Nutritious', 'Gourmet', 'Classic', 'Hearty', 'Tasty'];
      const randomWord = titleWords[Math.floor(Math.random() * titleWords.length)];
      title = `${randomWord} ${mealType}`;
      console.log(`Generated fallback title: "${title}"`);
    }

    // EXTRACT AI-PROVIDED NUTRITION DATA - This is the key fix!
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine === title) continue;

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
      // CRITICAL: Extract AI-provided nutrition data
      else if (trimmedLine.toLowerCase().includes('calorie') ||
               trimmedLine.toLowerCase().includes('protein') ||
               trimmedLine.toLowerCase().includes('fat') ||
               trimmedLine.toLowerCase().includes('carb') ||
               trimmedLine.toLowerCase().includes('kcal') ||
               trimmedLine.toLowerCase().includes('nutritional')) {
        
        console.log(`Found nutrition line: "${trimmedLine}"`);
        
        // Extract actual macro values from AI response
        const calorieMatch = trimmedLine.match(/calories?\s*:?\s*(\d+)/i) ||
                           trimmedLine.match(/(\d+)\s*calories?/i) ||
                           trimmedLine.match(/(\d+)\s*kcal/i);
        const proteinMatch = trimmedLine.match(/protein\s*:?\s*(\d+)/i) ||
                           trimmedLine.match(/(\d+)g?\s*protein/i);
        const carbMatch = trimmedLine.match(/carbs?\s*:?\s*(\d+)/i) ||
                        trimmedLine.match(/(\d+)g?\s*carbs?/i);
        const fatMatch = trimmedLine.match(/fat\s*:?\s*(\d+)/i) ||
                       trimmedLine.match(/(\d+)g?\s*fat/i);

        if (calorieMatch) {
          nutritionData.calories = parseInt(calorieMatch[1]);
          console.log(`Extracted calories: ${nutritionData.calories}`);
        }
        if (proteinMatch) {
          nutritionData.protein = parseInt(proteinMatch[1]);
          console.log(`Extracted protein: ${nutritionData.protein}g`);
        }
        if (carbMatch) {
          nutritionData.carbs = parseInt(carbMatch[1]);
          console.log(`Extracted carbs: ${nutritionData.carbs}g`);
        }
        if (fatMatch) {
          nutritionData.fat = parseInt(fatMatch[1]);
          console.log(`Extracted fat: ${nutritionData.fat}g`);
        }

        // Store the full nutrition line for display
        if (nutrition) {
          nutrition += ' • ' + trimmedLine;
        } else {
          nutrition = trimmedLine;
        }
      }
    }

    // ONLY use fallback if AI didn't provide ANY nutrition data
    if (nutritionData.calories === 0 && nutritionData.protein === 0 && nutritionData.carbs === 0 && nutritionData.fat === 0) {
      console.warn(`No AI nutrition data found for ${mealType}, using fallback calculation`);
      const caloriesPerMeal = Math.round(caloriesPerDay / mealsPerDay);
      nutritionData.calories = caloriesPerMeal;
      nutritionData.protein = Math.round(caloriesPerMeal * 0.2 / 4);
      nutritionData.carbs = Math.round(caloriesPerMeal * 0.5 / 4);
      nutritionData.fat = Math.round(caloriesPerMeal * 0.3 / 9);
      nutrition = `${nutritionData.calories} calories • ${nutritionData.protein}g protein • ${nutritionData.carbs}g carbs • ${nutritionData.fat}g fat`;
    } else {
      console.log(`✅ Using AI-provided nutrition data for ${mealType}:`, nutritionData);
      // Ensure we have a complete nutrition string even with AI data
      if (!nutrition) {
        nutrition = `${nutritionData.calories} calories • ${nutritionData.protein}g protein • ${nutritionData.carbs}g carbs • ${nutritionData.fat}g fat`;
      }
    }

    // Ensure we have some content
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

    console.log(`✅ Final nutrition data for ${mealType}:`, nutritionData);

    return {
      mealType,
      title,
      ingredients,
      instructions,
      nutrition,
      nutritionData, // This now contains real AI data when available
      timings
    };
  };

  const generateFallbackMeal = (mealType, mealIndex) => {
    const mealTitles = {
      'Breakfast': ['Protein Power Bowl', 'Morning Energy Plate', 'Sunrise Special', 'Hearty Breakfast Skillet', 'Golden Morning Toast'],
      'Lunch': ['Midday Balance Bowl', 'Power Lunch Plate', 'Afternoon Fuel', 'Fresh Garden Salad', 'Savory Lunch Wrap'],
      'Dinner': ['Evening Comfort Meal', 'Dinner Delight', 'Night Nourishment', 'Sunset Feast', 'Cozy Dinner Bowl'],
      'Snack': ['Energy Boost', 'Quick Bite', 'Healthy Snack', 'Power Snack', 'Midday Treat']
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
      nutritionData: { calories: caloriesPerMeal, protein, carbs, fat },
      timings: ['Prep: 15 min', 'Cook: 20 min']
    };
  };

  const generateFallbackDay = (dayNumber) => {
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'].slice(0, mealsPerDay);
    const meals = mealTypes.map((type, index) => generateFallbackMeal(type, index + 1));
    const dayTotals = calculateDayTotals(meals);
    
    return {
      title: `Day ${dayNumber}`,
      dayNumber,
      meals,
      totalCalories: dayTotals.calories,
      totalProtein: dayTotals.protein,
      totalCarbs: dayTotals.carbs,
      totalFat: dayTotals.fat
    };
  };

  const generateFallbackMealPlan = () => {
    return Array.from({ length: days }, (_, index) =>
      generateFallbackDay(index + 1)
    );
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'cards' ? 'list' : 'cards');
    Animated.timing(slideAnim, {
      toValue: viewMode === 'cards' ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const openDayModal = (day) => {
    setSelectedDayModal(day);
  };

  const openMealModal = (meal) => {
    setSelectedMealModal(meal);
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
        shareText += `Total: ${day.totalCalories} cal • ${day.totalProtein}g protein • ${day.totalCarbs}g carbs • ${day.totalFat}g fat\n`;
        shareText += '─'.repeat(40) + '\n';
        
        day.meals.forEach((meal) => {
          shareText += `\n${meal.mealType.toUpperCase()}: ${meal.title}\n`;
          shareText += `⏱️ ${meal.timings.join(' • ')}\n`;
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

  const renderDayCard = ({ item: day }) => (
    <TouchableOpacity
      style={styles.dayCard}
      onPress={() => openDayModal(day)}
      activeOpacity={0.8}
    >
      <View style={styles.dayCardHeader}>
        <Text style={styles.dayCardTitle}>{day.title}</Text>
        <View style={styles.dayCardStats}>
          <Text style={styles.dayCardCalories}>{day.totalCalories}</Text>
          <Text style={styles.dayCardCaloriesLabel}>cal</Text>
        </View>
      </View>
      
      <View style={styles.dayCardMacros}>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{day.totalProtein}g</Text>
          <Text style={styles.macroLabel}>Protein</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{day.totalCarbs}g</Text>
          <Text style={styles.macroLabel}>Carbs</Text>
        </View>
        <View style={styles.macroItem}>
          <Text style={styles.macroValue}>{day.totalFat}g</Text>
          <Text style={styles.macroLabel}>Fat</Text>
        </View>
      </View>

      <View style={styles.dayCardMeals}>
        {day.meals.map((meal, index) => (
          <View key={index} style={styles.mealPreview}>
            <View style={styles.mealIcon}>
              <Ionicons
                name={
                  meal.mealType === 'Breakfast' ? 'sunny' :
                  meal.mealType === 'Lunch' ? 'partly-sunny' :
                  meal.mealType === 'Dinner' ? 'moon' : 'cafe'
                }
                size={14}
                color="#008b8b"
              />
            </View>
            <Text style={styles.mealPreviewText} numberOfLines={1}>
              {meal.title}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.dayCardFooter}>
        <Text style={styles.dayCardMealCount}>{day.meals.length} meals</Text>
        <Ionicons name="chevron-forward" size={16} color="#008b8b" />
      </View>
    </TouchableOpacity>
  );

  const renderMealCard = ({ item: meal }) => (
    <TouchableOpacity
      style={styles.mealCard}
      onPress={() => openMealModal(meal)}
      activeOpacity={0.8}
    >
      <View style={styles.mealCardHeader}>
        <View style={styles.mealCardIcon}>
          <Ionicons
            name={
              meal.mealType === 'Breakfast' ? 'sunny' :
              meal.mealType === 'Lunch' ? 'partly-sunny' :
              meal.mealType === 'Dinner' ? 'moon' : 'cafe'
            }
            size={20}
            color="#008b8b"
          />
        </View>
        <View style={styles.mealCardInfo}>
          <Text style={styles.mealType}>{meal.mealType}</Text>
          <Text style={styles.mealTitle} numberOfLines={2}>{meal.title}</Text>
        </View>
        <View style={styles.mealCardCalories}>
          <Text style={styles.mealCaloriesValue}>{meal.nutritionData.calories}</Text>
          <Text style={styles.mealCaloriesLabel}>cal</Text>
        </View>
      </View>
      
      <View style={styles.mealCardMacros}>
        <Text style={styles.mealMacros}>
          {meal.nutritionData.protein}g protein • {meal.nutritionData.carbs}g carbs • {meal.nutritionData.fat}g fat
        </Text>
      </View>

      <View style={styles.mealCardFooter}>
        <Text style={styles.mealTiming}>{meal.timings.join(' • ')}</Text>
        <Ionicons name="chevron-forward" size={14} color="#008b8b" />
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <Ionicons name="restaurant" size={32} color="#008b8b" />
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
          <Text style={styles.headerSubtitle}>
            {days} days • {parsedDays.reduce((total, day) => total + day.totalCalories, 0)} total calories
          </Text>
        </View>
        
        <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsLeft}>
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
        
        <TouchableOpacity style={styles.viewToggle} onPress={toggleViewMode}>
          <Ionicons
            name={viewMode === 'cards' ? 'list' : 'grid'}
            size={16}
            color="#008b8b"
          />
          <Text style={styles.viewToggleText}>
            {viewMode === 'cards' ? 'List' : 'Cards'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Save Section */}
      <View style={styles.saveSection}>
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

      {/* Main Content */}
      {viewMode === 'cards' ? (
        <FlatList
          data={parsedDays}
          renderItem={renderDayCard}
          keyExtractor={(item) => item.dayNumber.toString()}
          contentContainerStyle={styles.cardsContainer}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={parsedDays.flatMap(day =>
            day.meals.map(meal => ({ ...meal, dayNumber: day.dayNumber }))
          )}
          renderItem={renderMealCard}
          keyExtractor={(item, index) => `${item.dayNumber}-${index}`}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Day Modal */}
      <Modal
        visible={selectedDayModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDayModal(null)}
      >
        {selectedDayModal && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedDayModal(null)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedDayModal.title}</Text>
              <View style={styles.modalHeaderStats}>
                <Text style={styles.modalHeaderCalories}>{selectedDayModal.totalCalories} cal</Text>
              </View>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalMacrosSummary}>
                <View style={styles.modalMacroItem}>
                  <Text style={styles.modalMacroValue}>{selectedDayModal.totalProtein}g</Text>
                  <Text style={styles.modalMacroLabel}>Protein</Text>
                </View>
                <View style={styles.modalMacroItem}>
                  <Text style={styles.modalMacroValue}>{selectedDayModal.totalCarbs}g</Text>
                  <Text style={styles.modalMacroLabel}>Carbs</Text>
                </View>
                <View style={styles.modalMacroItem}>
                  <Text style={styles.modalMacroValue}>{selectedDayModal.totalFat}g</Text>
                  <Text style={styles.modalMacroLabel}>Fat</Text>
                </View>
              </View>

              {selectedDayModal.meals.map((meal, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.modalMealCard}
                  onPress={() => openMealModal(meal)}
                >
                  <View style={styles.modalMealHeader}>
                    <View style={styles.modalMealIcon}>
                      <Ionicons
                        name={
                          meal.mealType === 'Breakfast' ? 'sunny' :
                          meal.mealType === 'Lunch' ? 'partly-sunny' :
                          meal.mealType === 'Dinner' ? 'moon' : 'cafe'
                        }
                        size={20}
                        color="#008b8b"
                      />
                    </View>
                    <View style={styles.modalMealInfo}>
                      <Text style={styles.modalMealTitle}>{meal.title}</Text>
                    </View>
                    <View style={styles.modalMealCalories}>
                      <Text style={styles.modalMealCaloriesValue}>{meal.nutritionData.calories}</Text>
                      <Text style={styles.modalMealCaloriesLabel}>cal</Text>
                    </View>
                  </View>
                  <Text style={styles.modalMealMacros}>
                    {meal.nutritionData.protein}g protein • {meal.nutritionData.carbs}g carbs • {meal.nutritionData.fat}g fat
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* Meal Modal */}
      <Modal
        visible={selectedMealModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMealModal(null)}
      >
        {selectedMealModal && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedMealModal(null)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalMealTypeTitle}>{selectedMealModal.mealType}</Text>
                <Text style={styles.modalTitle}>{selectedMealModal.title}</Text>
              </View>
              <View style={styles.modalHeaderStats}>
                <Text style={styles.modalHeaderCalories}>{selectedMealModal.nutritionData.calories} cal</Text>
              </View>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Nutrition Summary */}
              <View style={styles.nutritionCard}>
                <Text style={styles.nutritionCardTitle}>Nutrition Facts</Text>
                <View style={styles.nutritionGrid}>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{selectedMealModal.nutritionData.calories}</Text>
                    <Text style={styles.nutritionLabel}>Calories</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{selectedMealModal.nutritionData.protein}g</Text>
                    <Text style={styles.nutritionLabel}>Protein</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{selectedMealModal.nutritionData.carbs}g</Text>
                    <Text style={styles.nutritionLabel}>Carbs</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{selectedMealModal.nutritionData.fat}g</Text>
                    <Text style={styles.nutritionLabel}>Fat</Text>
                  </View>
                </View>
              </View>

              {/* Timing */}
              <View style={styles.timingCard}>
                <Text style={styles.sectionTitle}>Timing</Text>
                <View style={styles.timingContainer}>
                  {selectedMealModal.timings.map((timing, index) => (
                    <View key={index} style={styles.timingItem}>
                      <Ionicons name="time" size={16} color="#008b8b" />
                      <Text style={styles.timingText}>{timing}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Ingredients */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Ingredients ({selectedMealModal.ingredients.length})</Text>
                {selectedMealModal.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.ingredientBullet} />
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))}
              </View>

              {/* Instructions */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Instructions</Text>
                {selectedMealModal.instructions.map((instruction, index) => (
                  <View key={index} style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.instructionText}>{instruction.replace(/^\d+\.\s*/, '')}</Text>
                  </View>
                ))}
              </View>
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7f8c8d',
    marginTop: 2,
  },

  // Controls
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  controlsLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  controlTag: {
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  controlTagText: {
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '600',
  },
  controlTagWarning: {
    backgroundColor: '#fff2f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  controlTagWarningText: {
    fontSize: 12,
    color: '#d63031',
    fontWeight: '600',
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  viewToggleText: {
    fontSize: 14,
    color: '#008b8b',
    fontWeight: '600',
  },

  // Save Section
  saveSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Cards View
  cardsContainer: {
    padding: 16,
    gap: 16,
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dayCardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
  },
  dayCardStats: {
    alignItems: 'flex-end',
  },
  dayCardCalories: {
    fontSize: 28,
    fontWeight: '700',
    color: '#008b8b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dayCardCaloriesLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  dayCardMacros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  macroLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
    marginTop: 4,
  },
  dayCardMeals: {
    gap: 8,
    marginBottom: 16,
  },
  mealPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  mealIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e8f4f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPreviewText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  dayCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  dayCardMealCount: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  // List View
  listContainer: {
    padding: 16,
    gap: 12,
  },
  mealCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  mealCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e8f4f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealCardInfo: {
    flex: 1,
  },
  mealType: {
    fontSize: 14,
    color: '#008b8b',
    fontWeight: '600',
    marginBottom: 4,
  },
  mealTitle: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: '600',
    lineHeight: 24,
  },
  mealCardCalories: {
    alignItems: 'flex-end',
  },
  mealCaloriesValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mealCaloriesLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  mealCardMacros: {
    marginBottom: 12,
  },
  mealMacros: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  mealCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  mealTiming: {
    fontSize: 13,
    color: '#7f8c8d',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalMealTypeTitle: {
    fontSize: 14,
    color: '#008b8b',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalHeaderStats: {
    alignItems: 'flex-end',
  },
  modalHeaderCalories: {
    fontSize: 18,
    fontWeight: '700',
    color: '#008b8b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalMacrosSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modalMacroItem: {
    alignItems: 'center',
  },
  modalMacroValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalMacroLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
    marginTop: 4,
  },
  modalMealCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modalMealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  modalMealIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e8f4f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMealInfo: {
    flex: 1,
  },
  modalMealType: {
    fontSize: 14,
    color: '#008b8b',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalMealTitle: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: '600',
  },
  modalMealCalories: {
    alignItems: 'flex-end',
  },
  modalMealCaloriesValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalMealCaloriesLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  modalMealMacros: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  // Detailed Modal Sections
  nutritionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  nutritionCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 16,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#008b8b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
    marginTop: 4,
  },
  timingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  timingContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  timingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  timingText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 16,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
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
    lineHeight: 22,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#008b8b',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  instructionNumberText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 22,
  },
});
