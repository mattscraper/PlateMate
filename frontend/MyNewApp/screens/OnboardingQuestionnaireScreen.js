import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  StatusBar,
  Image,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import PremiumService from "../services/PremiumService";
import PurchaseService from "../services/PurchaseService";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const { width, height } = Dimensions.get("window");

// Dropdown data
const heightOptions = [
  { label: "4'10\"", value: "4'10\"" },
  { label: "4'11\"", value: "4'11\"" },
  { label: "5'0\"", value: "5'0\"" },
  { label: "5'1\"", value: "5'1\"" },
  { label: "5'2\"", value: "5'2\"" },
  { label: "5'3\"", value: "5'3\"" },
  { label: "5'4\"", value: "5'4\"" },
  { label: "5'5\"", value: "5'5\"" },
  { label: "5'6\"", value: "5'6\"" },
  { label: "5'7\"", value: "5'7\"" },
  { label: "5'8\"", value: "5'8\"" },
  { label: "5'9\"", value: "5'9\"" },
  { label: "5'10\"", value: "5'10\"" },
  { label: "5'11\"", value: "5'11\"" },
  { label: "6'0\"", value: "6'0\"" },
  { label: "6'1\"", value: "6'1\"" },
  { label: "6'2\"", value: "6'2\"" },
  { label: "6'3\"", value: "6'3\"" },
  { label: "6'4\"", value: "6'4\"" },
  { label: "6'5\"", value: "6'5\"" },
  { label: "6'6\"", value: "6'6\"" },
];

const weightOptions = Array.from({ length: 251 }, (_, i) => {
  const lbs = i + 80;
  return { label: `${lbs} lbs`, value: lbs.toString() };
});

const ageOptions = Array.from({ length: 83 }, (_, i) => {
  const age = i + 13;
  return { label: `${age} years`, value: age.toString() };
});

// Account Modal Component
const AccountModal = ({
  visible,
  onClose,
  isLoginMode,
  setIsLoginMode,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  isLoading,
  onAuth,
  onSkip
}) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.modalContainer}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalKeyboardView}
            keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          >
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={styles.modalLogoSection}>
                <View style={styles.modalLogoContainer}>
                  <Ionicons name="restaurant" size={32} color="#008b8b" />
                </View>
                <Text style={styles.modalTitle}>
                  {isLoginMode ? "Welcome Back" : "Join Kitchly"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {isLoginMode ? "Sign in to continue" : "Create your account"}
                </Text>
              </View>

              <View style={styles.modalToggleContainer}>
                <TouchableOpacity
                  style={[styles.modalToggleButton, !isLoginMode && styles.modalToggleButtonActive]}
                  onPress={() => setIsLoginMode(false)}
                >
                  <Text style={[styles.modalToggleText, !isLoginMode && styles.modalToggleTextActive]}>
                    Sign Up
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalToggleButton, isLoginMode && styles.modalToggleButtonActive]}
                  onPress={() => setIsLoginMode(true)}
                >
                  <Text style={[styles.modalToggleText, isLoginMode && styles.modalToggleTextActive]}>
                    Sign In
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalFormSection}>
                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Email</Text>
                  <View style={styles.modalInputWrapper}>
                    <Ionicons name="mail-outline" size={20} color="#008b8b" style={styles.modalInputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Enter your email"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View style={styles.modalInputGroup}>
                  <Text style={styles.modalInputLabel}>Password</Text>
                  <View style={styles.modalInputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#008b8b" style={styles.modalInputIcon} />
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Enter your password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={onAuth}
                    />
                    <TouchableOpacity
                      style={styles.modalPasswordToggle}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="#008b8b"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActionSection}>
              <TouchableOpacity
                style={[
                  styles.modalPrimaryButton,
                  (!email.trim() || !password || password.length < 6 || isLoading) && styles.modalPrimaryButtonDisabled
                ]}
                onPress={onAuth}
                disabled={!email.trim() || !password || password.length < 6 || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>
                    {isLoginMode ? "Sign In" : "Create Account"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSecondaryButton} onPress={onSkip}>
                <Text style={styles.modalSecondaryButtonText}>Continue without account</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// Premium Modal Component with Enhanced Logic
const PremiumModal = ({
  visible,
  onClose,
  onSelectPremium,
  onContinueFree,
  userCreatedAccount,
  isLoading,
  packages,
  revenueCatAvailable
}) => {
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [purchasing, setPurchasing] = useState(false);

  const getPackageInfo = (pkg) => {
    const identifier = pkg.identifier.toLowerCase();
    const product = pkg.product;
    
    const isMonthly = identifier.includes('monthly') ||
                     identifier.includes('month') ||
                     identifier.includes('1_month') ||
                     product.identifier === '1206856';
                     
    const isAnnual = identifier.includes('annual') ||
                    identifier.includes('year') ||
                    identifier.includes('12_month') ||
                    product.identifier === '1206857';
    
    if (isMonthly) {
      return {
        id: 'monthly',
        title: 'Monthly Premium',
        price: product.priceString,
        period: '/month',
        productId: product.identifier,
        features: [
          "Smart Ingredient Search",
          "Personalized Meal Plans",
          "Food Scanner & Health Scores",
          "AI Macro Tracking",
          "Grocery List Generator",
          "Unlimited Recipe Saves",
          "Ad-Free Experience",
          "Cancel Anytime",
        ],
        isRecommended: false
      };
    } else if (isAnnual) {
      return {
        id: 'yearly',
        title: 'Annual Premium',
        price: product.priceString,
        period: '/year',
        productId: product.identifier,
        savings: 'Save 33%',
        popular: true,
        features: [
          "Smart Ingredient Search",
          "Personalized Meal Plans",
          "Food Scanner & Health Scores",
          "Additive Detection",
          "AI Macro Tracking",
          "Grocery List Generator",
          "Unlimited Recipe Saves",
          "Ad-Free Experience",
          "Priority Support",
          "Advanced Recipe Filters",
          "Cancel Anytime",
        ],
        isRecommended: true
      };
    }
    
    return {
      id: pkg.identifier,
      title: product.title || 'Premium',
      price: product.priceString,
      period: '',
      productId: product.identifier,
      features: ["All Premium Features", "Cancel Anytime"],
      isRecommended: false
    };
  };

  const plans = packages.map(pkg => getPackageInfo(pkg)).filter(Boolean);

  // Set default to yearly if available
  useEffect(() => {
    if (plans.length > 0) {
      const yearlyPlan = plans.find(p => p.id === 'yearly');
      if (yearlyPlan) {
        setSelectedPlan('yearly');
      } else {
        setSelectedPlan(plans[0].id);
      }
    }
  }, [plans]);

  const handlePurchase = async () => {
    const selectedPackage = packages.find(pkg => {
      const info = getPackageInfo(pkg);
      return info?.id === selectedPlan;
    });

    if (!selectedPackage) {
      Alert.alert('Error', 'Selected plan not found');
      return;
    }

    setPurchasing(true);
    await onSelectPremium(selectedPackage);
    setPurchasing(false);
  };

  const PlanCard = ({ plan, onPress }) => {
    const isSelected = selectedPlan === plan.id;
    const isFallbackPackage = plan.productId?.includes('fallback');
    
    return (
      <TouchableOpacity
        style={[
          styles.planCard,
          isSelected && styles.planCardSelected,
          plan.popular && styles.planCardPopular
        ]}
        onPress={() => setSelectedPlan(plan.id)}
        activeOpacity={0.8}
      >
        {plan.popular && (
          <View style={styles.popularBadge}>
            <Ionicons name="diamond" size={12} color="white" />
            <Text style={styles.popularBadgeText}>BEST VALUE</Text>
          </View>
        )}
        
        {isFallbackPackage && (
          <View style={styles.fallbackBadge}>
            <Ionicons name="warning" size={12} color="#f39c12" />
            <Text style={styles.fallbackBadgeText}>ESTIMATED PRICING</Text>
          </View>
        )}
        
        <View style={styles.planCardHeader}>
          <View style={styles.planCardLeft}>
            <Text style={styles.planCardTitle}>{plan.title}</Text>
            <View style={styles.planCardPricing}>
              <Text style={styles.planCardPrice}>{plan.price}</Text>
              <Text style={styles.planCardPeriod}>{plan.period}</Text>
              {plan.savings && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>{plan.savings}</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={[
            styles.planCardRadio,
            isSelected && styles.planCardRadioSelected
          ]}>
            {isSelected && (
              <Ionicons name="checkmark" size={16} color="white" />
            )}
          </View>
        </View>

        <View style={styles.planCardFeatures}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.planCardFeature}>
              <Ionicons name="checkmark-circle" size={14} color="#008b8b" />
              <Text style={styles.planCardFeatureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.premiumModalContainer}>
        <SafeAreaView style={styles.premiumModalSafeArea}>
          <View style={styles.premiumModalHeader}>
            <TouchableOpacity style={styles.premiumModalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.premiumModalScroll}
            contentContainerStyle={styles.premiumModalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status Indicator */}
            {!revenueCatAvailable && (
              <View style={styles.statusBanner}>
                <Ionicons name="warning" size={16} color="#f39c12" />
                <Text style={styles.statusBannerText}>
                  In-app purchases temporarily unavailable
                </Text>
              </View>
            )}

            <View style={styles.premiumWelcomeSection}>
              <View style={styles.premiumIconContainer}>
                <Ionicons name="diamond" size={40} color="#008b8b" />
              </View>
              <Text style={styles.premiumTitle}>
                {userCreatedAccount ? "🎉 Account Created!" : "Unlock Premium Features"}
              </Text>
              <Text style={styles.premiumSubtitle}>
                {userCreatedAccount
                  ? "Now choose your plan to get the most out of Kitchly"
                  : "Get access to AI-powered nutrition tools"
                }
              </Text>
            </View>

            {isLoading ? (
              <View style={styles.planLoadingContainer}>
                <ActivityIndicator size="large" color="#008b8b" />
                <Text style={styles.planLoadingText}>Loading premium options...</Text>
              </View>
            ) : (
              <View style={styles.planSelectionSection}>
                <Text style={styles.planSelectionTitle}>Choose Your Plan</Text>
                
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.premiumModalActions}>
            <TouchableOpacity
              style={[
                styles.premiumUpgradeButton,
                (isLoading || purchasing) && styles.premiumUpgradeButtonDisabled
              ]}
              onPress={handlePurchase}
              disabled={isLoading || purchasing}
              activeOpacity={0.8}
            >
              {purchasing ? (
                <View style={styles.purchasingContainer}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.premiumUpgradeButtonText}>Processing...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Ionicons name="diamond" size={16} color="white" />
                  <Text style={styles.premiumUpgradeButtonText}>Get Premium Now</Text>
                  <Ionicons name="arrow-forward" size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.premiumFreeButton}
              onPress={onContinueFree}
              activeOpacity={0.8}
              disabled={purchasing}
            >
              <Text style={styles.premiumFreeButtonText}>Continue with Free</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// Main Component
export default function OnboardingQuestionnaireScreen({ navigation, onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showAccountScreen, setShowAccountScreen] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDropdown, setShowDropdown] = useState(null);
  const [userCreatedAccount, setUserCreatedAccount] = useState(false);
  const [premiumPackages, setPremiumPackages] = useState([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [revenueCatAvailable, setRevenueCatAvailable] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const questions = [
    {
      id: "welcome",
      type: "welcome",
      title: "Welcome to Kitchly",
      subtitle: "Your AI nutrition assistant",
      description: "Let's personalize your experience in just 3 minutes"
    },
    {
      id: "cooking_frequency",
      type: "multiple_choice",
      title: "How often do you cook?",
      options: [
        { id: "daily", text: "Daily - I love cooking!", icon: "restaurant" },
        { id: "few_times_week", text: "Few times a week", icon: "calendar" },
        { id: "weekly", text: "Once a week", icon: "time" },
        { id: "rarely", text: "Rarely - takeout champion!", icon: "car" }
      ]
    },
    {
      id: "grocery_pain",
      type: "multiple_choice",
      title: "What's your biggest grocery challenge?",
      options: [
        { id: "waste", text: "Food goes bad before I use it", icon: "trash" },
        { id: "ideas", text: "Never know what to buy/cook", icon: "help-circle" },
        { id: "healthy", text: "Finding healthy options", icon: "fitness" },
        { id: "expensive", text: "Groceries are too expensive", icon: "wallet" }
      ]
    },
    {
      id: "health_goals",
      type: "multiple_select",
      title: "What are your main goals?",
      options: [
        { id: "lose_weight", text: "Lose weight", icon: "trending-down" },
        { id: "gain_weight", text: "Gain weight", icon: "trending-up" },
        { id: "muscle", text: "Build muscle", icon: "fitness" },
        { id: "energy", text: "More energy", icon: "flash" },
        { id: "healthy_eating", text: "Eat healthier", icon: "leaf" },
        { id: "meal_prep", text: "Meal planning", icon: "calendar" }
      ]
    },
    {
      id: "food_waste",
      type: "multiple_choice",
      title: "How often do you waste food?",
      options: [
        { id: "weekly", text: "Weekly - so frustrating!", icon: "sad" },
        { id: "monthly", text: "Few times a month", icon: "calendar" },
        { id: "rarely", text: "Rarely", icon: "checkmark-circle" },
        { id: "never", text: "Never - I'm eco-conscious!", icon: "leaf" }
      ]
    },
    {
      id: "nutrition_tracking",
      type: "multiple_choice",
      title: "Do you track nutrition?",
      options: [
        { id: "no_want_to", text: "No, but ready to start!", icon: "add-circle" },
        { id: "yes_manual", text: "Yes, but it's tedious", icon: "time" },
        { id: "yes_app", text: "Using another app", icon: "phone-portrait" },
        { id: "no_interest", text: "Not really interested", icon: "close-circle" }
      ]
    },
    {
      id: "physical_stats",
      type: "form",
      title: "Basic information",
      fields: [
        { id: "height", label: "Height", type: "dropdown", options: heightOptions, defaultIndex: 8 },
        { id: "weight", label: "Weight", type: "dropdown", options: weightOptions, defaultIndex: 70 },
        { id: "age", label: "Age", type: "dropdown", options: ageOptions, defaultIndex: 17 }
      ]
    },
    {
      id: "activity_level",
      type: "multiple_choice",
      title: "Activity level?",
      options: [
        { id: "sedentary", text: "Desk warrior", icon: "laptop" },
        { id: "light", text: "Light exercise (1-3 days)", icon: "walk" },
        { id: "moderate", text: "Regular exercise (3-5 days)", icon: "bicycle" },
        { id: "very", text: "Fitness enthusiast (6-7 days)", icon: "fitness" }
      ]
    }
  ];

  useEffect(() => {
    StatusBar.setBarStyle("dark-content");
    Animated.timing(progressAnim, {
      toValue: currentStep / (questions.length - 1),
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  // Initialize premium packages when premium modal is shown
  useEffect(() => {
    if (showPremiumModal) {
      initializePremiumPackages();
    }
  }, [showPremiumModal]);

  const getFallbackPackages = () => {
    return [
      {
        identifier: 'monthly_premium_fallback',
        product: {
          identifier: 'monthly_premium_fallback',
          title: 'Monthly Premium',
          priceString: '$4.99',
          price: 4.99,
          currencyCode: 'USD'
        }
      },
      {
        identifier: 'annual_premium_fallback',
        product: {
          identifier: 'annual_premium_fallback',
          title: 'Annual Premium',
          priceString: '$39.99',
          price: 39.99,
          currencyCode: 'USD'
        }
      }
    ];
  };

  const initializePremiumPackages = async () => {
    try {
      setPremiumLoading(true);
      console.log('🚀 Onboarding: Loading premium packages...');

      // Check if user is authenticated
      const user = authService.getCurrentUser();
      if (!user) {
        console.log('⚠️ Onboarding: No authenticated user, using fallback packages');
        setPremiumPackages(getFallbackPackages());
        setRevenueCatAvailable(false);
        return;
      }

      console.log('👤 Onboarding: User authenticated:', user.uid);

      // Check if RevenueCat is available
      const isAvailable = PurchaseService.checkAvailability();
      setRevenueCatAvailable(isAvailable);

      if (isAvailable) {
        // Configure RevenueCat if not already done
        console.log('🔧 Onboarding: Configuring RevenueCat...');
        const configured = await PurchaseService.configure(
          'appl_fwRWQRdSViPvwzChtARGpDVvLEs',
          user.uid
        );

        if (configured) {
          console.log('✅ Onboarding: RevenueCat configured, loading packages...');
          const availablePackages = await PurchaseService.getOfferings();
          
          if (availablePackages && availablePackages.length > 0) {
            console.log('📦 Onboarding: Loaded', availablePackages.length, 'packages from RevenueCat');
            setPremiumPackages(availablePackages);
          } else {
            console.log('⚠️ Onboarding: No packages from RevenueCat, using fallback');
            setPremiumPackages(getFallbackPackages());
          }
        } else {
          console.log('⚠️ Onboarding: RevenueCat configuration failed, using fallback packages');
          setPremiumPackages(getFallbackPackages());
        }
      } else {
        console.log('⚠️ Onboarding: RevenueCat not available, using fallback packages');
        setPremiumPackages(getFallbackPackages());
      }

    } catch (error) {
      console.error('❌ Onboarding: Error loading premium packages:', error);
      setPremiumPackages(getFallbackPackages());
      setRevenueCatAvailable(false);
    } finally {
      setPremiumLoading(false);
    }
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    
    if (questions[currentStep].type === "multiple_choice") {
      setTimeout(() => { nextStep(); }, 300);
    }
  };

  const nextStep = () => {
    if (currentStep < questions.length - 1) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    } else {
      setShowAccountScreen(true);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep - 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password || password.length < 6) {
      Alert.alert("Error", "Please enter a valid email and password (6+ characters)");
      return;
    }

    setIsLoading(true);
    try {
      let user;
      if (isLoginMode) {
        // User is logging into existing account - skip premium and go straight to completion
        user = await authService.login(email.trim().toLowerCase(), password);
        if (user) {
          setShowAccountScreen(false);
          // Skip premium modal for existing users and complete onboarding
          if (onComplete) {
            onComplete(answers);
          }
        }
      } else {
        try {
          // User is creating new account - show premium modal after creation
          user = await authService.register(email.trim().toLowerCase(), password);
          if (user) {
            setUserCreatedAccount(true);
            setShowAccountScreen(false);
            setShowPremiumModal(true);
          }
        } catch (error) {
          // Handle account already exists error
          if (error.message?.includes('already exists') ||
              error.message?.includes('already in use') ||
              error.code === 'auth/email-already-in-use') {
            Alert.alert(
              "Account Already Exists",
              "An account with this email already exists. Would you like to sign in instead?",
              [
                {
                  text: "Cancel",
                  style: "cancel"
                },
                {
                  text: "Sign In",
                  onPress: () => {
                    setIsLoginMode(true);
                    setPassword(""); // Clear password for security
                  }
                }
              ]
            );
            return;
          }
          throw error; // Re-throw if it's a different error
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert("Error", error.message || `Failed to ${isLoginMode ? 'login' : 'create account'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const skipAuth = () => {
    setUserCreatedAccount(false);
    setShowAccountScreen(false);
    if (onComplete) {
      onComplete(answers);
    }
  };

  const handleSelectPremium = async (packageToPurchase) => {
    try {
      console.log('💳 Onboarding: Starting purchase:', packageToPurchase.identifier);

      // Check if this is a fallback package
      if (packageToPurchase.identifier.includes('fallback')) {
        console.log('⚠️ Onboarding: Fallback package selected');
        
        Alert.alert(
          "Upgrade to Premium",
          "The in-app purchase system is currently unavailable. Please visit our website to complete your premium upgrade, or contact support for assistance.",
          [
            {
              text: "Contact Support",
              onPress: () => {
                Alert.alert("Support", "Please email support@kitchly.app for assistance with premium upgrades.");
              }
            },
            {
              text: "Try Again",
              onPress: () => initializePremiumPackages()
            },
            {
              text: "Simulate Premium (DEV)",
              onPress: async () => {
                // DEV ONLY: Simulate premium activation for testing
                console.log('🧪 DEV: Simulating premium activation...');
                try {
                  const user = authService.getCurrentUser();
                  if (user) {
                    // Directly update Firestore for testing
                    const userRef = doc(db, "users", user.uid);
                    await updateDoc(userRef, {
                      isPremium: true,
                      premiumStatusUpdated: new Date().toISOString(),
                      'usage.lastActive': new Date().toISOString()
                    });
                    
                    // Force refresh both services
                    await PremiumService.forceRefresh();
                    await authService.forceRefreshPremiumStatus();
                    
                    Alert.alert(
                      "🎉 Welcome to Premium!",
                      "Premium status activated for testing!",
                      [
                        {
                          text: "Get Started",
                          onPress: () => {
                            setShowPremiumModal(false);
                            if (onComplete) {
                              onComplete(answers);
                            }
                          },
                        },
                      ]
                    );
                  }
                } catch (error) {
                  console.error('❌ DEV: Premium simulation failed:', error);
                  Alert.alert("Error", "Failed to simulate premium activation");
                }
              }
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
        return;
      }

      // Use PurchaseService for actual purchase
      console.log('🔄 Onboarding: Attempting RevenueCat purchase...');
      const result = await PurchaseService.purchasePackage(packageToPurchase);
      
      console.log('💳 Onboarding: Purchase result:', result);

      if (result.success) {
        console.log('✅ Onboarding: Purchase successful!');
        
        // 1. Update Firestore immediately (optimistic update)
        try {
          const user = authService.getCurrentUser();
          if (user) {
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
              isPremium: true,
              premiumStatusUpdated: new Date().toISOString(),
              'usage.lastActive': new Date().toISOString()
            });
            console.log('✅ Firestore premium status updated immediately');
          }
        } catch (firestoreError) {
          console.warn('⚠️ Immediate Firestore update failed:', firestoreError);
        }
        
        // 2. Notify services about successful purchase
        try {
          await PremiumService.handlePurchaseSuccess(result);
        } catch (premiumServiceError) {
          console.warn('⚠️ PremiumService handlePurchaseSuccess failed:', premiumServiceError);
        }
        
        try {
          await authService.handlePurchaseSuccess(result);
        } catch (authServiceError) {
          console.warn('⚠️ AuthService handlePurchaseSuccess failed:', authServiceError);
        }
        
        // 3. Force refresh both services
        setTimeout(async () => {
          try {
            await PremiumService.forceRefresh();
            await authService.forceRefreshPremiumStatus();
            console.log('✅ Services force refreshed after purchase');
          } catch (refreshError) {
            console.warn('⚠️ Service refresh failed:', refreshError);
          }
        }, 1000);
        
        Alert.alert(
          "🎉 Welcome to Premium!",
          "Congratulations! You now have access to all premium features.",
          [
            {
              text: "Get Started",
              onPress: () => {
                setShowPremiumModal(false);
                if (onComplete) {
                  onComplete(answers);
                }
              },
            },
          ]
        );
        
      } else if (result.cancelled) {
        console.log('🚫 Onboarding: Purchase cancelled by user');
        
      } else {
        console.log('❌ Onboarding: Purchase failed:', result.error);
        Alert.alert(
          "Purchase Error",
          result.error || "Unable to process purchase. Please try again later.",
          [
            {
              text: "Contact Support",
              onPress: () => {
                Alert.alert("Support", "Please email support@kitchly.app for assistance.");
              }
            },
            {
              text: "Try Again",
              onPress: () => handleSelectPremium(packageToPurchase)
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('❌ Onboarding: Purchase error:', error);
      Alert.alert("Purchase Error", "Something went wrong. Please try again later.");
    }
  };

  const handleContinueFree = () => {
    setShowPremiumModal(false);
    if (onComplete) {
      onComplete(answers);
    }
  };

  const handleCloseAccountModal = () => {
    setShowAccountScreen(false);
  };

  const handleClosePremiumModal = () => {
    setShowPremiumModal(false);
  };

  // Dropdown Component
  const SimpleDropdown = ({ field, value, onSelect }) => {
    const isOpen = showDropdown === field.id;

    return (
      <View style={[styles.dropdownContainer, isOpen && { zIndex: 9999, elevation: 9999 }]}>
        <TouchableOpacity
          style={[styles.dropdownButton, isOpen && styles.dropdownButtonActive]}
          onPress={() => setShowDropdown(isOpen ? null : field.id)}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownButtonText, !value && styles.placeholderText]}>
            {value ? field.options.find(opt => opt.value === value)?.label : `Select ${field.label.toLowerCase()}`}
          </Text>
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#008b8b" />
        </TouchableOpacity>
        
        {isOpen && (
          <>
            <TouchableWithoutFeedback onPress={() => setShowDropdown(null)}>
              <View style={styles.dropdownBackdrop} />
            </TouchableWithoutFeedback>
            
            <View style={styles.dropdownList}>
              <ScrollView
                style={styles.dropdownScroll}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                contentOffset={field.defaultIndex ? { x: 0, y: field.defaultIndex * 48 } : { x: 0, y: 0 }}
              >
                {field.options.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.dropdownOption, value === option.value && styles.dropdownOptionSelected]}
                    onPress={() => {
                      onSelect(option.value);
                      setShowDropdown(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownOptionText, value === option.value && styles.dropdownOptionTextSelected]}>
                      {option.label}
                    </Text>
                    {value === option.value && (
                      <Ionicons name="checkmark" size={18} color="#008b8b" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </View>
    );
  };

  const currentQuestion = questions[currentStep];
  const isAnswered = answers[currentQuestion?.id];

  // Welcome Step
  const WelcomeStep = () => (
    <View style={styles.welcomeContainer}>
      <Image source={require("../assets/logo.png")} style={styles.welcomeLogo} resizeMode="contain" />
      <Text style={styles.welcomeTitle}>{currentQuestion.title}</Text>
      <Text style={styles.welcomeSubtitle}>{currentQuestion.subtitle}</Text>
      <Text style={styles.welcomeDescription}>{currentQuestion.description}</Text>
      
      <View style={styles.welcomeFeatures}>
        <View style={styles.welcomeFeature}>
          <Ionicons name="scan" size={20} color="#008b8b" />
          <Text style={styles.welcomeFeatureText}>Instant barcode scanning with health scores</Text>
        </View>
        <View style={styles.welcomeFeature}>
          <Ionicons name="nutrition" size={20} color="#008b8b" />
          <Text style={styles.welcomeFeatureText}>AI-powered nutrition tracking</Text>
        </View>
        <View style={styles.welcomeFeature}>
          <Ionicons name="restaurant" size={20} color="#008b8b" />
          <Text style={styles.welcomeFeatureText}>Personalized meal planning</Text>
        </View>
        <View style={styles.welcomeFeature}>
          <Ionicons name="search" size={20} color="#008b8b" />
          <Text style={styles.welcomeFeatureText}>Smart recipe recommendations</Text>
        </View>
        <View style={styles.welcomeFeature}>
          <Ionicons name="basket" size={20} color="#008b8b" />
          <Text style={styles.welcomeFeatureText}>Auto-generated grocery lists</Text>
        </View>
        <View style={styles.welcomeFeature}>
          <Ionicons name="analytics" size={20} color="#008b8b" />
          <Text style={styles.welcomeFeatureText}>Detailed macro & nutrition insights</Text>
        </View>
       </View>
       
       <TouchableOpacity style={styles.getStartedButton} onPress={nextStep}>
         <Text style={styles.getStartedButtonText}>Get Started</Text>
         <Ionicons name="arrow-forward" size={20} color="white" />
       </TouchableOpacity>
     </View>
    );

  // Multiple Choice Step
  const MultipleChoiceStep = () => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
      
      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.optionButton, answers[currentQuestion.id] === option.id && styles.optionButtonSelected]}
            onPress={() => handleAnswer(currentQuestion.id, option.id)}
            activeOpacity={0.8}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons
                name={option.icon}
                size={24}
                color={answers[currentQuestion.id] === option.id ? "white" : "#008b8b"}
              />
            </View>
            <Text style={[styles.optionText, answers[currentQuestion.id] === option.id && styles.optionTextSelected]}>
              {option.text}
            </Text>
            {answers[currentQuestion.id] === option.id && (
              <Ionicons name="checkmark-circle" size={24} color="#008b8b" />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Multiple Select Step
  const MultipleSelectStep = () => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
      <Text style={styles.questionSubtitle}>Select all that apply</Text>
      
      <View style={styles.optionsContainer}>
        {currentQuestion.options.map((option) => {
          const isSelected = answers[currentQuestion.id]?.includes(option.id);
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
              onPress={() => {
                const currentAnswers = answers[currentQuestion.id] || [];
                let newAnswers;
                
                if (isSelected) {
                  newAnswers = currentAnswers.filter(id => id !== option.id);
                } else {
                  newAnswers = [...currentAnswers, option.id];
                }
                
                handleAnswer(currentQuestion.id, newAnswers);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name={option.icon} size={24} color={isSelected ? "white" : "#008b8b"} />
              </View>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option.text}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color="#008b8b" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      
      {isAnswered && (
        <TouchableOpacity style={styles.continueButton} onPress={nextStep}>
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );

  // Form Step
  const FormStep = () => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
      
      <View style={styles.formContainer}>
        {currentQuestion.fields.map((field) => (
          <View key={field.id} style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{field.label}</Text>
            <SimpleDropdown
              field={field}
              value={answers[currentQuestion.id]?.[field.id]}
              onSelect={(value) => {
                const currentFormData = answers[currentQuestion.id] || {};
                handleAnswer(currentQuestion.id, {
                  ...currentFormData,
                  [field.id]: value
                });
              }}
            />
          </View>
        ))}
      </View>
      
      {isAnswered && (
        <TouchableOpacity style={styles.continueButton} onPress={nextStep}>
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {currentStep + 1} of {questions.length}
        </Text>
      </View>

      <View style={styles.header}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={prevStep}>
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="none"
      >
        <Animated.View style={[styles.questionWrapper, { opacity: fadeAnim }]}>
          {currentQuestion?.type === "welcome" && <WelcomeStep />}
          {currentQuestion?.type === "multiple_choice" && <MultipleChoiceStep />}
          {currentQuestion?.type === "multiple_select" && <MultipleSelectStep />}
          {currentQuestion?.type === "form" && <FormStep />}
        </Animated.View>
      </ScrollView>

      <AccountModal
        visible={showAccountScreen}
        onClose={handleCloseAccountModal}
        isLoginMode={isLoginMode}
        setIsLoginMode={setIsLoginMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        isLoading={isLoading}
        onAuth={handleAuth}
        onSkip={skipAuth}
      />
      
      <PremiumModal
        visible={showPremiumModal}
        onClose={handleClosePremiumModal}
        onSelectPremium={handleSelectPremium}
        onContinueFree={handleContinueFree}
        userCreatedAccount={userCreatedAccount}
        isLoading={premiumLoading}
        packages={premiumPackages}
        revenueCatAvailable={revenueCatAvailable}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  
  // Progress & Header
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#e9ecef",
    borderRadius: 3,
    marginRight: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#008b8b",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: "#7f8c8d",
    fontWeight: "600",
  },
  header: {
    height: 60,
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#f8f9fa",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e9ecef",
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
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  questionWrapper: {
    flex: 1,
    justifyContent: "center",
    minHeight: 400,
  },

  // Welcome Step
  welcomeContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  welcomeLogo: {
    width: 70,
    height: 70,
    borderRadius: 18,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: "#008b8b",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "600",
  },
  welcomeDescription: {
    fontSize: 15,
    color: "#7f8c8d",
    textAlign: "center",
    marginBottom: 24,
  },
  welcomeFeatures: {
    width: "100%",
    marginBottom: 24,
    gap: 10,
  },
  welcomeFeature: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e9ecef",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  welcomeFeatureText: {
    fontSize: 14,
    color: "#2c3e50",
    marginLeft: 10,
    fontWeight: "500",
    flex: 1,
  },
  getStartedButton: {
    backgroundColor: "#008b8b",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
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
  getStartedButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },

  // Questions
  questionContainer: {
    paddingVertical: 10,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 6,
    textAlign: "center",
  },
  questionSubtitle: {
    fontSize: 15,
    color: "#7f8c8d",
    marginBottom: 24,
    textAlign: "center",
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#e9ecef",
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  optionButtonSelected: {
    borderColor: "#008b8b",
    backgroundColor: "#f0f9f9",
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: "#2c3e50",
    fontWeight: "500",
  },
  optionTextSelected: {
    color: "#008b8b",
    fontWeight: "600",
  },
  continueButton: {
    backgroundColor: "#008b8b",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  continueButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    marginRight: 6,
  },

  // Form Step
  formContainer: {
    gap: 20,
  },
  inputContainer: {
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },

  // Dropdown Styles
  dropdownContainer: {
    position: "relative",
  },
  dropdownButton: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: "#e9ecef",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 54,
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
  dropdownButtonActive: {
    borderColor: "#008b8b",
    backgroundColor: "#f0f9f9",
    zIndex: 10000,
    elevation: 10000,
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 10000,
      },
    }),
  },
  dropdownButtonText: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
    flex: 1,
  },
  placeholderText: {
    color: "#999",
    fontWeight: "400",
  },
  dropdownBackdrop: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: "transparent",
    zIndex: 9998,
    elevation: 9998,
  },
  dropdownList: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#008b8b",
    marginTop: 4,
    maxHeight: 240,
    zIndex: 10001,
    elevation: 10001,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 10001,
      },
    }),
  },
  dropdownScroll: {
    maxHeight: 240,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    backgroundColor: "white",
  },
  dropdownOptionSelected: {
    backgroundColor: "#f0f9f9",
  },
  dropdownOptionText: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: "#008b8b",
    fontWeight: "600",
  },

  // Status Banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3cd',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: -24,
    marginTop: -20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },
  statusBannerText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    fontWeight: '500',
  },

  // Account Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  modalLogoSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  modalLogoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#f0f9f9",
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
  },
  modalToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modalToggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalToggleButtonActive: {
    backgroundColor: "#008b8b",
  },
  modalToggleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7f8c8d",
  },
  modalToggleTextActive: {
    color: "white",
  },
  modalFormSection: {
    marginBottom: 20,
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },
  modalInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    paddingHorizontal: 16,
    height: 52,
  },
  modalInputIcon: {
    marginRight: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 16,
    color: "#2c3e50",
    height: "100%",
  },
  modalPasswordToggle: {
    padding: 4,
  },
  modalActionSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "white",
    gap: 12,
  },
  modalPrimaryButton: {
    backgroundColor: "#008b8b",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.5,
  },
  modalPrimaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },
  modalSecondaryButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7f8c8d",
  },

  // Premium Modal Styles
  premiumModalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  premiumModalSafeArea: {
    flex: 1,
  },
  premiumModalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  premiumModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
  },
  premiumModalScroll: {
    flex: 1,
  },
  premiumModalContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  premiumWelcomeSection: {
    alignItems: "center",
    paddingVertical: 30,
  },
  premiumIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  premiumTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 8,
  },
  premiumSubtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
  },
  planLoadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  planLoadingText: {
    fontSize: 16,
    color: "#7f8c8d",
    marginTop: 16,
  },
  planSelectionSection: {
    marginBottom: 30,
  },
  planSelectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 20,
    textAlign: "center",
  },
  planCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e9ecef",
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  planCardSelected: {
    borderColor: "#008b8b",
    backgroundColor: "#f0f9f9",
  },
  planCardPopular: {
    borderColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  popularBadge: {
    position: "absolute",
    top: -8,
    left: 20,
    backgroundColor: "#008b8b",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  popularBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  fallbackBadge: {
    position: "absolute",
    top: -8,
    left: 20,
    backgroundColor: "#f39c12",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  fallbackBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  planCardLeft: {
    flex: 1,
  },
  planCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
  },
  planCardPricing: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  planCardPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: "#008b8b",
  },
  planCardPeriod: {
    fontSize: 14,
    color: "#7f8c8d",
    marginLeft: 4,
    marginBottom: 4,
  },
  savingsBadge: {
    backgroundColor: "#e8f5e8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
    marginBottom: 2,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#27ae60",
  },
  planCardRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e9ecef",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
  },
  planCardRadioSelected: {
    backgroundColor: "#008b8b",
    borderColor: "#008b8b",
  },
  planCardFeatures: {
    gap: 8,
  },
  planCardFeature: {
    flexDirection: "row",
    alignItems: "center",
  },
  planCardFeatureText: {
    fontSize: 14,
    color: "#2c3e50",
    marginLeft: 8,
    flex: 1,
  },
  premiumModalActions: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "white",
    gap: 12,
  },
  premiumUpgradeButton: {
    backgroundColor: "#008b8b",
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
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
  premiumUpgradeButtonDisabled: {
    opacity: 0.7,
  },
  premiumUpgradeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 8,
  },
  purchasingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumFreeButton: {
    backgroundColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  premiumFreeButtonText: {
    color: "#7f8c8d",
    fontSize: 16,
    fontWeight: "600",
  },
});
