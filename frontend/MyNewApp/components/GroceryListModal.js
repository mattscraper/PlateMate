import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const GroceryListModal = ({
  visible,
  onClose,
  mealPlan,
  days,
  mealsPerDay,
  caloriesPerDay
}) => {
  const [groceryData, setGroceryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState(new Set());

  const categoryIcons = {
    proteins: 'fish-outline',
    vegetables: 'leaf-outline',
    fruits: 'nutrition-outline',
    dairy: 'wine-outline',
    grains: 'storefront-outline',
    pantry: 'home-outline',
    herbs_spices: 'flower-outline',
    condiments: 'water-outline',
    frozen: 'snow-outline',
    snacks: 'cafe-outline',
    beverages: 'glass-outline',
  };

  const categoryColors = {
    proteins: '#e74c3c',
    vegetables: '#2ecc71',
    fruits: '#f39c12',
    dairy: '#3498db',
    grains: '#e67e22',
    pantry: '#95a5a6',
    herbs_spices: '#9b59b6',
    condiments: '#1abc9c',
    frozen: '#74b9ff',
    snacks: '#fdcb6e',
    beverages: '#00b894',
  };

  const categoryNames = {
    proteins: 'Meat, Fish & Proteins',
    vegetables: 'Fresh Vegetables',
    fruits: 'Fresh Fruits',
    dairy: 'Dairy & Eggs',
    grains: 'Grains & Breads',
    pantry: 'Pantry Staples',
    herbs_spices: 'Herbs & Spices',
    condiments: 'Condiments & Sauces',
    frozen: 'Frozen Foods',
    snacks: 'Snacks & Nuts',
    beverages: 'Beverages',
  };

  const generateGroceryList = async () => {
    if (!mealPlan) {
      Alert.alert('Error', 'No meal plan data available');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://platemate-6.onrender.com/api/grocery-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meal_plan: mealPlan,
          days: days,
          meals_per_day: mealsPerDay,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGroceryData(data);
        setCheckedItems(new Set()); // Reset checked items
      } else {
        Alert.alert('Error', data.error || 'Failed to generate grocery list');
      }
    } catch (error) {
      console.error('Error generating grocery list:', error);
      Alert.alert('Error', 'Failed to generate grocery list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate grocery list when modal opens
  React.useEffect(() => {
    if (visible && !groceryData && !loading) {
      generateGroceryList();
    }
  }, [visible]);

  const toggleItemCheck = (itemName) => {
    const newCheckedItems = new Set(checkedItems);
    if (newCheckedItems.has(itemName)) {
      newCheckedItems.delete(itemName);
    } else {
      newCheckedItems.add(itemName);
    }
    setCheckedItems(newCheckedItems);
  };

  const shareGroceryList = async () => {
    if (!groceryData) return;

    try {
      let shareText = `🛒 Grocery List for ${days}-Day Meal Plan\n\n`;
      shareText += `💰 Total Estimated Cost: $${groceryData.cost_breakdown.total_cost}\n`;
      shareText += `📅 Cost per day: $${groceryData.cost_breakdown.cost_per_day}\n`;
      shareText += `🍽️ Cost per meal: $${groceryData.cost_breakdown.cost_per_meal}\n\n`;

      // Group items by category
      const itemsByCategory = {};
      groceryData.grocery_list.forEach(item => {
        if (!itemsByCategory[item.category]) {
          itemsByCategory[item.category] = [];
        }
        itemsByCategory[item.category].push(item);
      });

      // Add items by category
      Object.entries(itemsByCategory).forEach(([category, items]) => {
        shareText += `${categoryNames[category] || category.toUpperCase()}:\n`;
        items.forEach(item => {
          shareText += `• ${item.quantity} ${item.unit} ${item.name}\n`;
        });
        shareText += '\n';
      });

      await Share.share({ message: shareText });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const renderCostBreakdown = () => {
    if (!groceryData?.cost_breakdown) return null;

    const { cost_breakdown } = groceryData;
    
    return (
      <View style={styles.costSection}>
        <Text style={styles.sectionTitle}>💰 Cost Breakdown</Text>
        
        <View style={styles.costCards}>
          <View style={styles.costCard}>
            <View style={styles.costCardHeader}>
              <Ionicons name="cash-outline" size={24} color="#2ecc71" />
              <Text style={styles.costCardTitle}>Total Cost</Text>
            </View>
            <Text style={styles.costCardValue}>${cost_breakdown.total_cost}</Text>
            <Text style={styles.costCardSubtext}>{cost_breakdown.item_count} items</Text>
          </View>

          <View style={styles.costCard}>
            <View style={styles.costCardHeader}>
              <Ionicons name="calendar-outline" size={24} color="#3498db" />
              <Text style={styles.costCardTitle}>Per Day</Text>
            </View>
            <Text style={styles.costCardValue}>${cost_breakdown.cost_per_day}</Text>
            <Text style={styles.costCardSubtext}>{days} days</Text>
          </View>

          <View style={styles.costCard}>
            <View style={styles.costCardHeader}>
              <Ionicons name="restaurant-outline" size={24} color="#e74c3c" />
              <Text style={styles.costCardTitle}>Per Meal</Text>
            </View>
            <Text style={styles.costCardValue}>${cost_breakdown.cost_per_meal}</Text>
            <Text style={styles.costCardSubtext}>{days * mealsPerDay} meals</Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <View style={styles.categoryBreakdown}>
          <Text style={styles.categoryBreakdownTitle}>Spending by Category</Text>
          {Object.entries(cost_breakdown.category_breakdown)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([category, cost]) => (
              <View key={category} style={styles.categoryBreakdownItem}>
                <View style={styles.categoryBreakdownLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: categoryColors[category] || '#95a5a6' }]} />
                  <Text style={styles.categoryBreakdownName}>
                    {categoryNames[category] || category}
                  </Text>
                </View>
                <Text style={styles.categoryBreakdownCost}>${cost.toFixed(2)}</Text>
              </View>
            ))}
        </View>
      </View>
    );
  };

  const renderGroceryList = () => {
    if (!groceryData?.grocery_list) return null;

    // Group items by category
    const itemsByCategory = {};
    groceryData.grocery_list.forEach(item => {
      if (!itemsByCategory[item.category]) {
        itemsByCategory[item.category] = [];
      }
      itemsByCategory[item.category].push(item);
    });

    // Sort categories by total cost (highest first)
    const sortedCategories = Object.keys(itemsByCategory).sort((a, b) => {
      const costA = itemsByCategory[a].reduce((sum, item) => sum + item.estimated_cost, 0);
      const costB = itemsByCategory[b].reduce((sum, item) => sum + item.estimated_cost, 0);
      return costB - costA;
    });

    return (
      <View style={styles.grocerySection}>
        <View style={styles.grocerySectionHeader}>
          <Text style={styles.sectionTitle}>🛒 Shopping List</Text>
          <View style={styles.progressIndicator}>
            <Text style={styles.progressText}>
              {checkedItems.size}/{groceryData.grocery_list.length}
            </Text>
          </View>
        </View>

        {sortedCategories.map(category => {
          const items = itemsByCategory[category];
          const categoryTotal = items.reduce((sum, item) => sum + item.estimated_cost, 0);
          const checkedInCategory = items.filter(item => checkedItems.has(item.name)).length;

          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryHeaderLeft}>
                  <View style={[styles.categoryIcon, { backgroundColor: categoryColors[category] || '#95a5a6' }]}>
                    <Ionicons
                      name={categoryIcons[category] || 'cube-outline'}
                      size={20}
                      color="white"
                    />
                  </View>
                  <View>
                    <Text style={styles.categoryTitle}>
                      {categoryNames[category] || category}
                    </Text>
                    <Text style={styles.categorySubtitle}>
                      {items.length} items • ${categoryTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
                {checkedInCategory > 0 && (
                  <View style={styles.categoryProgress}>
                    <Text style={styles.categoryProgressText}>
                      {checkedInCategory}/{items.length}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.categoryItems}>
                {items.map((item, index) => {
                  const isChecked = checkedItems.has(item.name);
                  return (
                    <TouchableOpacity
                      key={`${item.name}-${index}`}
                      style={[styles.groceryItem, isChecked && styles.groceryItemChecked]}
                      onPress={() => toggleItemCheck(item.name)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.groceryItemLeft}>
                        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                          {isChecked && (
                            <Ionicons name="checkmark" size={16} color="white" />
                          )}
                        </View>
                        <View style={styles.groceryItemInfo}>
                          <Text style={[styles.groceryItemName, isChecked && styles.groceryItemNameChecked]}>
                            {item.name}
                          </Text>
                          <Text style={styles.groceryItemQuantity}>
                            {item.quantity} {item.unit}
                          </Text>
                          {item.notes && (
                            <Text style={styles.groceryItemNotes}>{item.notes}</Text>
                          )}
                        </View>
                      </View>
                      <Text style={[styles.groceryItemCost, isChecked && styles.groceryItemCostChecked]}>
                        ${item.estimated_cost.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#008b8b" />
      <Text style={styles.loadingTitle}>Creating Your Grocery List</Text>
      <Text style={styles.loadingSubtitle}>
        Analyzing ingredients • Calculating costs • Organizing by category
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="basket-outline" size={80} color="#ddd" />
      <Text style={styles.emptyTitle}>No Grocery List Available</Text>
      <Text style={styles.emptySubtitle}>
        Unable to generate grocery list from meal plan
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={generateGroceryList}>
        <Ionicons name="refresh" size={20} color="#008b8b" />
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#2c3e50" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Grocery List</Text>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={shareGroceryList}
            disabled={!groceryData}
          >
            <Ionicons
              name="share-outline"
              size={24}
              color={groceryData ? "#008b8b" : "#ddd"}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {loading ? (
            renderLoadingState()
          ) : groceryData ? (
            <>
              {renderCostBreakdown()}
              {renderGroceryList()}
            </>
          ) : (
            renderEmptyState()
          )}
        </ScrollView>
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
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 20,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f3f3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  retryButtonText: {
    color: '#008b8b',
    fontWeight: '600',
  },

  // Cost Section
  costSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  costCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  costCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  costCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  costCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  costCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  costCardSubtext: {
    fontSize: 12,
    color: '#64748b',
  },

  // Category Breakdown
  categoryBreakdown: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  categoryBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  categoryBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  categoryBreakdownName: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  categoryBreakdownCost: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },

  // Grocery Section
  grocerySection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  grocerySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  progressIndicator: {
    backgroundColor: '#e6f3f3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#008b8b',
  },

  // Category Section
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  categorySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  categoryProgress: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },

  // Category Items
  categoryItems: {
    gap: 6,
  },
  groceryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groceryItemChecked: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  groceryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#008b8b',
    borderColor: '#008b8b',
  },
  groceryItemInfo: {
    flex: 1,
  },
  groceryItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  groceryItemNameChecked: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  groceryItemQuantity: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  groceryItemNotes: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  groceryItemCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008b8b',
  },
  groceryItemCostChecked: {
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
});

export default GroceryListModal;
