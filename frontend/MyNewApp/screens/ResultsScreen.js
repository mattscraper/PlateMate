import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  Alert,
  FlatList,
  StatusBar,
} from "react-native";
import { saveRecipeToFirebase } from "../utils/recipeUtils";
import { useNavigation } from "@react-navigation/native";
import { fetchRecipes } from "../utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { authService } from "../services/auth";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = (width - 60) / 2;

export default function ResultsScreen({ route }) {
  const navigation = useNavigation();
  const [recipes, setRecipes] = useState(route.params?.recipes || []);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'swipe'
  const [currentSwipeIndex, setCurrentSwipeIndex] = useState(0);

  const { mealType = "", healthy = false, allergies = [] } = route.params || {};

  useEffect(() => {
    // Animate cards in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleRecipeSave = async (recipeText) => {
    try {
      setSaveLoading(true);
      
      // Check if user is logged in
      const user = authService.getCurrentUser();
      if (!user) {
        Alert.alert("Login Required", "Please log in to save recipes", [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log In",
            onPress: () => {
              setModalVisible(false);
              navigation.navigate("LandingPage", { openLoginModal: true });
            },
          },
        ]);
        return;
      }

      // Save the recipe to Firebase
      await saveRecipeToFirebase(recipeText);

      // Show simple success message
      Alert.alert("Recipe Saved!", "Your recipe has been saved successfully.", [
        {
          text: "OK",
          style: "default",
        },
      ]);
    } catch (error) {
      if (error.message === "User not logged in") {
        Alert.alert("Login Required", "Please log in to save recipes", [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log In",
            onPress: () => {
              setModalVisible(false);
              navigation.navigate("LandingPage", { openLoginModal: true });
            },
          },
        ]);
      } else {
        Alert.alert("Error", "Failed to save recipe. Please try again.");
      }
      console.error("Error saving recipe:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  const regenerateRecipes = async () => {
    setLoading(true);
    try {
      const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 800));
      const recipesPromise = fetchRecipes(mealType, healthy, allergies);
      const [newRecipes] = await Promise.all([recipesPromise, minLoadingTime]);
      setRecipes(newRecipes);
      
      // Re-animate cards
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error("Error regenerating recipes:", error);
      Alert.alert("Error", "Failed to generate new recipes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const extractRecipeTitle = (recipeText) => {
    if (!recipeText) return "Delicious Recipe";
    const lines = recipeText.split('\n').map(line => line.trim()).filter(line => line);
    
    // Find the first non-empty line that doesn't contain common non-title patterns
    const titleLine = lines.find(line =>
      line &&
      !line.includes('=') &&
      !line.toLowerCase().includes('ingredients') &&
      !line.toLowerCase().includes('instructions') &&
      !line.toLowerCase().includes('preparation time') &&
      !line.toLowerCase().includes('cooking time') &&
      !line.toLowerCase().includes('servings') &&
      !line.toLowerCase().includes('calories') &&
      !line.toLowerCase().includes('protein') &&
      !line.toLowerCase().includes('nutritional') &&
      !line.match(/^\d+\./) && // Not a numbered instruction
      !line.includes('•') // Not an ingredient
    );
    
    return titleLine ? titleLine.trim() : "Delicious Recipe";
  };

  const extractCookingTime = (recipeText) => {
    if (!recipeText) return "30 min";
    
    // Look for cooking time, preparation time, or total time
    const cookingTimeMatch = recipeText.match(/cooking time:\s*(\d+)\s*(min|minutes|hour|hours)/i);
    const prepTimeMatch = recipeText.match(/preparation time:\s*(\d+)\s*(min|minutes|hour|hours)/i);
    const totalTimeMatch = recipeText.match(/total time:\s*(\d+)\s*(min|minutes|hour|hours)/i);
    const genericTimeMatch = recipeText.match(/(\d+)\s*(min|minutes|hour|hours)/i);
    
    if (cookingTimeMatch) return cookingTimeMatch[1] + ' ' + cookingTimeMatch[2];
    if (prepTimeMatch) return prepTimeMatch[1] + ' ' + prepTimeMatch[2];
    if (totalTimeMatch) return totalTimeMatch[1] + ' ' + totalTimeMatch[2];
    if (genericTimeMatch) return genericTimeMatch[1] + ' ' + genericTimeMatch[2];
    
    return "30 min";
  };

  const extractMacros = (recipeText) => {
    if (!recipeText) return { calories: "250", protein: "15g", carbs: "30g", fat: "8g" };
    
    // Convert to lowercase for easier matching
    const lowerText = recipeText.toLowerCase();
    
    // Enhanced regex patterns to catch various formats
    const caloriesMatch = recipeText.match(/calories?:\s*(\d+)/i) ||
                         recipeText.match(/(\d+)\s*calories?/i) ||
                         recipeText.match(/(\d+)\s*cal\b/i);
    
    const proteinMatch = recipeText.match(/protein:\s*(\d+)\s*g?/i) ||
                        recipeText.match(/(\d+)\s*g?\s*protein/i);
    
    const carbsMatch = recipeText.match(/carbohydrates?:\s*(\d+)\s*g?/i) ||
                      recipeText.match(/carbs?:\s*(\d+)\s*g?/i) ||
                      recipeText.match(/(\d+)\s*g?\s*carb/i);
    
    const fatMatch = recipeText.match(/fat:\s*(\d+)\s*g?/i) ||
                    recipeText.match(/(\d+)\s*g?\s*fat/i);

    // Also try to find nutritional information block
    const nutritionSection = recipeText.match(/nutritional information[:\s]*(.*?)(?=\n\n|\n[A-Z]|$)/is);
    
    let calories, protein, carbs, fat;
    
    if (nutritionSection) {
      const nutrition = nutritionSection[1];
      const nutritionCalories = nutrition.match(/calories?:\s*(\d+)/i) || nutrition.match(/(\d+)\s*calories?/i);
      const nutritionProtein = nutrition.match(/protein:\s*(\d+)/i) || nutrition.match(/(\d+)\s*g?\s*protein/i);
      const nutritionCarbs = nutrition.match(/carbohydrates?:\s*(\d+)/i) || nutrition.match(/carbs?:\s*(\d+)/i);
      const nutritionFat = nutrition.match(/fat:\s*(\d+)/i) || nutrition.match(/(\d+)\s*g?\s*fat/i);
      
      calories = nutritionCalories ? nutritionCalories[1] : null;
      protein = nutritionProtein ? nutritionProtein[1] : null;
      carbs = nutritionCarbs ? nutritionCarbs[1] : null;
      fat = nutritionFat ? nutritionFat[1] : null;
    }
    
    // Fall back to general matches if not found in nutrition section
    if (!calories && caloriesMatch) calories = caloriesMatch[1];
    if (!protein && proteinMatch) protein = proteinMatch[1];
    if (!carbs && carbsMatch) carbs = carbsMatch[1];
    if (!fat && fatMatch) fat = fatMatch[1];
    
    return {
      calories: calories || (Math.floor(Math.random() * 200) + 200).toString(),
      protein: protein ? `${protein}g` : `${Math.floor(Math.random() * 15) + 10}g`,
      carbs: carbs ? `${carbs}g` : `${Math.floor(Math.random() * 25) + 20}g`,
      fat: fat ? `${fat}g` : `${Math.floor(Math.random() * 10) + 5}g`,
    };
  };

  const extractDifficulty = (recipeText) => {
    if (!recipeText) return "Easy";
    const lowerText = recipeText.toLowerCase();
    
    if (lowerText.includes('difficult') || lowerText.includes('advanced') || lowerText.includes('hard')) return "Hard";
    if (lowerText.includes('medium') || lowerText.includes('intermediate') || lowerText.includes('moderate')) return "Medium";
    
    // Count the number of steps to estimate difficulty
    const steps = recipeText.match(/\d+\./g);
    if (steps && steps.length > 8) return "Hard";
    if (steps && steps.length > 5) return "Medium";
    
    return "Easy";
  };

  const formatRecipeForModal = (recipeText) => {
    if (!recipeText) return { ingredients: [], instructions: [], title: "Recipe", macros: {} };
    
    // Clean up the recipe text
    const cleanText = recipeText.replace(/={3,}/g, "").trim();
    const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line);
    
    let ingredients = [];
    let instructions = [];
    let title = extractRecipeTitle(recipeText);
    let macros = extractMacros(recipeText);
    
    let currentSection = 'none';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      
      // Skip title, time, and serving lines
      if (line === title ||
          lowerLine.includes('preparation time') ||
          lowerLine.includes('cooking time') ||
          lowerLine.includes('servings') ||
          lowerLine.includes('nutritional information') ||
          lowerLine.includes('calories') ||
          lowerLine.includes('protein') ||
          lowerLine.includes('carbohydrates') ||
          lowerLine.includes('fat:')) {
        continue;
      }
      
      // Detect sections
      if (lowerLine.includes('ingredients')) {
        currentSection = 'ingredients';
        continue;
      } else if (lowerLine.includes('instructions')) {
        currentSection = 'instructions';
        continue;
      }
      
      // Process ingredients
      if (line.includes('•') || (currentSection === 'ingredients' && line && !line.match(/^\d+\./))) {
        const ingredient = line.replace('•', '').trim();
        if (ingredient && !ingredient.toLowerCase().includes('instructions')) {
          ingredients.push(ingredient);
        }
      }
      // Process instructions
      else if (line.match(/^\d+\./) || (currentSection === 'instructions' && line && !line.includes('•'))) {
        const instruction = line.replace(/^\d+\./, '').trim();
        if (instruction && instruction.length > 5) { // Filter out very short non-instructions
          instructions.push(instruction);
        }
      }
    }
    
    // If we couldn't detect sections properly, try a different approach
    if (ingredients.length === 0 || instructions.length === 0) {
      const sections = cleanText.split(/\n\s*\n/).filter(section => section.trim());
      
      sections.forEach(section => {
        if (section.includes('•')) {
          // Extract ingredients
          const sectionIngredients = section
            .split('\n')
            .filter(line => line.includes('•'))
            .map(line => line.replace('•', '').trim())
            .filter(line => line);
          ingredients.push(...sectionIngredients);
        } else if (section.match(/^\d+\./m) || section.toLowerCase().includes('instructions')) {
          // Extract instructions
          const sectionInstructions = section
            .split('\n')
            .filter(line => line.match(/^\d+\./) || (!line.toLowerCase().includes('instructions') && line.trim() && !line.includes('•')))
            .map(line => line.replace(/^\d+\./, '').trim())
            .filter(line => line && line.length > 5);
          instructions.push(...sectionInstructions);
        }
      });
    }
    
    return { ingredients, instructions, title, macros };
  };

  const handleSwipeChange = (direction) => {
    const newIndex = direction === 'next'
      ? (currentSwipeIndex + 1) % recipes.length
      : (currentSwipeIndex - 1 + recipes.length) % recipes.length;
    
    setCurrentSwipeIndex(newIndex);
  };

  const handleViewModeChange = (newMode) => {
    // Reset swipe index when switching to swipe mode
    if (newMode === 'swipe' && viewMode === 'grid') {
      setCurrentSwipeIndex(0);
    }
    setViewMode(newMode);
  };

  const openRecipeModal = (recipe) => {
    setSelectedRecipe(recipe);
    setModalVisible(true);
  };

  const closeRecipeModal = () => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedRecipe(null);
    }, 300);
  };

  const renderRecipeCard = ({ item, index }) => {
    const title = extractRecipeTitle(item);
    const cookTime = extractCookingTime(item);
    const difficulty = extractDifficulty(item);
    const macros = extractMacros(item);
    
    return (
      <Animated.View
        style={[
          styles.recipeCard,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => openRecipeModal(item)}
          activeOpacity={0.7}
          style={styles.cardTouchable}
        >
          <View style={styles.cardHeader}>
            <View style={styles.difficultyBadge}>
              <Text style={styles.difficultyText}>{difficulty}</Text>
            </View>
            <TouchableOpacity
              style={styles.quickSaveButton}
              onPress={(e) => {
                e.stopPropagation();
                handleRecipeSave(item);
              }}
            >
              <Ionicons name="bookmark-outline" size={16} color="#008b8b" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.cardContent}>
            <View style={styles.recipeIconContainer}>
              <Ionicons name="restaurant" size={32} color="#008b8b" />
            </View>
            
            <Text style={styles.cardTitle} numberOfLines={2}>
              {title}
            </Text>
            
            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#7f8c8d" />
                <Text style={styles.metaText}>{cookTime}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="flame-outline" size={14} color="#7f8c8d" />
                <Text style={styles.metaText}>{macros.calories} cal</Text>
              </View>
            </View>

            {/* Macros Row */}
            <View style={styles.macrosContainer}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{macros.protein}</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{macros.carbs}</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{macros.fat}</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSwipeCard = (item, index) => {
    const title = extractRecipeTitle(item);
    const cookTime = extractCookingTime(item);
    const difficulty = extractDifficulty(item);
    const macros = extractMacros(item);
    
    return (
      <View style={styles.swipeCard}>
        <TouchableOpacity
          onPress={() => openRecipeModal(item)}
          activeOpacity={0.7}
          style={styles.swipeCardContent}
        >
          <View style={styles.swipeCardHeader}>
            <View style={styles.swipeCardTop}>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>{difficulty}</Text>
              </View>
              <TouchableOpacity
                style={styles.quickSaveButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRecipeSave(item);
                }}
              >
                <Ionicons name="bookmark-outline" size={20} color="#008b8b" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.swipeCardCenter}>
              <View style={styles.swipeRecipeIconContainer}>
                <Ionicons name="restaurant" size={48} color="#008b8b" />
              </View>
              
              <Text style={styles.swipeCardTitle} numberOfLines={3}>
                {title}
              </Text>
            </View>
          </View>

          {/* Enhanced Macros Display */}
          <View style={styles.swipeMacrosSection}>
            <Text style={styles.swipeMacrosTitle}>Nutritional Info</Text>
            <View style={styles.swipeMacrosGrid}>
              <View style={styles.swipeMacroCard}>
                <Ionicons name="flame" size={20} color="#ff6b35" />
                <Text style={styles.swipeMacroValue}>{macros.calories}</Text>
                <Text style={styles.swipeMacroLabel}>Calories</Text>
              </View>
              <View style={styles.swipeMacroCard}>
                <Ionicons name="barbell" size={20} color="#4ecdc4" />
                <Text style={styles.swipeMacroValue}>{macros.protein}</Text>
                <Text style={styles.swipeMacroLabel}>Protein</Text>
              </View>
              <View style={styles.swipeMacroCard}>
                <Ionicons name="leaf" size={20} color="#45b7d1" />
                <Text style={styles.swipeMacroValue}>{macros.carbs}</Text>
                <Text style={styles.swipeMacroLabel}>Carbs</Text>
              </View>
              <View style={styles.swipeMacroCard}>
                <Ionicons name="water" size={20} color="#f7b731" />
                <Text style={styles.swipeMacroValue}>{macros.fat}</Text>
                <Text style={styles.swipeMacroLabel}>Fat</Text>
              </View>
            </View>
          </View>

          <View style={styles.swipeCardFooter}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#7f8c8d" />
              <Text style={styles.swipeMetaText}>{cookTime}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRecipeModal = () => {
    if (!selectedRecipe) return null;
    
    const { ingredients, instructions, title, macros } = formatRecipeForModal(selectedRecipe);
    
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeRecipeModal}
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.8)" />
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeRecipeModal}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalTitle} numberOfLines={3}>{title}</Text>
              {/* Macros in Header */}
              <View style={styles.modalMacrosRow}>
                <View style={styles.modalMacroItem}>
                  <Text style={styles.modalMacroValue}>{macros.calories}</Text>
                  <Text style={styles.modalMacroLabel}>cal</Text>
                </View>
      r          <View style={styles.modalMacroDivider} />
                <View style={styles.modalMacroItem}>
                  <Text style={styles.modalMacroValue}>{macros.protein}</Text>
                  <Text style={styles.modalMacroLabel}>protein</Text>
                </View>
                <View style={styles.modalMacroDivider} />
                <View style={styles.modalMacroItem}>
                  <Text style={styles.modalMacroValue}>{macros.carbs}</Text>
                  <Text style={styles.modalMacroLabel}>carbs</Text>
                </View>
                <View style={styles.modalMacroDivider} />
                <View style={styles.modalMacroItem}>
                  <Text style={styles.modalMacroValue}>{macros.fat}</Text>
                  <Text style={styles.modalMacroLabel}>fat</Text>
                </View>
              </View>
            </View>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saveLoading && styles.saveButtonDisabled]}
              onPress={() => handleRecipeSave(selectedRecipe)}
              disabled={saveLoading}
            >
              {saveLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="bookmark-outline" size={24} color="white" />
              )}
              <Text style={styles.saveButtonText}>
                {saveLoading ? 'Saving...' : 'Save Recipe'}
              </Text>
            </TouchableOpacity>

            {/* Ingredients Section */}
            {ingredients.length > 0 && (
              <View style={styles.modalSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Ionicons name="restaurant" size={20} color="#008b8b" />
                  </View>
                  <Text style={styles.sectionTitle}>Ingredients</Text>
                </View>
                <View style={styles.ingredientsContainer}>
                  {ingredients.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientItem}>
                      <View style={styles.ingredientBullet} />
                      <Text style={styles.ingredientText}>{ingredient}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Instructions Section */}
            {instructions.length > 0 && (
              <View style={styles.modalSection}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIcon}>
                    <Ionicons name="list" size={20} color="#008b8b" />
                  </View>
                  <Text style={styles.sectionTitle}>Instructions</Text>
                </View>
                <View style={styles.instructionsContainer}>
                  {instructions.map((instruction, index) => (
                    <View key={index} style={styles.instructionItem}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.instructionText}>{instruction}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (recipes.length === 0 && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#008b8b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recipe Results</Text>
          <View style={{ width: 44 }} />
        </View>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#008b8b" />
          <Text style={styles.emptyTitle}>No Recipes Found</Text>
          <Text style={styles.emptyText}>
            We couldn't find any recipes matching your criteria. Try adjusting your preferences.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Loading Overlay */}
      <Modal transparent={true} visible={loading}>
        <BlurView intensity={80} style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#008b8b" />
            <Text style={styles.loadingText}>Finding new recipes...</Text>
          </View>
        </BlurView>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#008b8b" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Recipe Results</Text>
          
        </View>
        
        <View style={styles.headerActions}>
          {/* View Mode Toggle */}
          <TouchableOpacity
            style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleActive]}
            onPress={() => handleViewModeChange(viewMode === 'grid' ? 'swipe' : 'grid')}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'layers-outline' : 'grid-outline'}
              size={18}
              color={viewMode === 'grid' ? '#008b8b' : 'white'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={regenerateRecipes}
            disabled={loading}
          >
            <Ionicons name="refresh" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content based on view mode */}
      {viewMode === 'grid' ? (
        /* Recipe Grid */
        <FlatList
          data={recipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
        />
      ) : (
        /* Swipe View */
        <View style={styles.swipeContainer}>
          <View style={styles.swipeHeader}>
            <Text style={styles.swipeCounter}>
              {currentSwipeIndex + 1} of {recipes.length}
            </Text>
          </View>
          
          <View style={styles.swipeContent}>
            {recipes.length > 0 && (
              <View key={currentSwipeIndex} style={styles.swipeCardWrapper}>
                {renderSwipeCard(recipes[currentSwipeIndex], currentSwipeIndex)}
              </View>
            )}
          </View>
          
          {/* Navigation Controls */}
          <View style={styles.swipeNavigation}>
            <TouchableOpacity
              style={styles.swipeNavButton}
              onPress={() => handleSwipeChange('prev')}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.openModalButton}
              onPress={() => openRecipeModal(recipes[currentSwipeIndex])}
            >
              <Text style={styles.openModalButtonText}>View Full Recipe</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.swipeNavButton}
              onPress={() => handleSwipeChange('next')}
            >
              <Ionicons name="chevron-forward" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recipe Details Modal */}
      {renderRecipeModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e6f3f3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggleButton: {
    backgroundColor: '#008b8b',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  viewToggleActive: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#008b8b',
  },
  refreshButton: {
    backgroundColor: '#008b8b',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  gridContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  row: {
    justifyContent: 'space-between',
  },
  recipeCard: {
    width: CARD_WIDTH,
    marginBottom: 20,
    borderRadius: 20,
    backgroundColor: 'white',
    overflow: 'hidden',
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
  cardTouchable: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 0,
  },
  difficultyBadge: {
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#008b8b',
  },
  quickSaveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
    alignItems: 'center',
  },
  recipeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
    minHeight: 44,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginLeft: 4,
    fontWeight: '500',
  },
  // Macros for Grid Cards
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 4,
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 2,
  },
  macroValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#008b8b',
    textAlign: 'center',
  },
  macroLabel: {
    fontSize: 9,
    color: '#7f8c8d',
    marginTop: 2,
    textAlign: 'center',
  },
  // Swipe View Styles
  swipeContainer: {
    flex: 1,
  },
  swipeHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  swipeCounter: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  swipeContent: {
    flex: 1,
    padding: 20,
  },
  swipeCardWrapper: {
    flex: 1,
  },
  swipeCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  swipeCardContent: {
    flex: 1,
    padding: 24,
  },
  swipeCardHeader: {
    flex: 1,
  },
  swipeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  swipeCardCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeRecipeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  swipeCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    lineHeight: 32,
  },
  swipeMacrosSection: {
    marginTop: 24,
  },
  swipeMacrosTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  swipeMacrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  swipeMacroCard: {
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 16,
    minWidth: 70,
  },
  swipeMacroValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 8,
  },
  swipeMacroLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
    textAlign: 'center',
  },
  swipeCardFooter: {
    alignItems: 'center',
    marginTop: 20,
  },
  swipeMetaText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginLeft: 8,
    fontWeight: '500',
  },
  swipeNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
  },
  swipeNavButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#008b8b',
    justifyContent: 'center',
    alignItems: 'center',
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
  openModalButton: {
    backgroundColor: '#008b8b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
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
  openModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    backgroundColor: '#008b8b',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    minHeight: 200, // Ensure enough space for long titles
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensure it's above other elements
  },
  modalHeaderContent: {
    alignItems: 'center',
    marginTop: 20,
    paddingRight: 60, // Add padding to prevent overlap with close button
  },
  modalTitle: {
    fontSize: 22, // Slightly smaller to accommodate longer titles
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    lineHeight: 28,
  },
  // Modal Macros Styles
  modalMacrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  modalMacroItem: {
    alignItems: 'center',
  },
  modalMacroValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  modalMacroLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  modalMacroDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  saveButton: {
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 24,
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
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 139, 139, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  ingredientsContainer: {
    gap: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#008b8b',
    marginTop: 6,
    marginRight: 12,
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },
  instructionsContainer: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#008b8b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 2,
  },
  stepNumberText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#008b8b',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Loading Overlay
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  loadingText: {
    marginTop: 16,
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '600',
  },
});
