import React, {useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
  Linking,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/auth';
import { useFocusEffect } from '@react-navigation/native';
import PersistentFooter from "../components/PersistentFooter";
import { saveRecipeToFirebase } from '../utils/recipeUtils';

const RecipeScreen = ({ navigation }) => {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const navigate = useNavigation();
  
  // Add state for authentication and premium status
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoginVisible, setIsLoginVisible] = useState(false);

  // Loading texts for consistency
  const [loadingText, setLoadingText] = useState("");
  const loadingTexts = [
    "Loading delicious recipes...",
    "Discovering amazing dishes...",
    "Finding culinary inspiration...",
    "Preparing recipe collection...",
    "Gathering cooking ideas...",
  ];

  useEffect(() => {
    if (loading && !refreshing) {
      let currentIndex = 0;
      const textInterval = setInterval(() => {
        setLoadingText(loadingTexts[currentIndex]);
        currentIndex = (currentIndex + 1) % loadingTexts.length;
      }, 1200);

      return () => clearInterval(textInterval);
    }
  }, [loading, refreshing]);

  // Check login status whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      checkLoginStatus();
    }, [])
  );

  useEffect(() => {
    loadRecipes();
    
    // Set up auth state listener
    const unsubscribe = authService.onAuthStateChange((user) => {
      setIsLoggedIn(!!user);
      if (user) {
        checkPremiumStatus();
      } else {
        setIsPremium(false);
      }
    });

    // Initialize auth service
    authService.initialize().then((isAuthenticated) => {
      setIsLoggedIn(isAuthenticated);
      if (isAuthenticated) {
        checkPremiumStatus();
      }
    });

    return () => unsubscribe();
  }, []);

  const checkLoginStatus = async () => {
    const user = authService.getCurrentUser();
    setIsLoggedIn(!!user);
    if (user) {
      checkPremiumStatus();
    }
  };

  const checkPremiumStatus = async () => {
    try {
      const isPremiumUser = await authService.checkPremiumStatus();
      setIsPremium(isPremiumUser);
    } catch (error) {
      console.error("Error checking premium status:", error);
    }
  };

  // Handler for when login is required by footer navigation
  const handleLoginRequired = () => {
    setIsLoginVisible(true);
  };

  // Convert structured recipe to text format for saving
  const convertRecipeToText = (recipe) => {
    let recipeText = `${recipe.strMeal}\n\n`;
    
    // Add meta information
    if (recipe.strCategory) {
      recipeText += `Category: ${recipe.strCategory}\n`;
    }
    if (recipe.strArea) {
      recipeText += `Cuisine: ${recipe.strArea}\n`;
    }
    recipeText += '\n';

    // Add ingredients
    recipeText += 'Ingredients:\n';
    for (let i = 1; i <= 20; i++) {
      const ingredient = recipe[`strIngredient${i}`];
      const measure = recipe[`strMeasure${i}`];
      
      if (ingredient && ingredient.trim()) {
        const measureText = measure && measure.trim() ? `${measure.trim()} ` : '';
        recipeText += `• ${measureText}${ingredient.trim()}\n`;
      }
    }
    recipeText += '\n';

    // Add instructions
    recipeText += 'Instructions:\n';
    if (recipe.strInstructions) {
      // Split instructions by periods or new lines and number them
      const instructions = recipe.strInstructions
        .split(/\.|(?:\r?\n)+/)
        .map(inst => inst.trim())
        .filter(inst => inst.length > 0);
      
      instructions.forEach((instruction, index) => {
        recipeText += `${index + 1}. ${instruction}\n`;
      });
    }

    // Add YouTube link if available
    if (recipe.strYoutube) {
      recipeText += `\nVideo Tutorial: ${recipe.strYoutube}\n`;
    }

    // Add image URL for display purposes
    if (recipe.strMealThumb) {
      recipeText += `\nImage: ${recipe.strMealThumb}\n`;
    }

    return recipeText;
  };

  // Handle recipe save
  const handleRecipeSave = async (recipe) => {
    try {
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
            onPress: () => navi.navigate("LandingPage"),
          },
        ]);
        return;
      }

      setSaveLoading(true);

      // Convert recipe to text format and save
      const recipeText = convertRecipeToText(recipe);
      await saveRecipeToFirebase(recipeText);

      // Show success message
      Alert.alert(
        "Recipe Saved!",
        "Recipe saved successfully! You can view it in My Recipes.",
        [
          {
            text: "View Now",
            onPress: () => navigation.navigate("MyRecipes"),
          },
          {
            text: "Continue Browsing",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      console.error("Error saving recipe:", error);
      
      if (error.message === "User not logged in") {
        Alert.alert("Login Required", "Please log in to save recipes", [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Log In",
            onPress: () => navigate.navigate("LandingPage"),
          },
        ]);
      } else {
        Alert.alert("Error", "Failed to save recipe. Please try again.");
      }
    } finally {
      setSaveLoading(false);
    }
  };

  // Load random recipes from API
  const loadRecipes = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setRefreshing(isRefresh);
      
      const newRecipes = [];
      
      // Fetch 12 random recipes
      for (let i = 0; i < 12; i++) {
        const response = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
        const data = await response.json();
        
        if (data.meals && data.meals.length > 0) {
          const recipe = data.meals[0];
          // Avoid duplicates
          if (!newRecipes.some(r => r.idMeal === recipe.idMeal)) {
            newRecipes.push(recipe);
          } else {
            i--; // Retry if duplicate
          }
        }
      }
      
      setRecipes(newRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    loadRecipes(true);
  };

  // Load recipe details
  const loadRecipeDetails = async (recipeId) => {
    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`);
      const data = await response.json();
      
      if (data.meals && data.meals.length > 0) {
        const recipe = data.meals[0];
        const ingredients = [];
        
        // Extract ingredients and measurements
        for (let i = 1; i <= 20; i++) {
          const ingredient = recipe[`strIngredient${i}`];
          const measure = recipe[`strMeasure${i}`];
          
          if (ingredient && ingredient.trim()) {
            ingredients.push({
              ingredient,
              measure: measure || ''
            });
          }
        }
        
        setSelectedRecipe({ ...recipe, ingredients });
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Error loading recipe details:', error);
    }
  };

  // Close recipe modal
  const closeRecipeModal = () => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedRecipe(null);
    }, 300);
  };

  // Open YouTube video
  const openVideoLink = () => {
    if (selectedRecipe?.strYoutube) {
      Linking.openURL(selectedRecipe.strYoutube);
    }
  };

  // Render recipe card
  const renderRecipeCard = ({ item }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      onPress={() => loadRecipeDetails(item.idMeal)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.strMealThumb }} style={styles.recipeImage} />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.strCategory}</Text>
        </View>
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.recipeTitle} numberOfLines={2}>
          {item.strMeal}
        </Text>
        {item.strArea && (
          <Text style={styles.originText}>{item.strArea}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render recipe details modal
  const renderRecipeDetails = () => {
    if (!selectedRecipe) return null;

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
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Hero Image */}
            <View style={styles.heroContainer}>
              <Image
                source={{ uri: selectedRecipe.strMealThumb }}
                style={styles.heroImage}
              />
              <TouchableOpacity style={styles.closeButton} onPress={closeRecipeModal}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <View style={styles.heroOverlay}>
                <Text style={styles.heroTitle}>{selectedRecipe.strMeal}</Text>
                <View style={styles.heroMeta}>
                  <Text style={styles.heroMetaText}>{selectedRecipe.strCategory}</Text>
                  {selectedRecipe.strArea && (
                    <Text style={styles.heroMetaText}>• {selectedRecipe.strArea}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
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
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <View style={styles.ingredientsContainer}>
                  {selectedRecipe.ingredients.map((item, index) => (
                    <View key={index} style={styles.ingredientItem}>
                      <View style={styles.ingredientBullet} />
                      <View style={styles.ingredientTextContainer}>
                        <Text style={styles.ingredientName}>{item.ingredient}</Text>
                        <Text style={styles.ingredientMeasure}>{item.measure}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Instructions Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Instructions</Text>
                <Text style={styles.instructionsText}>
                  {selectedRecipe.strInstructions}
                </Text>
              </View>

              {/* Video Button */}
              {selectedRecipe.strYoutube && (
                <TouchableOpacity style={styles.videoButton} onPress={openVideoLink}>
                  <Ionicons name="play-circle" size={24} color="white" />
                  <Text style={styles.videoButtonText}>Watch Video Tutorial</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#008b8b" />
        <Text style={styles.loadingText}>{loadingText}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#008b8b" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Recipe Explorer</Text>
            <Text style={styles.headerSubtitle}>Discover amazing dishes</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh"
            size={20}
            color="white"
            style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
          />
          <Text style={styles.refreshButtonText}>
            {refreshing ? 'Loading...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recipe Grid */}
      <FlatList
        data={recipes}
        renderItem={renderRecipeCard}
        keyExtractor={(item) => item.idMeal}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Persistent Footer Navigation */}
      <PersistentFooter
        navigation={navigation}
        isLoggedIn={isLoggedIn}
        isPremium={isPremium}
        onLoginRequired={handleLoginRequired}
      />

      {/* Recipe Details Modal */}
      {renderRecipeDetails()}
    </SafeAreaView>
  );
};

// Get screen dimensions
const { width, height } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#008b8b',
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    backgroundColor: 'white',
    marginTop: -2,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e6f3f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  refreshButton: {
    backgroundColor: '#008b8b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  gridContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  recipeCard: {
    width: CARD_WIDTH,
    marginHorizontal: 10,
    marginVertical: 12,
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
  imageContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: CARD_WIDTH * 0.8,
    resizeMode: 'cover',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 139, 139, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 22,
  },
  originText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  heroContainer: {
    position: 'relative',
    height: height * 0.4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    opacity: 0.9,
  },
  contentContainer: {
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
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
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
  ingredientTextContainer: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  ingredientMeasure: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  instructionsText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
    fontWeight: '400',
  },
  videoButton: {
    backgroundColor: '#008b8b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  videoButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RecipeScreen;
