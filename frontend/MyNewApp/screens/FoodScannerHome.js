import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const FoodScannerHome = ({ navigation }) => {
  // Set header style when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      navigation.setOptions({
        headerStyle: {
          backgroundColor: '#f8f9fa',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: '#2c3e50',
        headerTitle: () => null, // No title component
        headerBackTitleVisible: false, // Hide "Back" text on iOS
        headerBackTitle: '', // Remove back title text completely
      });
    }, [navigation])
  );
  const ActionCard = ({ icon, title, description, onPress, isPrimary = false }) => (
    <TouchableOpacity
      style={[styles.actionCard, isPrimary && styles.primaryCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.actionContent}>
        <View style={[styles.actionIconContainer, isPrimary && styles.primaryIconContainer]}>
          <Ionicons
            name={icon}
            size={32}
            color={isPrimary ? "white" : "#008b8b"}
          />
        </View>
        <View style={styles.actionTextContainer}>
          <Text style={[styles.actionTitle, isPrimary && styles.primaryActionTitle]}>
            {title}
          </Text>
          <Text style={[styles.actionDescription, isPrimary && styles.primaryActionDescription]}>
            {description}
          </Text>
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={24}
        color={isPrimary ? "white" : "#008b8b"}
      />
    </TouchableOpacity>
  );

  const FeatureCard = ({ icon, title, description, color }) => (
    <View style={styles.featureCard}>
      <View style={[styles.featureIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="scan" size={48} color="#008b8b" />
          </View>
          <Text style={styles.title}>Food Scanner</Text>
          <Text style={styles.subtitle}>
            Scan product barcodes to get health scores and nutritional analysis
          </Text>
        </View>

        {/* Action Cards */}
        <View style={styles.actionsContainer}>
          <ActionCard
            icon="scan"
            title="Scan Barcode"
            description="Point your camera at any product barcode"
            onPress={() => navigation.navigate('BarcodeScanner')}
            isPrimary={true}
          />

          <ActionCard
            icon="search"
            title="Search Products"
            description="Manually search for product information"
            onPress={() => navigation.navigate('ProductSearch')}
          />
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>What You'll Get</Text>
          
          <FeatureCard
            icon="shield-checkmark"
            title="Health Score Analysis"
            description="Get an overall health rating for any product"
            color="#10B981"
          />
          
          <FeatureCard
            icon="warning"
            title="Additive Detection"
            description="Identify potentially harmful additives and preservatives"
            color="#F59E0B"
          />
          
          <FeatureCard
            icon="nutrition"
            title="Nutritional Breakdown"
            description="Complete nutritional information and ingredient analysis"
            color="#3B82F6"
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },

  scrollContainer: {
    flex: 1,
  },
  
  // Header Content (inside scroll)
  headerContent: {
    alignItems: "center",
    paddingVertical: 30,
    marginBottom: 30,
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
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
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  // Action Cards (matching your menu items)
  actionsContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
    gap: 16,
  },
  actionCard: {
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
  primaryCard: {
    backgroundColor: "#008b8b",
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  primaryIconContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  actionTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  primaryActionTitle: {
    color: "white",
  },
  actionDescription: {
    fontSize: 14,
    color: "#7f8c8d",
    lineHeight: 20,
  },
  primaryActionDescription: {
    color: "rgba(255, 255, 255, 0.9)",
  },

  // Features Section
  featuresSection: {
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 20,
  },
  featureCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: "#7f8c8d",
    lineHeight: 18,
  },

  bottomSpacer: {
    height: 20,
  },
});

export default FoodScannerHome;
