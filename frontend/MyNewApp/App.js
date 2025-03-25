import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StyleSheet, Text, View } from "react-native";
import React, { useEffect } from "react";
//import { authService } from "./services/auth";
//import { AuthProvider } from "./services/AuthContext.";
//import { onAuthStateChanged } from "firebase/auth";
//import { auth } from "./firebaseConfig";
//import { initializeDatabase } from "./initDatabase";

import ResultsScreen from "./screens/ResultsScreen";
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

//import MealPlanLanding from "./screens/MealPlanLanding";

const Stack = createStackNavigator();

export default function App() {
  /*useEffect(() => {
    const initAuth = async () => {
      await authService.initialize();
    };
    initAuth();
  }, []);

  useEffect(() => {
    // Initialize sample data (only in development)
    if (__DEV__) {
      initializeDatabase();
    }

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    return unsubscribe; // Unsubscribe on unmount
  }, [initializing]);

  if (initializing) {
    return null; // or a loading screen
  }
*/
  return (
    // figure out if we need this auth provider
    //<AuthProvider>
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LandingPage">
        <Stack.Screen name="LandingPage" component={LandingScreen} />
        <Stack.Screen name="FindRecipes" component={FindRecipes} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen
          name="ResultsIngredients"
          component={ResultsIngredientsScreen}
        />
        <Stack.Screen name="MyRecipes" component={MyRecipes} />
        <Stack.Screen name="FindByIngredients" component={RecipeIngredients} />
        <Stack.Screen name="MealPlans" component={MealPlans} />
        <Stack.Screen name="MealPlanResults" component={MealPlanResults} />
        <Stack.Screen name="PremiumPlans" component={PremiumPlansScreen} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
        <Stack.Screen name="MealPlanDetail" component={MealPlanDetail} />

        <Stack.Screen
          name="SavedMealPlansScreen"
          component={SavedMealPlansScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
    //</AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
