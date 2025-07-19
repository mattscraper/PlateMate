import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";
import PremiumService from "../services/PremiumService";
import PurchaseService from "../services/PurchaseService";

const { width } = Dimensions.get('window');

export default function PremiumPlansScreen({ navigation, route }) {
  const [isLoading, setIsLoading] = useState(true);
  const [purchasingPackageId, setPurchasingPackageId] = useState(null);
  const [packages, setPackages] = useState([]);
  const [hasActivePremium, setHasActivePremium] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [revenueCatAvailable, setRevenueCatAvailable] = useState(false);
  
  // Get callback function from navigation params
  const { onPremiumStatusUpdate, isPremium } = route.params || {};

  useEffect(() => {
    initializeSubscriptions();
    
    // Subscribe to premium status changes
    const unsubscribe = authService.subscribeToPremiumStatus((premiumStatus) => {
      console.log('💎 PremiumPlansScreen: Premium status updated:', premiumStatus);
      setHasActivePremium(premiumStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const initializeSubscriptions = async () => {
    try {
      setIsLoading(true);
      console.log('🚀 PremiumPlansScreen: Loading...');

      // Check if user is authenticated
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('👤 PremiumPlansScreen: User authenticated:', user.uid);

      // Check current premium status
      const currentPremiumStatus = authService.getCurrentPremiumStatus();
      console.log('💎 PremiumPlansScreen: Current premium status:', currentPremiumStatus);
      setHasActivePremium(currentPremiumStatus);

      // If already premium, no need to load packages
      if (currentPremiumStatus) {
        console.log('✅ PremiumPlansScreen: User already has premium');
        setIsLoading(false);
        return;
      }

      // Check if RevenueCat is available
      const isAvailable = PurchaseService.checkAvailability();
      setRevenueCatAvailable(isAvailable);

      if (isAvailable) {
        // Configure RevenueCat if not already done
        console.log('🔧 PremiumPlansScreen: Configuring RevenueCat...');
        const configured = await PurchaseService.configure(
          'appl_fwRWQRdSViPvwzChtARGpDVvLEs',
          user.uid
        );

        if (configured) {
          console.log('✅ PremiumPlansScreen: RevenueCat configured, loading packages...');
          const availablePackages = await PurchaseService.getOfferings();
          
          if (availablePackages && availablePackages.length > 0) {
            console.log('📦 PremiumPlansScreen: Loaded', availablePackages.length, 'packages from RevenueCat');
            setPackages(availablePackages);
          } else {
            console.log('⚠️ PremiumPlansScreen: No packages from RevenueCat, using fallback');
            setPackages(getFallbackPackages());
          }
        } else {
          console.log('⚠️ PremiumPlansScreen: RevenueCat configuration failed, using fallback packages');
          setPackages(getFallbackPackages());
        }
      } else {
        console.log('⚠️ PremiumPlansScreen: RevenueCat not available, using fallback packages');
        setPackages(getFallbackPackages());
      }

    } catch (error) {
      console.error('❌ PremiumPlansScreen: Error loading premium plans:', error);
      setPackages(getFallbackPackages());
    } finally {
      setIsLoading(false);
    }
  };

  const getFallbackPackages = () => {
    return [
      {
        identifier: 'monthly_premium_fallback',
        product: {
          identifier: 'monthly_premium',
          title: 'Monthly Premium',
          priceString: '$4.99',
          price: 4.99,
          currencyCode: 'USD'
        }
      },
      {
        identifier: 'annual_premium_fallback',
        product: {
          identifier: 'annual_premium',
          title: 'Annual Premium',
          priceString: '$39.99',
          price: 39.99,
          currencyCode: 'USD'
        }
      }
    ];
  };

  const handleUpgradeToPremium = async (packageToPurchase) => {
    setPurchasingPackageId(packageToPurchase.identifier);
    
    try {
      console.log('💳 PremiumPlansScreen: Starting purchase:', packageToPurchase.identifier);

      // Check if this is a fallback package
      if (packageToPurchase.identifier.includes('fallback')) {
        console.log('⚠️ PremiumPlansScreen: Fallback package selected');
        
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
              onPress: () => initializeSubscriptions()
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
                    
                    Alert.alert("✅ Premium Activated", "Premium status activated for testing!");
                    
                    if (onPremiumStatusUpdate) {
                      onPremiumStatusUpdate();
                    }
                    navigation.goBack();
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
      console.log('🔄 PremiumPlansScreen: Attempting RevenueCat purchase...');
      const result = await PurchaseService.purchasePackage(packageToPurchase);
      
      console.log('💳 PremiumPlansScreen: Purchase result:', result);

      if (result.success) {
        console.log('✅ PremiumPlansScreen: Purchase successful!');
        
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
                if (onPremiumStatusUpdate) {
                  onPremiumStatusUpdate();
                }
                navigation.goBack();
              },
            },
          ]
        );
        
      } else if (result.cancelled) {
        console.log('🚫 PremiumPlansScreen: Purchase cancelled by user');
        
      } else {
        console.log('❌ PremiumPlansScreen: Purchase failed:', result.error);
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
              onPress: () => handleUpgradeToPremium(packageToPurchase)
            },
            {
              text: "Cancel",
              style: "cancel"
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('❌ PremiumPlansScreen: Purchase error:', error);
      Alert.alert("Purchase Error", "Something went wrong. Please try again later.");
    } finally {
      setPurchasingPackageId(null);
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    
    try {
      console.log('🔄 PremiumPlansScreen: Restoring purchases...');
      
      if (!revenueCatAvailable) {
        Alert.alert(
          'Restore Unavailable',
          'Purchase restoration is currently unavailable. Please contact support for assistance.',
          [
            {
              text: "Contact Support",
              onPress: () => {
                Alert.alert("Support", "Please email support@kitchly.app for assistance.");
              }
            },
            { text: "OK" }
          ]
        );
        return;
      }
      
      const result = await PurchaseService.restorePurchases();
      console.log('🔄 PremiumPlansScreen: Restore result:', result);

      if (result.success) {
        if (result.hasPremium) {
          // Force refresh PremiumService status
          await PremiumService.forceRefresh();
          
          // Also refresh authService premium status
          await authService.forceRefreshPremiumStatus();
          
          Alert.alert('✅ Success', 'Your purchases have been restored!');
          
          if (onPremiumStatusUpdate) {
            await onPremiumStatusUpdate();
          }
        } else {
          Alert.alert('ℹ️ No Purchases', 'No previous purchases found to restore.');
        }
      } else {
        Alert.alert('Error', result.error || 'Failed to restore purchases');
      }
      
    } catch (error) {
      console.error('❌ PremiumPlansScreen: Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again later.');
    } finally {
      setIsRestoring(false);
    }
  };

  const getPackageInfo = (pkg) => {
    const identifier = pkg.identifier.toLowerCase();
    const product = pkg.product;
    
    const isMonthly = identifier.includes('monthly') ||
                     identifier.includes('month') ||
                     identifier.includes('1_month');
                     
    const isAnnual = identifier.includes('annual') ||
                    identifier.includes('year') ||
                    identifier.includes('12_month');
    
    if (isMonthly) {
      return {
        title: 'Monthly Premium',
        subtitle: 'Perfect for trying premium',
        price: product.priceString,
        period: '/month',
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
        isRecommended: false
      };
    } else if (isAnnual) {
      return {
        title: 'Annual Premium',
        subtitle: 'Best value for serious users',
        price: product.priceString,
        period: '/year',
        savings: 'Save 33%',
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
        isRecommended: true
      };
    }
    
    return {
      title: product.title || 'Premium',
      subtitle: 'Premium features',
      price: product.priceString,
      period: '',
      features: ["All Premium Features", "Cancel Anytime"],
      isRecommended: false
    };
  };

  const PlanCard = ({ packageData, isRecommended, onPress }) => {
    const packageInfo = getPackageInfo(packageData);
    const isThisPackagePurchasing = purchasingPackageId === packageData.identifier;
    const isFallbackPackage = packageData.identifier.includes('fallback');
    
    return (
      <View style={[styles.planCard, isRecommended && styles.recommendedPlanCard]}>
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedBadgeText}>BEST VALUE</Text>
            <Ionicons name="diamond" size={12} color="white" style={styles.badgeIcon} />
          </View>
        )}
        
        {isFallbackPackage && (
          <View style={styles.fallbackBadge}>
            <Text style={styles.fallbackBadgeText}>ESTIMATED PRICING</Text>
            <Ionicons name="warning" size={12} color="white" style={styles.badgeIcon} />
          </View>
        )}
        
        <View style={[styles.planHeader, isRecommended && styles.recommendedPlanHeader]}>
          <View style={styles.planIconContainer}>
            <Ionicons name="diamond" size={24} color={isRecommended ? "#008b8b" : "#95a5a6"} />
          </View>
          <View style={styles.planTitleContainer}>
            <Text style={[styles.planTitle, isRecommended && styles.recommendedPlanTitle]}>
              {packageInfo.title}
            </Text>
            <Text style={styles.planSubtitle}>{packageInfo.subtitle}</Text>
          </View>
          
          {packageInfo.savings && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>{packageInfo.savings}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.priceContainer}>
          <Text style={styles.planPrice}>{packageInfo.price}</Text>
          <Text style={styles.planPeriod}>{packageInfo.period}</Text>
        </View>
        
        <View style={styles.featuresList}>
          {packageInfo.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.checkIconContainer}>
                <Ionicons name="checkmark-circle" size={16} color="#008b8b" />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        
        <TouchableOpacity
          style={[
            styles.upgradeButton,
            isRecommended && styles.recommendedUpgradeButton,
            isFallbackPackage && styles.fallbackUpgradeButton,
          ]}
          onPress={() => onPress(packageData)}
          disabled={purchasingPackageId !== null}
        >
          {isThisPackagePurchasing ? (
            <View style={styles.purchasingContainer}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.upgradeButtonText}>Processing...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="diamond" size={16} color="white" />
              <Text style={styles.upgradeButtonText}>
                {isFallbackPackage ? "Contact for Upgrade" : "Get Premium"}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium Plans</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#008b8b" />
          </View>
          <Text style={styles.loadingText}>Loading premium options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Already premium state - PRODUCTION READY (NO DEBUG BUTTON)
  if (hasActivePremium || isPremium) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium Status</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.premiumContainer}>
          <View style={styles.premiumIconContainer}>
            <View style={styles.premiumIconBg}>
              <Ionicons name="diamond" size={48} color="#008b8b" />
            </View>
          </View>
          <Text style={styles.premiumTitle}>💎 Premium Active!</Text>
          <Text style={styles.premiumText}>
            You have access to all premium features including smart ingredient search,
            food scanner, AI macro tracking, and unlimited recipe saving.
          </Text>
          
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRestorePurchases}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#008b8b" />
            ) : (
              <Ionicons name="refresh" size={18} color="#008b8b" />
            )}
            <Text style={styles.refreshButtonText}>
              {isRestoring ? "Refreshing..." : "Refresh Status"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.continueButtonText}>Continue to App</Text>
            <Ionicons name="arrow-forward" size={16} color="#008b8b" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium Plans</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          {/* Status Indicator */}
          {!revenueCatAvailable && (
            <View style={styles.statusBanner}>
              <Ionicons name="warning" size={16} color="#f39c12" />
              <Text style={styles.statusBannerText}>
                In-app purchases temporarily unavailable
              </Text>
            </View>
          )}

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroIconContainer}>
              <View style={styles.heroIconBg}>
                <Ionicons name="diamond" size={40} color="#008b8b" />
              </View>
              <View style={styles.sparkle1}>
                <Ionicons name="sparkles" size={16} color="#FFD700" />
              </View>
              <View style={styles.sparkle2}>
                <Ionicons name="sparkles" size={12} color="#FFD700" />
              </View>
            </View>
            <Text style={styles.heroTitle}>Unlock Premium Features</Text>
            <Text style={styles.heroSubtitle}>
              Transform your cooking experience with AI-powered tools and personalized insights
            </Text>
          </View>

          {/* Premium Features Grid */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Premium Features</Text>
            
            <View style={styles.featuresGrid}>
              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="search" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>Smart Ingredient Search</Text>
                <Text style={styles.featureDescription}>
                  Find recipes using ingredients you already have
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="barcode" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>Food Scanner</Text>
                <Text style={styles.featureDescription}>
                  Scan barcodes, get health scores & detect additives
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="book" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>Meal Planning</Text>
                <Text style={styles.featureDescription}>
                  Personalized meal plans for your goals
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="fitness" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>AI Weight Management</Text>
                <Text style={styles.featureDescription}>
                  Track weight, set goals & get personalized insights
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="analytics" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>AI Macro Tracking</Text>
                <Text style={styles.featureDescription}>
                  Daily nutrition tracking with AI assistance
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="list" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>Smart Grocery Lists</Text>
                <Text style={styles.featureDescription}>
                  Auto-generated lists from your meal plans
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="bookmark" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>Unlimited Saves</Text>
                <Text style={styles.featureDescription}>
                  Save & organize unlimited recipes
                </Text>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="remove-circle" size={24} color="#008b8b" />
                </View>
                <Text style={styles.featureTitle}>Ad-Free Experience</Text>
                <Text style={styles.featureDescription}>
                  Enjoy the app without any interruptions
                </Text>
              </View>
            </View>
          </View>

          {/* Pricing Plans */}
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            
            {packages.map((pkg, index) => {
              const packageInfo = getPackageInfo(pkg);
              return (
                <PlanCard
                  key={pkg.identifier || index}
                  packageData={pkg}
                  isRecommended={packageInfo.isRecommended}
                  onPress={handleUpgradeToPremium}
                />
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footerSection}>
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={handleRestorePurchases}
              disabled={isRestoring}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color="#008b8b" />
              ) : (
                <Ionicons name="refresh-outline" size={16} color="#008b8b" />
              )}
              <Text style={styles.restoreButtonText}>
                {isRestoring ? "Restoring..." : "Restore Purchases"}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.disclaimer}>
              Subscriptions automatically renew unless cancelled. Cancel anytime in your App Store account settings.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff3cd',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },
  statusBannerText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingSpinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  premiumContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  premiumIconContainer: {
    marginBottom: 24,
  },
  premiumIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  premiumText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#e8f5f5',
    borderRadius: 12,
    marginBottom: 16,
  },
  refreshButtonText: {
    fontSize: 16,
    color: '#008b8b',
    fontWeight: '500',
    marginLeft: 8,
  },
  // PRODUCTION READY: Clean continue button instead of debug button
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#008b8b',
    marginTop: 8,
  },
  continueButtonText: {
    fontSize: 16,
    color: '#008b8b',
    fontWeight: '600',
    marginRight: 8,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: 'white',
  },
  heroIconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  heroIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkle1: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  sparkle2: {
    position: 'absolute',
    bottom: 0,
    left: -8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    padding: 24,
    backgroundColor: 'white',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: (width - 72) / 2,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 18,
  },
  plansSection: {
    padding: 24,
    backgroundColor: 'white',
    marginTop: 12,
  },
  planCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e1e8ed',
    position: 'relative',
  },
  recommendedPlanCard: {
    borderColor: '#008b8b',
    backgroundColor: '#ffffff',
    shadowColor: '#008b8b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 28, // Add space for the badge
  },
  // FIXED: Better looking badge
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    left: 24,
    right: 24,
    backgroundColor: '#008b8b',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#008b8b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  recommendedBadgeText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  badgeIcon: {
    marginLeft: 6,
  },
  fallbackBadge: {
    position: 'absolute',
    top: -12,
    left: 24,
    right: 24,
    backgroundColor: '#f39c12',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f39c12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fallbackBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recommendedPlanHeader: {
    marginTop: 8, // Add space when there's a badge
  },
  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  planTitleContainer: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  recommendedPlanTitle: {
    color: '#008b8b',
  },
  planSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  savingsBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  planPeriod: {
    fontSize: 16,
    color: '#7f8c8d',
    marginLeft: 4,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkIconContainer: {
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: '#008b8b',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  recommendedUpgradeButton: {
    backgroundColor: '#008b8b',
  },
  fallbackUpgradeButton: {
    backgroundColor: '#008b8b',
  },
  purchasingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  footerSection: {
    padding: 24,
    alignItems: 'center',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#e8f5f5',
    borderRadius: 12,
    marginBottom: 20,
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#008b8b',
    fontWeight: '500',
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
