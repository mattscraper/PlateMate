import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
  Animated,
  Keyboard,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

const API_BASE_URL = 'https://platemate-6.onrender.com/api/food-scanner';

const ProductSearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchStats, setSearchStats] = useState(null);
  const searchInputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        headerTitle: 'Search Products',
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: '#2c3e50',
        },
        headerBackTitleVisible: false,
      });
    }, [navigation])
  );

  useEffect(() => {
    // Auto-focus search input when screen loads
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const searchProducts = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setHasSearched(true);
      
      // Don't dismiss keyboard immediately to prevent visual glitch
      const response = await fetch(`${API_BASE_URL}/search/${encodeURIComponent(query.trim())}`);
      const data = await response.json();
      
      setResults(data.products || []);
      setSearchStats({
        total: data.products?.length || 0,
        query: query.trim(),
        searchQuality: data.search_quality || 'standard'
      });

      // Dismiss keyboard after setting results
      Keyboard.dismiss();

      // Animate results appearance
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setSearchStats({ total: 0, query: query.trim(), error: true });
      Keyboard.dismiss();
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSearchStats(null);
    fadeAnim.setValue(0);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const getNutriScoreColor = (grade) => {
    const colors = {
      'A': '#10B981',
      'B': '#10B981',
      'C': '#F59E0B',
      'D': '#EF4444',
      'E': '#DC2626'
    };
    return colors[grade] || '#9CA3AF';
  };

  const getHealthScoreColor = (score) => {
    if (score >= 80) return '#10B981';
    if (score >= 65) return '#10B981';
    if (score >= 45) return '#F59E0B';
    return '#EF4444';
  };

  const getHealthScoreLabel = (score) => {
    if (score >= 80) return 'Excellent';
    if (score >= 65) return 'Good';
    if (score >= 45) return 'Fair';
    return 'Poor';
  };

  // Memoized render functions to prevent unnecessary re-renders
  const renderProduct = useCallback(({ item, index }) => (
    <Animated.View
      style={[
        styles.productItemContainer,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        }
      ]}
    >
      <TouchableOpacity
        style={styles.productItem}
        onPress={() => navigation.navigate('ProductDetail', { barcode: item.barcode })}
        activeOpacity={0.7}
      >
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.productImage}
              onError={() => {
                console.log('Image failed to load for:', item.product_name);
              }}
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="cube-outline" size={24} color="#7f8c8d" />
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.product_name}
          </Text>
          
          {item.brands && (
            <Text style={styles.productBrands} numberOfLines={1}>
              {item.brands}
            </Text>
          )}

          {/* Health and Nutri Score Row */}
          <View style={styles.scoreRow}>
            {/* Health Score */}
            {item.quick_health_score !== undefined && (
              <View style={styles.healthScoreContainer}>
                <View style={[
                  styles.healthScoreBadge,
                  { backgroundColor: getHealthScoreColor(item.quick_health_score) }
                ]}>
                  <Text style={styles.healthScoreText}>
                    {item.quick_health_score}
                  </Text>
                </View>
                <Text style={styles.healthScoreLabel}>
                  {getHealthScoreLabel(item.quick_health_score)}
                </Text>
              </View>
            )}

            {/* Nutri-Score */}
            {item.nutriscore_grade && (
              <View style={styles.nutriScoreContainer}>
                <View style={[
                  styles.nutriBadge,
                  { backgroundColor: getNutriScoreColor(item.nutriscore_grade) }
                ]}>
                  <Text style={styles.nutriBadgeText}>
                    {item.nutriscore_grade}
                  </Text>
                </View>
                <Text style={styles.nutriScoreLabel}>Nutri-Score</Text>
              </View>
            )}
          </View>

          {/* Serving Size */}
          {item.serving_size && (
            <View style={styles.servingContainer}>
              <Ionicons name="restaurant-outline" size={12} color="#7f8c8d" />
              <Text style={styles.servingText}>
                {item.serving_size}g per serving
              </Text>
              {item.serving_confidence && (
                <View style={[
                  styles.confidenceDot,
                  { backgroundColor: item.serving_confidence === 'high' ? '#10B981' :
                                   item.serving_confidence === 'medium' ? '#F59E0B' : '#EF4444' }
                ]} />
              )}
            </View>
          )}
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color="#008b8b" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  ), [fadeAnim, navigation]);

  const renderEmptyState = () => {
    if (loading) return null;
    
    if (!hasSearched) {
      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="search-outline" size={48} color="#7f8c8d" />
          </View>
          <Text style={styles.emptyStateTitle}>Discover Products</Text>
          <Text style={styles.emptyStateSubtitle}>
            Search for any food product to get detailed nutritional analysis and health insights
          </Text>
          <View style={styles.searchTips}>
            <Text style={styles.tipsTitle}>Search Examples:</Text>
            <View style={styles.tipItem}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>Brand names: "Coca Cola", "Oreo"</Text>
            </View>
            <View style={styles.tipItem}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>Product types: "Greek yogurt", "Energy drink"</Text>
            </View>
            <View style={styles.tipItem}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>Specific items: "Ben & Jerry's vanilla"</Text>
            </View>
          </View>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Ionicons name="search-outline" size={48} color="#7f8c8d" />
          </View>
          <Text style={styles.emptyStateTitle}>No Products Found</Text>
          <Text style={styles.emptyStateSubtitle}>
            We couldn't find any products matching "{searchStats?.query}"
          </Text>
          <TouchableOpacity style={styles.tryAgainButton} onPress={clearSearch}>
            <Ionicons name="refresh-outline" size={16} color="white" style={styles.buttonIcon} />
            <Text style={styles.tryAgainText}>Try Different Keywords</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {/* Fixed Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchBarContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#7f8c8d" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#bdc3c7"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={searchProducts}
              returnKeyType="search"
              autoCapitalize="words"
              autoCorrect={false}
              blurOnSubmit={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#7f8c8d" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchButton, !query.trim() && styles.searchButtonDisabled]}
            onPress={searchProducts}
            disabled={!query.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="search" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Stats */}
        {searchStats && !loading && (
          <View style={styles.searchStatsContainer}>
            <View style={styles.statsRow}>
              <Text style={styles.searchStatsText}>
                {searchStats.total > 0
                  ? `${searchStats.total} product${searchStats.total !== 1 ? 's' : ''} found`
                  : 'No products found'
                }
              </Text>
              {searchStats.searchQuality === 'intelligent_filtered' && (
                <View style={styles.qualityBadgeContainer}>
                  <Ionicons name="sparkles" size={12} color="#008b8b" />
                  <Text style={styles.qualityBadge}>AI Filtered</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Results List */}
      <FlatList
        data={results}
        renderItem={renderProduct}
        keyExtractor={(item) => item.barcode}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          results.length === 0 && styles.emptyListContainer
        ]}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
        getItemLayout={(data, index) => ({
          length: 120, // Approximate item height
          offset: 120 * index,
          index,
        })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Fixed Search Header
  searchHeader: {
    backgroundColor: '#f8f9fa',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  searchBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },

  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  searchIcon: {
    marginRight: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '400',
  },

  clearButton: {
    padding: 4,
    marginLeft: 8,
  },

  searchButton: {
    backgroundColor: '#008b8b',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  searchButtonDisabled: {
    backgroundColor: '#bdc3c7',
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },

  searchStatsContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  searchStatsText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  qualityBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fffe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },

  qualityBadge: {
    fontSize: 12,
    color: '#008b8b',
    fontWeight: '600',
  },

  // List Container
  listContainer: {
    paddingTop: 8,
    paddingBottom: 20,
  },

  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Product Items
  productItemContainer: {
    marginHorizontal: 20,
    marginVertical: 6,
  },

  productItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f3f4',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  imageContainer: {
    marginRight: 16,
  },

  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },

  placeholderImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },

  productInfo: {
    flex: 1,
    marginRight: 12,
  },

  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
    lineHeight: 20,
  },

  productBrands: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
    fontWeight: '500',
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 16,
  },

  healthScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  healthScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 32,
    alignItems: 'center',
  },

  healthScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },

  healthScoreLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  nutriScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  nutriBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 24,
    alignItems: 'center',
  },

  nutriBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },

  nutriScoreLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  servingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  servingText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },

  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  arrowContainer: {
    padding: 4,
  },

  // Empty States
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },

  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },

  emptyStateSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },

  searchTips: {
    alignSelf: 'stretch',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e9ecef',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },

  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  tipBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#008b8b',
    marginRight: 12,
  },

  tipText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
    flex: 1,
  },

  tryAgainButton: {
    backgroundColor: '#008b8b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#008b8b',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  buttonIcon: {
    marginRight: 4,
  },

  tryAgainText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default ProductSearchScreen;
