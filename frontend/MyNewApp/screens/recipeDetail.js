import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SaveRecipeButton from "../components/SaveRecipeButton";

export default function RecipeDetailScreen({ navigation, route }) {
  const { recipe } = route.params || {
    title: "Sample Recipe",
    cookTime: "30 min",
    difficulty: "Easy",
    ingredients: ["2 cups flour", "1 cup sugar", "3 eggs", "1/2 cup milk"],
    instructions: [
      "Preheat oven to 350°F (175°C).",
      "Mix dry ingredients in a bowl.",
      "Add wet ingredients and mix until smooth.",
      "Pour batter into a greased pan.",
      "Bake for 25-30 minutes or until a toothpick comes out clean.",
    ],
    tags: ["dessert", "baking", "vegetarian"],
  };

  const [imageError, setImageError] = useState(false);

  // Parse saved recipe text to extract structured data
  const parseRecipeText = (recipeText) => {
    if (!recipeText || typeof recipeText !== 'string') {
      console.log('RecipeDetailScreen: No text to parse, using default recipe');
      return recipe; // Return default recipe if no text
    }

    console.log('RecipeDetailScreen: Parsing recipe text:', recipeText.substring(0, 200) + '...');

    const lines = recipeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const parsedRecipe = {
      title: '',
      category: '',
      cuisine: '',
      ingredients: [],
      instructions: [],
      videoUrl: '',
      imageUrl: '',
      tags: []
    };

    let currentSection = 'title';
    let instructionCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // First line is typically the title
      if (i === 0 && !parsedRecipe.title) {
        parsedRecipe.title = line;
        continue;
      }

      // Check for meta information
      if (line.startsWith('Category:')) {
        parsedRecipe.category = line.replace('Category:', '').trim();
        parsedRecipe.tags.push(parsedRecipe.category.toLowerCase());
        continue;
      }
      
      if (line.startsWith('Cuisine:')) {
        parsedRecipe.cuisine = line.replace('Cuisine:', '').trim();
        parsedRecipe.tags.push(parsedRecipe.cuisine.toLowerCase());
        continue;
      }

      // Check for video URL - be more flexible with matching
      if (line.toLowerCase().includes('video tutorial:') || line.toLowerCase().includes('youtube.com') || line.toLowerCase().includes('youtu.be')) {
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          parsedRecipe.videoUrl = urlMatch[1].trim();
          console.log('RecipeDetailScreen: Found video URL:', parsedRecipe.videoUrl);
        }
        continue;
      }

      // Check for image URL - be more flexible with matching
      if (line.toLowerCase().includes('image:') || line.includes('themealdb.com') || line.match(/\.(jpg|jpeg|png|gif)/i)) {
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          parsedRecipe.imageUrl = urlMatch[1].trim();
          console.log('RecipeDetailScreen: Found image URL:', parsedRecipe.imageUrl);
        }
        continue;
      }

      // Check for section headers
      if (line.toLowerCase() === 'ingredients:') {
        currentSection = 'ingredients';
        continue;
      }
      
      if (line.toLowerCase() === 'instructions:') {
        currentSection = 'instructions';
        instructionCounter = 0;
        continue;
      }

      // Process content based on current section
      if (currentSection === 'ingredients' && line.startsWith('•')) {
        parsedRecipe.ingredients.push(line.replace('•', '').trim());
      } else if (currentSection === 'instructions' && /^\d+\./.test(line)) {
        parsedRecipe.instructions.push(line.replace(/^\d+\.\s*/, '').trim());
        instructionCounter++;
      }
    }

    // Add default values if missing
    if (!parsedRecipe.title) {
      parsedRecipe.title = recipe.title || "Saved Recipe";
    }

    console.log('RecipeDetailScreen: Parsed recipe:', {
      title: parsedRecipe.title,
      hasVideo: !!parsedRecipe.videoUrl,
      hasImage: !!parsedRecipe.imageUrl,
      videoUrl: parsedRecipe.videoUrl,
      imageUrl: parsedRecipe.imageUrl
    });

    return parsedRecipe;
  };

  // If we have a string recipe (from saved recipes), parse it
  const displayRecipe = typeof recipe === 'string' ? parseRecipeText(recipe) : recipe;

  // Add debugging
  console.log('RecipeDetailScreen: Recipe type:', typeof recipe);
  console.log('RecipeDetailScreen: Display recipe:', {
    title: displayRecipe.title,
    hasVideo: !!displayRecipe.videoUrl,
    hasImage: !!displayRecipe.imageUrl,
    videoUrl: displayRecipe.videoUrl?.substring(0, 50) + '...',
    imageUrl: displayRecipe.imageUrl?.substring(0, 50) + '...'
  });

  const handleLoginRequired = () => {
    Alert.alert("Login Required", "Please login to save recipes", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Login",
        onPress: () => navigation.navigate("LandingPage"),
      },
    ]);
  };

  const handleRecipeSaved = (savedRecipe) => {
    console.log("Recipe saved:", savedRecipe.title);
  };

  const openVideoLink = () => {
    console.log('RecipeDetailScreen: Attempting to open video:', displayRecipe.videoUrl);
    if (displayRecipe.videoUrl) {
      Linking.canOpenURL(displayRecipe.videoUrl)
        .then((supported) => {
          console.log('RecipeDetailScreen: URL supported:', supported);
          if (supported) {
            return Linking.openURL(displayRecipe.videoUrl);
          } else {
            Alert.alert('Error', 'Cannot open this video link');
          }
        })
        .catch((err) => {
          console.error('RecipeDetailScreen: Error opening URL:', err);
          Alert.alert('Error', 'Failed to open video link');
        });
    } else {
      console.log('RecipeDetailScreen: No video URL available');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayRecipe.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Recipe Image */}
          {displayRecipe.imageUrl && !imageError && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: displayRecipe.imageUrl }}
                style={styles.recipeImage}
                resizeMode="cover"
                onError={(error) => {
                  console.log('RecipeDetailScreen: Image load error:', error.nativeEvent.error);
                  setImageError(true);
                }}
                onLoad={() => {
                  console.log('RecipeDetailScreen: Image loaded successfully');
                }}
              />
            </View>
          )}

          {/* Fallback if image fails or for debugging */}
          {displayRecipe.imageUrl && imageError && (
            <View style={styles.imageContainer}>
              <View style={[styles.recipeImage, styles.imagePlaceholder]}>
                <Ionicons name="image-outline" size={48} color="#ccc" />
                <Text style={styles.imageErrorText}>Image failed to load</Text>
                <Text style={styles.imageUrlText} numberOfLines={2}>
                  {displayRecipe.imageUrl}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.heroSection}>
            <View style={styles.titleContainer}>
              <Text style={styles.recipeTitle}>{displayRecipe.title}</Text>

              <View style={styles.metaInfo}>
                {displayRecipe.cookTime && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={18} color="#008b8b" />
                    <Text style={styles.metaText}>{displayRecipe.cookTime}</Text>
                  </View>
                )}

                {displayRecipe.difficulty && (
                  <View style={styles.metaItem}>
                    <Ionicons
                      name="fitness-outline"
                      size={18}
                      color="#008b8b"
                    />
                    <Text style={styles.metaText}>{displayRecipe.difficulty}</Text>
                  </View>
                )}

                {displayRecipe.servings && (
                  <View style={styles.metaItem}>
                    <Ionicons name="people-outline" size={18} color="#008b8b" />
                    <Text style={styles.metaText}>
                      {displayRecipe.servings} servings
                    </Text>
                  </View>
                )}

                {displayRecipe.category && (
                  <View style={styles.metaItem}>
                    <Ionicons name="restaurant-outline" size={18} color="#008b8b" />
                    <Text style={styles.metaText}>{displayRecipe.category}</Text>
                  </View>
                )}

                {displayRecipe.cuisine && (
                  <View style={styles.metaItem}>
                    <Ionicons name="globe-outline" size={18} color="#008b8b" />
                    <Text style={styles.metaText}>{displayRecipe.cuisine}</Text>
                  </View>
                )}
              </View>

              <View style={styles.tagsContainer}>
                {displayRecipe.tags &&
                  displayRecipe.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>

          {/* Video Tutorial Button */}
          {displayRecipe.videoUrl && (
            <View style={styles.videoSection}>
              <TouchableOpacity style={styles.videoButton} onPress={openVideoLink}>
                <Ionicons name="play-circle" size={24} color="white" />
                <Text style={styles.videoButtonText}>Watch Video Tutorial</Text>
              </TouchableOpacity>
              {/* Debug info */}
              <Text style={styles.debugText} numberOfLines={2}>
                Video: {displayRecipe.videoUrl}
              </Text>
            </View>
          )}

          <View style={styles.saveButtonContainer}>
            <SaveRecipeButton
              recipe={displayRecipe}
              onSaved={handleRecipeSaved}
              onLoginRequired={handleLoginRequired}
            />
          </View>

          {displayRecipe.ingredients && displayRecipe.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.ingredientsList}>
                {displayRecipe.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.bulletPoint} />
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {displayRecipe.instructions && displayRecipe.instructions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              <View style={styles.instructionsList}>
                {displayRecipe.instructions.map((instruction, index) => (
                  <View key={index} style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={styles.instructionText}>{instruction}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginTop: -2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    flex: 1,
    textAlign: "center",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  imageContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  recipeImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  imageErrorText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  imageUrlText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  videoSection: {
    marginBottom: 20,
  },
  debugText: {
    fontSize: 10,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  heroSection: {
    marginBottom: 20,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  titleContainer: {
    width: "100%",
  },
  recipeTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 4,
    color: "#2c3e50",
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tag: {
    backgroundColor: "#e6f3f3",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: "#008b8b",
  },
  videoButton: {
    backgroundColor: "#008b8b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  videoButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  saveButtonContainer: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 16,
  },
  ingredientsList: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bulletPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#008b8b",
    marginRight: 10,
  },
  ingredientText: {
    fontSize: 16,
    color: "#2c3e50",
    flex: 1,
  },
  instructionsList: {
    marginTop: 8,
  },
  instructionItem: {
    flexDirection: "row",
    marginBottom: 20,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#008b8b",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  instructionText: {
    fontSize: 16,
    color: "#2c3e50",
    flex: 1,
    lineHeight: 24,
  },
});
