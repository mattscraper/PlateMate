// EnhancedGroceryListModal.js - Enhanced Grocery List Modal with Persistence
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/auth';

const { width, height } = Dimensions.get('window');

const EnhancedGroceryListModal = ({
  visible,
  onClose,
  mealPlan,
  days,
  mealsPerDay,
  caloriesPerDay,
  mealPlanId = null
}) => {
  const [groceryData, setGroceryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [updatingChecks, setUpdatingChecks] = useState(false);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // Load grocery list (with persistence support)
  const loadGroceryList = useCallback(async () => {
    if (!mealPlan || !visible) return;

    setLoading(true);
    setError(null);

    try {
      // First, try to get existing grocery list if we have a meal plan ID
      let existingGroceryList = null;
      if (mealPlanId) {
        existingGroceryList = await authService.getGroceryListByMealPlanId(mealPlanId);
        console.log('📋 Existing grocery list:', existingGroceryList ? 'Found' : 'Not found');
      }

      // Prepare request data
      const requestData = {
        meal_plan: mealPlan,
        days: days,
        meals_per_day: mealsPerDay,
        meal_plan_id: mealPlanId,
        existing_grocery_list: existingGroceryList
      };

      // Call enhanced grocery list API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/grocery-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate grocery list');
      }

      const data = await response.json();
      console.log('✅ Enhanced grocery list loaded successfully');
      
      // If this is a new grocery list and we have a meal plan ID, save it
      if (!existingGroceryList && mealPlanId && data.success) {
        try {
          await authService.saveGroceryList({
            ...data,
            meal_plan_id: mealPlanId
          });
          console.log('💾
