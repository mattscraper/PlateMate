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
  Keyboard,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import PremiumService from "../services/PremiumService";
import PurchaseService from "../services/PurchaseService";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

const { width, height } = Dimensions.get("window");

// Updated Terms of Service Content with web link
const TERMS_OF_SERVICE = `📄 Kitchly Terms of Service

Effective Date: July 27th, 2025
App Name: Kitchly
Company Name: Riso Development LLC
Contact Email: risodevelopmentcontact@gmail.com

Full Terms Available Online: https://merry-griffin-b38c95.netlify.app

1. Acceptance of Terms
By creating an account or using the Kitchly app, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use the app.

2. Description of the Service
Kitchly provides nutrition and meal planning tools, including barcode scanning, recipe recommendations, AI-generated meal plans, weight tracking, voice-based logging, and shopping list creation. Some features require a paid subscription.

3. Account Registration
You must be at least 13 years old to create an account. When registering, you agree to provide accurate information including your age, height, weight, and activity level. You are responsible for maintaining the confidentiality of your account credentials.

4. Subscriptions and Payments
Kitchly is free to download. Premium features are available through monthly and yearly subscriptions.
• Prices and durations are shown within the app.
• Payment is charged to your Apple ID account.
• Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period.
• You can manage or cancel your subscription in your Apple device settings: Manage Subscriptions

Refunds: All purchases are final. Refunds are managed through Apple and subject to their policies.

5. Health Data & Usage
Kitchly collects and uses health-related data (e.g., weight, goals, dietary preferences) to deliver personalized recommendations. This data is handled according to our Privacy Policy and is never shared with third parties.

6. User Content
You may log food entries, weight progress, and health goals. You retain ownership of this content, but grant Kitchly the right to use this data internally to improve your experience.

You may not log unrealistic, misleading, or inappropriate content. We reserve the right to restrict or terminate your access if we detect abuse or misuse of AI-generated features.

7. Restrictions
You agree not to:
• Use the app for unlawful or harmful purposes.
• Reverse engineer, tamper with, or interfere with the functionality.
• Use the AI features in a misleading or abusive way.
• Attempt to bypass account limitations or exploit bugs.

Violation of these terms may result in account suspension without notice.

8. Data Retention & Deletion
Users can delete their accounts and all associated data directly within the app. If you need assistance with data deletion, contact us at: risodevelopmentcontact@gmail.com.

9. Changes to the Terms
We may update these Terms from time to time. Continued use of Kitchly after changes have been made constitutes acceptance of those changes.

10. Contact & Support
For support or legal inquiries, contact:
📧 risodevelopmentcontact@gmail.com

11. Governing Law
These Terms are governed by the laws applicable to Riso Development LLC's operating jurisdiction.`;

// Updated Terms Modal Component with web link option
const TermsModal = ({ visible, onClose }) => {
  const handlePrivacyPolicyPress = () => {
    const privacyPolicyUrl = "https://www.privacypolicies.com/live/6898ece2-326a-48e7-b950-555cf9ab1713";
    
    Linking.canOpenURL(privacyPolicyUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(privacyPolicyUrl);
        } else {
          Alert.alert(
            "Unable to Open Link",
            "Please visit our privacy policy at: " + privacyPolicyUrl,
            [{ text: "OK" }]
          );
        }
      })
      .catch((err) => {
        console.error("Error opening privacy policy:", err);
        Alert.alert(
          "Privacy Policy",
          "Please visit our privacy policy at: " + privacyPolicyUrl,
          [{ text: "OK" }]
        );
      });
  };

  const handleViewFullTermsPress = () => {
    const termsUrl = "https://merry-griffin-b38c95.netlify.app";
    
    Linking.canOpenURL(termsUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(termsUrl);
        } else {
          Alert.alert(
            "Unable to Open Link",
            "Please visit our terms of service at: " + termsUrl,
            [{ text: "OK" }]
          );
        }
      })
      .catch((err) => {
        console.error("Error opening terms of service:", err);
        Alert.alert(
          "Terms of Service",
          "Please visit our terms of service at: " + termsUrl,
          [{ text: "OK" }]
        );
      });
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.termsModalContainer}>
        <View style={styles.termsModalHeader}>
        </View>
        
        <ScrollView
          style={styles.termsModalContent}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.termsModalScrollContent}
        >
          <Text style={styles.termsText}>{TERMS_OF_SERVICE}</Text>
          
          <TouchableOpacity
            style={styles.fullTermsButton}
            onPress={handleViewFullTermsPress}
          >
            <Ionicons name="document-text" size={20} color="#008b8b" />
            <Text style={styles.fullTermsButtonText}>
              View Full Terms Online
            </Text>
            <Ionicons name="open-outline" size={16} color="#008b8b" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.privacyPolicyButton}
            onPress={handlePrivacyPolicyPress}
          >
            <Ionicons name="shield-checkmark" size={20} color="#008b8b" />
            <Text style={styles.privacyPolicyButtonText}>
              View Privacy Policy
            </Text>
            <Ionicons name="open-outline" size={16} color="#008b8b" />
          </TouchableOpacity>
        </ScrollView>
        
        <View style={styles.termsModalFooter}>
          <TouchableOpacity
            style={styles.termsModalAcceptButton}
            onPress={onClose}
          >
            <Text style={styles.termsModalAcceptButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

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

// Enhanced Account Modal Component with updated terms handling
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const handleTermsPress = () => {
    // Option 1: Try to open web link directly
    const termsUrl = "https://merry-griffin-b38c95.netlify.app";
    
    Linking.canOpenURL(termsUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(termsUrl);
        } else {
          // Fallback to modal if link can't be opened
          setShowTermsModal(true);
        }
      })
      .catch((err) => {
        console.error("Error opening terms link:", err);
        // Fallback to modal
        setShowTermsModal(true);
      });
  };

  const handlePrivacyPolicyPress = () => {
    const privacyPolicyUrl = "https://www.privacypolicies.com/live/6898ece2-326a-48e7-b950-555cf9ab1713";
    
    Linking.canOpenURL(privacyPolicyUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(privacyPolicyUrl);
        } else {
          Alert.alert(
            "Unable to Open Link",
            "Please visit our privacy policy at: " + privacyPolicyUrl,
            [{ text: "OK" }]
          );
        }
      })
      .catch((err) => {
        console.error("Error opening privacy policy:", err);
        Alert.alert(
          "Privacy Policy",
          "Please visit our privacy policy at: " + privacyPolicyUrl,
          [{ text: "OK" }]
        );
      });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={scrollViewRef}
              style={styles.modalScrollView}
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: Math.max(keyboardHeight, 20) + 100 }
              ]}
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
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({ y: 200, animated: true });
                        }, 100);
                      }}
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
                      onFocus={() => {
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({ y: 300, animated: true });
                        }, 100);
                      }}
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

                {/* Terms and Conditions Section - Only for Sign Up */}
                {!isLoginMode && (
                  <View style={styles.termsSection}>
                    <Text style={styles.termsAgreementText}>
                      By creating an account, you agree to Kitchly's{" "}
                      <Text
                        style={styles.termsLink}
                        onPress={handleTermsPress}
                      >
                        Terms of Use
                      </Text>
                      {" "}and{" "}
                      <Text
                        style={styles.termsLink}
                        onPress={handlePrivacyPolicyPress}
                      >
                        Privacy Policy
                      </Text>
                    </Text>
                  </View>
                )}
              </View>

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
            </ScrollView>
          </SafeAreaView>
        </View>
      </TouchableWithoutFeedback>

      {/* Terms Modal */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </Modal>
  );
};

// Premium Modal Component with individual purchase buttons
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
  const [purchasingPackageId, setPurchasingPackageId] = useState(null);

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
        subtitle: 'Perfect for trying premium',
        price: product.priceString,
        period: '/month',
        productId: product.identifier,
        features: [
          "Smart Ingredient Search",
          "Personalized Meal Plans",
          "Food Scanner & Health Scores",
          "AI Weight Management",
          "AI Macro Tracking",
          "Grocery List Generator",
          "Unlimited Recipe Saves",
          "Ad-Free Experience",
          "Cancel Anytime",
        ],
        isRecommended: false,
        sortOrder: 1
      };
    } else if (isAnnual) {
      return {
        id: 'yearly',
        title: 'Annual Premium',
        subtitle: 'Best value for serious users',
        price: product.priceString,
        period: '/year',
        productId: product.identifier,
        savings: 'Save 30%',
        popular: true,
        features: [
          "Smart Ingredient Search",
          "Personalized Meal Plans",
          "Food Scanner & Health Scores",
          "AI Weight Management & Goals",
          "Additive Detection",
          "AI Macro Tracking",
          "Grocery List Generator",
          "Unlimited Recipe Saves",
          "Ad-Free Experience",
          "Priority Support",
          "Advanced Recipe Filters",
          "Cancel Anytime",
        ],
        isRecommended: true,
        sortOrder: 2
      };
    }
    
    return {
      id: pkg.identifier,
      title: product.title || 'Premium',
      subtitle: 'Premium features',
      price: product.priceString,
      period: '',
      productId: product.identifier,
      features: ["All Premium Features", "Cancel Anytime"],
      isRecommended: false,
      sortOrder: 3
    };
  };

  const plans = packages
    .map(pkg => getPackageInfo(pkg))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const handlePurchase = async (packageToPurchase) => {
    setPurchasingPackageId(packageToPurchase.identifier);
    await onSelectPremium(packageToPurchase);
    setPurchasingPackageId(null);
  };

  const PlanCard = ({ plan, packageData }) => {
    const isThisPackagePurchasing = purchasingPackageId === packageData.identifier;
    const isFallbackPackage = plan.productId?.includes('fallback');
    
    return (
      <View style={[
        styles.planCard,
        plan.popular && styles.planCardPopular
      ]}>
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
            <Text style={styles.planCardSubtitle}>{plan.subtitle}</Text>
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
        </View>

        <View style={styles.planCardFeatures}>
          {plan.features.map((feature, index) => (
            <View key={index} style={styles.planCardFeature}>
              <Ionicons name="checkmark-circle" size={14} color="#008b8b" />
              <Text style={styles.planCardFeatureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.planUpgradeButton,
            plan.isRecommended && styles.recommendedUpgradeButton,
            isFallbackPackage && styles.fallbackUpgradeButton,
          ]}
          onPress={() => handlePurchase(packageData)}
          disabled={purchasingPackageId !== null}
          activeOpacity={0.8}
        >
          {isThisPackagePurchasing ? (
            <View style={styles.purchasingContainer}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.planUpgradeButtonText}>Processing...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="diamond" size={16} color="white" />
              <Text style={styles.planUpgradeButtonText}>
                {isFallbackPackage ? "Contact for Upgrade" : "Get Premium"}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.premiumModalContainer}>
        <SafeAreaView style={styles.premiumModalSafeArea}>
          <View style={styles.premiumModalTopBar}>
            <TouchableOpacity
              style={styles.topContinueFreeButton}
              onPress={onContinueFree}
              activeOpacity={0.7}
              disabled={purchasingPackageId !== null}
            >
              <Text style={styles.topContinueFreeButtonText}>Continue with Free</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView
            style={styles.premiumModalScroll}
            contentContainerStyle={styles.premiumModalContent}
            showsVerticalScrollIndicator={false}
          >
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
                  : "Get access to AI-powered nutrition & weight management tools"
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
                
                {plans.map((plan, index) => {
                  const packageData = packages.find(pkg => {
                    const planInfo = getPackageInfo(pkg);
                    return planInfo.id === plan.id;
                  });
                  
                  return (
                    <PlanCard
                      key={plan.id || index}
                      plan={plan}
                      packageData={packageData}
                    />
                  );
                })}
              </View>
            )}

            <View style={styles.premiumModalActionsInline}>
              <TouchableOpacity
                style={styles.premiumFreeButtonProminent}
                onPress={onContinueFree}
                activeOpacity={0.8}
                disabled={purchasingPackageId !== null}
              >
                <Ionicons name="arrow-forward-circle" size={20} color="#008b8b" />
                <Text style={styles.premiumFreeButtonProminentText}>Continue with Free Version</Text>
                <Text style={styles.premiumFreeButtonSubtext}>Always available • No credit card required</Text>
              </TouchableOpacity>
              
              <Text style={styles.premiumFreeDisclaimer}>
                You can upgrade to premium anytime from the app settings
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// Main Component - rest of the file remains the same as the original...
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
      subtitle: "Your AI nutrition & weight management assistant",
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
        { id: "meal_prep", text: "Meal planning", icon: "calendar" },
        { id: "track_weight", text: "Track my weight progress", icon: "analytics" },
        { id: "save_money", text: "Save money on groceries", icon: "wallet" }
      ]
    },
    {
      id: "weight_goals",
      type: "multiple_choice",
      title: "What's your weight management focus?",
      options: [
        { id: "lose_weight", text: "Lose weight gradually", icon: "trending-down" },
        { id: "maintain_weight", text: "Maintain current weight", icon: "remove" },
        { id: "gain_weight", text: "Gain weight healthily", icon: "trending-up" },
        { id: "build_muscle", text: "Build muscle & strength", icon: "barbell" }
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
      title: "Do you track nutrition or weight?",
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
      subtitle: "This helps us provide personalized recommendations",
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
          priceString: '$5.99',
          price: 4.99,
          currencyCode: 'USD'
        }
      },
      {
        identifier: 'annual_premium_fallback',
        product: {
          identifier: 'annual_premium_fallback',
          title: 'Annual Premium',
          priceString: '$49.99',
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

      const user = authService.getCurrentUser();
      if (!user) {
        console.log('⚠️ Onboarding: No authenticated user, using fallback packages');
        setPremiumPackages(getFallbackPackages());
        setRevenueCatAvailable(false);
        return;
      }

      console.log('👤 Onboarding: User authenticated:', user.uid);

      const isAvailable = PurchaseService.checkAvailability();
      setRevenueCatAvailable(isAvailable);

      if (isAvailable) {
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
        user = await authService.login(email.trim().toLowerCase(), password);
        if (user) {
          setShowAccountScreen(false);
          if (onComplete) {
            onComplete(answers);
          }
        }
      } else {
        try {
          user = await authService.register(email.trim().toLowerCase(), password);
          if (user) {
            setUserCreatedAccount(true);
            setShowAccountScreen(false);
            setShowPremiumModal(true);
          }
        } catch (error) {
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
                    setPassword("");
                  }
                }
              ]
            );
            return;
          }
          throw error;
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
                console.log('🧪 DEV: Simulating premium activation...');
                try {
                  const user = authService.getCurrentUser();
                  if (user) {
                    const userRef = doc(db, "users", user.uid);
                    await updateDoc(userRef, {
                      isPremium: true,
                      premiumStatusUpdated: new Date().toISOString(),
                      'usage.lastActive': new Date().toISOString()
                    });
                    
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

      console.log('🔄 Onboarding: Attempting RevenueCat purchase...');
      const result = await PurchaseService.purchasePackage(packageToPurchase);
      
      console.log('💳 Onboarding: Purchase result:', result);

      if (result.success) {
        console.log('✅ Onboarding: Purchase successful!');
        
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
          "Congratulations! You now have access to all premium features including AI weight management.",
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

  // Enhanced Dropdown Component with proper height calculations
  const SimpleDropdown = ({ field, value, onSelect }) => {
    const isOpen = showDropdown === field.id;
    
    const maxDropdownHeight = Math.min(height * 0.4, 280);
    const itemHeight = 48;
    const maxVisibleItems = Math.floor(maxDropdownHeight / itemHeight);

    return (
      <View style={[styles.dropdownContainer, isOpen && { zIndex: 10000, elevation: 10000 }]}>
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
            
            <View style={[styles.dropdownList, { maxHeight: maxDropdownHeight }]}>
              <ScrollView
                style={[styles.dropdownScroll, { maxHeight: maxDropdownHeight }]}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                contentOffset={field.defaultIndex ? { x: 0, y: Math.max(0, field.defaultIndex * itemHeight - (maxDropdownHeight / 2)) } : { x: 0, y: 0 }}
                bounces={false}
              >
                {field.options.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.dropdownOption,
                      { height: itemHeight },
                      value === option.value && styles.dropdownOptionSelected,
                      index === field.options.length - 1 && styles.dropdownOptionLast
                    ]}
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

  // Welcome Step with weight management highlight
  const WelcomeStep = () => (
    <View style={styles.welcomeContainer}>
      <Image source={require("../assets/logo.png")} style={styles.welcomeLogo} resizeMode="contain" />
      <Text style={styles.welcomeTitle}>{currentQuestion.title}</Text>
      <Text style={styles.welcomeSubtitle}>{currentQuestion.subtitle}</Text>
      <Text style={styles.welcomeDescription}>{currentQuestion.description}</Text>
      
      <View style={styles.welcomeFeatures}>
        <View style={styles.welcomeFeature}>
          <Ionicons name="fitness" size={20} color="#008b8b" />
          <Text style={styles.welcomeFeatureText}>AI weight management & goal tracking</Text>
        </View>
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

  // Multiple Select Step with Grid Layout
  const MultipleSelectStep = () => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
      <Text style={styles.questionSubtitle}>Select all that apply</Text>
      
      <View style={styles.optionsGrid}>
        {currentQuestion.options.map((option) => {
          const isSelected = answers[currentQuestion.id]?.includes(option.id);
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.gridOptionButton, isSelected && styles.gridOptionButtonSelected]}
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
              <View style={styles.gridOptionIconContainer}>
                <Ionicons name={option.icon} size={20} color={isSelected ? "white" : "#008b8b"} />
              </View>
              <Text style={[styles.gridOptionText, isSelected && styles.gridOptionTextSelected]}>
                {option.text}
              </Text>
              {isSelected && (
                <View style={styles.gridCheckmark}>
                  <Ionicons name="checkmark-circle" size={18} color="#008b8b" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Form Step - with proper spacing to avoid footer blocking
  const FormStep = () => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
      {currentQuestion.subtitle && (
        <Text style={styles.questionSubtitle}>{currentQuestion.subtitle}</Text>
      )}
      
      <View style={styles.formContainer}>
        {currentQuestion.fields.map((field, index) => (
          <View key={field.id} style={[
            styles.inputContainer,
            index === currentQuestion.fields.length - 1 && styles.lastInputContainer
          ]}>
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

      <View style={styles.contentContainer}>
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

        {/* Fixed Continue Button for Multi-Select and Form Steps */}
        {((currentQuestion?.type === "multiple_select" && isAnswered) ||
          (currentQuestion?.type === "form" && isAnswered)) && (
          <View style={styles.fixedButtonContainer}>
            <TouchableOpacity style={styles.continueButton} onPress={nextStep}>
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>

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
  contentContainer: {
    flex: 1,
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
  fixedButtonContainer: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
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
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  gridOptionButton: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: "#e9ecef",
    width: (width - 60) / 2,
    alignItems: "center",
    minHeight: 120,
    position: "relative",
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
  gridOptionButtonSelected: {
    borderColor: "#008b8b",
    backgroundColor: "#f0f9f9",
  },
  gridOptionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  gridOptionText: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  gridOptionTextSelected: {
    color: "#008b8b",
    fontWeight: "600",
  },
  gridCheckmark: {
    position: "absolute",
    top: 8,
    right: 8,
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
    paddingBottom: 120,
  },
  inputContainer: {
    marginBottom: 6,
  },
  lastInputContainer: {
    marginBottom: 100,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 8,
  },

  // Enhanced Dropdown Styles
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
    // maxHeight will be set dynamically in component
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
  },
  dropdownOptionSelected: {
    backgroundColor: "#f0f9f9",
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
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

  // Enhanced Account Modal Styles
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
    backgroundColor: "white",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
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
    marginBottom: 40,
  },
  modalInputGroup: {
    marginBottom: 20,
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
    height: 56,
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
    gap: 12,
    marginTop: 20,
  },
  modalPrimaryButton: {
    backgroundColor: "#008b8b",
    borderRadius: 12,
    height: 56,
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
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7f8c8d",
  },

  // Terms-related styles
  termsSection: {
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  termsAgreementText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    textAlign: "center",
  },
  termsLink: {
    color: "#008b8b",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  
  // Terms Modal Styles
  termsModalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  termsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    backgroundColor: "white",
  },
  termsModalContent: {
    flex: 1,
  },
  termsModalScrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  termsText: {
    marginTop: 15,
    fontSize: 14,
    color: "#2c3e50",
    lineHeight: 22,
    marginBottom: 24,
  },
  fullTermsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f4f8",
    borderWidth: 1,
    borderColor: "#008b8b",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  fullTermsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#008b8b",
  },
  privacyPolicyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f9f9",
    borderWidth: 1,
    borderColor: "#008b8b",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  privacyPolicyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#008b8b",
  },
  termsModalFooter: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  termsModalAcceptButton: {
    backgroundColor: "#008b8b",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  termsModalAcceptButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  // Premium Modal Styles
  premiumModalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  premiumModalSafeArea: {
    flex: 1,
  },
  premiumModalTopBar: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 14,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: "rgba(248, 249, 250, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(233, 236, 239, 0.3)",
  },
  topContinueFreeButton: {
    marginTop: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0, 139, 139, 0.2)",
  },
  topContinueFreeButtonText: {
    fontSize: 14,
    color: "rgba(127, 140, 141, 0.8)",
    fontWeight: "500",
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
    marginBottom: 8,
  },
  planCardLeft: {
    flex: 1,
  },
  planCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 4,
  },
  planCardSubtitle: {
    fontSize: 14,
    color: "#7f8c8d",
    marginBottom: 8,
  },
  planCardPricing: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
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
  planCardFeatures: {
    gap: 8,
    marginBottom: 20,
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
  planUpgradeButton: {
    backgroundColor: "#008b8b",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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
  recommendedUpgradeButton: {
    backgroundColor: "#007a7a",
    ...Platform.select({
      ios: {
        shadowColor: "#007a7a",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  fallbackUpgradeButton: {
    backgroundColor: "#008b8b",
  },
  planUpgradeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    marginHorizontal: 8,
    letterSpacing: 0.3,
  },
  premiumModalActionsInline: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  premiumFreeButtonProminent: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: "#008b8b",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 300,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  premiumFreeButtonProminentText: {
    color: "#008b8b",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  premiumFreeButtonSubtext: {
    color: "#7f8c8d",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  premiumFreeDisclaimer: {
    color: "#95a5a6",
    fontSize: 13,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 16,
    paddingHorizontal: 20,
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
});
