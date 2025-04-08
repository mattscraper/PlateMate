import React from "react";
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

const { width } = Dimensions.get("window");

const PersistentFooter = ({
  navigation,
  isLoggedIn,
  isPremium,
  onLoginRequired,
}) => {
  const insets = useSafeAreaInsets();

  const handleNavigation = (routeName, requiresLogin, isPremiumFeature) => {
    if (requiresLogin && !isLoggedIn) {
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
              if (onLoginRequired) {
                navigation.navigate("LandingPage");
              }
            },
          },
        ]
      );
      return;
    }

    if (isPremiumFeature && !isPremium && isLoggedIn) {
      // Navigate to premium plans for premium features
      navigation.navigate("PremiumPlans");
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
      requiresLogin: false,
      isPremiumFeature: true,
    },
    {
      name: "MealPlans",
      icon: "book-outline",
      label: "Meal Plan",
      requiresLogin: false,
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
      requiresLogin: true,
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
