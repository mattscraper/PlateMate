import React, { useState, useEffect } from "react";
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
  FlatList,
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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  useEffect(() => {
    console.log("=== PARSING MEAL PLAN ===");
    console.log("Raw text length:", mealPlan?.length);
    console.log("Sample:", mealPlan?.substring(0, 500));
    
    const parsed = parseAIMealPlan(mealPlan);
    setParsedDays(parsed);
    setIsLoading(false);
  }, [mealPlan]);

  // SIMPLE BUT EFFECTIVE PARSING
  const parseAIMealPlan = (text) => {
    if (!text) return createFallbackPlan();

    try {
      // Split by ===== first (your AI format)
      let dayBlocks = text.split('=====').filter(block => block.trim());
      
      // Fallback: split by "Day" if no separators
      if (dayBlocks.length < 2) {
        dayBlocks = text.split(/Day\s+\d+/i).filter(block => block.trim());
        if (dayBlocks.length > 1) dayBlocks = dayBlocks.slice(1); // Remove first empty block
      }

      console.log(`Found ${dayBlocks.length} day blocks`);

      const result = [];
      for (let i = 0; i < Math.min(dayBlocks.length, days); i++) {
        const dayData = parseDayBlock(dayBlocks[i], i + 1);
        result.push(dayData);
      }

      // Fill missing days
      while (result.length < days) {
        result.push(createFallbackDay(result.length + 1));
      }

      return result;
    } catch (error) {
      console.error("Parsing failed:", error);
      return createFallbackPlan();
    }
  };

  const parseDayBlock = (block, dayNum) => {
    console.log(`\n=== Parsing Day ${dayNum} ===`);
    
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    const meals = [];
    
    // Split into meal blocks
    let currentMeal = null;
    let currentLines = [];
    
    for (const line of lines) {
      const mealType = detectMealType(line);
      
      if (mealType) {
        // Save previous meal
        if (currentMeal && currentLines.length > 0) {
          meals.push(parseMeal(currentLines, currentMeal));
        }
        // Start new meal
        currentMeal = mealType;
        currentLines = [line];
      } else if (currentMeal) {
        currentLines.push(line);
      }
    }
    
    // Don't forget last meal
    if (currentMeal && currentLines.length > 0) {
      meals.push(parseMeal(currentLines, currentMeal));
    }

    // Fill missing meals
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    while (meals.length < mealsPerDay) {
      const missingType = mealTypes[meals.length] || 'Meal';
      meals.push(createFallbackMeal(missingType));
    }

    console.log(`Day ${dayNum}: ${meals.length} meals parsed`);

    // Calculate totals
    const totals = meals.reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      dayNumber: dayNum,
      title: `Day ${dayNum}`,
      meals: meals.slice(0, mealsPerDay),
      ...totals
    };
  };

  const detectMealType = (line) => {
    const lower = line.toLowerCase();
    if (lower.includes('breakfast')) return 'Breakfast';
    if (lower.includes('lunch')) return 'Lunch';
    if (lower.includes('dinner')) return 'Dinner';
    if (lower.includes('snack')) return 'Snack';
    return null;
  };

  const parseMeal = (lines, mealType) => {
    console.log(`Parsing ${mealType}:`, lines.slice(0, 5));
    
    let title = '';
    let ingredients = [];
    let instructions = [];
    let timings = [];
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    // Find title (first non-meal-type substantial line)
    for (const line of lines) {
      if (!line ||
          line.toLowerCase().includes(mealType.toLowerCase()) ||
          line.startsWith('•') ||
          line.startsWith('-') ||
          line.match(/^\d+\./) ||
          line.toLowerCase().includes('calorie') ||
          line.toLowerCase().includes('protein') ||
          line.toLowerCase().includes('carb') ||
          line.toLowerCase().includes('fat') ||
          line.toLowerCase().includes('preparation') ||
          line.toLowerCase().includes('cooking') ||
          line.toLowerCase().includes('nutritional') ||
          line.toLowerCase().includes('instructions') ||
          line.toLowerCase().includes('ingredients')) {
        continue;
      }
      
      if (line.length > 3) {
        title = line.replace(/[^\w\s\-'&(),.]/g, '').trim();
        break;
      }
    }

    if (!title) {
      title = `${mealType} Special`;
    }

    // Extract everything else
    for (const line of lines) {
      const lower = line.toLowerCase();
      
      // EXTRACT AI-PROVIDED NUTRITION DATA - PRIORITY!
      if (lower.includes('calorie') || lower.includes('kcal')) {
        // Try multiple patterns for calories
        const patterns = [
          /calories?\s*:?\s*(\d+)/i,
          /(\d+)\s*calories?/i,
          /(\d+)\s*kcal/i
        ];
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match && calories === 0) {
            calories = parseInt(match[1]);
            console.log(`✅ AI provided calories: ${calories}`);
            break;
          }
        }
      }
      
      if (lower.includes('protein')) {
        const patterns = [
          /protein\s*:?\s*(\d+)/i,
          /(\d+)g?\s*protein/i,
          /(\d+)\s*g\s*protein/i
        ];
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match && protein === 0) {
            protein = parseInt(match[1]);
            console.log(`✅ AI provided protein: ${protein}g`);
            break;
          }
        }
      }
      
      if (lower.includes('carb')) {
        const patterns = [
          /carbs?\s*:?\s*(\d+)/i,
          /(\d+)g?\s*carbs?/i,
          /(\d+)\s*g\s*carbs?/i
        ];
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match && carbs === 0) {
            carbs = parseInt(match[1]);
            console.log(`✅ AI provided carbs: ${carbs}g`);
            break;
          }
        }
      }
      
      if (lower.includes('fat')) {
        const patterns = [
          /fat\s*:?\s*(\d+)/i,
          /(\d+)g?\s*fat/i,
          /(\d+)\s*g\s*fat/i
        ];
        for (const pattern of patterns) {
          const match = line.match(pattern);
          if (match && fat === 0) {
            fat = parseInt(match[1]);
            console.log(`✅ AI provided fat: ${fat}g`);
            break;
          }
        }
      }
      
      // Ingredients
      if (line.startsWith('•') || line.startsWith('-')) {
        const ingredient = line.replace(/^[•\-]\s*/, '').trim();
        if (ingredient) ingredients.push(ingredient);
      }
      
      // Instructions
      if (line.match(/^\d+\./)) {
        instructions.push(line);
      }
      
      // Timings
      if (lower.includes('prep') || lower.includes('cook') || lower.includes('serving')) {
        timings.push(line);
      }
    }

    // ONLY use fallback if AI provided NO nutrition data at all
    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
      console.warn(`⚠️ No AI nutrition data found for ${mealType}, using estimates`);
      const avgCals = Math.round(caloriesPerDay / mealsPerDay);
      calories = avgCals;
      protein = Math.round(avgCals * 0.25 / 4);
      carbs = Math.round(avgCals * 0.45 / 4);
      fat = Math.round(avgCals * 0.30 / 9);
    } else {
      console.log(`✅ Using AI nutrition data for ${mealType}: ${calories} cal, ${protein}g protein, ${carbs}g carbs, ${fat}g fat`);
    }

    // Fallback content
    if (ingredients.length === 0) {
      ingredients = ['Quality ingredients as specified', 'Fresh seasonings and herbs'];
    }
    if (instructions.length === 0) {
      instructions = ['1. Prepare ingredients', '2. Cook as directed', '3. Serve fresh'];
    }
    if (timings.length === 0) {
      timings = ['Prep: 15 min', 'Cook: 25 min'];
    }

    console.log(`✅ Final ${mealType}: ${title} - ${calories} cal, ${protein}g protein`);

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

  const createFallbackMeal = (mealType) => {
    const avgCals = Math.round(caloriesPerDay / mealsPerDay);
    return {
      mealType,
      title: `Healthy ${mealType}`,
      ingredients: ['Quality ingredients', 'Fresh seasonings'],
      instructions: ['1. Prepare ingredients', '2. Cook thoroughly', '3. Enjoy!'],
      timings: ['Prep: 15 min', 'Cook: 20 min'],
      calories: avgCals,
      protein: Math.round(avgCals * 0.25 / 4),
      carbs: Math.round(avgCals * 0.45 / 4),
      fat: Math.round(avgCals * 0.30 / 9)
    };
  };

  const createFallbackDay = (dayNum) => {
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner'].slice(0, mealsPerDay);
    const meals = mealTypes.map(type => createFallbackMeal(type));
    const totals = meals.reduce((sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      dayNumber: dayNum,
      title: `Day ${dayNum}`,
      meals,
      ...totals
    };
  };

  const createFallbackPlan = () => {
    return Array.from({ length: days }, (_, i) => createFallbackDay(i + 1));
  };

  const getMealTypeColor = (mealType) => {
    const colors = {
      'Breakfast': '#FF6B35',
      'Lunch': '#007AFF',
      'Dinner': '#5856D6',
      'Snack': '#32D74B'
    };
    return colors[mealType] || '#007AFF';
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="restaurant" size={48} color="#008080" />
          <Text style={styles.loadingText}>Preparing your meal plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Simple Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Meal Plan</Text>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#008080" />
        </TouchableOpacity>
      </View>

      {/* View Toggle */}
      <View style={styles.toggleContainer}>
        <View style={styles.toggleButtons}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color={viewMode === 'list' ? '#008080' : '#666'} />
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'grid' && styles.toggleButtonActive]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons name="grid" size={20} color={viewMode === 'grid' ? '#008080' : '#666'} />
            <Text style={[styles.toggleText, viewMode === 'grid' && styles.toggleTextActive]}>Grid</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Plan Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{days} Day Plan</Text>
        <Text style={styles.summaryText}>
          {parsedDays.reduce((sum, day) => sum + day.calories, 0).toLocaleString()} total calories
        </Text>
        {dietType && <Text style={styles.dietType}>{dietType}</Text>}
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

      {/* Days List */}
      {viewMode === 'list' ? (
        <FlatList
          data={parsedDays}
          keyExtractor={(item) => item.dayNumber.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: day }) => (
            <View style={styles.dayCard}>
              {/* Day Header */}
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{day.title}</Text>
                <Text style={styles.dayCalories}>{day.calories} cal</Text>
              </View>

              {/* Day Macros */}
              <View style={styles.dayMacros}>
                <View style={styles.macro}>
                  <Text style={styles.macroValue}>{day.protein}g</Text>
                  <Text style={styles.macroLabel}>Protein</Text>
                </View>
                <View style={styles.macro}>
                  <Text style={styles.macroValue}>{day.carbs}g</Text>
                  <Text style={styles.macroLabel}>Carbs</Text>
                </View>
                <View style={styles.macro}>
                  <Text style={styles.macroValue}>{day.fat}g</Text>
                  <Text style={styles.macroLabel}>Fat</Text>
                </View>
              </View>

              {/* Meals */}
              <View style={styles.mealsContainer}>
                {day.meals.map((meal, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.mealRow}
                    onPress={() => setSelectedMeal(meal)}
                  >
                    <View style={styles.mealLeft}>
                      <Text style={styles.mealType}>{meal.mealType}</Text>
                      <Text style={styles.mealTitle}>{meal.title}</Text>
                    </View>
                    <View style={styles.mealRight}>
                      <Text style={styles.mealCalories}>{meal.calories}</Text>
                      <Text style={styles.mealCalLabel}>cal</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={parsedDays.flatMap(day => day.meals.map(meal => ({ ...meal, dayTitle: day.title })))}
          keyExtractor={(item, index) => `meal-${index}`}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item: meal }) => (
            <TouchableOpacity
              style={styles.gridMealCard}
              onPress={() => setSelectedMeal(meal)}
            >
              <View style={[styles.mealTypeBadge, { backgroundColor: getMealTypeColor(meal.mealType) }]}>
                <Text style={styles.mealTypeBadgeText}>{meal.mealType}</Text>
              </View>
              <Text style={styles.gridMealTitle} numberOfLines={2}>{meal.title}</Text>
              <View style={styles.gridMealCalories}>
                <Text style={styles.gridCaloriesNumber}>{meal.calories}</Text>
                <Text style={styles.gridCaloriesLabel}>calories</Text>
              </View>
              <View style={styles.gridMacros}>
                <Text style={styles.gridMacroText}>{meal.protein}g • {meal.carbs}g • {meal.fat}g</Text>
                <Text style={styles.gridMacroLabel}>P • C • F</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Recipe Modal */}
      <Modal
        visible={selectedMeal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMeal(null)}
      >
        {selectedMeal && (
          <SafeAreaView style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedMeal(null)}>
                <Ionicons name="close" size={28} color="#000" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedMeal.title}</Text>
              <View style={styles.modalCalories}>
                <Text style={styles.modalCaloriesText}>{selectedMeal.calories}</Text>
                <Text style={styles.modalCaloriesLabel}>cal</Text>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Nutrition */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Nutrition</Text>
                <View style={styles.nutritionRow}>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{selectedMeal.protein}g</Text>
                    <Text style={styles.nutritionLabel}>Protein</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{selectedMeal.carbs}g</Text>
                    <Text style={styles.nutritionLabel}>Carbs</Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{selectedMeal.fat}g</Text>
                    <Text style={styles.nutritionLabel}>Fat</Text>
                  </View>
                </View>
              </View>

              {/* Timing */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Timing</Text>
                {selectedMeal.timings.map((timing, index) => (
                  <Text key={index} style={styles.timingText}>{timing}</Text>
                ))}
              </View>

              {/* Ingredients */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                {selectedMeal.ingredients.map((ingredient, index) => (
                  <Text key={index} style={styles.ingredientText}>• {ingredient}</Text>
                ))}
              </View>

              {/* Instructions */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Instructions</Text>
                {selectedMeal.instructions.map((instruction, index) => (
                  <Text key={index} style={styles.instructionText}>
                    {instruction}
                  </Text>
                ))}
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
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },

  // Toggle
  toggleContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toggleButtons: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  toggleTextActive: {
    color: '#008080',
    fontWeight: '600',
  },

  // Summary
  summaryCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  summaryText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  dietType: {
    fontSize: 14,
    color: '#008080',
    fontWeight: '600',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#e0f2f1',
    borderRadius: 12,
  },

  // Save
  saveContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Grid
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  gridMealCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    flex: 1,
    maxWidth: '48%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  mealTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  mealTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  gridMealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    minHeight: 36,
  },
  gridMealCalories: {
    alignItems: 'center',
    marginBottom: 8,
  },
  gridCaloriesNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#008080',
  },
  gridCaloriesLabel: {
    fontSize: 10,
    color: '#666',
  },
  gridMacros: {
    alignItems: 'center',
  },
  gridMacroText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
  },
  gridMacroLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },

  // Day Card
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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
  dayTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  dayCalories: {
    fontSize: 20,
    fontWeight: '600',
    color: '#008080',
  },

  // Day Macros
  dayMacros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  macro: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  macroLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // Meals
  mealsContainer: {
    gap: 8,
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  mealLeft: {
    flex: 1,
  },
  mealType: {
    fontSize: 12,
    color: '#008080',
    fontWeight: '600',
    marginBottom: 2,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  mealRight: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  mealCalLabel: {
    fontSize: 12,
    color: '#666',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  modalCalories: {
    alignItems: 'flex-end',
  },
  modalCaloriesText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#008080',
  },
  modalCaloriesLabel: {
    fontSize: 12,
    color: '#666',
  },

  // Modal Content
  modalContent: {
    flex: 1,
    padding: 20,
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
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },

  // Nutrition
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#008080',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Content
  timingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  ingredientText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
    lineHeight: 24,
  },
  instructionText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 12,
    lineHeight: 24,
  },
  modalBottom: {
    height: 40,
  },
});
