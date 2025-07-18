import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import PersistentFooter from "../components/PersistentFooter";

const { width } = Dimensions.get("window");

export default function MoreScreen({ navigation }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    checkAuthStatus();

    const unsubscribe = authService.onAuthStateChange((user) => {
      setIsLoggedIn(!!user);
      if (user) {
        checkPremiumStatus();
      } else {
        setIsPremium(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const checkAuthStatus = () => {
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
      setIsPremium(false);
    }
  };

  const handleLoginRequired = () => {
    Alert.alert(
      "Login Required",
      "You need to sign in to access this feature.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign In",
          onPress: () => navigation.navigate("LandingPage"),
        },
      ]
    );
  };

  const handlePremiumFeaturePress = (featureName, screenName) => {
    if (!isLoggedIn) {
      handleLoginRequired();
      return;
    }

    if (!isPremium) {
      Alert.alert(
        "Premium Feature",
        `${featureName} is a premium feature. Would you like to upgrade to premium?`,
        [
          {
            text: "Not Now",
            style: "cancel",
          },
          {
            text: "Learn More",
            onPress: () => navigation.navigate("PremiumPlans"),
          },
        ]
      );
      return;
    }

    navigation.navigate(screenName);
  };

  // Feature Card Component matching landing screen style
  const FeatureCard = ({ icon, title, description, onPress, isPremiumFeature = false }) => (
    <TouchableOpacity
      style={styles.featureCard}
      onPress={onPress}
      activeOpacity={0.95}
    >
      <View style={styles.featureCardContent}>
        <View style={styles.featureIconContainer}>
          <Ionicons name={icon} size={36} color="#008b8b" />
          {isPremiumFeature && !isPremium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="diamond" size={12} color="#FFD700" />
            </View>
          )}
        </View>
        <View style={styles.featureTextContainer}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featureDescription}>{description}</Text>
        </View>
        <View style={styles.featureArrow}>
          <Ionicons name="chevron-forward" size={22} color="#008b8b" />
        </View>
      </View>
    </TouchableOpacity>
  );

  // Premium Status Banner
  const PremiumStatusBanner = () => {
    if (!isLoggedIn) return null;

    return (
      <View style={[styles.statusBanner, isPremium ? styles.premiumBanner : styles.freeBanner]}>
        <View style={styles.statusContent}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusIcon, isPremium ? styles.premiumIcon : styles.freeIcon]}>
              <Ionicons
                name={isPremium ? "diamond" : "person-circle-outline"}
                size={20}
                color={isPremium ? "#FFD700" : "#008b8b"}
              />
            </View>
            <View style={styles.statusText}>
              <Text style={[styles.statusTitle, isPremium ? styles.premiumText : styles.freeText]}>
                {isPremium ? "Premium Member" : "Free Account"}
              </Text>
              <Text style={[styles.statusSubtitle, isPremium ? styles.premiumSubtext : styles.freeSubtext]}>
                {isPremium ? "All features unlocked" : "Upgrade for full access"}
              </Text>
            </View>
          </View>
          {!isPremium && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => navigation.navigate("PremiumPlans")}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
              <Ionicons name="arrow-forward" size={14} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Explore More</Text>
            <Text style={styles.headerSubtitle}>Discover all features</Text>
          </View>
          
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Premium Status Banner */}
          <PremiumStatusBanner />

          {/* Featured Tools Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Features</Text>
            <Text style={styles.sectionSubtitle}>
              Everything you need for your nutrition journey
            </Text>

            <View style={styles.featuresGrid}>
              {/* Free Features */}
              <FeatureCard
                icon="image"
                title="Recipe Explorer"
                description="Browse thousands of delicious recipes with video tutorials and step-by-step instructions"
                onPress={() => navigation.navigate("RecipeScreen")}
              />

              <FeatureCard
                icon="search"
                title="Recipe Builder"
                description="Get personalized recipes based on your dietary preferences and cooking style"
                onPress={() => {
                  if (!isLoggedIn) {
                    handleLoginRequired();
                    return;
                  }
                  navigation.navigate("FindRecipes");
                }}
              />

              <FeatureCard
                icon="scan"
                title="Food Scanner"
                description="Scan any product barcode for instant health scores and detailed nutritional insights"
                onPress={() => {
                  if (!isLoggedIn) {
                    handleLoginRequired();
                    return;
                  }
                  navigation.navigate("FoodScannerHome");
                }}
              />

              <FeatureCard
                icon="bookmark"
                title="My Recipes"
                description="Save your favorite recipes and access your personal collection anywhere"
                onPress={() => {
                  if (isLoggedIn) {
                    navigation.navigate("MyRecipes");
                  } else {
                    handleLoginRequired();
                  }
                }}
              />

              {/* Premium Features */}
              <FeatureCard
                icon="nutrition-outline"
                title="Smart Nutrition Tracker"
                description="AI-powered food logging with detailed macro tracking and personalized insights"
                onPress={() =>
                  handlePremiumFeaturePress("Smart Nutrition Tracker", "FoodLog")
                }
                isPremiumFeature={true}
              />

              <FeatureCard
                icon="scale-outline"
                title="Weight Manager"
                description="Smart weight tracking with AI insights, goal setting, and progress forecasting"
                onPress={() =>
                  handlePremiumFeaturePress("Weight Management", "WeightManager")
                }
                isPremiumFeature={true}
              />

              <FeatureCard
                icon="basket-outline"
                title="Ingredient Recipes"
                description="Find creative recipes using ingredients you already have in your kitchen"
                onPress={() =>
                  handlePremiumFeaturePress("Recipe search by ingredients", "FindByIngredients")
                }
                isPremiumFeature={true}
              />

              <FeatureCard
                icon="book-outline"
                title="Meal Planner"
                description="Personalized weekly meal plans with automated grocery lists and nutrition tracking"
                onPress={() =>
                  handlePremiumFeaturePress("Meal Planning", "MealPlans")
                }
                isPremiumFeature={true}
              />

              <FeatureCard
                icon="bar-chart-outline"
                title="Food Log History"
                description="Detailed nutrition history with trends, insights, and progress tracking over time"
                onPress={() =>
                  handlePremiumFeaturePress("Food Log History", "FoodLogHistory")
                }
                isPremiumFeature={true}
              />
            </View>
          </View>

          {/* Premium CTA for non-premium users */}
          {isLoggedIn && !isPremium && (
            <View style={styles.premiumCTASection}>
              <TouchableOpacity
                style={styles.premiumCTA}
                onPress={() => navigation.navigate("PremiumPlans")}
                activeOpacity={0.9}
              >
                <View style={styles.premiumCTAContent}>
                  <View style={styles.premiumCTAHeader}>
                    <Ionicons name="diamond" size={24} color="#FFD700" />
                    <Text style={styles.premiumCTATitle}>Unlock Premium</Text>
                  </View>
                  <Text style={styles.premiumCTADescription}>
                    Get access to all premium features including nutrition tracking, meal planning, and advanced analytics
                  </Text>
                  <View style={styles.premiumCTAButton}>
                    <Text style={styles.premiumCTAButtonText}>Upgrade Now</Text>
                    <Ionicons name="arrow-forward" size={16} color="white" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Persistent Footer */}
      <PersistentFooter
        navigation={navigation}
        onLoginRequired={handleLoginRequired}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  safeArea: {
    flex: 1,
  },

  // Header Styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#7f8c8d",
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },

  scrollContent: {
    paddingBottom: 100, // Account for footer
  },

  // Status Banner Styles
  statusBanner: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  premiumBanner: {
    backgroundColor: "#FFF8DC",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  freeBanner: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  premiumIcon: {
    backgroundColor: "#FFF",
  },
  freeIcon: {
    backgroundColor: "#FFF",
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  premiumText: {
    color: "#B8860B",
  },
  freeText: {
    color: "#1E40AF",
  },
  statusSubtitle: {
    fontSize: 12,
  },
  premiumSubtext: {
    color: "#B8860B",
  },
  freeSubtext: {
    color: "#3B82F6",
  },
  upgradeButton: {
    backgroundColor: "#008b8b",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  upgradeButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },

  // Section Styles
  section: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    marginBottom: 24,
    lineHeight: 22,
  },

  // Features Grid
  featuresGrid: {
    gap: 14,
  },

  // Feature Card Styles (matching landing screen)
  featureCard: {
    backgroundColor: "white",
    borderRadius: 18,
    borderLeftWidth: 5,
    borderLeftColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  featureCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  featureIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 18,
    position: "relative",
  },
  premiumBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFF8DC",
    borderWidth: 2,
    borderColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  featureTextContainer: {
    flex: 1,
    marginRight: 14,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 14,
    color: "#7f8c8d",
    lineHeight: 20,
  },
  featureArrow: {
    padding: 3,
  },

  // Premium CTA Section
  premiumCTASection: {
    padding: 20,
    marginTop: 10,
  },
  premiumCTA: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFD700",
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  premiumCTAContent: {
    padding: 24,
    alignItems: "center",
  },
  premiumCTAHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  premiumCTATitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#2c3e50",
  },
  premiumCTADescription: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  premiumCTAButton: {
    backgroundColor: "#008b8b",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  premiumCTAButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});
