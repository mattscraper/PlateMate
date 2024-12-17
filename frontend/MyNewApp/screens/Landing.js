import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function LandingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PlateMate</Text>
          <Text style={styles.subtitle}>Your Personal Recipe Assistant</Text>
        </View>

        {/* Main Menu Options */}
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate("FindRecipes")}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="search" size={32} color="#008b8b" />
            </View>
            <Text style={styles.menuTitle}>Find New Recipes</Text>
            <Text style={styles.menuDescription}>
              Discover delicious recipes tailored to your preferences
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              // Check if user is logged in, if not, navigate to auth screen
              // For now, we'll assume they need to log in
              navigation.navigate("MyRecipes");
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="bookmark" size={32} color="#008b8b" />
            </View>
            <Text style={styles.menuTitle}>My Recipes</Text>
            <Text style={styles.menuDescription}>
              Access your saved recipes and cooking history
            </Text>
          </TouchableOpacity>
        </View>

        {/* Login/Profile Button */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate("Auth")}
        >
          <Ionicons name="person-circle-outline" size={24} color="#008b8b" />
          <Text style={styles.profileButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginVertical: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#7f8c8d",
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
  },
  menuItem: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e6f3f3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },
  menuDescription: {
    fontSize: 14,
    color: "#7f8c8d",
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#e6f3f3",
    marginBottom: 16,
    gap: 8,
  },
  profileButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#008b8b",
  },
});
