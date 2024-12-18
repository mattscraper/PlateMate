import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StyleSheet, Text, View } from "react-native";
import React, { useEffect } from "react";
import { authService } from "./services/auth";

import ResultsScreen from "./screens/ResultsScreen";
import FindRecipes from "./screens/FindRecipes";
import LandingScreen from "./screens/Landing";
import MyRecipes from "./screens/MyRecipes";

const Stack = createStackNavigator();
export default function App() {
  useEffect(() => {
    const initAuth = async () => {
      await authService.initialize();
    };
    initAuth();
  }, []);

  // Rest of your App component

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="LandingPage">
        <Stack.Screen name="LandingPage" component={LandingScreen} />
        <Stack.Screen name="FindRecipes" component={FindRecipes} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="MyRecipes" component={MyRecipes} />
      </Stack.Navigator>
    </NavigationContainer>
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
