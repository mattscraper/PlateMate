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
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import { useFocusEffect } from "@react-navigation/native";
import PersistentFooter from "../components/PersistentFooter"; // Import the new footer component

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
  const [isPremium, setIsPremium] = useState(false);

  // Create animated value for scroll position
  const scrollY = useRef(new Animated.Value(0)).current;

  // Refs for inputs
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Check login status whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      checkLoginStatus();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user) => {
      setIsLoggedIn(!!user);
      if (user) {
        checkPremiumStatus();
      } else {
        setIsPremium(false);
      }
    });

    // Initialize auth service
    authService.initialize().then((isAuthenticated) => {
      setIsLoggedIn(isAuthenticated);
      if (isAuthenticated) {
        checkPremiumStatus();
      }
    });

    return () => unsubscribe();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const user = authService.getCurrentUser();
      setIsLoggedIn(!!user);
      if (user) {
        checkPremiumStatus();
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      setIsLoggedIn(false);
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

  // Handler for when login is required by footer navigation
  const handleLoginRequired = () => {
    setIsLoginVisible(true);
  };

  // State for custom toast messages
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success"); // success, error, info
  const toastTimeoutRef = useRef(null);

  const showCustomToast = (message, type = "success") => {
    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    setToastType(type);
    setShowToast(true);

    // Auto hide after 4 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
    }, 4000);
  };

  const handleLogin = async () => {
    console.log('Login attempt started');
    
    // Enhanced validation
    if (!email || !email.trim()) {
      showCustomToast("Please enter your email address", "error");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      showCustomToast("Please enter a valid email address", "error");
      return;
    }

    if (!password) {
      showCustomToast("Please enter your password", "error");
      return;
    }

    if (password.length < 6) {
      showCustomToast("Password must be at least 6 characters", "error");
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Attempting auth operation:', isNewUser ? 'register' : 'login');
      
      let user = null;
      
      if (isNewUser) {
        // Register and automatically log in
        user = await authService.register(email.trim().toLowerCase(), password);
        console.log('Registration successful:', !!user);
        
        if (user) {
          setIsLoggedIn(true);
          setIsPremium(false); // New users start with free tier
          setIsLoginVisible(false);
          setEmail("");
          setPassword("");
          showCustomToast("Welcome to Kitch! Account created successfully.", "success");
        } else {
          throw new Error("Registration failed - no user returned");
        }
      } else {
        // Login
        user = await authService.login(email.trim().toLowerCase(), password);
        console.log('Login successful:', !!user);
        
        if (user) {
          setIsLoggedIn(true);
          setIsPremium(user.isPremium || false);
          setIsLoginVisible(false);
          setEmail("");
          setPassword("");
          showCustomToast("Welcome back to Kitchly!", "success");
        } else {
          throw new Error("Login failed - no user returned");
        }
      }
    } catch (error) {
      console.error("Authentication error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack
      });

      let errorMessage = "An unexpected error occurred. Please try again.";

      // Handle Firebase Auth errors
      if (error.code) {
        switch (error.code) {
          case "auth/email-already-in-use":
            errorMessage = "This email is already registered. Please sign in instead or use a different email.";
            // Automatically switch to login mode
            setIsNewUser(false);
            break;
          case "auth/invalid-email":
            errorMessage = "Please enter a valid email address.";
            break;
          case "auth/user-not-found":
            errorMessage = "No account found with this email. Please check your email or create a new account.";
            break;
          case "auth/wrong-password":
            errorMessage = "Incorrect password. Please try again.";
            break;
          case "auth/invalid-credential":
            errorMessage = "Invalid email or password. Please check your credentials and try again.";
            break;
          case "auth/too-many-requests":
            errorMessage = "Too many failed attempts. Please wait a few minutes before trying again.";
            break;
          case "auth/weak-password":
            errorMessage = "Password is too weak. Please choose a stronger password with at least 6 characters.";
            break;
          case "auth/network-request-failed":
            errorMessage = "Network error. Please check your internet connection and try again.";
            break;
          case "auth/user-disabled":
            errorMessage = "This account has been disabled. Please contact support.";
            break;
          case "auth/operation-not-allowed":
            errorMessage = "This sign-in method is not enabled. Please contact support.";
            break;
          default:
            errorMessage = `Authentication failed: ${error.message}`;
        }
      } else if (error.message) {
        // Handle custom errors from authService
        errorMessage = error.message;
      }

      showCustomToast(errorMessage, "error");
    } finally {
      setIsLoading(false);
      console.log('Login attempt completed');
    }
  };

  const handleForgotPassword = async () => {
    console.log('Forgot password attempt started');
    
    if (!email || !email.trim()) {
      showCustomToast("Please enter your email address", "error");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      showCustomToast("Please enter a valid email address", "error");
      return;
    }

    setIsLoading(true);
    
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      showCustomToast("Password reset instructions sent to your email", "success");
      setIsForgotVisible(false);
      setEmail("");
      console.log('Forgot password successful');
    } catch (error) {
      console.error("Forgot password error:", {
        code: error.code,
        message: error.message
      });

      let errorMessage = "Failed to send reset email. Please try again.";

      if (error.code) {
        switch (error.code) {
          case "auth/user-not-found":
            // For security reasons, we show success message even if user doesn't exist
            showCustomToast("Password reset instructions sent to your email", "success");
            setIsForgotVisible(false);
            setEmail("");
            return;
          case "auth/invalid-email":
            errorMessage = "Please enter a valid email address.";
            break;
          case "auth/network-request-failed":
            errorMessage = "Network error. Please check your internet connection.";
            break;
          case "auth/too-many-requests":
            errorMessage = "Too many requests. Please wait a few minutes before trying again.";
            break;
          default:
            errorMessage = `Reset failed: ${error.message}`;
        }
      }

      showCustomToast(errorMessage, "error");
    } finally {
      setIsLoading(false);
      console.log('Forgot password attempt completed');
    }
  };

  const handlePremiumFeaturePress = (featureName, screenName) => {
    if (!isLoggedIn) {
      setIsLoginVisible(true);
      return;
    }

    if (!isPremium) {
      Alert.alert(
        "Premium Feature",
        `${featureName} is a premium feature. Would you like to upgrade to premium?`,
        [
          {
            text: "Not Now",
            style: "cancel",
          },
          {
            text: "Learn More",
            onPress: () => navigation.navigate("PremiumPlans"),
          },
        ]
      );
      return;
    }

    navigation.navigate(screenName);
  };

  const MenuCard = ({
    icon,
    title,
    description,
    onPress,
    isPremiumFeature = false,
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuContent}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={32} color="#008b8b" />
          {isPremiumFeature && (
            <View style={styles.premiumBadge}>
              <View style={styles.premiumIcon} />
            </View>
          )}
        </View>
        <View style={styles.menuTextContainer}>
          <Text style={styles.menuTitle}>{title}</Text>
          <Text style={styles.menuDescription}>{description}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#008b8b" />
    </TouchableOpacity>
  );

  // Enhanced Toast component with better styling and animation
  const Toast = ({ visible, message, type }) => {
    const [fadeAnim] = useState(new Animated.Value(0));

    useEffect(() => {
      if (visible) {
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }, [visible]);

    if (!visible) return null;

    let backgroundColor, iconName, textColor;

    switch (type) {
      case "success":
        backgroundColor = "#10B981";
        iconName = "checkmark-circle";
        textColor = "white";
        break;
      case "error":
        backgroundColor = "#EF4444";
        iconName = "alert-circle";
        textColor = "white";
        break;
      case "info":
        backgroundColor = "#3B82F6";
        iconName = "information-circle";
        textColor = "white";
        break;
      default:
        backgroundColor = "#374151";
        iconName = "chatbubble-ellipses";
        textColor = "white";
    }

    return (
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor, opacity: fadeAnim }
        ]}
      >
        <Ionicons name={iconName} size={24} color={textColor} />
        <Text style={[styles.toastText, { color: textColor }]} numberOfLines={3}>
          {message}
        </Text>
        <TouchableOpacity
          onPress={() => setShowToast(false)}
          style={styles.toastCloseButton}
        >
          <Ionicons name="close" size={20} color={textColor} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Dashboard Header Component (from our dashboard version)
  const DashboardHeader = () => (
    <View style={styles.dashboardHeader}>
      <View style={styles.headerLeft}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.dashboardLogo}
          resizeMode="contain"
        />
        <View style={styles.headerTextContainer}>
          <Text style={styles.dashboardTitle}>Kitchly</Text>
          <Text style={styles.dashboardSubtitle}>Recipe Assistant</Text>
        </View>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.profileIconButton}
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
                      try {
                        await authService.logout();
                        setIsLoggedIn(false);
                        setIsPremium(false);
                        showCustomToast("Signed out successfully", "success");
                      } catch (error) {
                        console.error("Logout error:", error);
                        showCustomToast("Failed to sign out. Please try again.", "error");
                      }
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
            name={isLoggedIn ? "person-circle" : "person-circle-outline"}
            size={32}
            color={isLoggedIn ? "#008b8b" : "#7f8c8d"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Account Status Card (consolidated into one clean card)
  const AccountStatusCard = () => {
    if (!isLoggedIn) return null;

    return (
      <View style={styles.accountStatusCard}>
        <View style={styles.statusContent}>
          <View style={styles.statusIconContainer}>
            <Ionicons
              name={isPremium ? "checkmark-circle" : "person-circle"}
              size={24}
              color={isPremium ? "#34D399" : "#008b8b"}
            />
          </View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>
              {isPremium ? "Premium Account" : "Free Account"}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isPremium
                ? "All features unlocked"
                : "Upgrade to unlock premium features"}
            </Text>
          </View>
          {!isPremium && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => navigation.navigate("PremiumPlans")}
            >
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 70 }} // Add padding to account for footer
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* Dashboard Header */}
            <DashboardHeader />

            {/* Account Status */}
            <AccountStatusCard />

            <View style={styles.menuContainer}>
          
          <MenuCard
            icon="image"
            title="Recipe Explorer"
            description="Browse a vibrant grid of recipes with mouthwatering photos and details."
            onPress={() => navigation.navigate("RecipeScreen")}
          />

              <MenuCard
                icon="search"
                title="Smart Recipe Builder"
                description="Enter your preferences and get personalized recipes instantly."
                onPress={() => navigation.navigate("FindRecipes")}
              />
              <MenuCard
                icon="basket-outline"
                title="What's in Your Kitchen?"
                description="Find tasty recipes using the ingredients you already have"
                onPress={() =>
                  handlePremiumFeaturePress(
                    "Recipe search by ingredients",
                    "FindByIngredients"
                  )
                }
                isPremiumFeature={true}
              />
              <MenuCard
                icon="book-outline"
                title="Meal Plan"
                description="Get personalized meal plans tailored for you!"
                onPress={() =>
                  handlePremiumFeaturePress("Meal Planning", "MealPlans")
                }
                isPremiumFeature={true}
              />
              <MenuCard
                icon="bookmark"
                title="My Recipes"
                description="Access your saved recipes and meal plans"
                onPress={() => {
                  if (isLoggedIn) {
                    navigation.navigate("MyRecipes");
                  } else {
                    setIsLoginVisible(true);
                  }
                }}
              />
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>

      {/* Persistent Footer Navigation */}
      <PersistentFooter
        navigation={navigation}
        isLoggedIn={isLoggedIn}
        isPremium={isPremium}
        onLoginRequired={handleLoginRequired}
      />

      {/* Login Overlay */}
      {isLoginVisible && (
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="person" size={32} color="#008b8b" />
              </View>
              <Text style={styles.modalTitle}>Welcome to Kitch</Text>
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
                editable={!isLoading}
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
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.inputIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
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
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.loginButton,
                ((!email || !password) || isLoading) && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {isNewUser ? "Create Account" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setIsNewUser(!isNewUser)}
              disabled={isLoading}
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
              disabled={isLoading}
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
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, (!email || isLoading) && styles.loginButtonDisabled]}
              onPress={handleForgotPassword}
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
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
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Toast Notification */}
      <Toast visible={showToast} message={toastMessage} type={toastType} />
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
    padding: 20,
  },
  
  // Dashboard Header Styles (from our dashboard version)
  dashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 5,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dashboardLogo: {
    width: 70,
    height: 70,
    borderRadius: 25,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  dashboardTitle: {
    fontSize: 35,
    fontWeight: "700",
    color: "#2c3e50",
    letterSpacing: -0.6,
  },
  dashboardSubtitle: {
    fontSize: 14,
    color: "#7f8c8d",
    marginTop: 4,
  },
  headerRight: {
    marginLeft: 15,
  },
  profileIconButton: {
    padding: 5,
  },

  // Enterprise Account Status Card
  accountStatusCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statusContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  statusTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 13,
    color: "#7f8c8d",
  },
  upgradeButton: {
    backgroundColor: "#008b8b",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontWeight: "600",
    color: "white",
    fontSize: 13,
  },

  toast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
    minHeight: 64,
  },
  toastText: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 12,
    marginRight: 12,
    flex: 1,
    lineHeight: 20,
  },
  toastCloseButton: {
    padding: 4,
    marginTop: -2,
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
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
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
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    position: "relative",
  },
  // Professional Premium Badge
  premiumBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  premiumIcon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
  },
  menuTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 14,
    color: "#7f8c8d",
    lineHeight: 20,
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
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    width: "100%",
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
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
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
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
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 52,
    justifyContent: "center",
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
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
