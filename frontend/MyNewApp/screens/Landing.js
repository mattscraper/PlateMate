import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";

export default function LandingScreen({ navigation }) {
  // Core state
  const [isLoginVisible, setIsLoginVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotVisible, setIsForgotVisible] = useState(false);

  // Refs for inputs
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  // this needs to be changed when auth is implemented
  const checkLoginStatus = async () => {
    const token = await authService.getToken();
    setIsLoggedIn(!!token);
  };

  // this will be changed when we implement a way to login paid users only
  const handleLogin = async () => {
    if (!email || !email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    // here we handle when a user first makes an account and will be changed when we handle the paid login features
    try {
      if (isNewUser) {
        await authService.register(email, password);
        Alert.alert("Success", "Account created successfully! Please log in.");
        setIsNewUser(false);
      } else {
        const response = await authService.login(email, password);
        if (response) {
          setIsLoggedIn(true);
          setIsLoginVisible(false);
          setEmail("");
          setPassword("");
          Alert.alert("Success", "Welcome to PlateMate!");
        }
      }
    } catch (error) {
      Alert.alert(
        "Error",
        isNewUser
          ? "Failed to create account. Please try again."
          : "Failed to login. Please try again."
      );
      console.error("Auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes("@")) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      Alert.alert(
        "Success",
        "If an account exists with this email, you will receive password reset instructions."
      );
      setIsForgotVisible(false);
      setEmail("");
    } catch (error) {
      Alert.alert("Error", "Failed to process request. Please try again.");
      console.error("Forgot password error:", error);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Image
                source={require("../assets/logo.jpg")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>PlateMate</Text>
              <Text style={styles.subtitle}>
                Your Personal Recipe Assistant
              </Text>
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
                icon="book-outline"
                title="Meal Plan"
                description="Get personalized meal plans tailored for you!"
                onPress={() => navigation.navigate("MealPlans")}
              />
              <MenuCard
                icon="bookmark"
                title="My Recipes"
                description="Access your saved recipes and cooking history"
                onPress={() => {
                  if (isLoggedIn) {
                    navigation.navigate("MyRecipes");
                  } else {
                    setIsLoginVisible(true);
                  }
                }}
              />
            </View>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => {
                if (isLoggedIn) {
                  Alert.alert(
                    "Sign Out",
                    "Are you sure you want to sign out?",
                    [
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
                    ]
                  );
                } else {
                  setIsLoginVisible(true);
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
        </SafeAreaView>
      </ScrollView>

      {/* Login Overlay */}
      {isLoginVisible && (
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="person" size={32} color="#008b8b" />
              </View>
              <Text style={styles.modalTitle}>Welcome to PlateMate</Text>
              <Text style={styles.modalSubtitle}>
                {isNewUser
                  ? "Create an account to start your culinary journey"
                  : "Sign in to continue your culinary journey"}
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
                ref={emailRef}
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

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed"
                size={20}
                color="#008b8b"
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.inputIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#008b8b"
                />
              </TouchableOpacity>
            </View>

            {!isNewUser && (
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={() => {
                  setIsLoginVisible(false);
                  setIsForgotVisible(true);
                }}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.loginButton,
                (!email || !password) && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {isNewUser ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setIsNewUser(!isNewUser)}
            >
              <Text style={styles.switchModeText}>
                {isNewUser
                  ? "Already have an account? Sign in"
                  : "New user? Create account"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsLoginVisible(false);
                setEmail("");
                setPassword("");
                setIsNewUser(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Forgot Password Overlay */}
      {isForgotVisible && (
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="key" size={32} color="#008b8b" />
              </View>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>
                Enter your email to receive password reset instructions
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
              style={[styles.loginButton, !email && styles.loginButtonDisabled]}
              onPress={handleForgotPassword}
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsForgotVisible(false);
                setEmail("");
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flex: 1,
    padding: 19,
  },
  header: {
    alignItems: "center",
    marginVertical: 32,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginTop: 1,
    marginBottom: 1,
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 24,
    width: "100%",
    padding: 24,
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
  switchModeButton: {
    padding: 12,
    alignItems: "center",
  },
  switchModeText: {
    color: "#008b8b",
    fontSize: 16,
    fontWeight: "500",
  },
  forgotPasswordButton: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: "#008b8b",
    fontSize: 14,
    fontWeight: "500",
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
