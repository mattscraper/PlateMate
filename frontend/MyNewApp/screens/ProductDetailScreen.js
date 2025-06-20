import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const API_BASE_URL = 'https://platemate-6.onrender.com/api/food-scanner';

const ProductDetailScreen = ({ route, navigation }) => {
  const { barcode } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        headerTitle: () => null,
        headerBackTitleVisible: false,
      });
    }, [navigation])
  );

  useEffect(() => {
    fetchProductData();
  }, [barcode]);

  const fetchProductData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/product/${barcode}`);
      
      if (!response.ok) {
        throw new Error('Product not found');
      }
      
      const data = await response.json();
      setProduct(data);
    } catch (err) {
      setError(err.message);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getHealthScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  const getNutrientQuality = (key, value, per100g = true) => {
    if (!value) return { level: 'unknown', color: '#9CA3AF', label: 'Unknown' };
    
    // Convert to per 100g if needed (assuming 33g serving size like screenshot)
    const val = per100g ? value : (value * 100 / 33);
    
    const thresholds = {
      energy_kcal_100g: { low: 200, medium: 400, high: 600 },
      fat_100g: { low: 3, medium: 17.5, high: 20 },
      saturated_fat_100g: { low: 1.5, medium: 5, high: 6 },
      sugars_100g: { low: 5, medium: 22.5, high: 27 },
      salt_100g: { low: 0.3, medium: 1.5, high: 2 },
      sodium_100g: { low: 0.12, medium: 0.6, high: 0.8 },
      fiber_100g: { low: 3, medium: 6, high: 10 },
      proteins_100g: { low: 5, medium: 10, high: 20 }
    };

    const threshold = thresholds[key];
    if (!threshold) return { level: 'unknown', color: '#9CA3AF', label: 'Unknown' };

    // For beneficial nutrients (fiber, protein)
    if (key === 'fiber_100g' || key === 'proteins_100g') {
      if (val >= threshold.high) return { level: 'excellent', color: '#10B981', label: 'Excellent amount' };
      if (val >= threshold.medium) return { level: 'good', color: '#10B981', label: 'Good amount' };
      if (val >= threshold.low) return { level: 'moderate', color: '#F59E0B', label: 'Moderate amount' };
      return { level: 'low', color: '#EF4444', label: 'Low amount' };
    }

    // For nutrients to limit (calories, fat, sugar, salt)
    if (val >= threshold.high) return { level: 'high', color: '#EF4444', label: 'High impact' };
    if (val >= threshold.medium) return { level: 'moderate', color: '#F59E0B', label: 'Moderate impact' };
    return { level: 'low', color: '#10B981', label: 'Low impact' };
  };

  const formatNutrientValue = (key, value) => {
    if (!value) return 'N/A';
    
    // Convert per 100g to per serving (33g)
    const servingValue = (value * 33 / 100);
    
    if (key === 'energy_kcal_100g') return `${Math.round(servingValue)} Cal`;
    if (key === 'sodium_100g') return `${Math.round(servingValue * 1000)}mg`;
    return `${servingValue.toFixed(1)}g`;
  };

  const getNutrientIcon = (key) => {
    const icons = {
      energy_kcal_100g: 'flame',
      fat_100g: 'water',
      saturated_fat_100g: 'water',
      sugars_100g: 'cube',
      salt_100g: 'salt',
      sodium_100g: 'salt',
      fiber_100g: 'leaf',
      proteins_100g: 'fish'
    };
    return icons[key] || 'nutrition';
  };

  const PositiveIndicator = ({ icon, title, subtitle, value, quality }) => (
    <View style={styles.indicatorRow}>
      <View style={styles.indicatorIcon}>
        <Ionicons name={icon} size={24} color="#6B7280" />
      </View>
      <View style={styles.indicatorContent}>
        <Text style={styles.indicatorTitle}>{title}</Text>
        <Text style={styles.indicatorSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.indicatorValue}>
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>{value}</Text>
          <View style={[styles.qualityDot, { backgroundColor: quality.color }]} />
          <Ionicons name="checkmark" size={16} color="#10B981" />
        </View>
      </View>
    </View>
  );

  const NegativeIndicator = ({ icon, title, subtitle, value, quality }) => (
    <View style={styles.indicatorRow}>
      <View style={styles.indicatorIcon}>
        <Ionicons name={icon} size={24} color="#6B7280" />
      </View>
      <View style={styles.indicatorContent}>
        <Text style={styles.indicatorTitle}>{title}</Text>
        <Text style={styles.indicatorSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.indicatorValue}>
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>{value}</Text>
          <View style={[styles.qualityDot, { backgroundColor: quality.color }]} />
          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#008b8b" />
            <Text style={styles.loadingText}>Analyzing product...</Text>
            <Text style={styles.loadingSubtext}>Getting nutritional data and health insights</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={64} color="#EF4444" />
            <Text style={styles.errorTitle}>Product Not Found</Text>
            <Text style={styles.errorText}>
              We couldn't find information about this product in our database.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="scan" size={20} color="white" />
              <Text style={styles.retryButtonText}>Scan Another Product</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Categorize nutrients into positives and negatives
  const positiveNutrients = [
    { key: 'fiber_100g', title: 'Fiber', icon: 'leaf' },
    { key: 'proteins_100g', title: 'Protein', icon: 'fish' }
  ];

  const negativeNutrients = [
    { key: 'energy_kcal_100g', title: 'Calories', icon: 'flame' },
    { key: 'saturated_fat_100g', title: 'Saturated fat', icon: 'water' }
  ];

  // Check for additives
  const hasAdditives = product.ingredients_analysis?.additives?.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Product Header */}
        <View style={styles.productHeader}>
          {product.image_url && (
            <Image source={{ uri: product.image_url }} style={styles.productImage} />
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.product_name}</Text>
            <Text style={styles.brands}>{product.brands}</Text>
          </View>
          
          {/* Health Score */}
          <View style={styles.healthScoreContainer}>
            <View style={[styles.healthScoreCircle, { backgroundColor: getHealthScoreColor(product.health_score) }]}>
              <Text style={styles.healthScoreText}>{Math.round(product.health_score)}</Text>
              <Text style={styles.healthScoreMax}>/100</Text>
            </View>
            <Text style={[styles.healthScoreLabel, { color: getHealthScoreColor(product.health_score) }]}>
              {getHealthScoreLabel(product.health_score)}
            </Text>
          </View>
        </View>

        {/* Positives Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Positives</Text>
            <Text style={styles.servingInfo}>per serving (33g) •••</Text>
          </View>

          {/* No Additives */}
          <PositiveIndicator
            icon="hand-right"
            title="No additives"
            subtitle="No hazardous substances"
            value=""
            quality={{ color: '#10B981' }}
          />

          {/* Positive Nutrients */}
          {positiveNutrients.map(({ key, title, icon }) => {
            const value = product.nutriments[key];
            if (!value) return null;
            
            const quality = getNutrientQuality(key, value);
            const formattedValue = formatNutrientValue(key, value);
            
            return (
              <PositiveIndicator
                key={key}
                icon={icon}
                title={title}
                subtitle={quality.label}
                value={formattedValue}
                quality={quality}
              />
            );
          })}

          {/* Other positive nutrients dynamically */}
          {['sugars_100g', 'sodium_100g'].map(key => {
            const value = product.nutriments[key];
            if (!value) return null;
            
            const quality = getNutrientQuality(key, value);
            if (quality.level !== 'low') return null; // Only show if low (good)
            
            const title = key === 'sugars_100g' ? 'Sugar' : 'Sodium';
            const formattedValue = formatNutrientValue(key, value);
            
            return (
              <PositiveIndicator
                key={key}
                icon={getNutrientIcon(key)}
                title={title}
                subtitle={quality.label}
                value={formattedValue}
                quality={quality}
              />
            );
          })}
        </View>

        {/* Negatives Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Negatives</Text>
            <Text style={styles.servingInfo}>per serving (33g) •••</Text>
          </View>

          {negativeNutrients.map(({ key, title, icon }) => {
            const value = product.nutriments[key];
            if (!value) return null;
            
            const quality = getNutrientQuality(key, value);
            const formattedValue = formatNutrientValue(key, value);
            
            return (
              <NegativeIndicator
                key={key}
                icon={icon}
                title={title}
                subtitle={quality.level === 'high' ? 'Too high' : quality.level === 'moderate' ? 'Moderate' : quality.label}
                value={formattedValue}
                quality={quality}
              />
            );
          })}

          {/* Show bad nutrients dynamically */}
          {['sugars_100g', 'sodium_100g', 'fat_100g'].map(key => {
            const value = product.nutriments[key];
            if (!value) return null;
            
            const quality = getNutrientQuality(key, value);
            if (quality.level === 'low') return null; // Don't show if good
            
            const titles = {
              'sugars_100g': 'Sugar',
              'sodium_100g': 'Sodium',
              'fat_100g': 'Fat'
            };
            
            const formattedValue = formatNutrientValue(key, value);
            
            return (
              <NegativeIndicator
                key={key}
                icon={getNutrientIcon(key)}
                title={titles[key]}
                subtitle={quality.level === 'high' ? 'Too high' : 'Moderate impact'}
                value={formattedValue}
                quality={quality}
              />
            );
          })}

          {/* Show additives if present */}
          {hasAdditives && (
            <NegativeIndicator
              icon="warning"
              title="Contains additives"
              subtitle={`${product.ingredients_analysis.additives.length} potentially harmful substances`}
              value=""
              quality={{ color: '#EF4444' }}
            />
          )}
        </View>

        {/* Additives Detail (if any) */}
        {hasAdditives && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Additive Details</Text>
            </View>
            {product.ingredients_analysis.additives.map((additive, index) => (
              <View key={index} style={styles.additiveDetailCard}>
                <View style={styles.additiveDetailHeader}>
                  <Text style={styles.additiveDetailName}>{additive.name}</Text>
                  <View style={[styles.riskBadge, {
                    backgroundColor: additive.risk_level === 'high' ? '#EF4444' :
                                    additive.risk_level === 'medium' ? '#F59E0B' : '#10B981'
                  }]}>
                    <Text style={styles.riskText}>{additive.risk_level.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.additiveCode}>{additive.code}</Text>
                <Text style={styles.additiveEffects}>
                  Potential effects: {additive.effects.join(', ')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Ingredients */}
        {product.ingredients_text && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
            </View>
            <View style={styles.ingredientsCard}>
              <Text style={styles.ingredientsText}>{product.ingredients_text}</Text>
            </View>
          </View>
        )}

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

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
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
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 8,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
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
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Product Header
  productHeader: {
    backgroundColor: 'white',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  productImage: {
    width: 100,
    height: 140,
    borderRadius: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  productInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  brands: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Health Score
  healthScoreContainer: {
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    flexDirection: 'row',
  },
  healthScoreText: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
  },
  healthScoreMax: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
    marginLeft: 2,
  },
  healthScoreLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Sections
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  servingInfo: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // Indicator Rows
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  indicatorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  indicatorContent: {
    flex: 1,
  },
  indicatorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  indicatorSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  indicatorValue: {
    alignItems: 'flex-end',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  // Additive Details
  additiveDetailCard: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  additiveDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  additiveDetailName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'white',
  },
  additiveCode: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  additiveEffects: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Ingredients
  ingredientsCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  ingredientsText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 22,
  },

  bottomSpacer: {
    height: 40,
  },
});

export default ProductDetailScreen;
