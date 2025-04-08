import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { authService } from "../services/auth";

const { width } = Dimensions.get("window");

const PersistentFooter = ({ navigation, onLoginRequired }) => {
  const insets = useSafeAreaInsets();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Check auth state on component mount
  useEffect(() => {
    // Initial check
    checkAuthStatus();

    // Set up listener for auth state changes
    const unsubscribe = authService.onAuthStateChange((user) => {
      setIsLoggedIn(!!user);
      if (user) {
        checkPremiumStatus();
      } else {
        setIsPremium(false);
      }
    });

    // Cleanup subscription
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

  const handleNavigation = (routeName, requiresLogin, isPremiumFeature) => {
    // Premium features always require login first
    if ((requiresLogin || isPremiumFeature) && !isLoggedIn) {
      // Show an alert with login options
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
            onPress: () => {
              onLoginRequired();
            },
          },
        ]
      );
      return;
    }

    // If it's a premium feature and user is logged in but not premium
    if (isPremiumFeature && isLoggedIn && !isPremium) {
      // Navigate to premium plans for premium features
      Alert.alert(
        "Premium Feature",
        "This feature requires a premium subscription.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Upgrade",
            onPress: () => navigation.navigate("PremiumPlans"),
          },
        ]
      );
      return;
    }

    navigation.navigate(routeName);
  };

  const routes = [
    {
      name: "FindRecipes",
      icon: "search",
      label: "Recipes",
      requiresLogin: false,
      isPremiumFeature: false,
    },
    {
      name: "FindByIngredients",
      icon: "basket-outline",
      label: "Ingredients",
      requiresLogin: true, // Changed to true since premium features require login
      isPremiumFeature: true,
    },
    {
      name: "MealPlans",
      icon: "book-outline",
      label: "Meal Plan",
      requiresLogin: true, // Changed to true since premium features require login
      isPremiumFeature: true,
    },
    {
      name: "MyRecipes",
      icon: "bookmark",
      label: "Saved",
      requiresLogin: true,
      isPremiumFeature: false,
    },
    {
      name: "PremiumPlans",
      icon: "star",
      label: "Premium",
      requiresLogin: false, // Allow non-logged in users to see pricing
      isPremiumFeature: false,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 },
      ]}
    >
      <View style={styles.footerContent}>
        {routes.map((route) => (
          <TouchableOpacity
            key={route.name}
            style={styles.footerItem}
            onPress={() =>
              handleNavigation(
                route.name,
                route.requiresLogin,
                route.isPremiumFeature
              )
            }
          >
            <View style={styles.iconWrapper}>
              <Ionicons name={route.icon} size={24} color="#008b8b" />
              {route.isPremiumFeature && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={8} color="white" />
                </View>
              )}
            </View>
            <Text style={styles.footerLabel}>{route.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Styles remain unchanged
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f0ffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 100,
  },
  footerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
  },
  footerItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 5,
  },
  iconWrapper: {
    position: "relative",
    marginBottom: 4,
  },
  premiumBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FFD700",
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "white",
  },
  footerLabel: {
    fontSize: 12,
    color: "#2c3e50",
    textAlign: "center",
  },
});

export default PersistentFooter;
