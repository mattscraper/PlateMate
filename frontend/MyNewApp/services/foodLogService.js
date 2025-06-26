// services/foodLogService.js
import { db } from "../firebaseConfig";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from "firebase/firestore";

const API_BASE_URL = 'https://platemate-6.onrender.com'; // Replace with your Flask backend URL

class FoodLogService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Helper method for making API requests to backend
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Estimate nutrition using backend OpenAI
  async estimateNutrition(foodDescription) {
    return this.makeRequest('/api/estimate-nutrition', {
      method: 'POST',
      body: JSON.stringify({
        food_description: foodDescription,
      }),
    });
  }

  // Get meal suggestions from backend
  async getMealSuggestions(targetCalories, targetProtein, targetCarbs = null, targetFat = null) {
    return this.makeRequest('/api/meal-suggestions', {
      method: 'POST',
      body: JSON.stringify({
        target_calories: targetCalories,
        target_protein: targetProtein,
        target_carbs: targetCarbs,
        target_fat: targetFat,
      }),
    });
  }

  // Firebase operations for food logging
  async logFood(userId, foodDescription, mealType = 'other') {
    try {
      // First, get nutrition estimation from backend
      const nutritionResponse = await this.estimateNutrition(foodDescription);
      
      if (!nutritionResponse.success) {
        throw new Error('Failed to estimate nutrition');
      }

      const nutrition = nutritionResponse.nutrition;
      
      // Create food log entry
      const foodEntry = {
        user_id: userId,
        food_description: foodDescription,
        meal_type: mealType,
        food_name: nutrition.food_name,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        serving_size: nutrition.serving_size,
        confidence: nutrition.confidence,
        logged_at: Timestamp.now(),
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, "food_logs"), foodEntry);
      
      return {
        success: true,
        food_entry: {
          ...foodEntry,
          id: docRef.id,
          logged_at: foodEntry.logged_at.toDate().toISOString()
        }
      };
    } catch (error) {
      console.error('Error logging food:', error);
      throw error;
    }
  }

  // Set user's nutrition goals
  async setNutritionGoals(userId, dailyCalories, dailyProtein, dailyCarbs = null, dailyFat = null) {
    try {
      const goals = {
        user_id: userId,
        daily_calories: dailyCalories,
        daily_protein: dailyProtein,
        daily_carbs: dailyCarbs,
        daily_fat: dailyFat,
        updated_at: Timestamp.now(),
      };

      // Save to Firestore using userId as document ID
      await setDoc(doc(db, "nutrition_goals", userId), goals);
      
      return {
        success: true,
        goals: {
          ...goals,
          updated_at: goals.updated_at.toDate().toISOString()
        }
      };
    } catch (error) {
      console.error('Error setting nutrition goals:', error);
      throw error;
    }
  }

  // Get user's nutrition goals
  async getNutritionGoals(userId) {
    try {
      const docRef = doc(db, "nutrition_goals", userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          success: true,
          goals: {
            ...data,
            updated_at: data.updated_at?.toDate().toISOString()
          }
        };
      } else {
        return {
          success: false,
          message: "No nutrition goals found for this user"
        };
      }
    } catch (error) {
      console.error('Error getting nutrition goals:', error);
      throw error;
    }
  }

  // Get daily nutrition progress - Fixed indexing issue
  async getDailyProgress(userId, targetDate = null) {
    try {
      if (!targetDate) {
        targetDate = new Date().toISOString().split('T')[0];
      }

      // Simplified query to avoid index requirements
      const foodLogsRef = collection(db, "food_logs");
      const q = query(
        foodLogsRef,
        where("user_id", "==", userId),
        limit(200) // Get more entries and filter in JS
      );
      
      const querySnapshot = await getDocs(q);
      
      // Calculate totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      const entries = [];
      
      querySnapshot.forEach((doc) => {
        const entry = doc.data();
        
        // Filter by date in JavaScript
        if (entry.date !== targetDate) return;
        
        entry.id = doc.id;
        
        // Convert Timestamp to string for JSON serialization
        if (entry.logged_at && entry.logged_at.toDate) {
          entry.logged_at = entry.logged_at.toDate().toISOString();
        }
        
        entries.push(entry);
        
        totalCalories += entry.calories || 0;
        totalProtein += entry.protein || 0;
        totalCarbs += entry.carbs || 0;
        totalFat += entry.fat || 0;
      });

      // Sort entries by logged_at
      entries.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));

      // Get user's goals
      const goalsResponse = await this.getNutritionGoals(userId);
      const goals = goalsResponse.success ? goalsResponse.goals : null;
      
      // Calculate remaining macros
      const remainingCalories = goals ? Math.max(0, goals.daily_calories - totalCalories) : 0;
      const remainingProtein = goals ? Math.max(0, goals.daily_protein - totalProtein) : 0;
      const remainingCarbs = goals && goals.daily_carbs ? Math.max(0, goals.daily_carbs - totalCarbs) : null;
      const remainingFat = goals && goals.daily_fat ? Math.max(0, goals.daily_fat - totalFat) : null;

      return {
        success: true,
        progress: {
          date: targetDate,
          goals: goals,
          consumed: {
            calories: Math.round(totalCalories),
            protein: Math.round(totalProtein),
            carbs: Math.round(totalCarbs),
            fat: Math.round(totalFat)
          },
          remaining: {
            calories: Math.round(remainingCalories),
            protein: Math.round(remainingProtein),
            carbs: remainingCarbs ? Math.round(remainingCarbs) : null,
            fat: remainingFat ? Math.round(remainingFat) : null
          },
          entries: entries,
          entry_count: entries.length
        }
      };
    } catch (error) {
      console.error('Error getting daily progress:', error);
      throw error;
    }
  }

  // Get food log history - Fixed for Firestore indexing
  async getFoodLogs(userId, options = {}) {
    try {
      const {
        limitCount = 50,
        startDate = null,
        endDate = null
      } = options;
      
      // Simple query without multiple where clauses to avoid index requirements
      let q = query(
        collection(db, "food_logs"),
        where("user_id", "==", userId),
        limit(Math.min(limitCount, 100))
      );
      
      const querySnapshot = await getDocs(q);
      const foodLogs = [];
      
      querySnapshot.forEach((doc) => {
        const entry = doc.data();
        entry.id = doc.id;
        
        // Convert Timestamp to string
        if (entry.logged_at && entry.logged_at.toDate) {
          entry.logged_at = entry.logged_at.toDate().toISOString();
        }
        
        // Apply date filtering in JavaScript to avoid complex Firestore queries
        if (startDate && entry.date < startDate) return;
        if (endDate && entry.date > endDate) return;
        
        foodLogs.push(entry);
      });

      // Sort in JavaScript by logged_at descending
      foodLogs.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));

      return {
        success: true,
        food_logs: foodLogs,
        count: foodLogs.length
      };
    } catch (error) {
      console.error('Error getting food logs:', error);
      // Fallback query if the above fails
      try {
        const simpleQuery = query(
          collection(db, "food_logs"),
          where("user_id", "==", userId),
          limit(Math.min(limitCount, 100))
        );
        
        const snapshot = await getDocs(simpleQuery);
        const logs = [];
        
        snapshot.forEach((doc) => {
          const entry = doc.data();
          entry.id = doc.id;
          
          if (entry.logged_at && entry.logged_at.toDate) {
            entry.logged_at = entry.logged_at.toDate().toISOString();
          }
          
          logs.push(entry);
        });
        
        // Sort in JavaScript
        logs.sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at));
        
        return {
          success: true,
          food_logs: logs,
          count: logs.length
        };
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  // Delete a food log entry
  async deleteFoodLogEntry(entryId) {
    try {
      await deleteDoc(doc(db, "food_logs", entryId));
      return {
        success: true,
        message: "Food entry deleted successfully"
      };
    } catch (error) {
      console.error('Error deleting food entry:', error);
      throw error;
    }
  }

  // Update a food log entry
  async updateFoodLogEntry(entryId, updates) {
    try {
      const allowedFields = ['food_description', 'meal_type', 'calories', 'protein', 'carbs', 'fat', 'serving_size'];
      const filteredUpdates = {};
      
      // Only allow specific fields to be updated
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });
      
      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error("No valid fields to update");
      }
      
      // Add updated timestamp
      filteredUpdates.updated_at = Timestamp.now();
      
      await updateDoc(doc(db, "food_logs", entryId), filteredUpdates);
      
      return {
        success: true,
        message: "Food entry updated successfully",
        updates: filteredUpdates
      };
    } catch (error) {
      console.error('Error updating food entry:', error);
      throw error;
    }
  }

  // Get nutrition summary for a date range
  async getNutritionSummary(userId, startDate, endDate) {
    try {
      const foodLogsResponse = await this.getFoodLogs(userId, {
        startDate: this.formatDate(startDate),
        endDate: this.formatDate(endDate),
        limitCount: 1000 // Get more entries for summary
      });

      if (!foodLogsResponse.success) {
        throw new Error('Failed to fetch food logs');
      }

      const logs = foodLogsResponse.food_logs;
      const dailyTotals = {};

      logs.forEach(log => {
        const date = log.date;
        if (!dailyTotals[date]) {
          dailyTotals[date] = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            entries: 0,
          };
        }

        dailyTotals[date].calories += log.calories || 0;
        dailyTotals[date].protein += log.protein || 0;
        dailyTotals[date].carbs += log.carbs || 0;
        dailyTotals[date].fat += log.fat || 0;
        dailyTotals[date].entries += 1;
      });

      const days = Object.keys(dailyTotals);
      const summary = {
        totalDays: days.length,
        averageCalories: 0,
        averageProtein: 0,
        averageCarbs: 0,
        averageFat: 0,
        totalEntries: logs.length,
        dailyBreakdown: dailyTotals,
      };

      if (days.length > 0) {
        summary.averageCalories = Math.round(
          days.reduce((sum, day) => sum + dailyTotals[day].calories, 0) / days.length
        );
        summary.averageProtein = Math.round(
          days.reduce((sum, day) => sum + dailyTotals[day].protein, 0) / days.length
        );
        summary.averageCarbs = Math.round(
          days.reduce((sum, day) => sum + dailyTotals[day].carbs, 0) / days.length
        );
        summary.averageFat = Math.round(
          days.reduce((sum, day) => sum + dailyTotals[day].fat, 0) / days.length
        );
      }

      return { success: true, summary };
    } catch (error) {
      console.error('Error calculating nutrition summary:', error);
      throw error;
    }
  }

  // Helper method to format date for API calls
  formatDate(date) {
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return date;
  }

  // Get weekly progress
  async getWeeklyProgress(userId) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 6); // Last 7 days
      
      const summary = await this.getNutritionSummary(
        userId,
        this.formatDate(startDate),
        this.formatDate(endDate)
      );
      
      if (!summary.success) {
        throw new Error('Failed to get weekly summary');
      }
      
      // Get user goals for comparison
      const goalsResponse = await this.getNutritionGoals(userId);
      const goals = goalsResponse.success ? goalsResponse.goals : null;
      
      // Create weekly data array
      const weeklyData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = this.formatDate(date);
        
        const dayData = summary.summary.dailyBreakdown[dateStr] || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          entries: 0
        };
        
        weeklyData.push({
          date: dateStr,
          ...dayData
        });
      }
      
      return {
        success: true,
        weekly_data: weeklyData,
        goals: goals,
        start_date: this.formatDate(startDate),
        end_date: this.formatDate(endDate)
      };
    } catch (error) {
      console.error('Error getting weekly progress:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const foodLogService = new FoodLogService();

// Export the class as well for testing purposes
export { FoodLogService };

// Helper functions for common operations
export const nutritionHelpers = {
  // Calculate calories from macros
  calculateCaloriesFromMacros: (protein, carbs, fat) => {
    return (protein * 4) + (carbs * 4) + (fat * 9);
  },

  // Calculate macro percentages
  calculateMacroPercentages: (calories, protein, carbs, fat) => {
    if (calories === 0) return { protein: 0, carbs: 0, fat: 0 };
    
    return {
      protein: Math.round((protein * 4 / calories) * 100),
      carbs: Math.round((carbs * 4 / calories) * 100),
      fat: Math.round((fat * 9 / calories) * 100),
    };
  },

  // Format nutrition display
  formatNutritionDisplay: (nutrition) => {
    return {
      calories: `${nutrition.calories} cal`,
      protein: `${nutrition.protein}g protein`,
      carbs: `${nutrition.carbs}g carbs`,
      fat: `${nutrition.fat}g fat`,
    };
  },

  // Check if user is meeting their goals
  checkGoalProgress: (consumed, goals) => {
    const progress = {};
    
    Object.keys(consumed).forEach(macro => {
      const goalKey = `daily_${macro}`;
      if (goals[goalKey]) {
        const percentage = (consumed[macro] / goals[goalKey]) * 100;
        progress[macro] = {
          percentage: Math.round(percentage),
          isOnTrack: percentage >= 80 && percentage <= 120, // Within 20% of goal
          isOver: percentage > 120,
          isUnder: percentage < 80,
        };
      }
    });
    
    return progress;
  },

  // Generate meal timing suggestions
  getMealTimingSuggestions: (currentTime, mealType) => {
    const hour = currentTime.getHours();
    const suggestions = {
      breakfast: hour < 10 ? 'Perfect timing for breakfast!' : 'A bit late for breakfast, but still good!',
      lunch: hour >= 11 && hour <= 14 ? 'Great lunch timing!' : hour < 11 ? 'Early lunch!' : 'Late lunch!',
      dinner: hour >= 17 && hour <= 20 ? 'Perfect dinner time!' : hour < 17 ? 'Early dinner!' : 'Late dinner!',
      snack: 'Snacks can be enjoyed anytime!',
      other: 'Food logged successfully!',
    };
    
    return suggestions[mealType] || suggestions.other;
  },

  // Validate nutrition goals
  validateGoals: (goals) => {
    const errors = [];
    
    if (!goals.daily_calories || goals.daily_calories < 1000 || goals.daily_calories > 5000) {
      errors.push('Daily calories should be between 1000-5000');
    }
    
    if (!goals.daily_protein || goals.daily_protein < 10 || goals.daily_protein > 300) {
      errors.push('Daily protein should be between 10-300g');
    }
    
    if (goals.daily_carbs && (goals.daily_carbs < 0 || goals.daily_carbs > 800)) {
      errors.push('Daily carbs should be between 0-800g');
    }
    
    if (goals.daily_fat && (goals.daily_fat < 0 || goals.daily_fat > 200)) {
      errors.push('Daily fat should be between 0-200g');
    }
    
    // Check if macros add up reasonably to calories
    if (goals.daily_carbs && goals.daily_fat) {
      const calculatedCalories = nutritionHelpers.calculateCaloriesFromMacros(
        goals.daily_protein,
        goals.daily_carbs,
        goals.daily_fat
      );
      
      const difference = Math.abs(calculatedCalories - goals.daily_calories);
      const allowedDifference = goals.daily_calories * 0.2; // 20% tolerance
      
      if (difference > allowedDifference) {
        errors.push('Your macro goals don\'t add up to your calorie goal. Please adjust.');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};
