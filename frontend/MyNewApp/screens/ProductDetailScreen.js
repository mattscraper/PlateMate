import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  LayoutAnimation,
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
  const [expandedSections, setExpandedSections] = useState({
    positives: true,
    negatives: false,
    additives: false,
    ingredients: false,
  });

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

  const toggleSection = (section) => {
    // Configure animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
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

  const getNutrientDisplayData = (key, value, servingSize) => {
    if (!value || value === 0) return null;
    
    // Define thresholds and colors based on nutrient type
    const nutrientConfig = {
      'proteins_100g': {
        title: 'Protein',
        icon: 'fish',
        unit: 'g',
        thresholds: [0, 2.5, 6, 12],
        colors: ['#EF4444', '#F59E0B', '#84CC16', '#10B981'],
        isPositive: true,
        maxScale: 15
      },
      'fiber_100g': {
        title: 'Fiber',
        icon: 'leaf',
        unit: 'g',
        thresholds: [0, 1.5, 3, 6],
        colors: ['#EF4444', '#F59E0B', '#84CC16', '#10B981'],
        isPositive: true,
        maxScale: 8
      },
      'sugars_100g': {
        title: 'Sugar',
        icon: 'cube',
        unit: 'g',
        thresholds: [0, 3, 6, 10],
        colors: ['#10B981', '#84CC16', '#F59E0B', '#EF4444'],
        isPositive: false,
        maxScale: 15
      },
      'sodium_100g': {
        title: 'Sodium',
        icon: 'water',
        unit: 'mg',
        thresholds: [0, 60, 120, 210],
        colors: ['#10B981', '#84CC16', '#F59E0B', '#EF4444'],
        isPositive: false,
        maxScale: 295
      },
      'energy_kcal_100g': {
        title: 'Calories',
        icon: 'flame',
        unit: 'Cal',
        thresholds: [0, 50, 120, 180],
        colors: ['#10B981', '#84CC16', '#F59E0B', '#EF4444'],
        isPositive: false,
        maxScale: 260
      },
      'saturated_fat_100g': {
        title: 'Saturated fat',
        icon: 'water',
        unit: 'g',
        thresholds: [0, 0.7, 1.3, 2.3],
        colors: ['#10B981', '#84CC16', '#F59E0B', '#EF4444'],
        isPositive: false,
        maxScale: 4
      }
    };

    const config = nutrientConfig[key];
    if (!config) return null;

    // Calculate per serving value
    let servingValue = (value * servingSize / 100);
    
    // Special handling for sodium (convert to mg)
    if (key === 'sodium_100g') {
      servingValue = servingValue * 1000;
    }

    // Determine color based on thresholds
    let colorIndex = 0;
    for (let i = 0; i < config.thresholds.length - 1; i++) {
      if (servingValue > config.thresholds[i + 1]) {
        colorIndex = i + 1;
      }
    }
    if (servingValue > config.thresholds[config.thresholds.length - 1]) {
      colorIndex = config.colors.length - 1;
    }

    const color = config.colors[colorIndex];
    const position = Math.min((servingValue / config.maxScale) * 100, 100);

    // Determine quality level
    let level, description;
    if (config.isPositive) {
      if (colorIndex <= 1) {
        level = 'low';
        description = colorIndex === 0 ? 'Very low amount' : 'Low amount';
      } else {
        level = 'high';
        description = colorIndex === 2 ? 'Good amount' : 'Excellent amount';
      }
    } else {
      if (colorIndex <= 1) {
        level = 'low';
        description = 'Low impact';
      } else {
        level = 'high';
        description = colorIndex === 2 ? 'Moderate impact' : colorIndex === 3 ? 'Too high' : 'Too fatty';
      }
    }

    return {
      title: config.title,
      icon: config.icon,
      value: servingValue,
      unit: config.unit,
      color,
      position,
      level,
      description,
      isPositive: config.isPositive,
      maxScale: config.maxScale,
      thresholds: config.thresholds,
      colors: config.colors
    };
  };

  const ProgressBar = ({ nutrientData }) => {
    if (!nutrientData || !nutrientData.thresholds || !nutrientData.colors || !Array.isArray(nutrientData.thresholds) || !Array.isArray(nutrientData.colors)) {
      return null;
    }

    const thresholds = nutrientData.thresholds || [];
    const colors = nutrientData.colors || [];
    const position = typeof nutrientData.position === 'number' ? nutrientData.position : 0;
    const maxScale = nutrientData.maxScale || 100;

    if (thresholds.length === 0 || colors.length === 0) {
      return null;
    }

    // Create segments for the progress bar
    const segments = [];
    const segmentWidth = 100 / thresholds.length;
    
    for (let i = 0; i < thresholds.length && i < colors.length; i++) {
      const segmentColor = colors[i] || '#9CA3AF';
      segments.push(
        <View
          key={i}
          style={[
            styles.progressSegment,
            {
              backgroundColor: segmentColor,
              width: `${segmentWidth}%`,
            }
          ]}
        />
      );
    }

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          {segments}
        </View>
        <View
          style={[
            styles.progressIndicator,
            {
              left: `${Math.min(Math.max(position, 0), 95)}%`,
              backgroundColor: nutrientData.color
            }
          ]}
        />
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>0</Text>
          {thresholds.slice(1, -1).map((threshold, index) => (
            <Text key={index} style={styles.progressLabel}>
              {threshold || ''}
            </Text>
          ))}
          <Text style={styles.progressLabel}>{maxScale}+</Text>
        </View>
      </View>
    );
  };

  const NutrientIndicatorWithProgress = ({ nutrientKey, servingSize }) => {
    if (!product?.nutriments?.[nutrientKey]) return null;
    
    const nutrientData = getNutrientDisplayData(nutrientKey, product.nutriments[nutrientKey], servingSize);
    if (!nutrientData) return null;

    const formattedValue = nutrientData.unit === 'Cal' ?
      Math.round(nutrientData.value) :
      nutrientData.value.toFixed(1);

    return (
      <View style={styles.nutrientItem}>
        <View style={styles.indicatorRow}>
          <View style={styles.indicatorIcon}>
            <Ionicons name={nutrientData.icon} size={24} color="#6B7280" />
          </View>
          <View style={styles.indicatorContent}>
            <Text style={styles.indicatorTitle}>{nutrientData.title}</Text>
            <Text style={styles.indicatorSubtitle}>{nutrientData.description}</Text>
          </View>
          <View style={styles.indicatorValue}>
            <View style={styles.valueContainer}>
              <Text style={styles.valueText}>
                {formattedValue}{nutrientData.unit}
              </Text>
              <View style={[styles.qualityDot, { backgroundColor: nutrientData.color }]} />
              <Ionicons
                name={nutrientData.isPositive && nutrientData.level === 'high' ? "chevron-up" :
                      !nutrientData.isPositive && nutrientData.level === 'low' ? "chevron-up" : "chevron-down"}
                size={16}
                color={nutrientData.isPositive && nutrientData.level === 'high' ? "#10B981" :
                       !nutrientData.isPositive && nutrientData.level === 'low' ? "#10B981" : "#9CA3AF"}
              />
            </View>
          </View>
        </View>
        <ProgressBar nutrientData={nutrientData} />
      </View>
    );
  };

  const SimpleIndicator = ({ icon, title, subtitle, value, quality, isPositive = true }) => (
    <View style={styles.nutrientItem}>
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
            {value && <Text style={styles.valueText}>{value}</Text>}
            <View style={[styles.qualityDot, { backgroundColor: quality.color }]} />
            <Ionicons
              name={isPositive ? "checkmark" : "chevron-down"}
              size={16}
              color={isPositive ? "#10B981" : "#9CA3AF"}
            />
          </View>
        </View>
      </View>
    </View>
  );

  const CollapsibleSection = ({ title, subtitle, icon, isExpanded, onToggle, children, count }) => (
    <View style={styles.collapsibleSection}>
      <TouchableOpacity
        style={[styles.sectionHeader, isExpanded && styles.sectionHeaderExpanded]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: getIconBackgroundColor(title) }]}>
            <Ionicons name={icon} size={20} color={getIconColor(title)} />
          </View>
          <View style={styles.sectionTitleContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{title}</Text>
              {count !== undefined && (
                <View style={[styles.countBadge, { backgroundColor: getCountBadgeColor(title) }]}>
                  <Text style={styles.countText}>{count}</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color="#6B7280"
          style={styles.chevronIcon}
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );

  const getIconBackgroundColor = (title) => {
    switch (title) {
      case 'Positives': return '#ECFDF5';
      case 'Negatives': return '#FEF2F2';
      case 'Additive Details': return '#FFF7ED';
      case 'Ingredients': return '#F0F9FF';
      default: return '#F9FAFB';
    }
  };

  const getIconColor = (title) => {
    switch (title) {
      case 'Positives': return '#10B981';
      case 'Negatives': return '#EF4444';
      case 'Additive Details': return '#F59E0B';
      case 'Ingredients': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getCountBadgeColor = (title) => {
    switch (title) {
      case 'Positives': return '#10B981';
      case 'Negatives': return '#EF4444';
      case 'Additive Details': return '#F59E0B';
      default: return '#6B7280';
    }
  };

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

  // Get serving size from backend
  const servingSize = product.serving_size || 33;

  // Check for additives
  const hasAdditives = product.ingredients_analysis?.additives?.length > 0;

  // Determine which nutrients to show in which sections
  const nutrients = product.nutriments || {};
  
  // Check sugar and sodium levels to determine section placement
  const sugarData = getNutrientDisplayData('sugars_100g', nutrients.sugars_100g, servingSize);
  const sodiumData = getNutrientDisplayData('sodium_100g', nutrients.sodium_100g, servingSize);
  
  const showSugarInPositives = sugarData && sugarData.level === 'low';
  const showSodiumInPositives = sodiumData && sodiumData.level === 'low';

  // Count items in each section
  const positivesCount = (!hasAdditives ? 1 : 0) +
                        (nutrients.proteins_100g ? 1 : 0) +
                        (nutrients.fiber_100g ? 1 : 0) +
                        (showSugarInPositives ? 1 : 0) +
                        (showSodiumInPositives ? 1 : 0);

  const negativesCount = (nutrients.energy_kcal_100g ? 1 : 0) +
                        (nutrients.saturated_fat_100g ? 1 : 0) +
                        (!showSugarInPositives && nutrients.sugars_100g ? 1 : 0) +
                        (!showSodiumInPositives && nutrients.sodium_100g ? 1 : 0) +
                        (nutrients.fat_100g && nutrients.fat_100g > 3 ? 1 : 0) +
                        (hasAdditives ? 1 : 0);

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
        <CollapsibleSection
          title="Positives"
          subtitle={`per serving (${servingSize}g)`}
          icon="checkmark-circle"
          isExpanded={expandedSections.positives}
          onToggle={() => toggleSection('positives')}
          count={positivesCount}
        >
          {/* No Additives Indicator */}
          {!hasAdditives && (
            <SimpleIndicator
              icon="hand-right"
              title="No additives"
              subtitle="No hazardous substances"
              value=""
              quality={{ color: '#10B981' }}
              isPositive={true}
            />
          )}

          {/* Protein */}
          <NutrientIndicatorWithProgress nutrientKey="proteins_100g" servingSize={servingSize} />

          {/* Fiber */}
          <NutrientIndicatorWithProgress nutrientKey="fiber_100g" servingSize={servingSize} />

          {/* Sugar (if low) */}
          {showSugarInPositives && (
            <NutrientIndicatorWithProgress nutrientKey="sugars_100g" servingSize={servingSize} />
          )}

          {/* Sodium (if low) */}
          {showSodiumInPositives && (
            <NutrientIndicatorWithProgress nutrientKey="sodium_100g" servingSize={servingSize} />
          )}
        </CollapsibleSection>

        {/* Negatives Section */}
        <CollapsibleSection
          title="Negatives"
          subtitle={`per serving (${servingSize}g)`}
          icon="close-circle"
          isExpanded={expandedSections.negatives}
          onToggle={() => toggleSection('negatives')}
          count={negativesCount}
        >
          {/* Calories */}
          <NutrientIndicatorWithProgress nutrientKey="energy_kcal_100g" servingSize={servingSize} />

          {/* Saturated Fat */}
          <NutrientIndicatorWithProgress nutrientKey="saturated_fat_100g" servingSize={servingSize} />

          {/* Sugar (if not low) */}
          {!showSugarInPositives && nutrients.sugars_100g && (
            <NutrientIndicatorWithProgress nutrientKey="sugars_100g" servingSize={servingSize} />
          )}

          {/* Sodium (if not low) */}
          {!showSodiumInPositives && nutrients.sodium_100g && (
            <NutrientIndicatorWithProgress nutrientKey="sodium_100g" servingSize={servingSize} />
          )}

          {/* Total Fat (if significant) */}
          {nutrients.fat_100g && nutrients.fat_100g > 3 && (
            <NutrientIndicatorWithProgress nutrientKey="fat_100g" servingSize={servingSize} />
          )}

          {/* Show additives if present */}
          {hasAdditives && (
            <SimpleIndicator
              icon="warning"
              title="Contains additives"
              subtitle={`${product.ingredients_analysis.additives.length} potentially harmful substances`}
              value=""
              quality={{ color: '#EF4444' }}
              isPositive={false}
            />
          )}
        </CollapsibleSection>

        {/* Additives Detail (if any) */}
        {hasAdditives && (
          <CollapsibleSection
            title="Additive Details"
            subtitle="Potentially harmful substances"
            icon="warning"
            isExpanded={expandedSections.additives}
            onToggle={() => toggleSection('additives')}
            count={product.ingredients_analysis.additives.length}
          >
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
          </CollapsibleSection>
        )}

        {/* Ingredients */}
        {product.ingredients_text && (
          <CollapsibleSection
            title="Ingredients"
            subtitle="Complete ingredient list"
            icon="list"
            isExpanded={expandedSections.ingredients}
            onToggle={() => toggleSection('ingredients')}
          >
            <View style={styles.ingredientsCard}>
              <Text style={styles.ingredientsText}>{product.ingredients_text}</Text>
            </View>
          </CollapsibleSection>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  healthScoreText: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  healthScoreMax: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
    marginLeft: 2,
  },
  healthScoreLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Collapsible Sections
  collapsibleSection: {
    backgroundColor: 'white',
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionHeaderExpanded: {
    borderBottomColor: '#E5E7EB',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  chevronIcon: {
    marginLeft: 12,
  },
  sectionContent: {
    backgroundColor: '#FAFBFC',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // Nutrient Items
  nutrientItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  // Indicator Rows
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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

  // Progress Bar Styles
  progressContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressSegment: {
    height: '100%',
  },
  progressIndicator: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
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
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
