import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StyleSheet, Text, View, Image, Animated, ActivityIndicator, Platform } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';
import PurchaseService from "./services/PurchaseService";
import { authService } from "./services/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";

import ResultsScreen from "./screens/ResultsScreen";
import RecipeScreen from "./screens/RecipeScreen"
import FindRecipes from "./screens/FindRecipes";
import LandingScreen from "./screens/Landing";
import MyRecipes from "./screens/MyRecipes";
import RecipeIngredients from "./screens/RecipeIngredient";
import ResultsIngredientsScreen from "./screens/ResultsIngredients";
import MealPlans from "./screens/MealPlans";
import MealPlanResults from "./screens/MealPlanResults";
import PremiumPlansScreen from "./screens/PremiumPlansScreen";
import RecipeDetailScreen from "./screens/recipeDetail";
import { SavedMealPlansScreen } from "./screens/SavedMealPlansScreen";
import MealPlanDetail from "./screens/MealPlanDetail";
import PersistentFooter from "./components/PersistentFooter";
import OnboardingQuestionnaireScreen from "./screens/OnboardingQuestionnaireScreen";

// Food Scanner Imports
import FoodScannerHome from "./screens/FoodScannerHome";
import BarcodeScannerScreen from "./screens/BarcodeScannerScreen";
import ProductDetailScreen from "./screens/ProductDetailScreen";
import ProductSearchScreen from "./screens/ProductSearchScreen";
import FoodLogScreen from "./screens/FoodLogScreen";
import FoodLogHistoryScreen from "./screens/FoodLogHistoryScreen"

const Stack = createStackNavigator();

// Create navigation ref to use for the footer
const navigationRef = React.createRef();

export default function App() {
  // States for authentication
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [splashReady, setSplashReady] = useState(false);
  
  // New onboarding states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Track splash screen timing
  const splashStartTime = useRef(Date.now());
  const minSplashDuration = 3000; // 3 seconds minimum

  // Function to update premium status after purchase
  const handlePremiumStatusUpdate = async () => {
    try {
      const status = await PurchaseService.checkSubscriptionStatus();
      setIsPremium(status.hasActivePremium);
      console.log('Premium status updated:', status.hasActivePremium);
    } catch (error) {
      console.error('Error updating premium status:', error);
      
      // Fallback to Firestore check
      try {
        const firestorePremium = await authService.checkPremiumStatus();
        setIsPremium(firestorePremium);
      } catch (fallbackError) {
        console.error('Error with fallback premium check:', fallbackError);
      }
    }
  };

  // Check if user should see onboarding
  const checkOnboardingStatus = async () => {
    try {
      // Check if app has been opened before
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      const lastOnboardingVersion = await AsyncStorage.getItem('onboardingVersion');
      const currentOnboardingVersion = '1.0'; // Update this when you want to show onboarding again
      
      console.log('Onboarding check:', {
        hasSeenOnboarding,
        lastOnboardingVersion,
        currentOnboardingVersion
      });

      // Show onboarding if:
      // 1. User has never seen it, OR
      // 2. Onboarding version has been updated
      const shouldShowOnboarding = !hasSeenOnboarding || lastOnboardingVersion !== currentOnboardingVersion;
      
      setShowOnboarding(shouldShowOnboarding);
      setOnboardingChecked(true);
      
      console.log('Should show onboarding:', shouldShowOnboarding);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Default to showing onboarding on error
      setShowOnboarding(true);
      setOnboardingChecked(true);
    }
  };

  // Handle onboarding completion
  const handleOnboardingComplete = async (answers) => {
    try {
      console.log('Onboarding completed with answers:', answers);
      
      // Save user profile data if they created an account
      if (isLoggedIn && user) {
        await authService.saveOnboardingData(answers);
        console.log('✅ Onboarding data saved to user profile');
      }
      
      // Mark onboarding as completed
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      await AsyncStorage.setItem('onboardingVersion', '1.0');
      
      setShowOnboarding(false);
      console.log('✅ Onboarding marked as completed');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still hide onboarding to prevent infinite loop
      setShowOnboarding(false);
    }
  };

  // Enhanced auth state listener
  useEffect(() => {
    console.log('🔥 Setting up Firebase auth listener...');
    
    // Listen for auth state changes with proper persistence handling
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔥 Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      
      try {
        setUser(user);
        setIsLoggedIn(!!user);
        
        if (user) {
          console.log('✅ User is authenticated, setting up services...');
          
          // Initialize RevenueCat and check premium status
          try {
            await PurchaseService.configure();
            console.log('✅ RevenueCat configured for user:', user.uid);
            
            // Check subscription status
            const status = await PurchaseService.checkSubscriptionStatus();
            setIsPremium(status.hasActivePremium);
            
            console.log('Premium status:', status.hasActivePremium);
          } catch (error) {
            console.error('Error initializing RevenueCat:', error);
            
            // Fallback to checking Firestore premium status
            try {
              const firestorePremium = await authService.checkPremiumStatus();
              setIsPremium(firestorePremium);
              console.log('Used Firestore fallback, premium status:', firestorePremium);
            } catch (fallbackError) {
              console.error('Error checking Firestore premium status:', fallbackError);
              setIsPremium(false);
            }
          }
        } else {
          // User is logged out
          console.log('❌ User logged out, clearing premium status');
          setIsPremium(false);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        setIsPremium(false);
      } finally {
        // Calculate remaining splash time
        const elapsedTime = Date.now() - splashStartTime.current;
        const remainingTime = Math.max(0, minSplashDuration - elapsedTime);

        // Ensure splash shows for minimum duration
        setTimeout(() => {
          // Mark initialization as complete
          if (initializing) {
            console.log('✅ Auth initialization complete');
            setInitializing(false);
          }
          setAuthChecked(true);
          setSplashReady(true);
        }, remainingTime);
      }
    });

    // Check onboarding status
    checkOnboardingStatus();

    // Initialize sample data (only in development)
    if (__DEV__) {
      // Uncomment if you want to use initializeDatabase
      // initializeDatabase();
    }

    return () => {
      console.log('🧹 Cleaning up auth listener');
      unsubscribe();
    };
  }, []); // Remove initializing dependency to prevent re-running

  // Function to handle login requirement from footer
  const handleLoginRequired = () => {
    setShowLoginModal(true);
    // Navigate to login screen or show login modal
    if (navigationRef.current) {
      navigationRef.current.navigate("LandingPage");
    }
  };

  // Show professional loading screen while initializing
  if (initializing || !authChecked || !splashReady || !onboardingChecked) {
    return (
      <SafeAreaProvider>
        <View style={styles.splashContainer}>
          <StatusBar style="light" />
          <Animated.View style={styles.splashContent}>
            <View style={styles.logoContainer}>
              <Image
                source={require("./assets/logo.png")}
                style={styles.splashLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.splashTitle}>Kitchly</Text>
            <Text style={styles.splashSubtitle}>AI Nutrition Assistant</Text>
            <View style={styles.loadingIndicatorContainer}>
              <ActivityIndicator size="large" color="#008b8b" />
            </View>
          </Animated.View>
        </View>
      </SafeAreaProvider>
    );
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return (
      <SafeAreaProvider>
        <OnboardingQuestionnaireScreen
          navigation={navigationRef}
          onComplete={handleOnboardingComplete}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="LandingPage"
            screenOptions={{
              headerShown: false,
              contentStyle: { paddingBottom: 70 },
            }}
          >
            <Stack.Screen name="LandingPage" component={LandingScreen} />
            <Stack.Screen name="FindRecipes" component={FindRecipes} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen
              name="ResultsIngredients"
              component={ResultsIngredientsScreen}
            />
            <Stack.Screen
              name="FoodLog"
              component={FoodLogScreen}
              options={{ title: "Food Log" }}
            />
            <Stack.Screen name="FoodLogHistory" component={FoodLogHistoryScreen} />
            <Stack.Screen name="MyRecipes" component={MyRecipes} />
            <Stack.Screen
              name="FindByIngredients"
              component={RecipeIngredients}
            />
            <Stack.Screen name="MealPlans" component={MealPlans} />
            <Stack.Screen name="MealPlanResults" component={MealPlanResults} />
            <Stack.Screen
              name="PremiumPlans"
              component={PremiumPlansScreen}
              initialParams={{
                onPremiumStatusUpdate: handlePremiumStatusUpdate,
                isPremium: isPremium
              }}
            />
            <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
            <Stack.Screen name="MealPlanDetail" component={MealPlanDetail} />
            <Stack.Screen
              name="SavedMealPlansScreen"
              component={SavedMealPlansScreen}
            />
            <Stack.Screen
              name="RecipeScreen"
              component={RecipeScreen}
            />
            
            {/* Food Scanner Screens */}
            <Stack.Screen
              name="FoodScannerHome"
              component={FoodScannerHome}
              options={{
                title: 'Food Scanner',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#007AFF',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="BarcodeScanner"
              component={BarcodeScannerScreen}
              options={{
                title: 'Scan Barcode',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#007AFF',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{
                title: 'Product Details',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#007AFF',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            <Stack.Screen
              name="ProductSearch"
              component={ProductSearchScreen}
              options={{
                title: 'Search Products',
                headerShown: true,
                headerStyle: {
                  backgroundColor: '#007AFF',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            />
            
            {/* Onboarding Screen (for manual access if needed) */}
            <Stack.Screen
              name="Onboarding"
              component={OnboardingQuestionnaireScreen}
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>

        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  
  // Professional Splash Screen Styles
  splashContainer: {
    flex: 1,
    backgroundColor: "#008b8b", // Your brand color
    justifyContent: "center",
    alignItems: "center",
  },
  splashContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  splashLogo: {
    width: 120,
    height: 120,
    borderRadius: 30,
  },
  splashTitle: {
    fontSize: 48,
    fontWeight: "800",
    color: "white",
    marginBottom: 8,
    letterSpacing: -1,
    textAlign: "center",
  },
  splashSubtitle: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
    marginBottom: 40,
    textAlign: "center",
  },
  loadingIndicatorContainer: {
    marginTop: 20,
  },
});
