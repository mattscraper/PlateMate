import React, { useState, useEffect, useCallback } from 'react';
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
  StatusBar,
  Platform,
  Alert,
  TextInput,
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
  const [searchQuery, setSearchQuery] = useState('');
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

  // Convert TheMealDB recipe to text format for saving
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
      // Split instructions into steps
      const steps = recipe.strInstructions
        .split(/\r?\n/)
        .filter(step => step.trim().length > 0)
        .map(step => step.trim());
      
      steps.forEach((step, index) => {
        recipeText += `${index + 1}. ${step}\n`;
      });
    }

    // Add YouTube link if available
    if (recipe.strYoutube) {
      recipeText += `\nVideo Tutorial: ${recipe.strYoutube}\n`;
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
            onPress: () => {
              setModalVisible(false);
              navigation.navigate("LandingPage", { openLoginModal: true });
            },
          },
        ]);
        return;
      }

      setSaveLoading(true);

      // Convert recipe to text format and save
      const recipeText = convertRecipeToText(recipe);
      await saveRecipeToFirebase(recipeText);

      Alert.alert(
        "Recipe Saved!",
        "Your recipe has been saved successfully.",
        [{ text: "OK", style: "default" }]
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
            onPress: () => {
              setModalVisible(false);
              navigation.navigate("LandingPage", { openLoginModal: true });
            },
          },
        ]);
      } else {
        Alert.alert("Error", "Failed to save recipe. Please try again.");
      }
    } finally {
      setSaveLoading(false);
    }
  };

  // Load diverse recipes using multiple approaches
  const loadRecipes = async (isRefresh = false, query = '') => {
    try {
      if (!isRefresh) setLoading(true);
      setRefreshing(isRefresh);
      
      let allRecipes = [];

      if (query.trim()) {
        // Search by name
        try {
          const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query.trim())}`);
          const data = await response.json();
          if (data.meals) {
            allRecipes = data.meals;
          }
        } catch (error) {
          console.log('Search error:', error);
        }
      } else {
        // Load diverse recipes using multiple strategies for better variety
        const strategies = [
          // Get recipes by first letters
          'a', 'b', 'c', 'd', 'e',
          // Get random recipes
          'random', 'random', 'random', 'random', 'random'
        ];

        for (const strategy of strategies) {
          try {
            let url;
            if (strategy === 'random') {
              url = 'https://www.themealdb.com/api/json/v1/1/random.php';
            } else {
              url = `https://www.themealdb.com/api/json/v1/1/search.php?f=${strategy}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            
            if (data.meals && Array.isArray(data.meals)) {
              allRecipes.push(...data.meals);
            }
          } catch (error) {
            console.log(`Error loading ${strategy}:`, error);
          }
        }

        // Remove duplicates
        const uniqueRecipes = allRecipes.filter((recipe, index, self) =>
          index === self.findIndex(r => r.idMeal === recipe.idMeal)
        );

        // Shuffle for variety
        allRecipes = uniqueRecipes.sort(() => 0.5 - Math.random()).slice(0, 30);
      }
      
      setRecipes(allRecipes);
    } catch (error) {
      console.error('Error loading recipes:', error);
      Alert.alert('Error', 'Failed to load recipes. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Debounced search function
  const [searchTimeout, setSearchTimeout] = useState(null);

  // Handle search with debouncing
  const handleSearch = (query) => {
    setSearchQuery(query);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      if (query.length > 2) {
        loadRecipes(false, query);
      } else if (query.length === 0) {
        loadRecipes(false, '');
      }
    }, 500); // Wait 500ms after user stops typing
    
    setSearchTimeout(timeout);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  // Handle refresh
  const handleRefresh = () => {
    loadRecipes(true, searchQuery);
  };

  // Load recipe details
  const loadRecipeDetails = async (recipeId) => {
    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`);
      const data = await response.json();
      
      if (data.meals && data.meals.length > 0) {
        const recipe = data.meals[0];
        setSelectedRecipe(recipe);
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Error loading recipe details:', error);
      Alert.alert('Error', 'Failed to load recipe details. Please try again.');
    }
  };

  // Close recipe modal
  const closeRecipeModal = () => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedRecipe(null);
    }, 300);
  };

  // Fixed equal height cards for perfect alignment
  const FIXED_CARD_HEIGHT = 326;
  const FIXED_IMAGE_HEIGHT = 200;

  // Open YouTube video
  const openVideoLink = () => {
    if (selectedRecipe?.strYoutube) {
      // You would use Linking.openURL here
      Alert.alert('Video', 'Would open YouTube video tutorial');
    }
  };

  // Render recipe card with fixed dimensions for perfect alignment
  const renderRecipeCard = ({ item, index }) => {
    return (
      <TouchableOpacity
        style={[styles.recipeCard, { height: FIXED_CARD_HEIGHT }]}
        onPress={() => loadRecipeDetails(item.idMeal)}
        activeOpacity={0.8}
      >
        <View style={[styles.imageContainer, { height: FIXED_IMAGE_HEIGHT }]}>
          <Image
            source={{ uri: item.strMealThumb }}
            style={styles.recipeImage}
            resizeMode="cover"
          />
          <View style={styles.imageOverlay}>
            {item.strCategory && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.strCategory}</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {item.strMeal}
          </Text>
          
          {item.strArea && (
            <View style={styles.metaInfo}>
              <Ionicons name="location-outline" size={14} color="#008b8b" />
              <Text style={styles.cuisineText}>{item.strArea}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => loadRecipeDetails(item.idMeal)}
          >
            <Text style={styles.viewButtonText}>View Recipe</Text>
            <Ionicons name="arrow-forward" size={16} color="#008b8b" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Parse instructions into individual steps
  const parseInstructions = (instructionsText) => {
    if (!instructionsText) return [];
    
    // Clean up the text
    let cleanText = instructionsText.trim();
    
    // Split by common delimiters and clean up
    let steps = cleanText
      .split(/(?:\r?\n)+|(?:\d+\.)|(?:STEP \d+)|(?:Step \d+)/i)
      .map(step => step.trim())
      .filter(step => step.length > 10) // Filter out very short fragments
      .map(step => {
        // Remove leading numbers, periods, or step indicators
        return step.replace(/^[\d\.\s]*/, '').trim();
      })
      .filter(step => step.length > 0);
    
    // If we don't have clear steps, try splitting by sentences
    if (steps.length <= 1) {
      steps = cleanText
        .split(/\.(?=\s[A-Z])|(?<=\.)\s+(?=[A-Z])/g)
        .map(step => step.trim())
        .filter(step => step.length > 15)
        .map(step => step.endsWith('.') ? step : step + '.');
    }
    
    return steps.length > 0 ? steps : [cleanText];
  };

  // Render sleek recipe details modal with swipe gesture
  const renderRecipeDetails = () => {
    if (!selectedRecipe) return null;

    // Extract ingredients
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = selectedRecipe[`strIngredient${i}`];
      const measure = selectedRecipe[`strMeasure${i}`];
      
      if (ingredient && ingredient.trim()) {
        ingredients.push({
          ingredient: ingredient.trim(),
          measure: measure && measure.trim() ? measure.trim() : ''
        });
      }
    }

    // Parse instructions into steps
    const instructionSteps = parseInstructions(selectedRecipe.strInstructions);

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeRecipeModal}
        statusBarTranslucent
        presentationStyle="pageSheet" // iOS swipe gesture
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.modalContainer}>
          {/* Swipe indicator */}
          <View style={styles.swipeIndicator}>
            <View style={styles.swipeHandle} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={true}
            contentContainerStyle={styles.modalScrollContent}
          >
            {/* Hero Image with gradient overlay */}
            <View style={styles.heroContainer}>
              <Image
                source={{ uri: selectedRecipe.strMealThumb }}
                style={styles.heroImage}
              />
              <View style={styles.heroGradientOverlay} />
              
              <TouchableOpacity style={styles.closeButtonNew} onPress={closeRecipeModal}>
                <View style={styles.closeButtonInner}>
                  <Ionicons name="close" size={20} color="#2c3e50" />
                </View>
              </TouchableOpacity>
              
              <View style={styles.heroTextOverlay}>
                <Text style={styles.heroTitleNew}>{selectedRecipe.strMeal}</Text>
                <View style={styles.heroTagsContainer}>
                  {selectedRecipe.strCategory && (
                    <View style={styles.heroTag}>
                      <Text style={styles.heroTagText}>{selectedRecipe.strCategory}</Text>
                    </View>
                  )}
                  {selectedRecipe.strArea && (
                    <View style={styles.heroTag}>
                      <Text style={styles.heroTagText}>{selectedRecipe.strArea}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Content Container */}
            <View style={styles.modalContentContainer}>
              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButtonNew, saveLoading && styles.saveButtonDisabled]}
                onPress={() => handleRecipeSave(selectedRecipe)}
                disabled={saveLoading}
              >
                {saveLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="bookmark-outline" size={20} color="white" />
                )}
                <Text style={styles.saveButtonTextNew}>
                  {saveLoading ? 'Saving...' : 'Save Recipe'}
                </Text>
              </TouchableOpacity>

              {/* Ingredients Section */}
              <View style={styles.sectionNew}>
                <View style={styles.sectionHeaderNew}>
                  <Ionicons name="list-outline" size={20} color="#008b8b" />
                  <Text style={styles.sectionTitleNew}>Ingredients</Text>
                  <Text style={styles.ingredientCount}>({ingredients.length})</Text>
                </View>
                <View style={styles.ingredientsGrid}>
                  {ingredients.map((item, index) => (
                    <View key={index} style={styles.ingredientCard}>
                      <Text style={styles.ingredientNameNew}>{item.ingredient}</Text>
                      {item.measure && (
                        <Text style={styles.ingredientMeasureNew}>{item.measure}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              {/* Instructions Section */}
              {instructionSteps.length > 0 && (
                <View style={styles.sectionNew}>
                  <View style={styles.sectionHeaderNew}>
                    <Ionicons name="clipboard-outline" size={20} color="#008b8b" />
                    <Text style={styles.sectionTitleNew}>Instructions</Text>
                    <Text style={styles.stepCount}>({instructionSteps.length} steps)</Text>
                  </View>
                  <View style={styles.instructionsGrid}>
                    {instructionSteps.map((instruction, index) => (
                      <View key={index} style={styles.instructionCard}>
                        <View style={styles.stepIndicator}>
                          <Text style={styles.stepNumber}>{index + 1}</Text>
                        </View>
                        <Text style={styles.instructionTextNew}>{instruction}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* YouTube Button */}
              {selectedRecipe.strYoutube && (
                <TouchableOpacity style={styles.videoButtonNew} onPress={openVideoLink}>
                  <View style={styles.videoIconContainer}>
                    <Ionicons name="play" size={16} color="white" />
                  </View>
                  <Text style={styles.videoButtonTextNew}>Watch Tutorial</Text>
                </TouchableOpacity>
              )}

              {/* Bottom spacing */}
              <View style={styles.modalBottomSpacing} />
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
            <Text style={styles.headerSubtitle}>Discover Amazing Dishes</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes (e.g., chicken, pasta, curry)..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
          </View>
        </View>
      </View>

      {/* Recipes Grid - Better Aligned */}
      <FlatList
        data={recipes}
        renderItem={renderRecipeCard}
        keyExtractor={(item) => item.idMeal}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        columnWrapperStyle={styles.row}
        removeClippedSubviews={false}
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      {/* Empty State */}
      {!loading && recipes.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No recipes found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try a different search term' : 'Pull to refresh to load recipes'}
          </Text>
        </View>
      )}

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
const CARD_WIDTH = (width - 45) / 2;

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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#008b8b',
    fontWeight: '600',
    textAlign: 'center',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    margintop:-55,
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
    marginTop: 5,
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
  searchContainer: {
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  gridContainer: {
    padding: 15,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Align cards to top for better grid appearance
  },
  recipeCard: {
    width: CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: 20,
    marginBottom: 15,
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
    width: '100%',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  categoryBadge: {
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
    flex: 1,
    justifyContent: 'space-between', // Ensures button stays at bottom
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 20,
    height: 40, // Fixed height for title area
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  cuisineText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f3f3',
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    marginTop: 5,// Pushes button to bottom
    marginBottom: 2,
  },
  viewButtonText: {
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '600',
    marginBottom: 2,
    padding: 3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  swipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  modalScrollContent: {
    paddingBottom: 30,
  },
  heroContainer: {
    position: 'relative',
    height: height * 0.35,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeButtonNew: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroTitleNew: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    lineHeight: 28,
  },
  heroTagsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  heroTag: {
    backgroundColor: 'rgba(0, 139, 139, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroTagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContentContainer: {
    padding: 20,
  },
  saveButtonNew: {
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 24,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  saveButtonTextNew: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionNew: {
    marginBottom: 28,
  },
  sectionHeaderNew: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitleNew: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  ingredientCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  stepCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ingredientsGrid: {
    gap: 12,
  },
  ingredientCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ingredientNameNew: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  ingredientMeasureNew: {
    fontSize: 13,
    color: '#008b8b',
    fontWeight: '500',
  },
  instructionsGrid: {
    gap: 16,
  },
  instructionCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#008b8b',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumber: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  instructionTextNew: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#2c3e50',
    fontWeight: '400',
  },
  videoButtonNew: {
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  videoIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoButtonTextNew: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBottomSpacing: {
    height: 20,
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
    gap: 8,
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
    marginBottom: 2,
  },
  ingredientMeasure: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  instructionsContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
  },
  instructionText: {
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
