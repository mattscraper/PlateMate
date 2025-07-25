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
  Linking,
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
  const [activeTab, setActiveTab] = useState('ingredients');
  const navigate = useNavigation();
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const [premiumStatusLoading, setPremiumStatusLoading] = useState(true);

  const [loadingText, setLoadingText] = useState("");
  const loadingTexts = [
    "Loading delicious recipes...",
    "Discovering amazing dishes...",
    "Finding culinary inspiration...",
    "Preparing recipe collection...",
    "Gathering cooking ideas...",
  ];

  // Improved conversion functions for US standards with whole number rounding
  const convertToUSMeasurements = (measure) => {
    if (!measure || typeof measure !== 'string') return measure;
    
    let converted = measure.toLowerCase();
    
    // Temperature conversions - round to whole numbers
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*°?c\b/g, (match, celsius) => {
      const fahrenheit = Math.round((parseFloat(celsius) * 9/5) + 32);
      return `${fahrenheit}°F`;
    });
    
    // Weight conversions - round to whole numbers
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*g\b/g, (match, grams) => {
      const oz = Math.round(parseFloat(grams) * 0.035274);
      return oz > 0 ? `${oz} oz` : `${Math.round(parseFloat(grams))} g`;
    });
    
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*kg\b/g, (match, kg) => {
      const lbs = Math.round(parseFloat(kg) * 2.20462 * 10) / 10; // Round to 1 decimal for pounds
      return `${lbs} lbs`;
    });
    
    // Volume conversions - round to appropriate whole numbers or common fractions
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*ml\b/g, (match, ml) => {
      const mlValue = parseFloat(ml);
      if (mlValue >= 240) { // Convert larger amounts to cups
        const cups = Math.round(mlValue / 240 * 4) / 4; // Round to nearest quarter cup
        return cups >= 1 ? `${cups} cup${cups !== 1 ? 's' : ''}` : `${Math.round(mlValue * 0.033814)} fl oz`;
      } else {
        const flOz = Math.round(mlValue * 0.033814);
        return flOz > 0 ? `${flOz} fl oz` : `${Math.round(mlValue)} ml`;
      }
    });
    
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*l\b/g, (match, liters) => {
      const literValue = parseFloat(liters);
      const cups = Math.round(literValue * 4.22675 * 4) / 4; // Round to nearest quarter cup
      return `${cups} cup${cups !== 1 ? 's' : ''}`;
    });
    
    // Common measurement standardizations
    converted = converted.replace(/\btsp\b/g, 'tsp');
    converted = converted.replace(/\btbsp\b/g, 'tbsp');
    
    // Convert decimal measurements to common fractions
    converted = converted.replace(/0\.5/g, '1/2');
    converted = converted.replace(/0\.25/g, '1/4');
    converted = converted.replace(/0\.75/g, '3/4');
    converted = converted.replace(/0\.33/g, '1/3');
    converted = converted.replace(/0\.67/g, '2/3');
    
    return converted.charAt(0).toUpperCase() + converted.slice(1);
  };

  const convertInstructionsToUS = (instructions) => {
    if (!instructions || typeof instructions !== 'string') return instructions;
    
    let converted = instructions;
    
    // Temperature conversions in instructions - round to whole numbers
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*°?c\b/gi, (match, celsius) => {
      const fahrenheit = Math.round((parseFloat(celsius) * 9/5) + 32);
      return `${fahrenheit}°F`;
    });
    
    // Common cooking temperature conversions
    converted = converted.replace(/gas mark (\d+)/gi, (match, gasMark) => {
      const gasToF = { 1: 275, 2: 300, 3: 325, 4: 350, 5: 375, 6: 400, 7: 425, 8: 450, 9: 475 };
      return gasToF[gasMark] ? `${gasToF[gasMark]}°F` : match;
    });
    
    // Weight conversions in instructions
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*g\b/gi, (match, grams) => {
      const oz = Math.round(parseFloat(grams) * 0.035274);
      return oz > 0 ? `${oz} oz` : `${Math.round(parseFloat(grams))} g`;
    });
    
    // Volume conversions in instructions
    converted = converted.replace(/(\d+(?:\.\d+)?)\s*ml\b/gi, (match, ml) => {
      const mlValue = parseFloat(ml);
      if (mlValue >= 240) {
        const cups = Math.round(mlValue / 240 * 4) / 4;
        return `${cups} cup${cups !== 1 ? 's' : ''}`;
      } else {
        const flOz = Math.round(mlValue * 0.033814);
        return flOz > 0 ? `${flOz} fl oz` : `${Math.round(mlValue)} ml`;
      }
    });
    
    return converted;
  };

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

  useFocusEffect(
    useCallback(() => {
      checkLoginStatus();
    }, [])
  );

  useEffect(() => {
    loadRecipes();
    
    const unsubscribe = authService.onAuthStateChange(async (user) => {
      setIsLoggedIn(!!user);
      if (user) {
        setPremiumStatusLoading(true);
        await checkPremiumStatus();
        setPremiumStatusLoading(false);
      } else {
        setIsPremium(false);
        setPremiumStatusLoading(false);
      }
    });

    checkLoginStatus();

    return () => unsubscribe();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const user = authService.getCurrentUser();
      setIsLoggedIn(!!user);
      if (user) {
        setPremiumStatusLoading(true);
        await checkPremiumStatus();
        setPremiumStatusLoading(false);
      } else {
        setPremiumStatusLoading(false);
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      setIsLoggedIn(false);
      setPremiumStatusLoading(false);
    }
  };

  const checkPremiumStatus = async () => {
    try {
      const isPremiumUser = await authService.checkPremiumStatus();
      setIsPremium(isPremiumUser);
    } catch (error) {
      console.error("Error checking premium status:", error);
      setIsPremium(false);
    }
  };

  const handleLoginRequired = () => {
    setIsLoginVisible(true);
  };

  const convertRecipeToText = (recipe) => {
    let recipeText = `${recipe.strMeal}\n\n`;
    
    if (recipe.strCategory) {
      recipeText += `Category: ${recipe.strCategory}\n`;
    }
    if (recipe.strArea) {
      recipeText += `Cuisine: ${recipe.strArea}\n`;
    }
    recipeText += '\n';

    recipeText += 'Ingredients:\n';
    for (let i = 1; i <= 20; i++) {
      const ingredient = recipe[`strIngredient${i}`];
      const measure = recipe[`strMeasure${i}`];
      
      if (ingredient && ingredient.trim()) {
        const measureText = measure && measure.trim() ? `${convertToUSMeasurements(measure.trim())} ` : '';
        recipeText += `• ${measureText}${ingredient.trim()}\n`;
      }
    }
    recipeText += '\n';

    recipeText += 'Instructions:\n';
    if (recipe.strInstructions) {
      const convertedInstructions = convertInstructionsToUS(recipe.strInstructions);
      const steps = convertedInstructions
        .split(/\r?\n/)
        .filter(step => step.trim().length > 0)
        .map(step => step.trim());
      
      steps.forEach((step, index) => {
        recipeText += `${index + 1}. ${step}\n`;
      });
    }

    if (recipe.strYoutube) {
      recipeText += `\nVideo Tutorial: ${recipe.strYoutube}\n`;
    }

    return recipeText;
  };

  const handleRecipeSave = async (recipe) => {
    try {
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

  const loadRecipes = async (isRefresh = false, query = '') => {
    try {
      if (!isRefresh) setLoading(true);
      setRefreshing(isRefresh);
      
      let allRecipes = [];

      if (query.trim()) {
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
        const strategies = [
          'a', 'b', 'c', 'd', 'e',
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

        const uniqueRecipes = allRecipes.filter((recipe, index, self) =>
          index === self.findIndex(r => r.idMeal === recipe.idMeal)
        );

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

  // Improved search with longer debounce delay
  const [searchTimeout, setSearchTimeout] = useState(null);

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Increased timeout to 1000ms (1 second) to prevent premature searches
    const timeout = setTimeout(() => {
      if (query.length > 2) {
        loadRecipes(false, query);
      } else if (query.length === 0) {
        loadRecipes(false, '');
      }
    }, 1000);
    
    setSearchTimeout(timeout);
  };

  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const handleRefresh = () => {
    loadRecipes(true, searchQuery);
  };

  const loadRecipeDetails = async (recipeId) => {
    try {
      const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`);
      const data = await response.json();
      
      if (data.meals && data.meals.length > 0) {
        const recipe = data.meals[0];
        setSelectedRecipe(recipe);
        setActiveTab('ingredients');
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Error loading recipe details:', error);
      Alert.alert('Error', 'Failed to load recipe details. Please try again.');
    }
  };

  const closeRecipeModal = () => {
    setModalVisible(false);
    setTimeout(() => {
      setSelectedRecipe(null);
    }, 300);
  };

  const FIXED_CARD_HEIGHT = 326;
  const FIXED_IMAGE_HEIGHT = 200;

  const openVideoLink = async () => {
    if (selectedRecipe?.strYoutube) {
      try {
        const supported = await Linking.canOpenURL(selectedRecipe.strYoutube);
        if (supported) {
          await Linking.openURL(selectedRecipe.strYoutube);
        } else {
          Alert.alert('Error', 'Cannot open YouTube video. Please check if you have YouTube installed.');
        }
      } catch (error) {
        console.error('Error opening YouTube link:', error);
        Alert.alert('Error', 'Failed to open video tutorial.');
      }
    }
  };

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

  const parseInstructions = (instructionsText) => {
    if (!instructionsText) return [];
    
    // Convert to US standards first
    let cleanText = convertInstructionsToUS(instructionsText.trim());
    
    let steps = cleanText
      .split(/(?:\r?\n)+|(?:\d+\.)|(?:STEP \d+)|(?:Step \d+)/i)
      .map(step => step.trim())
      .filter(step => step.length > 10)
      .map(step => {
        return step.replace(/^[\d\.\s]*/, '').trim();
      })
      .filter(step => step.length > 0);
    
    if (steps.length <= 1) {
      steps = cleanText
        .split(/\.(?=\s[A-Z])|(?<=\.)\s+(?=[A-Z])/g)
        .map(step => step.trim())
        .filter(step => step.length > 15)
        .map(step => step.endsWith('.') ? step : step + '.');
    }
    
    return steps.length > 0 ? steps : [cleanText];
  };

  const renderTabContent = () => {
    if (!selectedRecipe) return null;

    if (activeTab === 'ingredients') {
      const ingredients = [];
      for (let i = 1; i <= 20; i++) {
        const ingredient = selectedRecipe[`strIngredient${i}`];
        const measure = selectedRecipe[`strMeasure${i}`];
        
        if (ingredient && ingredient.trim()) {
          ingredients.push({
            ingredient: ingredient.trim(),
            measure: measure && measure.trim() ? convertToUSMeasurements(measure.trim()) : ''
          });
        }
      }

      return (
        <View style={styles.tabContent}>
          <View style={styles.ingredientsGrid}>
            {ingredients.map((item, index) => (
              <View key={index} style={styles.ingredientCard}>
                <View style={styles.ingredientHeader}>
                  <Text style={styles.ingredientName}>{item.ingredient}</Text>
                  {item.measure && (
                    <Text style={styles.ingredientMeasure}>{item.measure}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    } else if (activeTab === 'instructions') {
      const instructionSteps = parseInstructions(selectedRecipe.strInstructions);

      return (
        <View style={styles.tabContent}>
          <View style={styles.instructionsGrid}>
            {instructionSteps.map((instruction, index) => (
              <View key={index} style={styles.instructionCard}>
                <View style={styles.stepIndicator}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }
  };

  const renderRecipeDetails = () => {
    if (!selectedRecipe) return null;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeRecipeModal}
        statusBarTranslucent
        presentationStyle="pageSheet"
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.modalContainer}>
          <View style={styles.swipeIndicator}>
            <View style={styles.swipeHandle} />
          </View>

          <View style={styles.heroContainer}>
            <Image
              source={{ uri: selectedRecipe.strMealThumb }}
              style={styles.heroImage}
            />
            <View style={styles.heroOverlay} />
            
            <TouchableOpacity style={styles.closeButton} onPress={closeRecipeModal}>
              <View style={styles.closeButtonInner}>
                <Ionicons name="close" size={20} color="#2c3e50" />
              </View>
            </TouchableOpacity>
            
            <View style={styles.heroTextOverlay}>
              <Text style={styles.heroTitle}>{selectedRecipe.strMeal}</Text>
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

          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.saveButton, saveLoading && styles.saveButtonDisabled]}
              onPress={() => handleRecipeSave(selectedRecipe)}
              disabled={saveLoading}
            >
              {saveLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="bookmark-outline" size={18} color="white" />
              )}
              <Text style={styles.saveButtonText}>
                {saveLoading ? 'Saving...' : 'Save Recipe'}
              </Text>
            </TouchableOpacity>

            {selectedRecipe.strYoutube && (
              <TouchableOpacity style={styles.videoButton} onPress={openVideoLink}>
                <View style={styles.videoIconContainer}>
                  <Ionicons name="play" size={14} color="white" />
                </View>
                <Text style={styles.videoButtonText}>Watch Video</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
              onPress={() => setActiveTab('ingredients')}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={activeTab === 'ingredients' ? '#008b8b' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>
                Ingredients
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === 'instructions' && styles.activeTab]}
              onPress={() => setActiveTab('instructions')}
            >
              <Ionicons
                name="clipboard-outline"
                size={18}
                color={activeTab === 'instructions' ? '#008b8b' : '#666'}
              />
              <Text style={[styles.tabText, activeTab === 'instructions' && styles.activeTabText]}>
                Instructions
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {renderTabContent()}
            <View style={styles.modalBottomSpacing} />
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
          {/* Added refresh button */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={refreshing ? "#ccc" : "#008b8b"}
            />
          </TouchableOpacity>
        </View>

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

      {!loading && recipes.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>No recipes found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? 'Try a different search term' : 'Pull to refresh to load recipes'}
          </Text>
        </View>
      )}

      <PersistentFooter
        navigation={navigation}
        isLoggedIn={isLoggedIn}
        isPremium={!premiumStatusLoading ? isPremium : false}
        onLoginRequired={handleLoginRequired}
      />

      {renderRecipeDetails()}
    </SafeAreaView>
  );
};

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
  // New refresh button styles
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6f3f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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
    alignItems: 'flex-start',
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
    justifyContent: 'space-between',
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 20,
    height: 40,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    marginTop: 5,
  },
  viewButtonText: {
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '600',
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
  heroContainer: {
    position: 'relative',
    height: height * 0.25,
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
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeButton: {
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
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    lineHeight: 26,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
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
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  videoButton: {
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#e6f3f3',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#008b8b',
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  tabContent: {
    flex: 1,
  },
  ingredientsGrid: {
    gap: 16,
  },
  ingredientCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  ingredientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  ingredientName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    lineHeight: 22,
  },
  ingredientMeasure: {
    fontSize: 14,
    color: '#008b8b',
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 60,
  },
  instructionsGrid: {
    gap: 20,
  },
  instructionCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#008b8b',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  stepNumber: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
    fontWeight: '400',
  },
  modalBottomSpacing: {
    height: 20,
  },
});

export default RecipeScreen;
