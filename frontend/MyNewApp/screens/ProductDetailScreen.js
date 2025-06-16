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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = 'https://platemate-6.onrender.com/api/food-scanner'; // Replace with your server IP

const ProductDetailScreen = ({ route, navigation }) => {
  const { barcode } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getNutriScoreColor = (grade) => {
    const colors = {
      'A': '#4CAF50',
      'B': '#8BC34A',
      'C': '#FFEB3B',
      'D': '#FF9800',
      'E': '#F44336'
    };
    return colors[grade] || '#999';
  };

  const getRiskColor = (risk) => {
    const colors = {
      low: '#4CAF50',
      medium: '#FF9800',
      high: '#F44336'
    };
    return colors[risk] || '#999';
  };

  const formatNutrientLabel = (key) => {
    const labels = {
      energy_kcal_100g: 'Energy (kcal)',
      fat_100g: 'Fat',
      saturated_fat_100g: 'Saturated Fat',
      carbohydrates_100g: 'Carbohydrates',
      sugars_100g: 'Sugars',
      fiber_100g: 'Fiber',
      proteins_100g: 'Proteins',
      salt_100g: 'Salt',
      sodium_100g: 'Sodium'
    };
    return labels[key] || key.replace(/_100g$/, '').replace(/_/g, ' ');
  };

  const getNutrientUnit = (key) => {
    if (key === 'energy_kcal_100g') return ' kcal';
    if (key === 'sodium_100g') return ' mg';
    return ' g';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing product...</Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={50} color="#F44336" />
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retryButtonText}>Scan Another Product</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        {product.image_url && (
          <Image source={{ uri: product.image_url }} style={styles.productImage} />
        )}
        <Text style={styles.productName}>{product.product_name}</Text>
        <Text style={styles.brands}>{product.brands}</Text>
      </View>

      <View style={styles.scoresContainer}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Health Score</Text>
          <View style={[styles.scoreCircle, { backgroundColor: getHealthScoreColor(product.health_score) }]}>
            <Text style={styles.scoreText}>{Math.round(product.health_score)}</Text>
          </View>
        </View>

        {product.nutri_score.grade && (
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Nutri-Score</Text>
            <View style={[styles.nutriScoreCircle, { backgroundColor: getNutriScoreColor(product.nutri_score.grade) }]}>
              <Text style={styles.nutriScoreText}>{product.nutri_score.grade}</Text>
            </View>
          </View>
        )}
      </View>

      {product.ingredients_analysis.additives.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Additives Found</Text>
          {product.ingredients_analysis.additives.map((additive, index) => (
            <View key={index} style={styles.additiveItem}>
              <View style={styles.additiveHeader}>
                <Text style={styles.additiveName}>{additive.name}</Text>
                <View style={[styles.riskBadge, { backgroundColor: getRiskColor(additive.risk_level) }]}>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔬 Nutritional Information (per 100g)</Text>
        <View style={styles.nutritionGrid}>
          {Object.entries(product.nutriments).map(([key, value]) => {
            if (value !== null && value !== undefined) {
              const label = formatNutrientLabel(key);
              return (
                <View key={key} style={styles.nutritionItem}>
                  <Text style={styles.nutritionLabel}>{label}</Text>
                  <Text style={styles.nutritionValue}>
                    {typeof value === 'number' ? value.toFixed(1) : value}
                    {getNutrientUnit(key)}
                  </Text>
                </View>
              );
            }
            return null;
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Health Recommendations</Text>
        {product.recommendations.map((recommendation, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.recommendationText}>{recommendation}</Text>
          </View>
        ))}
      </View>

      {product.ingredients_text && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Ingredients</Text>
          <Text style={styles.ingredientsText}>{product.ingredients_text}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    marginVertical: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  productImage: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 15,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  brands: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scoresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  scoreCard: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  nutriScoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nutriScoreText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  additiveItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
    paddingLeft: 15,
    marginBottom: 15,
  },
  additiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  additiveName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  additiveCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  additiveEffects: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    width: '48%',
    marginBottom: 10,
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#666',
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  recommendationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  ingredientsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ProductDetailScreen;
