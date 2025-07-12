
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
import PurchaseService from "../services/PurchaseService";

const { width } = Dimensions.get('window');

export default function PremiumPlansScreen({ navigation, route }) {
  const [isLoading, setIsLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState([]);
  const [hasActivePremium, setHasActivePremium] = useState(false);
  
  // Get callback function from navigation params
  const { onPremiumStatusUpdate, isPremium } = route.params || {};

  useEffect(() => {
    initializeSubscriptions();
  }, []);

  const initializeSubscriptions = async () => {
    try {
      // Configure RevenueCat
      await PurchaseService.configure();
      console.log('🔧 RevenueCat configured');
      
      // Debug: Check customer info
      const customerInfo = await PurchaseService.getCustomerInfo();
      console.log('👤 Customer Info:', customerInfo);
      
      // Debug: Try to get offerings
      console.log('🛍️ Fetching offerings...');
      const availablePackages = await PurchaseService.getOfferings();
      console.log('📦 Available packages:', availablePackages);
      
      if (availablePackages.length === 0) {
        console.error('❌ No packages found! Check RevenueCat dashboard configuration');
      }
      
      // Check current subscription status
      const status = await PurchaseService.checkSubscriptionStatus();
      setHasActivePremium(status.hasActivePremium);
      
      setPackages(availablePackages);
      
    } catch (error) {
      console.error('💥 Error initializing subscriptions:', error);
      Alert.alert('Error', 'Failed to load subscription options');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgradeToPremium = async (packageToPurchase) => {
    setPurchasing(true);
    
    try {
      const result = await PurchaseService.purchasePackage(packageToPurchase);
      
      if (result.success) {
        setHasActivePremium(true);
        
        // Call the callback to update premium status in App.js
        if (onPremiumStatusUpdate) {
          await onPremiumStatusUpdate();
        }
        
        Alert.alert(
          "🎉 Welcome to Premium!",
          "Congratulations! You now have access to all premium features.",
          [
            {
              text: "Get Started",
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else if (result.cancelled) {
        console.log('Purchase cancelled');
      } else {
        Alert.alert('Purchase Failed', result.error || 'Something went wrong');
      }
    } catch (error) {
      Alert.alert("Error", "Failed to upgrade. Please try again later.");
      console.error("Upgrade error:", error);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestorePurchases = async () => {
    setIsLoading(true);
    
    try {
      const result = await PurchaseService.restorePurchases();
      
      if (result.success) {
        setHasActivePremium(result.hasActivePremium);
        
        if (onPremiumStatusUpdate) {
          await onPremiumStatusUpdate();
        }
        
        if (result.hasActivePremium) {
          Alert.alert('Success', 'Your purchases have been restored!');
        } else {
          Alert.alert('No Purchases', 'No previous purchases found to restore.');
        }
      } else {
        Alert.alert('Error', 'Failed to restore purchases');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setIsLoading(false);
    }
  };

  const getPackageInfo = (pkg) => {
    const productId = pkg.product.identifier;
    
    if (productId === '1206856') {
      return {
        title: 'Monthly Premium',
        subtitle: 'Perfect for trying premium',
        price: pkg.product.priceString,
        period: '/month',
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
    } else if (productId === '1206857') {
      return {
        title: 'Annual Premium',
        subtitle: 'For those serious about nutrition',
        price: pkg.product.priceString,
        period: '/year',
        savings: 'Save 33%',
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
      title: pkg.product.title || 'Premium',
      subtitle: 'Premium features',
      price: pkg.product.priceString,
      period: '',
      features: ["All Premium Features", "Cancel Anytime"],
      isRecommended: false
    };
  };

  const PlanCard = ({ packageData, isRecommended, onPress }) => {
    const packageInfo = getPackageInfo(packageData);
    
    return (
      <View style={[styles.planCard, isRecommended && styles.recommendedPlanCard]}>
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Ionicons name="diamond" size={12} color="white" />
            <Text style={styles.recommendedBadgeText}>BEST VALUE</Text>
          </View>
        )}
        
        <View style={styles.planHeader}>
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
          ]}
          onPress={() => onPress(packageData)}
          disabled={purchasing}
        >
          {purchasing ? (
            <View style={styles.purchasingContainer}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.upgradeButtonText}>Processing...</Text>
            </View>
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="diamond" size={16} color="white" />
              <Text style={styles.upgradeButtonText}>Get Premium</Text>
              <Ionicons name="arrow-forward" size={16} color="white" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Show loading state
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
          <View style={{ width: 24 }} />
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

  // Show already premium state
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
          <View style={{ width: 24 }} />
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
          >
            <Ionicons name="refresh" size={18} color="#008b8b" />
            <Text style={styles.refreshButtonText}>Refresh Status</Text>
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
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
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
            </View>
          </View>

          {/* Pricing Plans */}
          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            
            {packages.map((pkg, index) => {
              const packageInfo = getPackageInfo(pkg);
              return (
                <PlanCard
                  key={index}
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
              disabled={isLoading}
            >
              <Ionicons name="refresh-outline" size={16} color="#008b8b" />
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
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
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#f8f9fa",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2c3e50",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  
  // Premium State
  premiumContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  premiumIconContainer: {
    marginBottom: 24,
  },
  premiumIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  premiumTitle: {
    fontSize: 28,
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
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  refreshButtonText: {
    color: '#008b8b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 40,
    position: 'relative',
  },
  heroIconContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  heroIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#008b8b',
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sparkle1: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  sparkle2: {
    position: 'absolute',
    bottom: 5,
    left: -5,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 17,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
  },
  
  // Features Section
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 24,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: (width - 60) / 2,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
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
  featureIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e6f3f3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 13,
    color: "#7f8c8d",
    lineHeight: 18,
    textAlign: 'center',
  },
  
  // Plans Section
  plansSection: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  planCard: {
    backgroundColor: "white",
    borderRadius: 20,
    marginBottom: 16,
    padding: 24,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
    overflow: 'hidden',
  },
  recommendedPlanCard: {
    borderWidth: 2,
    borderColor: "#008b8b",
    transform: [{ scale: 1.02 }],
  },
  recommendedBadge: {
    position: "absolute",
    top: 20,
    right: -35,
    backgroundColor: "#008b8b",
    paddingVertical: 8,
    paddingHorizontal: 40,
    transform: [{ rotate: "45deg" }],
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
    marginLeft: 4,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  planTitleContainer: {
    flex: 1,
  },
  planTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 4,
  },
  recommendedPlanTitle: {
    color: "#008b8b",
  },
  planSubtitle: {
    fontSize: 14,
    color: "#95a5a6",
    fontWeight: '500',
  },
  savingsBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27ae60',
    marginLeft: 8,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: "800",
    color: "#2c3e50",
  },
  planPeriod: {
    fontSize: 16,
    color: "#95a5a6",
    marginLeft: 4,
    marginBottom: 6,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkIconContainer: {
    marginRight: 10,
  },
  featureText: {
    fontSize: 15,
    color: "#2c3e50",
    fontWeight: '500',
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: "#008b8b",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: 'center',
  },
  recommendedUpgradeButton: {
    backgroundColor: "#008b8b",
    ...Platform.select({
      ios: {
        shadowColor: "#008b8b",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
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
  upgradeButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
    marginHorizontal: 8,
  },
  
  // Footer
  footerSection: {
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  restoreButtonText: {
    color: '#008b8b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  disclaimer: {
    fontSize: 13,
    color: "#95a5a6",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 10,
  },
});
