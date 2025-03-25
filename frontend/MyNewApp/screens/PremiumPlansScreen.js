import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";

export default function PremiumPlansScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgradeToPremium = async () => {
    setIsLoading(true);
    try {
      // In a real app, you would integrate with a payment gateway here
      // For this example, we'll just set the user as premium in Firestore
      await authService.upgradeToPremuim();
      Alert.alert(
        "Upgrade Successful",
        "Congratulations! You now have access to all premium features.",
        [
          {
            text: "OK",
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to upgrade. Please try again later.");
      console.error("Upgrade error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const PlanCard = ({ title, price, features, isRecommended, onPress }) => (
    <View
      style={[styles.planCard, isRecommended && styles.recommendedPlanCard]}
    >
      {isRecommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedBadgeText}>BEST VALUE</Text>
        </View>
      )}
      <Text
        style={[styles.planTitle, isRecommended && styles.recommendedPlanTitle]}
      >
        {title}
      </Text>
      <Text style={styles.planPrice}>{price}</Text>
      <View style={styles.featuresList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#008b8b" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={[
          styles.upgradeButton,
          isRecommended && styles.recommendedUpgradeButton,
        ]}
        onPress={onPress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.upgradeButtonText}>Choose Plan</Text>
        )}
      </TouchableOpacity>
    </View>
  );

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

      <ScrollView style={styles.container}>
        <View style={styles.contentContainer}>
          <View style={styles.introSection}>
            <Ionicons name="star" size={48} color="#FFD700" />
            <Text style={styles.introTitle}>Upgrade to PlateMate Premium</Text>
            <Text style={styles.introText}>
              Get access to all premium features and elevate your cooking
              experience.
            </Text>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Premium Features</Text>

            <View style={styles.featureRow}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="basket-outline" size={24} color="#008b8b" />
              </View>
              <View style={styles.featureDetails}>
                <Text style={styles.featureTitle}>
                  Recipe Search by Ingredients
                </Text>
                <Text style={styles.featureDescription}>
                  Find recipes using ingredients you already have in your
                  kitchen
                </Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="book-outline" size={24} color="#008b8b" />
              </View>
              <View style={styles.featureDetails}>
                <Text style={styles.featureTitle}>Personalized Meal Plans</Text>
                <Text style={styles.featureDescription}>
                  Get custom meal plans tailored to your dietary preferences and
                  goals
                </Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={styles.featureIconContainer}>
                <Ionicons name="bookmark" size={24} color="#008b8b" />
              </View>
              <View style={styles.featureDetails}>
                <Text style={styles.featureTitle}>Unlimited Recipe Saving</Text>
                <Text style={styles.featureDescription}>
                  Save and organize your favorite recipes in personalized
                  collections
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>

            <PlanCard
              title="Monthly"
              price="$4.99/month"
              features={[
                "Recipe Search by Ingredients",
                "Personalized Meal Plans",
                "Unlimited Recipe Saving",
                "Cancel Anytime",
              ]}
              onPress={handleUpgradeToPremium}
            />

            <PlanCard
              title="Annual"
              price="$39.99/year"
              features={[
                "Recipe Search by Ingredients",
                "Personalized Meal Plans",
                "Unlimited Recipe Saving",
                "Save 33% vs. Monthly",
                "Cancel Anytime",
              ]}
              isRecommended={true}
              onPress={handleUpgradeToPremium}
            />
          </View>

          <Text style={styles.disclaimer}>
            For demonstration purposes only. No actual payment will be
            processed.
          </Text>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "white",
    marginTop: -57,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  introSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2c3e50",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  introText: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 24,
  },
  featuresSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
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
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e6f3f3",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureDetails: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: "#7f8c8d",
    lineHeight: 20,
  },
  plansSection: {
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
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
    position: "relative",
    overflow: "hidden",
  },
  recommendedPlanCard: {
    borderWidth: 2,
    borderColor: "#008b8b",
  },
  recommendedBadge: {
    position: "absolute",
    top: 16,
    right: -28,
    backgroundColor: "#008b8b",
    paddingVertical: 6,
    paddingHorizontal: 32,
    transform: [{ rotate: "45deg" }],
  },
  recommendedBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  planTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  recommendedPlanTitle: {
    color: "#008b8b",
  },
  planPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: "#2c3e50",
    marginBottom: 20,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: "#2c3e50",
    marginLeft: 12,
  },
  upgradeButton: {
    backgroundColor: "#008b8b",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  recommendedUpgradeButton: {
    backgroundColor: "#008b8b",
  },
  upgradeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disclaimer: {
    fontSize: 12,
    color: "#95a5a6",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 32,
  },
});
