import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StyleSheet, Text, View, Image, Animated, ActivityIndicator, Platform } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';
import PurchaseService from "./services/PurchaseService";
import { authService } from "./services/auth";
import PremiumService from "./services/PremiumService";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";

// Import all your screens
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
const navigationRef = React.createRef();

export default function App() {
  // Core authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  
  // Premium status from PremiumService
  const [isPremium, setIsPremium] = useState(false);
  
  // Onboarding states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Track splash screen timing
  const splashStartTime = useRef(Date.now());
  const minSplashDuration = 3000;

  // Initialize app
  useEffect(() => {
    initializeApp();
    
    return () => {
      // Cleanup on unmount
      PremiumService.cleanup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 App: Initializing...');
      
      // Initialize PurchaseService
      await initializeRevenueCat();
      
      // Set up auth listener
      const unsubscribe = onAuthStateChanged(auth, handleAuthStateChange);
      
      // Check onboarding status
      await checkOnboardingStatus();
      
      // Initialize auth service
      await authService.initialize();
      
      // Ensure minimum splash duration
      const elapsedTime = Date.now() - splashStartTime.current;
      const remainingTime = Math.max(0, minSplashDuration - elapsedTime);
      
      setTimeout(() => {
        setInitializing(false);
        console.log('✅ App: Initialization complete');
      }, remainingTime);
      
      return () => {
        unsubscribe();
      };
      
    } catch (error) {
      console.error('❌ App: Initialization failed:', error);
      setInitializing(false);
    }
  };

  // Handle authentication state changes
  const handleAuthStateChange = async (user) => {
    console.log('🔥 App: Auth state changed:', user ? `User: ${user.uid}` : 'No user');
    
    setUser(user);
    setIsLoggedIn(!!user);
    
    if (user) {
      // Set up premium status subscription
      const unsubscribePremium = authService.subscribeToPremiumStatus((premiumStatus) => {
        console.log('💎 App: Premium status updated:', premiumStatus);
        setIsPremium(premiumStatus);
      });
      
      // Store the unsubscribe function for cleanup
      user._premiumUnsubscribe = unsubscribePremium;
      
    } else {
      // Clean up premium subscription if user logs out
      setIsPremium(false);
    }
  };

  // Initialize RevenueCat
  const initializeRevenueCat = async () => {
    try {
      console.log('🚀 App: Initializing RevenueCat...');
      
      const success = await PurchaseService.configure(
        'appl_fwRWQRdSViPvwzChtARGpDVvLEs',
        null // Will be set when user logs in
      );
      
      if (success) {
        console.log('✅ App: RevenueCat configured successfully');
      } else {
        console.log('⚠️ App: RevenueCat not available');
      }
      
      return success;
    } catch (error) {
      console.log('⚠️ App: RevenueCat initialization failed:', error);
      return false;
    }
  };

  // Check onboarding status
  const checkOnboardingStatus = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      const lastOnboardingVersion = await AsyncStorage.getItem('onboardingVersion');
      const currentOnboardingVersion = '1.0';
      
      const shouldShowOnboarding = !hasSeenOnboarding || lastOnboardingVersion !== currentOnboardingVersion;
      
      setShowOnboarding(shouldShowOnboarding);
      setOnboardingChecked(true);
      
      console.log('📋 App: Onboarding check complete. Should show:', shouldShowOnboarding);
    } catch (error) {
      console.error('❌ App: Onboarding check failed:', error);
      setShowOnboarding(true);
      setOnboardingChecked(true);
    }
  };

  // Handle onboarding completion
  const handleOnboardingComplete = async (answers) => {
    try {
      console.log('📋 App: Onboarding completed');
      
      if (isLoggedIn && user) {
        await authService.saveOnboardingData(answers);
        console.log('✅ App: Onboarding data saved');
      }
      
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      await AsyncStorage.setItem('onboardingVersion', '1.0');
      
      setShowOnboarding(false);
    } catch (error) {
      console.error('❌ App: Onboarding completion failed:', error);
      setShowOnboarding(false);
    }
  };

  // Handle premium status updates (called from PremiumPlansScreen)
  const handlePremiumStatusUpdate = async () => {
    console.log('🔄 App: Premium status update requested');
    try {
      const newStatus = await authService.forceRefreshPremiumStatus();
      console.log('💎 App: Premium status refreshed:', newStatus);
      return newStatus;
    } catch (error) {
      console.error('❌ App: Premium status update failed:', error);
      return false;
    }
  };

  // Show loading screen
  if (initializing || !onboardingChecked) {
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

  // Show onboarding
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

  // Main app
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
            <Stack.Screen name="ResultsIngredients" component={ResultsIngredientsScreen} />
            <Stack.Screen name="FoodLog" component={FoodLogScreen} options={{ title: "Food Log" }} />
            <Stack.Screen name="FoodLogHistory" component={FoodLogHistoryScreen} />
            <Stack.Screen name="MyRecipes" component={MyRecipes} />
            <Stack.Screen name="FindByIngredients" component={RecipeIngredients} />
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
            <Stack.Screen name="SavedMealPlansScreen" component={SavedMealPlansScreen} />
            <Stack.Screen name="RecipeScreen" component={RecipeScreen} />
            
            {/* Food Scanner Screens */}
            <Stack.Screen
              name="FoodScannerHome"
              component={FoodScannerHome}
              options={{
                title: 'Food Scanner',
                headerShown: true,
                headerStyle: { backgroundColor: '#007AFF' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
              }}
            />
            <Stack.Screen
              name="BarcodeScanner"
              component={BarcodeScannerScreen}
              options={{
                title: 'Scan Barcode',
                headerShown: true,
                headerStyle: { backgroundColor: '#007AFF' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
              }}
            />
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{
                title: 'Product Details',
                headerShown: true,
                headerStyle: { backgroundColor: '#007AFF' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
              }}
            />
            <Stack.Screen
              name="ProductSearch"
              component={ProductSearchScreen}
              options={{
                title: 'Search Products',
                headerShown: true,
                headerStyle: { backgroundColor: '#007AFF' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
              }}
            />
            
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
  
  // Splash Screen Styles
  splashContainer: {
    flex: 1,
    backgroundColor: "#008b8b",
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
