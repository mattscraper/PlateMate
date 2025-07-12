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
import PersistentFooter from "../components/PersistentFooter";

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
  const [premiumStatusLoading, setPremiumStatusLoading] = useState(true); // Add loading state

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
    const unsubscribe = authService.onAuthStateChange(async (user) => {
      setIsLoggedIn(!!user);
      if (user) {
        setPremiumStatusLoading(true);
        await checkPremiumStatus();
        setPremiumStatusLoading(false);
      } else {
        setIsPremium(false);
        setPremiumStatusLoading(false);
      }
    });

    // Initialize by checking current user status
    checkLoginStatus();

    return () => unsubscribe();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const user = authService.getCurrentUser();
      setIsLoggedIn(!!user);
      if (user) {
        setPremiumStatusLoading(true);
        await checkPremiumStatus();
        setPremiumStatusLoading(false);
      } else {
        setPremiumStatusLoading(false);
      }
    } catch (error) {
      console.error("Error checking login status:", error);
      setIsLoggedIn(false);
      setPremiumStatusLoading(false);
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

  // Memoized input handlers to prevent re-renders
  const handleEmailChange = useCallback((text) => {
    setEmail(text);
  }, []);

  const handlePasswordChange = useCallback((text) => {
    setPassword(text);
  }, []);

  // State for custom toast messages
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const toastTimeoutRef = useRef(null);

  const showCustomToast = (message, type = "success") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    setToastType(type);
    setShowToast(true);

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
          showCustomToast("Welcome to Kitchly! Account created successfully.", "success");
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

  // Hero Feature Card Component
  const HeroFeatureCard = ({ icon, title, description, onPress }) => (
    <TouchableOpacity
      style={styles.heroCard}
      onPress={onPress}
      activeOpacity={0.95}
    >
      <View style={styles.heroCardContent}>
        <View style={styles.heroIconContainer}>
          <Ionicons name={icon} size={40} color="#008b8b" />
        </View>
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroDescription}>{description}</Text>
        </View>
        <View style={styles.heroArrow}>
          <Ionicons name="chevron-forward" size={24} color="#008b8b" />
        </View>
      </View>
    </TouchableOpacity>
  );

  // Standard Feature Card Component
  const FeatureCard = ({ icon, title, description, onPress, isPremiumFeature = false }) => (
    <TouchableOpacity
      style={styles.featureCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.featureCardContent}>
        <View style={styles.featureIconContainer}>
          <Ionicons name={icon} size={28} color="#008b8b" />
          {isPremiumFeature && (
            <View style={styles.premiumBadge}>
              <View style={styles.premiumIcon} />
            </View>
          )}
        </View>
        <View style={styles.featureTextContainer}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featureDescription}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#008b8b" />
      </View>
    </TouchableOpacity>
  );

  // Enhanced Toast component
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

  // Memoized Dashboard Header Component to prevent unnecessary re-renders
  const DashboardHeader = React.memo(() => (
    <View style={styles.dashboardHeader}>
      <View style={styles.headerLeft}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.dashboardLogo}
          resizeMode="contain"
          fadeDuration={0}
          cache="force-cache"
          loadingIndicatorSource={require("../assets/logo.png")}
        />
        <View style={styles.headerTextContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.dashboardTitle}>Kitchly</Text>
            {/* Only show premium badge when not loading and user is premium */}
            {!premiumStatusLoading && isPremium && isLoggedIn && (
              <View style={styles.premiumBadgeSmall}>
                <Ionicons name="diamond" size={12} color="#FFD700" />
                <Text style={styles.premiumBadgeText}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={styles.dashboardSubtitle}>AI Nutrition Assistant</Text>
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
                        setPremiumStatusLoading(false);
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
  ), [isLoggedIn, isPremium, premiumStatusLoading]); // Add premiumStatusLoading to dependencies

  // Premium CTA Section
  const PremiumCTASection = () => {
    // Don't show anything while premium status is loading
    if (premiumStatusLoading) return null;
    
    // Don't show if user is premium or not logged in
    if (isPremium || !isLoggedIn) return null;

    return (
      <TouchableOpacity
        style={styles.premiumCTA}
        onPress={() => navigation.navigate("PremiumPlans")}
        activeOpacity={0.9}
      >
        <View style={styles.premiumCTAContent}>
          <View style={styles.premiumCTALeft}>
            <View style={styles.premiumCTAIcon}>
              <Ionicons name="diamond" size={20} color="#FFD700" />
            </View>
            <View style={styles.premiumCTAText}>
              <Text style={styles.premiumCTATitle}>Unlock Premium Features</Text>
              <Text style={styles.premiumCTASubtitle}>
                Advanced nutrition tracking & meal plans
              </Text>
            </View>
          </View>
          <View style={styles.premiumCTAButton}>
            <Text style={styles.premiumCTAButtonText}>Upgrade</Text>
            <Ionicons name="chevron-forward" size={14} color="white" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Account Status Card
  const AccountStatusCard = () => {
    return null; // Removed this component entirely
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 70 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* Dashboard Header */}
            <DashboardHeader />

            {/* Account Status */}
            <AccountStatusCard />

            {/* Premium CTA (for non-premium users) */}
            <PremiumCTASection />

            {/* Hero Features Section */}
            <View style={styles.heroSection}>
              <Text style={styles.sectionTitle}>Featured Tools</Text>
              
              {/* Food Scanner - Requires Login */}
              <HeroFeatureCard
                icon="scan"
                title="Food Scanner"
                description="Scan any product barcode for instant health scores and nutritional insights"
                onPress={() => {
                  if (!isLoggedIn) {
                    setIsLoginVisible(true);
                    return;
                  }
                  navigation.navigate("FoodScannerHome");
                }}
              />

              {/* Food Log & Nutrition Tracker - Premium */}
              <HeroFeatureCard
                icon="nutrition-outline"
                title="Smart Nutrition Tracker"
                description="AI-powered food logging with detailed macro tracking and personalized insights"
                onPress={() =>
                  handlePremiumFeaturePress(
                    "Smart Nutrition Tracker",
                    "FoodLog"
                  )
                }
              />
            </View>

            {/* All Features Section */}
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>Explore More</Text>
              
              <View style={styles.featureGrid}>
                <FeatureCard
                  icon="image"
                  title="Recipe Explorer"
                  description="Browse beautiful recipes with photos and details"
                  onPress={() => navigation.navigate("RecipeScreen")}
                />

                <FeatureCard
                  icon="search"
                  title="Recipe Builder"
                  description="Get personalized recipes based on your preferences"
                  onPress={() => {
                    if (!isLoggedIn) {
                      setIsLoginVisible(true);
                      return;
                    }
                    navigation.navigate("FindRecipes");
                  }}
                />

                <FeatureCard
                  icon="basket-outline"
                  title="Ingredient Recipes"
                  description="Find recipes using ingredients you have"
                  onPress={() =>
                    handlePremiumFeaturePress(
                      "Recipe search by ingredients",
                      "FindByIngredients"
                    )
                  }
                  isPremiumFeature={true}
                />

                <FeatureCard
                  icon="book-outline"
                  title="Meal Planner"
                  description="Personalized meal plans and smart grocery lists"
                  onPress={() =>
                    handlePremiumFeaturePress("Meal Planning", "MealPlans")
                  }
                  isPremiumFeature={true}
                />

                <FeatureCard
                  icon="bookmark"
                  title="My Recipes"
                  description="Your saved recipes and meal plans"
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
          <View style={styles.fullScreenBackground} />
          <SafeAreaView style={styles.loginSafeArea}>
            {/* Header with Close Button */}
            <View style={styles.loginHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setIsLoginVisible(false);
                  setEmail("");
                  setPassword("");
                  setIsNewUser(false);
                }}
                disabled={isLoading}
              >
                <Ionicons name="close" size={28} color="#2c3e50" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardContainer}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
              <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {/* Logo and Welcome */}
                <View style={styles.loginWelcomeSection}>
                  <Image
                    source={require("../assets/logo.png")}
                    style={styles.loginLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.loginWelcomeTitle}>Welcome to Kitchly</Text>
                  <Text style={styles.loginWelcomeSubtitle}>
                    Your AI nutrition assistant
                  </Text>
                </View>

                {/* Mode Toggle */}
                <View style={styles.modeToggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.modeToggleButton,
                      !isNewUser && styles.modeToggleButtonActive
                    ]}
                    onPress={() => setIsNewUser(false)}
                    disabled={isLoading}
                  >
                    <Text style={[
                      styles.modeToggleText,
                      !isNewUser && styles.modeToggleTextActive
                    ]}>
                      Sign In
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeToggleButton,
                      isNewUser && styles.modeToggleButtonActive
                    ]}
                    onPress={() => setIsNewUser(true)}
                    disabled={isLoading}
                  >
                    <Text style={[
                      styles.modeToggleText,
                      isNewUser && styles.modeToggleTextActive
                    ]}>
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
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
                      placeholder="Email address"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
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
                      placeholder="Password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={handlePasswordChange}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
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
                      <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
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
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      )}

      {/* Forgot Password Overlay */}
      {isForgotVisible && (
        <View style={styles.overlay}>
          <View style={styles.fullScreenBackground} />
          <SafeAreaView style={styles.loginSafeArea}>
            {/* Header with Back Button */}
            <View style={styles.loginHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setIsForgotVisible(false);
                  setEmail("");
                }}
                disabled={isLoading}
              >
                <Ionicons name="arrow-back" size={28} color="#2c3e50" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.keyboardContainer}
            >
              <ScrollView
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {/* Reset Password Header */}
                <View style={styles.loginWelcomeSection}>
                  <View style={styles.resetPasswordIcon}>
                    <Ionicons name="key" size={40} color="#008b8b" />
                  </View>
                  <Text style={styles.loginWelcomeTitle}>Reset Password</Text>
                  <Text style={styles.loginWelcomeSubtitle}>
                    Enter your email address and we'll send you instructions to reset your password
                  </Text>
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="mail"
                      size={20}
                      color="#008b8b"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Email address"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      returnKeyType="done"
                      onSubmitEditing={handleForgotPassword}
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
                      <Text style={styles.loginButtonText}>Send Reset Instructions</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
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
  
  // Dashboard Header Styles
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dashboardTitle: {
    fontSize: 35,
    fontWeight: "700",
    color: "#2c3e50",
    letterSpacing: -0.6,
  },
  premiumBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8DC",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFD700",
    gap: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#B8860B",
    letterSpacing: 0.5,
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

  // Account Status Card
  accountStatusCard: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
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
    backgroundColor: "#f1f5f9",
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

  // Premium CTA Section
  premiumCTA: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#FFD700",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  premiumCTAContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  premiumCTALeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  premiumCTAIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF8DC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  premiumCTAText: {
    flex: 1,
  },
  premiumCTATitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 2,
  },
  premiumCTASubtitle: {
    fontSize: 12,
    color: "#7f8c8d",
    lineHeight: 16,
  },
  premiumCTAButton: {
    backgroundColor: "#008b8b",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  premiumCTAButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 13,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Hero Section
  heroSection: {
    marginBottom: 32,
  },

  // Hero Feature Cards
  heroCard: {
    backgroundColor: "white",
    borderRadius: 20,
    marginBottom: 16,
    borderLeftWidth: 6,
    borderLeftColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  heroCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
  },
  heroIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 20,
  },
  heroTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 6,
  },
  heroDescription: {
    fontSize: 15,
    color: "#7f8c8d",
    lineHeight: 22,
  },
  heroArrow: {
    padding: 4,
  },

  // Features Section
  featuresSection: {
    marginBottom: 20,
  },
  featureGrid: {
    gap: 12,
  },

  // Feature Cards
  featureCard: {
    backgroundColor: "white",
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  featureCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    position: "relative",
  },
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
  featureTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: "#7f8c8d",
    lineHeight: 18,
  },

  // Toast Styles
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

  // Modal Styles
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  fullScreenBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "white",
  },
  loginSafeArea: {
    flex: 1,
    backgroundColor: "white",
  },
  loginHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  loginWelcomeSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 40,
  },
  loginLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 24,
  },
  resetPasswordIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  loginWelcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 12,
    textAlign: "center",
  },
  loginWelcomeSubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  
  // Mode Toggle Styles
  modeToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  modeToggleButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modeToggleButtonActive: {
    backgroundColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  modeToggleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7f8c8d",
  },
  modeToggleTextActive: {
    color: "white",
    fontWeight: "700",
  },

  formContainer: {
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 16,
    minHeight: 56,
  },
  inputIcon: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#2c3e50",
    paddingVertical: 16,
    paddingRight: 16,
  },
  loginButton: {
    backgroundColor: "#008b8b",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
    minHeight: 56,
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
  },
  forgotPasswordButton: {
    alignItems: "center",
    marginBottom: 24,
    paddingVertical: 12,
  },
  forgotPasswordText: {
    color: "#008b8b",
    fontSize: 15,
    fontWeight: "600",
  },
});
