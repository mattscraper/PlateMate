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
    }
  };

  // State for custom toast messages
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success"); // success, error, info

  const showCustomToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);

    // Auto hide after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const handleLogin = async () => {
    if (!email || !email.includes("@")) {
      showCustomToast("Please enter a valid email address", "error");
      return;
    }

    if (!password || password.length < 6) {
      showCustomToast("Password must be at least 6 characters", "error");
      return;
    }

    setIsLoading(true);
    try {
      if (isNewUser) {
        // Register and automatically log in
        const user = await authService.register(email, password);
        if (user) {
          setIsLoggedIn(true);
          setIsPremium(false); // New users start with free tier
          setIsLoginVisible(false);
          setEmail("");
          setPassword("");
          showCustomToast(
            "Welcome to PlateMate! Account created successfully.",
            "success"
          );
        }
      } else {
        const user = await authService.login(email, password);
        if (user) {
          setIsLoggedIn(true);
          setIsPremium(user.isPremium || false);
          setIsLoginVisible(false);
          setEmail("");
          setPassword("");
          showCustomToast(`Welcome back to PlateMate!`, "success");
        }
      }
    } catch (error) {
      let errorMessage = "An unexpected error occurred";
      let errorIcon = "alert-circle";

      // Check for specific Firebase error codes
      if (error.code === "auth/email-already-in-use") {
        errorMessage =
          "This email is already in use. Please try another email or sign in instead.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        errorMessage = "Invalid email or password.";
        errorIcon = "key";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage =
          "Too many failed login attempts. Please try again later.";
        errorIcon = "time";
      } else if (error.code === "auth/weak-password") {
        errorMessage =
          "Password is too weak. Please choose a stronger password.";
        errorIcon = "lock-open";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
        errorIcon = "wifi";
      }

      showCustomToast(errorMessage, "error");
      console.error("Auth error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !email.includes("@")) {
      showCustomToast("Please enter a valid email address", "error");
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      showCustomToast(
        "Password reset instructions sent to your email",
        "success"
      );
      setIsForgotVisible(false);
      setEmail("");
    } catch (error) {
      let errorMessage = "Failed to process request. Please try again.";

      if (error.code === "auth/user-not-found") {
        // For security reasons, we still show a success message even if the email doesn't exist
        showCustomToast(
          "Password reset instructions sent to your email",
          "success"
        );
        setIsForgotVisible(false);
        setEmail("");
        return;
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection.";
      }

      showCustomToast(errorMessage, "error");
      console.error("Forgot password error:", error);
    } finally {
      setIsLoading(false);
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
              <Ionicons name="star" size={12} color="white" />
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

  // Custom Toast component
  const Toast = ({ visible, message, type }) => {
    if (!visible) return null;

    let backgroundColor, iconName, textColor;

    switch (type) {
      case "success":
        backgroundColor = "#4caf50";
        iconName = "checkmark-circle";
        textColor = "white";
        break;
      case "error":
        backgroundColor = "#f44336";
        iconName = "alert-circle";
        textColor = "white";
        break;
      case "info":
        backgroundColor = "#2196f3";
        iconName = "information-circle";
        textColor = "white";
        break;
      default:
        backgroundColor = "#333";
        iconName = "chatbubble-ellipses";
        textColor = "white";
    }

    return (
      <Animated.View style={[styles.toast, { backgroundColor }]}>
        <Ionicons name={iconName} size={24} color={textColor} />
        <Text style={[styles.toastText, { color: textColor }]}>{message}</Text>
      </Animated.View>
    );
  };

  // We might want to adjust this welcome banner or get rid of it!!
  const WelcomeBanner = () => {
    if (!isLoggedIn) return null;

    return (
      <View style={styles.welcomeBanner}>
        <View style={styles.welcomeContent}>
          <Ionicons name="person-circle" size={28} color="#008b8b" />
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeHeading}>Welcome </Text>
            <Text style={styles.welcomeSubheading}>
              {isPremium ? "Premium Member" : "Free Account"}
            </Text>
          </View>
        </View>
        {!isPremium && (
          <TouchableOpacity
            style={styles.upgradeBannerButton}
            onPress={() => navigation.navigate("PremiumPlans")}
          >
            <Text style={styles.upgradeBannerText}>Upgrade</Text>
          </TouchableOpacity>
        )}
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
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <WelcomeBanner />
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

            {isLoggedIn && (
              <View style={styles.userStatusContainer}>
                <Text style={styles.userStatusText}>
                  {isPremium ? "Premium Member 🌟" : "Free Account"}
                </Text>
                {!isPremium && (
                  <TouchableOpacity
                    style={styles.upgradeToPremiumButton}
                    onPress={() => navigation.navigate("PremiumPlans")}
                  >
                    <Text style={styles.upgradeToPremiumText}>
                      Upgrade to Premium
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

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
                          try {
                            await authService.logout();
                            setIsLoggedIn(false);
                            setIsPremium(false);
                          } catch (error) {
                            Alert.alert(
                              "Error",
                              "Failed to sign out. Please try again."
                            );
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

      {/* Login Overlay 
      figure out if we should delete the boiler plate person image//
      // */}
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
                ref={emailRef} // we may need to switch libraries to implement forgot password!
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
  toast: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
  },
  toastText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    flexShrink: 1,
  },
  welcomeBanner: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: -2,
    marginBottom: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: -10, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        marginTop: 5,
        marginBottom: 9,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  welcomeContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    height: 25,
    marginTop: 3,
  },
  welcomeTextContainer: {
    marginLeft: 12,
    marginRight: 10,
  },
  welcomeHeading: {
    marginLeft: 58,
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
  },
  welcomeSubheading: {
    marginLeft: 40,
    fontSize: 14,
    color: "#7f8c8d",
  },
  upgradeBannerButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  upgradeBannerText: {
    fontWeight: "600",
    color: "#2c3e50",
    fontSize: 14,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginVertical: 32,
    marginTop: 14,
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
    position: "relative",
  },
  premiumBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FFD700",
    width: 16,
    height: 20,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "white",
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
  userStatusContainer: {
    backgroundColor: "#f0f8ff",
    padding: 16,
    borderRadius: 16,
    marginTop: 20,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e8ed",
  },
  userStatusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },
  upgradeToPremiumButton: {
    backgroundColor: "#FFD700",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  upgradeToPremiumText: {
    fontWeight: "600",
    color: "#2c3e50",
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
