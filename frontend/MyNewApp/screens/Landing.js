import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Dimensions,
  Keyboard,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Device from "expo-device";
import { authService } from "../services/auth";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function LandingScreen({ navigation }) {
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [modalAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (isLoginModalVisible) {
      Animated.spring(modalAnimation, {
        toValue: 1,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoginModalVisible]);

  const checkLoginStatus = async () => {
    const token = await authService.getToken();
    setIsLoggedIn(!!token);
  };

  const handleLogin = async () => {
    if (!email || !email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.login(email);
      if (response) {
        setIsLoggedIn(true);
        setIsLoginModalVisible(false);
        setEmail("");
        Alert.alert("Success", "Welcome to PlateMate!");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to login. Please try again.");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const MenuCard = ({ icon, title, description, onPress }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuContent}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={32} color="#008b8b" />
        </View>
        <View style={styles.menuTextContainer}>
          <Text style={styles.menuTitle}>{title}</Text>
          <Text style={styles.menuDescription}>{description}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#008b8b" />
    </TouchableOpacity>
  );

  const LoginModal = () => (
    <Modal
      visible={isLoginModalVisible}
      transparent
      animationType="none"
      onRequestClose={() => setIsLoginModalVisible(false)}
    >
      <BlurView intensity={20} tint="dark" style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: modalAnimation,
                transform: [
                  {
                    translateY: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="person" size={32} color="#008b8b" />
                </View>
                <Text style={styles.modalTitle}>Welcome to PlateMate</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your email to continue your culinary journey
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Ionicons
                  name="mail"
                  size={20}
                  color="#008b8b"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  !email && styles.loginButtonDisabled,
                ]}
                onPress={handleLogin}
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.loginButtonText}>Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsLoginModalVisible(false);
                  setEmail("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );

  return (
    <ScrollView>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.logoText}>🍳</Text>
            <Text style={styles.title}>PlateMate</Text>
            <Text style={styles.subtitle}>Your Personal Recipe Assistant</Text>
          </View>

          <View style={styles.menuContainer}>
            <MenuCard
              icon="search"
              title="Find New Recipes"
              description="Discover delicious recipes tailored to your preferences"
              onPress={() => navigation.navigate("FindRecipes")}
            />
            <MenuCard
              icon="basket-outline"
              title="What's in Your Kitchen?"
              description="Find tasty recipes using the ingredients you already have."
              onPress={() => navigation.navigate("FindByIngredients")}
            />

            <MenuCard
              icon="bookmark"
              title="My Recipes"
              description="Access your saved recipes and cooking history"
              onPress={() => {
                if (isLoggedIn) {
                  navigation.navigate("MyRecipes");
                } else {
                  setIsLoginModalVisible(true);
                }
              }}
            />
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => {
              if (isLoggedIn) {
                Alert.alert("Sign Out", "Are you sure you want to sign out?", [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Sign Out",
                    onPress: async () => {
                      await authService.logout();
                      setIsLoggedIn(false);
                    },
                  },
                ]);
              } else {
                setIsLoginModalVisible(true);
              }
            }}
          >
            <Ionicons
              name={isLoggedIn ? "log-out-outline" : "person-circle-outline"}
              size={24}
              color="#008b8b"
            />
            <Text style={styles.profileButtonText}>
              {isLoggedIn ? "Sign Out" : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>

        <LoginModal />
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginVertical: 32,
  },
  logoText: {
    fontSize: 48,
    marginBottom: 16,
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
    textAlign: "center",
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
  },
  menuItem: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  menuContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e6f3f3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 14,
    color: "#7f8c8d",
    lineHeight: 20,
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#e6f3f3",
    gap: 8,
    marginTop: 20,
  },
  profileButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#008b8b",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalContent: {
    padding: 24,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalHeaderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e6f3f3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 20,
  },
  inputIcon: {
    padding: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#2c3e50",
    padding: 12,
  },
  loginButton: {
    backgroundColor: "#008b8b",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  cancelButton: {
    padding: 16,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#7f8c8d",
    fontSize: 16,
    fontWeight: "500",
  },
});
