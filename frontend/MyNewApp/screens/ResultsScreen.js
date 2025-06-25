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
import { LinearGradient } from 'expo-linear-gradient';
import { saveRecipeToFirebase } from "../utils/recipeUtils";
import { useNavigation } from "@react-navigation/native";
import { fetchRecipes } from "../utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { authService } from "../services/auth";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = (width - 60) / 2;

// Beautiful gradient combinations
const gradients = [
  ['#FF6B6B', '#4ECDC4'],
  ['#A8E6CF', '#3D5A80'],
  ['#FFD93D', '#FF6B6B'],
  ['#6C5CE7', '#A29BFE'],
  ['#FD79A8', '#FDCB6E'],
  ['#00B894', '#00CEC9'],
  ['#E17055', '#FDCB6E'],
  ['#0984E3', '#74B9FF'],
];

export default function ResultsScreen({ route }) {
  const navigation = useNavigation();
  const [recipes, setRecipes] = useState(route.params?.recipes || []);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [viewMode, setViewMode] = useState('grid');
  const [currentSwipeIndex, setCurrentSwipeIndex] = useState(0);

  const { mealType = "", healthy = false, allergies = [] } = route.params || {};

  useEffect(() => {
    // Stunning entrance animation
    Animated.spring(fadeAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleRecipeSave = async (recipeText) => {
    try {
      setSaveLoading(true);
      
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

      await saveRecipeToFirebase(recipeText);

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
      
      fadeAnim.setValue(0);
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
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
      !line.match(/^\d+\./) &&
      !line.includes('•')
    );
    
    return titleLine ? titleLine.trim() : "Delicious Recipe";
  };

  const extractCookingTime = (recipeText) => {
    if (!recipeText) return "30 min";
    
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
    
    const lowerText = recipeText.toLowerCase();
    
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
    
    const steps = recipeText.match(/\d+\./g);
    if (steps && steps.length > 8) return "Hard";
    if (steps && steps.length > 5) return "Medium";
    
    return "Easy";
  };

  const formatRecipeForModal = (recipeText) => {
    if (!recipeText) return { ingredients: [], instructions: [], title: "Recipe", macros: {} };
    
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
      
      if (lowerLine.includes('ingredients')) {
        currentSection = 'ingredients';
        continue;
      } else if (lowerLine.includes('instructions')) {
        currentSection = 'instructions';
        continue;
      }
      
      if (line.includes('•') || (currentSection === 'ingredients' && line && !line.match(/^\d+\./))) {
        const ingredient = line.replace('•', '').trim();
        if (ingredient && !ingredient.toLowerCase().includes('instructions')) {
          ingredients.push(ingredient);
        }
      }
      else if (line.match(/^\d+\./) || (currentSection === 'instructions' && line && !line.includes('•'))) {
        const instruction = line.replace(/^\d+\./, '').trim();
        if (instruction && instruction.length > 5) {
          instructions.push(instruction);
        }
      }
    }
    
    if (ingredients.length === 0 || instructions.length === 0) {
      const sections = cleanText.split(/\n\s*\n/).filter(section => section.trim());
      
      sections.forEach(section => {
        if (section.includes('•')) {
          const sectionIngredients = section
            .split('\n')
            .filter(line => line.includes('•'))
            .map(line => line.replace('•', '').trim())
            .filter(line => line);
          ingredients.push(...sectionIngredients);
        } else if (section.match(/^\d+\./m) || section.toLowerCase().includes('instructions')) {
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

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return ['#00B894', '#00CEC9'];
      case 'Medium': return ['#FDCB6E', '#E17055'];
      case 'Hard': return ['#E84393', '#FD79A8'];
      default: return ['#00B894', '#00CEC9'];
    }
  };

  const renderRecipeCard = ({ item, index }) => {
    const title = extractRecipeTitle(item);
    const cookTime = extractCookingTime(item);
    const difficulty = extractDifficulty(item);
    const macros = extractMacros(item);
    const cardGradient = gradients[index % gradients.length];
    const difficultyColors = getDifficultyColor(difficulty);
    
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
                  outputRange: [80, 0],
                }),
              },
              {
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => openRecipeModal(item)}
          activeOpacity={0.9}
          style={styles.cardTouchable}
        >
          {/* Beautiful gradient background */}
          <LinearGradient
            colors={cardGradient}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Floating elements for visual interest */}
            <View style={styles.floatingElement1} />
            <View style={styles.floatingElement2} />
            
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={difficultyColors}
                style={styles.difficultyBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.difficultyText}>{difficulty}</Text>
              </LinearGradient>
              
              <TouchableOpacity
                style={styles.quickSaveButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRecipeSave(item);
                }}
              >
                <View style={styles.saveButtonInner}>
                  <Ionicons name="bookmark-outline" size={16} color="white" />
                </View>
              </TouchableOpacity>
            </View>
            
            <View style={styles.cardContent}>
              {/* Glowing recipe icon */}
              <View style={styles.recipeIconContainer}>
                <View style={styles.iconGlow} />
                <Ionicons name="restaurant" size={28} color="white" />
              </View>
              
              <Text style={styles.cardTitle} numberOfLines={2}>
                {title}
              </Text>
              
              {/* Enhanced meta info */}
              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <View style={styles.metaIconContainer}>
                    <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={styles.metaText}>{cookTime}</Text>
                </View>
                <View style={styles.metaItem}>
                  <View style={styles.metaIconContainer}>
                    <Ionicons name="flame-outline" size={12} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={styles.metaText}>{macros.calories} cal</Text>
                </View>
              </View>

              {/* Beautiful macros display */}
              <View style={styles.macrosContainer}>
                <View style={styles.macroItem}>
                  <View style={styles.macroCircle}>
                    <Text style={styles.macroValue}>{macros.protein}</Text>
                  </View>
                  <Text style={styles.macroLabel}>Protein</Text>
                </View>
                <View style={styles.macroItem}>
                  <View style={styles.macroCircle}>
                    <Text style={styles.macroValue}>{macros.carbs}</Text>
                  </View>
                  <Text style={styles.macroLabel}>Carbs</Text>
                </View>
                <View style={styles.macroItem}>
                  <View style={styles.macroCircle}>
                    <Text style={styles.macroValue}>{macros.fat}</Text>
                  </View>
                  <Text style={styles.macroLabel}>Fat</Text>
                </View>
              </View>
            </View>
            
            {/* Shimmer overlay effect */}
            <View style={styles.shimmerOverlay} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderSwipeCard = (item, index) => {
    const title = extractRecipeTitle(item);
    const cookTime = extractCookingTime(item);
    const difficulty = extractDifficulty(item);
    const macros = extractMacros(item);
    const cardGradient = gradients[index % gradients.length];
    const difficultyColors = getDifficultyColor(difficulty);
    
    return (
      <View style={styles.swipeCard}>
        <TouchableOpacity
          onPress={() => openRecipeModal(item)}
          activeOpacity={0.9}
          style={styles.swipeCardContent}
        >
          <LinearGradient
            colors={cardGradient}
            style={styles.swipeCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Decorative elements */}
            <View style={styles.swipeFloatingElement1} />
            <View style={styles.swipeFloatingElement2} />
            <View style={styles.swipeFloatingElement3} />
            
            <View style={styles.swipeCardHeader}>
              <View style={styles.swipeCardTop}>
                <LinearGradient
                  colors={difficultyColors}
                  style={styles.difficultyBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.difficultyText}>{difficulty}</Text>
                </LinearGradient>
                
                <TouchableOpacity
                  style={styles.quickSaveButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRecipeSave(item);
                  }}
                >
                  <View style={styles.saveButtonInner}>
                    <Ionicons name="bookmark-outline" size={20} color="white" />
                  </View>
                </TouchableOpacity>
              </View>
              
              <View style={styles.swipeCardCenter}>
                {/* Enhanced glowing icon */}
                <View style={styles.swipeRecipeIconContainer}>
                  <View style={styles.swipeIconGlow} />
                  <View style={styles.swipeIconGlow2} />
                  <Ionicons name="restaurant" size={48} color="white" />
                </View>
                
                <Text style={styles.swipeCardTitle} numberOfLines={3}>
                  {title}
                </Text>
              </View>
            </View>

            {/* Stunning macros section */}
            <View style={styles.swipeMacrosSection}>
              <Text style={styles.swipeMacrosTitle}>Nutritional Info</Text>
              <View style={styles.swipeMacrosGrid}>
                <View style={styles.swipeMacroCard}>
                  <LinearGradient
                    colors={['#FF6B6B', '#FF8E8E']}
                    style={styles.swipeMacroGradient}
                  >
                    <Ionicons name="flame" size={20} color="white" />
                    <Text style={styles.swipeMacroValue}>{macros.calories}</Text>
                    <Text style={styles.swipeMacroLabel}>Calories</Text>
                  </LinearGradient>
                </View>
                <View style={styles.swipeMacroCard}>
                  <LinearGradient
                    colors={['#4ECDC4', '#44A08D']}
                    style={styles.swipeMacroGradient}
                  >
                    <Ionicons name="barbell" size={20} color="white" />
                    <Text style={styles.swipeMacroValue}>{macros.protein}</Text>
                    <Text style={styles.swipeMacroLabel}>Protein</Text>
                  </LinearGradient>
                </View>
                <View style={styles.swipeMacroCard}>
                  <LinearGradient
                    colors={['#45B7D1', '#96C93F']}
                    style={styles.swipeMacroGradient}
                  >
                    <Ionicons name="leaf" size={20} color="white" />
                    <Text style={styles.swipeMacroValue}>{macros.carbs}</Text>
                    <Text style={styles.swipeMacroLabel}>Carbs</Text>
                  </LinearGradient>
                </View>
                <View style={styles.swipeMacroCard}>
                  <LinearGradient
                    colors={['#F7B731', '#F0932B']}
                    style={styles.swipeMacroGradient}
                  >
                    <Ionicons name="water" size={20} color="white" />
                    <Text style={styles.swipeMacroValue}>{macros.fat}</Text>
                    <Text style={styles.swipeMacroLabel}>Fat</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            <View style={styles.swipeCardFooter}>
              <View style={styles.swipeTimeContainer}>
                <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.swipeMetaText}>{cookTime}</Text>
              </View>
            </View>
          </LinearGradient>
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
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalHeader}
          >
            <TouchableOpacity style={styles.closeButton} onPress={closeRecipeModal}>
              <View style={styles.closeButtonInner}>
                <Ionicons name="close" size={24} color="white" />
              </View>
            </TouchableOpacity>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalTitle} numberOfLines={3}>{title}</Text>
              
              {/* Enhanced macros in header */}
              <View style={styles.modalMacrosRow}>
                <View style={styles.modalMacroItem}>
                  <View style={styles.modalMacroCircle}>
                    <Text style={styles.modalMacroValue}>{macros.calories}</Text>
                  </View>
                  <Text style={styles.modalMacroLabel}>cal</Text>
                </View>
                <View style={styles.modalMacroDivider} />
                <View style={styles.modalMacroItem}>
                  <View style={styles.modalMacroCircle}>
                    <Text style={styles.modalMacroValue}>{macros.protein}</Text>
                  </View>
                  <Text style={styles.modalMacroLabel}>protein</Text>
                </View>
                <View style={styles.modalMacroDivider} />
                <View style={styles.modalMacroItem}>
                  <View style={styles.modalMacroCircle}>
                    <Text style={styles.modalMacroValue}>{macros.carbs}</Text>
                  </View>
                  <Text style={styles.modalMacroLabel}>carbs</Text>
                </View>
                <View style={styles.modalMacroDivider} />
                <View style={styles.modalMacroItem}>
                  <View style={styles.modalMacroCircle}>
                    <Text style={styles.modalMacroValue}>{macros.fat}</Text>
                  </View>
                  <Text style={styles.modalMacroLabel}>fat</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Beautiful save button */}
            <TouchableOpacity
              style={[styles.saveButton, saveLoading && styles.saveButtonDisabled]}
              onPress={() => handleRecipeSave(selectedRecipe)}
              disabled={saveLoading}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.saveButtonGradient}
              >
                {saveLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="bookmark-outline" size={24} color="white" />
                )}
                <Text style={styles.saveButtonText}>
                  {saveLoading ? 'Saving...' : 'Save Recipe'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Enhanced sections */}
            {ingredients.length > 0 && (
              <View style={styles.modalSection}>
                <View style={styles.sectionHeader}>
                  <LinearGradient
                    colors={['#4ECDC4', '#44A08D']}
                    style={styles.sectionIcon}
                  >
                    <Ionicons name="restaurant" size={20} color="white" />
                  </LinearGradient>
                  <Text style={styles.sectionTitle}>Ingredients</Text>
                </View>
                <View style={styles.ingredientsContainer}>
                  {ingredients.map((ingredient, index) => (
                    <View key={index} style={styles.ingredientItem}>
                      <LinearGradient
                        colors={['#4ECDC4', '#44A08D']}
                        style={styles.ingredientBullet}
                      />
                      <Text style={styles.ingredientText}>{ingredient}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {instructions.length > 0 && (
              <View style={styles.modalSection}>
                <View style={styles.sectionHeader}>
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.sectionIcon}
                  >
                    <Ionicons name="list" size={20} color="white" />
                  </LinearGradient>
                  <Text style={styles.sectionTitle}>Instructions</Text>
                </View>
                <View style={styles.instructionsContainer}>
                  {instructions.map((instruction, index) => (
                    <View key={index} style={styles.instructionItem}>
                      <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        style={styles.stepNumber}
                      >
                        <Text style={styles.stepNumberText}>{index + 1}</Text>
                      </LinearGradient>
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
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <View style={styles.backButtonInner}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recipe Results</Text>
          <View style={{ width: 44 }} />
        </LinearGradient>
        
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <LinearGradient
              colors={['#4ECDC4', '#44A08D']}
              style={styles.emptyIconGradient}
            >
              <Ionicons name="restaurant-outline" size={64} color="white" />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>No Recipes Found</Text>
          <Text style={styles.emptyText}>
            We couldn't find any recipes matching your criteria. Try adjusting your preferences.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.retryButtonGradient}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Stunning loading overlay */}
      <Modal transparent={true} visible={loading}>
        <BlurView intensity={100} style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.loadingGradient}
            >
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.loadingText}>Finding new recipes...</Text>
            </LinearGradient>
          </View>
        </BlurView>
      </Modal>

      {/* Beautiful gradient header */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <View style={styles.backButtonInner}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Recipe Results</Text>
          <Text style={styles.headerSubtitle}>{recipes.length} delicious recipes</Text>
        </View>
        
        <View style={styles.headerActions}>
          {/* Enhanced view toggle */}
          <TouchableOpacity
            style={styles.viewToggleButton}
            onPress={() => handleViewModeChange(viewMode === 'grid' ? 'swipe' : 'grid')}
          >
            <LinearGradient
              colors={viewMode === 'grid' ? ['#4ECDC4', '#44A08D'] : ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              style={styles.viewToggleGradient}
            >
              <Ionicons
                name={viewMode === 'grid' ? 'layers-outline' : 'grid-outline'}
                size={18}
                color="white"
              />
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={regenerateRecipes}
            disabled={loading}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF8E8E']}
              style={styles.refreshGradient}
            >
              <Ionicons name="refresh" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Content based on view mode */}
      {viewMode === 'grid' ? (
        <View style={styles.gridWrapper}>
          <FlatList
            data={recipes}
            renderItem={renderRecipeCard}
            keyExtractor={(item, index) => index.toString()}
            numColumns={2}
            contentContainerStyle={styles.gridContainer}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.row}
          />
        </View>
      ) : (
        <View style={styles.swipeContainer}>
          <LinearGradient
            colors={['rgba(102, 126, 234, 0.1)', 'rgba(118, 75, 162, 0.1)']}
            style={styles.swipeHeader}
          >
            <Text style={styles.swipeCounter}>
              {currentSwipeIndex + 1} of {recipes.length}
            </Text>
          </LinearGradient>
          
          <View style={styles.swipeContent}>
            {recipes.length > 0 && (
              <View key={currentSwipeIndex} style={styles.swipeCardWrapper}>
                {renderSwipeCard(recipes[currentSwipeIndex], currentSwipeIndex)}
              </View>
            )}
          </View>
          
          {/* Enhanced navigation */}
          <LinearGradient
            colors={['rgba(102, 126, 234, 0.1)', 'rgba(118, 75, 162, 0.1)']}
            style={styles.swipeNavigation}
          >
            <TouchableOpacity
              style={styles.swipeNavButton}
              onPress={() => handleSwipeChange('prev')}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.swipeNavGradient}
              >
                <Ionicons name="chevron-back" size={24} color="white" />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.openModalButton}
              onPress={() => openRecipeModal(recipes[currentSwipeIndex])}
            >
              <LinearGradient
                colors={['#4ECDC4', '#44A08D']}
                style={styles.openModalGradient}
              >
                <Text style={styles.openModalButtonText}>View Full Recipe</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.swipeNavButton}
              onPress={() => handleSwipeChange('next')}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.swipeNavGradient}
              >
                <Ionicons name="chevron-forward" size={24} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
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
  
  // Enhanced Header Styles
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  backButton: {
    width: 44,
    height: 44,
  },
  backButtonInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewToggleButton: {
    width: 44,
    height: 44,
  },
  viewToggleGradient: {
    flex: 1,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  refreshButton: {
    width: 44,
    height: 44,
  },
  refreshGradient: {
    flex: 1,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Enhanced Grid Styles
  gridWrapper: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    height: 280,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardTouchable: {
    flex: 1,
  },
  cardGradient: {
    flex: 1,
    position: 'relative',
  },

  // Floating decorative elements
  floatingElement1: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  floatingElement2: {
    position: 'absolute',
    bottom: 30,
    left: 15,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  quickSaveButton: {
    width: 36,
    height: 36,
  },
  saveButtonInner: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  cardContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    lineHeight: 22,
    minHeight: 44,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metaIconContainer: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },

  // Enhanced Macros
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  macroLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },

  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  // Enhanced Swipe View
  swipeContainer: {
    flex: 1,
  },
  swipeHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(102, 126, 234, 0.1)',
  },
  swipeCounter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
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
    borderRadius: 32,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  swipeCardContent: {
    flex: 1,
  },
  swipeCardGradient: {
    flex: 1,
    position: 'relative',
    padding: 24,
  },

  // Swipe decorative elements
  swipeFloatingElement1: {
    position: 'absolute',
    top: 40,
    right: 30,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  swipeFloatingElement2: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  swipeFloatingElement3: {
    position: 'absolute',
    top: '50%',
    left: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  swipeIconGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  swipeIconGlow2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  swipeCardTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    lineHeight: 36,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  swipeMacrosSection: {
    marginTop: 24,
  },
  swipeMacrosTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  swipeMacrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  swipeMacroCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  swipeMacroGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  swipeMacroValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 4,
  },
  swipeMacroLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    textAlign: 'center',
  },
  swipeCardFooter: {
    alignItems: 'center',
    marginTop: 20,
  },
  swipeTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  swipeMetaText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 8,
    fontWeight: '600',
  },

  // Enhanced Navigation
  swipeNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(102, 126, 234, 0.1)',
  },
  swipeNavButton: {
    width: 56,
    height: 56,
  },
  swipeNavGradient: {
    flex: 1,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  openModalButton: {
    height: 56,
    paddingHorizontal: 24,
  },
  openModalGradient: {
    flex: 1,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  openModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Enhanced Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    minHeight: 220,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    zIndex: 10,
  },
  closeButtonInner: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modalHeaderContent: {
    alignItems: 'center',
    marginTop: 20,
    paddingRight: 60,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  modalMacrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalMacroItem: {
    alignItems: 'center',
  },
  modalMacroCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: 4,
  },
  modalMacroValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  modalMacroLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  modalMacroDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 16,
  },

  modalContent: {
    flex: 1,
    padding: 24,
  },
  saveButton: {
    height: 56,
    borderRadius: 28,
    marginBottom: 24,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  modalSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#f0f0f0',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
  },

  ingredientsContainer: {
    gap: 12,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
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
  ingredientBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    marginRight: 16,
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    fontWeight: '500',
  },

  instructionsContainer: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
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
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontWeight: '500',
  },

  // Enhanced Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    overflow: 'hidden',
  },
  emptyIconGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  retryButton: {
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    overflow: 'hidden',
  },
  retryButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Enhanced Loading Overlay
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  loadingGradient: {
    padding: 40,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

