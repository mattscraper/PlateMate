// EnhancedRealisticGroceryListModal.js - Optimized for the new backend
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
  Share,
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/auth';

const { width, height } = Dimensions.get('window');

const EnhancedRealisticGroceryListModal = ({
  visible,
  onClose,
  mealPlan,
  days,
  mealsPerDay,
  mealPlanId = null
}) => {
  const [groceryData, setGroceryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [updatingChecks, setUpdatingChecks] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showShoppingTips, setShowShoppingTips] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Generate realistic grocery list with new backend
  const generateGroceryList = useCallback(async () => {
    if (!mealPlan || !visible) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🛒 Generating realistic grocery list...');
      
      // Check for existing saved list first
      let existingList = null;
      if (mealPlanId) {
        try {
          existingList = await authService.getGroceryListByMealPlanId(mealPlanId);
          if (existingList && existingList.grocery_list) {
            console.log('📋 Found existing grocery list, restoring...');
            setGroceryData(transformSavedListData(existingList));
            setLoading(false);
            return;
          }
        } catch (authError) {
          console.warn('⚠️ Could not load existing list:', authError.message);
        }
      }

      // Generate new list with enhanced backend
      const requestData = {
        meal_plan: mealPlan,
        days: days || 7,
        meals_per_day: mealsPerDay || 3,
        meal_plan_id: mealPlanId
      };

      console.log('📤 Sending request to enhanced grocery API...');
      const response = await fetch('https://platemate-6.onrender.com/api/grocery-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate grocery list');
      }

      console.log('✅ Grocery list generated successfully');
      console.log(`📊 Found ${data.ingredients_processed || 0} ingredients in ${data.recipes_found || 0} recipes`);
      
      // Transform and store the data
      const transformedData = transformBackendData(data);
      setGroceryData(transformedData);

      // Save to database for future use
      if (mealPlanId && data.success) {
        try {
          const listToSave = {
            id: `grocery_${mealPlanId}_${Date.now()}`,
            meal_plan_id: mealPlanId,
            grocery_list: data.grocery_list,
            cost_breakdown: data.cost_breakdown,
            summary: data.summary,
            shopping_tips: data.shopping_tips,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          await authService.saveGroceryList(listToSave);
          console.log('💾 Grocery list saved successfully');
        } catch (saveError) {
          console.warn('⚠️ Could not save grocery list:', saveError.message);
        }
      }

      // Animate entrance
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

    } catch (error) {
      console.error('❌ Failed to generate grocery list:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [mealPlan, visible, mealPlanId, days, mealsPerDay, fadeAnim]);

  // Transform backend data to component format
  const transformBackendData = (data) => {
    // Group items by category
    const categorizedItems = {};
    
    if (data.grocery_list && Array.isArray(data.grocery_list)) {
      data.grocery_list.forEach(item => {
        const category = item.category || 'Other';
        if (!categorizedItems[category]) {
          categorizedItems[category] = [];
        }
        
        categorizedItems[category].push({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.estimated_cost || 0,
          notes: item.notes || '',
          checked: item.is_checked || false,
          originalItem: item
        });
      });
    }

    // Convert to categories array with proper ordering
    const categoryOrder = {
      'Meat & Proteins': 1,
      'Vegetables': 2,
      'Fruits': 3,
      'Dairy & Eggs': 4,
      'Grains & Bread': 5,
      'Pantry Staples': 6,
      'Herbs & Spices': 7,
      'Condiments': 8
    };

    const categories = Object.keys(categorizedItems)
      .map(categoryName => ({
        name: categoryName,
        items: categorizedItems[categoryName],
        icon: getCategoryIcon(categoryName)
      }))
      .sort((a, b) => (categoryOrder[a.name] || 99) - (categoryOrder[b.name] || 99));

    return {
      success: true,
      categories: categories,
      total_cost: data.cost_breakdown?.total_cost || 0,
      cost_breakdown: data.cost_breakdown,
      summary: data.summary,
      shopping_tips: data.shopping_tips || [],
      recipes_found: data.recipes_found || 0,
      ingredients_processed: data.ingredients_processed || 0
    };
  };

  // Transform saved list data
  const transformSavedListData = (savedData) => {
    if (savedData.categories) {
      return savedData; // Already in correct format
    }
    
    return transformBackendData(savedData);
  };

  // Get category icon
  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      'Meat & Proteins': '🥩',
      'Vegetables': '🥕',
      'Fruits': '🍎',
      'Dairy & Eggs': '🥛',
      'Grains & Bread': '🍞',
      'Pantry Staples': '🥫',
      'Herbs & Spices': '🌿',
      'Condiments': '🍯'
    };
    return iconMap[categoryName] || '📦';
  };

  // Toggle item check state with optimistic updates
  const toggleItemChecked = useCallback(async (categoryName, itemIndex) => {
    if (!groceryData || updatingChecks) return;

    setUpdatingChecks(true);
    
    try {
      // Find the category and item
      const categoryIndex = groceryData.categories.findIndex(cat => cat.name === categoryName);
      if (categoryIndex === -1 || !groceryData.categories[categoryIndex].items[itemIndex]) {
        return;
      }

      // Create updated data with optimistic update
      const updatedData = JSON.parse(JSON.stringify(groceryData)); // Deep clone
      const item = updatedData.categories[categoryIndex].items[itemIndex];
      item.checked = !item.checked;
      
      // Update original item if it exists
      if (item.originalItem) {
        item.originalItem.is_checked = item.checked;
        item.originalItem.checked_at = item.checked ? new Date().toISOString() : null;
      }
      
      // Apply optimistic update
      setGroceryData(updatedData);

      // Save to backend if we have a meal plan ID
      if (mealPlanId) {
        try {
          // Update the saved grocery list
          const existingList = await authService.getGroceryListByMealPlanId(mealPlanId);
          if (existingList) {
            const updatedList = {
              ...existingList,
              grocery_list: updatedData.categories.flatMap(cat =>
                cat.items.map(item => item.originalItem || {
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  category: cat.name,
                  estimated_cost: item.price,
                  is_checked: item.checked,
                  checked_at: item.checked ? new Date().toISOString() : null
                })
              ),
              updated_at: new Date().toISOString()
            };
            
            await authService.saveGroceryList(updatedList);
            console.log('✅ Item check state saved');
          }
        } catch (saveError) {
          console.warn('⚠️ Failed to save check state:', saveError);
          // Revert optimistic update on save failure
          const revertedData = JSON.parse(JSON.stringify(groceryData));
          revertedData.categories[categoryIndex].items[itemIndex].checked = !item.checked;
          setGroceryData(revertedData);
        }
      }
    } catch (error) {
      console.error('❌ Failed to toggle item:', error);
    } finally {
      setUpdatingChecks(false);
    }
  }, [groceryData, updatingChecks, mealPlanId]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!groceryData?.categories) return { total: 0, checked: 0, cost: 0 };

    let totalItems = 0;
    let checkedItems = 0;
    let totalCost = 0;

    groceryData.categories.forEach(category => {
      category.items.forEach(item => {
        totalItems++;
        if (item.checked) checkedItems++;
        totalCost += item.price || 0;
      });
    });

    return {
      total: totalItems,
      checked: checkedItems,
      cost: totalCost,
      progress: totalItems > 0 ? (checkedItems / totalItems) * 100 : 0
    };
  }, [groceryData]);

  // Get filtered items for display
  const filteredItems = useMemo(() => {
    if (!groceryData?.categories) return [];
    
    if (selectedCategory === 'all') {
      const allItems = [];
      groceryData.categories.forEach(category => {
        category.items.forEach(item => {
          allItems.push({
            ...item,
            categoryName: category.name,
            categoryIcon: category.icon
          });
        });
      });
      return allItems;
    }
    
    const category = groceryData.categories.find(cat =>
      cat.name.toLowerCase() === selectedCategory.toLowerCase()
    );
    
    return category ? category.items.map(item => ({
      ...item,
      categoryName: category.name,
      categoryIcon: category.icon
    })) : [];
  }, [groceryData, selectedCategory]);

  // Get available categories for filter
  const availableCategories = useMemo(() => {
    if (!groceryData?.categories) return ['all'];
    return ['all', ...groceryData.categories.map(cat => cat.name.toLowerCase())];
  }, [groceryData]);

  // Share grocery list
  const handleShare = useCallback(async () => {
    if (!groceryData) return;

    try {
      const shareText = `🛒 My Grocery List\n\n${groceryData.categories
        .map(category => 
          `${category.icon} ${category.name}:\n${category.items
            .map(item => `${item.checked ? '✅' : '⬜'} ${item.name}${item.quantity ? ` (${item.quantity}${item.unit ? ' ' + item.unit : ''})` : ''}`)
            .join('\n')}`
        )
        .join('\n\n')}\n\n💰 Total estimated cost: $${groceryData.total_cost?.toFixed(2) || '0.00'}\n\n📱 Generated with PlateMate`;

      await Share.share({
        message: shareText,
        title: 'My Grocery List'
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  }, [groceryData]);

  // Handle modal close with auto-save
  const handleClose = useCallback(async () => {
    if (groceryData && mealPlanId) {
      try {
        // Quick save before closing
        const existingList = await authService.getGroceryListByMealPlanId(mealPlanId);
        if (existingList) {
          const updatedList = {
            ...existingList,
            categories: groceryData.categories,
            last_accessed: new Date().toISOString()
          };
          await authService.saveGroceryList(updatedList);
        }
      } catch (error) {
        console.warn('Could not save on close:', error);
      }
    }
    onClose();
  }, [groceryData, mealPlanId, onClose]);

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      generateGroceryList();
    } else {
      // Reset animation when modal closes
      fadeAnim.setValue(0);
    }
  }, [visible, generateGroceryList]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        
        {/* Enhanced Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#2c3e50" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Smart Grocery List</Text>
            {summaryStats.total > 0 && (
              <Text style={styles.headerSubtitle}>
                {summaryStats.checked}/{summaryStats.total} items • ${summaryStats.cost.toFixed(2)}
              </Text>
            )}
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerActionButton, showCostBreakdown && styles.headerActionButtonActive]}
              onPress={() => setShowCostBreakdown(!showCostBreakdown)}
            >
              <Ionicons name="analytics" size={20} color={showCostBreakdown ? "#ffffff" : "#008b8b"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerActionButton, showShoppingTips && styles.headerActionButtonActive]}
              onPress={() => setShowShoppingTips(!showShoppingTips)}
            >
              <Ionicons name="bulb" size={20} color={showShoppingTips ? "#ffffff" : "#008b8b"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#008b8b" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#008b8b" />
            <Text style={styles.loadingText}>Creating your smart grocery list...</Text>
            <Text style={styles.loadingSubtext}>Analyzing ingredients and optimizing quantities</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#e74c3c" />
            <Text style={styles.errorTitle}>Unable to Generate List</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={generateGroceryList}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : groceryData ? (
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            {/* Enhanced Progress Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { width: `${summaryStats.progress}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(summaryStats.progress)}% Complete
                </Text>
                {groceryData.recipes_found > 0 && (
                  <Text style={styles.progressSubtext}>
                    {groceryData.recipes_found} recipes • {groceryData.ingredients_processed} ingredients processed
                  </Text>
                )}
              </View>
              
              <View style={styles.costSummary}>
                <Text style={styles.costValue}>${groceryData.total_cost?.toFixed(2) || '0.00'}</Text>
                <Text style={styles.costLabel}>Estimated Total</Text>
              </View>
            </View>

            {/* Cost Breakdown Panel */}
            {showCostBreakdown && (
              <View style={styles.expandablePanel}>
                <Text style={styles.panelTitle}>💰 Cost Analysis</Text>
                <View style={styles.costStats}>
                  <View style={styles.costStat}>
                    <Text style={styles.costStatValue}>
                      ${groceryData.cost_breakdown?.cost_per_day?.toFixed(2) || '0.00'}
                    </Text>
                    <Text style={styles.costStatLabel}>Per Day</Text>
                  </View>
                  <View style={styles.costStat}>
                    <Text style={styles.costStatValue}>
                      ${groceryData.cost_breakdown?.cost_per_meal?.toFixed(2) || '0.00'}
                    </Text>
                    <Text style={styles.costStatLabel}>Per Meal</Text>
                  </View>
                  <View style={styles.costStat}>
                    <Text style={styles.costStatValue}>{days || 7}</Text>
                    <Text style={styles.costStatLabel}>Days</Text>
                  </View>
                </View>
                
                {/* Category breakdown */}
                {groceryData.cost_breakdown?.category_breakdown && (
                  <View style={styles.categoryBreakdown}>
                    {Object.entries(groceryData.cost_breakdown.category_breakdown).map(([category, cost]) => (
                      <View key={category} style={styles.categoryBreakdownItem}>
                        <Text style={styles.categoryBreakdownName}>{getCategoryIcon(category)} {category}</Text>
                        <Text style={styles.categoryBreakdownCost}>${cost.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Shopping Tips Panel */}
            {showShoppingTips && groceryData.shopping_tips && (
              <View style={styles.expandablePanel}>
                <Text style={styles.panelTitle}>💡 Smart Shopping Tips</Text>
                {groceryData.shopping_tips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Category Filter Tabs */}
            {availableCategories.length > 1 && (
              <View style={styles.categoryTabsContainer}>
                <ScrollView
                  horizontal
                  style={styles.categoryTabs}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryTabsContent}
                >
                  {availableCategories.map((category) => {
                    const isActive = selectedCategory === category;
                    const categoryData = groceryData.categories.find(cat =>
                      cat.name.toLowerCase() === category
                    );
                    const categoryCount = category === 'all'
                      ? summaryStats.total
                      : categoryData?.items.length || 0;
                    
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryTab,
                          isActive && styles.categoryTabActive
                        ]}
                        onPress={() => setSelectedCategory(category)}
                      >
                        <Text style={[
                          styles.categoryTabText,
                          isActive && styles.categoryTabTextActive
                        ]}>
                          {categoryData?.icon || '📦'} {category === 'all' ? 'All' : categoryData?.name || category}
                        </Text>
                        <View style={[
                          styles.categoryTabBadge,
                          isActive && styles.categoryTabBadgeActive
                        ]}>
                          <Text style={[
                            styles.categoryTabBadgeText,
                            isActive && styles.categoryTabBadgeTextActive
                          ]}>
                            {categoryCount}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Grocery Items List */}
            <ScrollView style={styles.itemsScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.itemsList}>
                {filteredItems.map((item, index) => {
                  const categoryIndex = groceryData.categories.findIndex(cat =>
                    cat.name === item.categoryName
                  );
                  const itemIndex = groceryData.categories[categoryIndex]?.items.findIndex(i =>
                    i.name === item.name
                  );
                  
                  return (
                    <TouchableOpacity
                      key={`${item.categoryName}-${item.name}-${index}`}
                      style={[
                        styles.groceryItem,
                        item.checked && styles.groceryItemChecked
                      ]}
                      onPress={() => toggleItemChecked(item.categoryName, itemIndex)}
                      disabled={updatingChecks}
                      activeOpacity={0.7}
                    >
                      <View style={styles.itemLeft}>
                        <View style={[
                          styles.checkbox,
                          item.checked && styles.checkboxChecked
                        ]}>
                          {item.checked && (
                            <Ionicons name="checkmark" size={16} color="#ffffff" />
                          )}
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={[
                            styles.itemName,
                            item.checked && styles.itemNameChecked
                          ]}>
                            {item.name}
                          </Text>
                          <View style={styles.itemDetails}>
                            {item.quantity && (
                              <Text style={styles.itemAmount}>
                                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                              </Text>
                            )}
                            {selectedCategory === 'all' && (
                              <Text style={styles.itemCategory}>
                                {item.categoryIcon} {item.categoryName}
                              </Text>
                            )}
                            {item.notes && (
                              <Text style={styles.itemNotes} numberOfLines={1}>
                                {item.notes}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                      
                      <View style={styles.itemRight}>
                        {item.price > 0 && (
                          <Text style={[
                            styles.itemPrice,
                            item.checked && styles.itemPriceChecked
                          ]}>
                            ${item.price.toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
                
                {filteredItems.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="basket-outline" size={48} color="#94a3b8" />
                    <Text style={styles.emptyStateText}>No items in this category</Text>
                    <Text style={styles.emptyStateSubtext}>Try selecting a different category</Text>
                  </View>
                )}
              </View>
              
              {/* Footer Information */}
              {groceryData && (
                <View style={styles.footerInfo}>
                  <Text style={styles.footerText}>
                    💡 Generated from {groceryData.recipes_found} recipes
                  </Text>
                  <Text style={styles.footerSubtext}>
                    Estimates based on average store prices • Actual costs may vary
                  </Text>
                </View>
              )}
              
              <View style={styles.bottomPadding} />
            </ScrollView>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionButtonActive: {
    backgroundColor: '#008b8b',
  },

  content: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#1e293b',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#008b8b',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },

  progressSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  progressContainer: {
    flex: 1,
    marginRight: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#008b8b',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  progressSubtext: {
    fontSize: 12,
    color: '#64748b',
  },
  costSummary: {
    alignItems: 'flex-end',
  },
  costValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#008b8b',
  },
  costLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  expandablePanel: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  costStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  costStat: {
    alignItems: 'center',
  },
  costStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#008b8b',
    marginBottom: 4,
  },
  costStatLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },

  categoryBreakdown: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  categoryBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryBreakdownName: {
    fontSize: 14,
    color: '#64748b',
  },
  categoryBreakdownCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },

  tipItem: {
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },

  categoryTabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoryTabs: {
    paddingVertical: 12,
  },
  categoryTabsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryTabActive: {
    backgroundColor: '#008b8b',
    borderColor: '#008b8b',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    marginRight: 8,
  },
  categoryTabTextActive: {
    color: '#ffffff',
  },
  categoryTabBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  categoryTabBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryTabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryTabBadgeTextActive: {
    color: '#ffffff',
  },

  itemsScrollView: {
    flex: 1,
  },
  itemsList: {
    backgroundColor: '#ffffff',
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  groceryItemChecked: {
    backgroundColor: '#f8fafc',
  },
  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#008b8b',
    borderColor: '#008b8b',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    marginBottom: 4,
  },
  itemNameChecked: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemAmount: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 8,
  },
  itemCategory: {
    fontSize: 14,
    color: '#94a3b8',
    marginRight: 8,
  },
  itemNotes: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  itemPriceChecked: {
    color: '#9ca3af',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#cbd5e1',
    marginTop: 4,
  },

  footerInfo: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },

  bottomPadding: {
    height: 20,
  },
});

export default EnhancedRealisticGroceryListModal;
