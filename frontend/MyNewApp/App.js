import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StyleSheet, Text, View } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import PurchaseService from "./services/PurchaseService"; // Add this import
import { authService } from "./services/auth";
//import { AuthProvider } from "./services/AuthContext.";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";
//import { initializeDatabase } from "./initDatabase";

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
import PersistentFooter from "./components/PersistentFooter"; // Import the footer component

//import MealPlanLanding from "./screens/MealPlanLanding";

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

  // Initialize auth service
  useEffect(() => {
    const initAuth = async () => {
      await authService.initialize();
    };
    initAuth();
  }, []);

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

  // Listen for auth state changes and initialize RevenueCat
  useEffect(() => {
    // Initialize sample data (only in development)
    if (__DEV__) {
      // Uncomment if you want to use initializeDatabase
      // initializeDatabase();
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsLoggedIn(!!user);
      
      if (user) {
        // User is logged in - initialize RevenueCat and check premium status
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
        setIsPremium(false);
      }
      
      if (initializing) setInitializing(false);
    });

    return unsubscribe; // Unsubscribe on unmount
  }, [initializing]);

  // Function to handle login requirement from footer
  const handleLoginRequired = () => {
    setShowLoginModal(true);
    // Navigate to login screen or show login modal
    if (navigationRef.current) {
      navigationRef.current.navigate("LandingPage");
    }
  };

  if (initializing) {
    return null; // or a loading screen
  }

  return (
    // Wrap everything with SafeAreaProvider
    <SafeAreaProvider>
      {/* figure out if we need this auth provider */}
      {/* <AuthProvider> */}
      <View style={styles.container}>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="LandingPage"
            screenOptions={{
              headerShown: false,
              // Add padding to the bottom of all screens to prevent content from being hidden by footer
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
          </Stack.Navigator>
        </NavigationContainer>

        {/* Persistent Footer that appears on all screens */}

        <StatusBar style="auto" />
      </View>
      {/* </AuthProvider> */}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});
