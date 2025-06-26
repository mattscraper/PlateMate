import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
  Modal,
  Alert,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import { authService } from "../services/auth";
import { foodLogService } from "../services/foodLogService";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function FoodLogScreen({ navigation }) {
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [foodDescription, setFoodDescription] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("other");
  const [userGoals, setUserGoals] = useState(null);
  const [dailyProgress, setDailyProgress] = useState(null);
  const [isGoalsModalVisible, setIsGoalsModalVisible] = useState(false);
  
  // Goal form state
  const [dailyCalories, setDailyCalories] = useState("");
  const [dailyProtein, setDailyProtein] = useState("");
  const [dailyCarbs, setDailyCarbs] = useState("");
  const [dailyFat, setDailyFat] = useState("");
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimer = useRef(null);
  
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  
  // Progress animations
  const progressAnimations = useRef({
    calories: new Animated.Value(0),
    protein: new Animated.Value(0),
    carbs: new Animated.Value(0),
    fat: new Animated.Value(0),
  }).current;

  // Recording pulse animation
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  
  const mealTypes = [
    { id: "breakfast", label: "Breakfast", icon: "sunny-outline", color: "#F59E0B" },
    { id: "lunch", label: "Lunch", icon: "partly-sunny-outline", color: "#10B981" },
    { id: "dinner", label: "Dinner", icon: "moon-outline", color: "#8B5CF6" },
    { id: "snack", label: "Snack", icon: "nutrition-outline", color: "#EF4444" },
    { id: "other", label: "Other", icon: "restaurant-outline", color: "#6B7280" },
  ];

  // Recommended daily intakes
  const getRecommendedIntake = (calories) => {
    return {
      carbs: Math.round(calories * 0.45 / 4),
      fat: Math.round(calories * 0.25 / 9),
    };
  };

  useEffect(() => {
    initializeComponent();
  }, []);

  useEffect(() => {
    if (isRecording) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      return () => {
        pulseLoop.stop();
        if (recordingTimer.current) {
          clearInterval(recordingTimer.current);
        }
      };
    } else {
      pulseAnimation.setValue(1);
      setRecordingDuration(0);
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    }
  }, [isRecording]);

  const initializeComponent = async () => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      await loadUserGoals(currentUser.uid);
      await loadDailyProgress(currentUser.uid);
    } else {
      navigation.navigate("Landing");
    }
  };

  const loadUserGoals = async (userId) => {
    try {
      const response = await foodLogService.getNutritionGoals(userId);
      if (response.success) {
        setUserGoals(response.goals);
        setDailyCalories(response.goals.daily_calories?.toString() || "");
        setDailyProtein(response.goals.daily_protein?.toString() || "");
        setDailyCarbs(response.goals.daily_carbs?.toString() || "");
        setDailyFat(response.goals.daily_fat?.toString() || "");
      }
    } catch (error) {
      console.error("Error loading user goals:", error);
    }
  };

  const loadDailyProgress = async (userId) => {
    try {
      const response = await foodLogService.getDailyProgress(userId);
      if (response.success) {
        setDailyProgress(response.progress);
        animateProgress(response.progress);
      }
    } catch (error) {
      console.error("Error loading daily progress:", error);
    }
  };

  const animateProgress = (progress) => {
    if (!progress.goals) return;
    
    const { consumed, goals } = progress;
    
    Object.keys(progressAnimations).forEach(macro => {
      const consumedValue = consumed[macro] || 0;
      const goalValue = goals[`daily_${macro}`] || 1;
      const percentage = Math.min(consumedValue / goalValue, 1);
      
      Animated.timing(progressAnimations[macro], {
        toValue: percentage,
        duration: 1200,
        useNativeDriver: false,
      }).start();
    });
  };
    
  const showCustomToast = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const logFood = async () => {
    if (!foodDescription.trim()) {
      showCustomToast("Please describe what you ate", "error");
      return;
    }

    if (!user) {
      showCustomToast("Please log in to continue", "error");
      return;
    }

    setIsLoading(true);

    try {
      const response = await foodLogService.logFood(
        user.uid,
        foodDescription,
        selectedMealType
      );

      if (response.success) {
        showCustomToast("Food logged successfully!", "success");
        setFoodDescription("");
        await loadDailyProgress(user.uid);
      } else {
        showCustomToast("Failed to log food", "error");
      }
    } catch (error) {
      console.error("Error logging food:", error);
      showCustomToast("Network error. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const saveGoals = async () => {
    if (!dailyCalories || !dailyProtein) {
      showCustomToast("Please enter calories and protein goals", "error");
      return;
    }

    if (!user) {
      showCustomToast("Please log in to continue", "error");
      return;
    }

    setIsLoading(true);

    try {
      let finalCarbs = dailyCarbs ? parseInt(dailyCarbs) : null;
      let finalFat = dailyFat ? parseInt(dailyFat) : null;
      
      if (!finalCarbs || !finalFat) {
        const recommended = getRecommendedIntake(parseInt(dailyCalories));
        if (!finalCarbs) finalCarbs = recommended.carbs;
        if (!finalFat) finalFat = recommended.fat;
        
        showCustomToast("Missing macros filled with recommended values", "info");
      }

      const response = await foodLogService.setNutritionGoals(
        user.uid,
        parseInt(dailyCalories),
        parseInt(dailyProtein),
        finalCarbs,
        finalFat
      );

      if (response.success) {
        setUserGoals(response.goals);
        setIsGoalsModalVisible(false);
        showCustomToast("Goals updated successfully!", "success");
        await loadDailyProgress(user.uid);
      } else {
        showCustomToast("Failed to save goals", "error");
      }
    } catch (error) {
      console.error("Error saving goals:", error);
      showCustomToast("Network error. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced voice recording functions
  const startRecording = async () => {
    try {
      if (permissionResponse.status !== 'granted') {
        const permission = await requestPermission();
        if (permission.status !== 'granted') {
          showCustomToast("Microphone permission required for voice input", "error");
          return;
        }
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      
      setRecording(recording);
      setIsRecording(true);
      showCustomToast("Recording started... Speak now!", "info");
    } catch (err) {
      console.error('Failed to start recording', err);
      showCustomToast("Failed to start recording. Please try again.", "error");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      const uri = recording.getURI();
      
      if (uri) {
        showCustomToast("Processing speech...", "info");
        
        // Simulate speech-to-text processing
        const mockResponses = [
          "Grilled chicken breast with quinoa and steamed broccoli",
          "Greek yogurt with mixed berries and granola",
          "Salmon fillet with sweet potato and asparagus",
          "Turkey and avocado wrap with whole wheat tortilla",
          "Protein smoothie with banana and spinach"
        ];
        
        setTimeout(() => {
          const transcription = mockResponses[Math.floor(Math.random() * mockResponses.length)];
          setFoodDescription(transcription);
          showCustomToast("Speech converted successfully! (Demo mode)", "success");
        }, 2000);
      }
      
      setRecording(undefined);
    } catch (error) {
      console.error('Error stopping recording:', error);
      showCustomToast("Failed to process recording", "error");
      setRecording(undefined);
    }
  };

  const handleVoiceInput = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteEntry = (entryId, entryName) => {
    Alert.alert(
      "Delete Entry",
      `Remove "${entryName}" from today's log?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await foodLogService.deleteFoodLogEntry(entryId);
              showCustomToast("Entry deleted", "success");
              if (user) {
                await loadDailyProgress(user.uid);
              }
            } catch (error) {
              console.error("Error deleting entry:", error);
              showCustomToast("Failed to delete entry", "error");
            }
          },
        },
      ]
    );
  };

  const ProgressRing = ({ macro, consumed, goal, color, icon }) => {
    const animatedPercentage = progressAnimations[macro];
    const percentage = consumed / (goal || 1);
    const isOverGoal = percentage > 1;
    const displayPercentage = Math.min(percentage * 100, 100);
    
    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressRing, isOverGoal && styles.progressRingOver]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: isOverGoal ? '#EF4444' : color,
                transform: [{
                  rotate: animatedPercentage.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  })
                }]
              },
            ]}
          />
          <View style={styles.progressContent}>
            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
              <Ionicons name={icon} size={18} color={color} />
            </View>
            <Text style={[styles.progressValue, isOverGoal && styles.progressValueOver]}>
              {consumed}
            </Text>
            <Text style={[styles.progressGoal, isOverGoal && styles.progressGoalOver]}>
              of {goal || 0}
            </Text>
          </View>
          {isOverGoal && (
            <View style={styles.overGoalBadge}>
              <Ionicons name="warning" size={10} color="#EF4444" />
            </View>
          )}
        </View>
        <Text style={styles.progressLabel}>
          {macro.charAt(0).toUpperCase() + macro.slice(1)}
        </Text>
        <View style={[styles.progressBadge, { backgroundColor: color + '15' }]}>
          <Text style={[styles.progressPercentage, { color: color }]}>
            {Math.round(displayPercentage)}%
          </Text>
        </View>
      </View>
    );
  };

  const MealTypeCard = ({ meal, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.mealTypeCard,
        isSelected && [styles.mealTypeCardActive, { borderColor: meal.color }],
      ]}
      onPress={onPress}
    >
      <View style={[styles.mealIconContainer, { backgroundColor: meal.color + '15' }]}>
        <Ionicons
          name={meal.icon}
          size={20}
          color={isSelected ? meal.color : meal.color + '80'}
        />
      </View>
      <Text style={[
        styles.mealTypeText,
        isSelected && [styles.mealTypeTextActive, { color: meal.color }]
      ]}>
        {meal.label}
      </Text>
    </TouchableOpacity>
  );

  const TodaysMealCard = ({ entry, index }) => {
    const mealType = mealTypes.find(m => m.id === entry.meal_type) || mealTypes[4];
    
    return (
      <View style={[styles.mealCard, { borderLeftColor: mealType.color }]}>
        <View style={styles.mealCardHeader}>
          <View style={styles.mealTypeInfo}>
            <View style={[styles.mealBadge, { backgroundColor: mealType.color + '15' }]}>
              <Ionicons name={mealType.icon} size={14} color={mealType.color} />
              <Text style={[styles.mealBadgeText, { color: mealType.color }]}>
                {mealType.label}
              </Text>
            </View>
            <Text style={styles.mealTime}>
              {entry.logged_at ? new Date(entry.logged_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              }) : 'Now'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteEntry(entry.id, entry.food_name)}
            style={styles.deleteButton}
          >
            <Ionicons name="close-circle" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.foodName}>{entry.food_name}</Text>
        
        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionItem}>
            <Ionicons name="flame" size={14} color="#EF4444" />
            <Text style={styles.nutritionValue}>{entry.calories}</Text>
            <Text style={styles.nutritionLabel}>cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Ionicons name="fitness" size={14} color="#10B981" />
            <Text style={styles.nutritionValue}>{entry.protein}g</Text>
            <Text style={styles.nutritionLabel}>protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Ionicons name="leaf" size={14} color="#3B82F6" />
            <Text style={styles.nutritionValue}>{entry.carbs}g</Text>
            <Text style={styles.nutritionLabel}>carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Ionicons name="water" size={14} color="#F59E0B" />
            <Text style={styles.nutritionValue}>{entry.fat}g</Text>
            <Text style={styles.nutritionLabel}>fat</Text>
          </View>
        </View>
      </View>
    );
  };

  const Toast = ({ visible, message, type }) => {
    if (!visible) return null;

    const getToastConfig = () => {
      switch (type) {
        case "success":
          return { backgroundColor: "#10B981", iconName: "checkmark-circle" };
        case "error":
          return { backgroundColor: "#EF4444", iconName: "alert-circle" };
        case "info":
          return { backgroundColor: "#3B82F6", iconName: "information-circle" };
        default:
          return { backgroundColor: "#6B7280", iconName: "chatbubble" };
      }
    };

    const { backgroundColor, iconName } = getToastConfig();

    return (
      <Animated.View style={[styles.toast, { backgroundColor }]}>
        <Ionicons name={iconName} size={20} color="white" />
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    );
  };

  const isSaveEnabled = dailyCalories.trim() && dailyProtein.trim() && !isLoading;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Nutrition Tracker</Text>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
              })}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate("FoodLogHistory")}
              style={styles.headerActionButton}
            >
              <Ionicons name="analytics-outline" size={22} color="#6366F1" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setIsGoalsModalVisible(true)}
              style={styles.headerActionButton}
            >
              <Ionicons name="settings-outline" size={22} color="#6366F1" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Progress Section */}
            {dailyProgress && dailyProgress.goals && (
              <View style={styles.progressSection}>
                <Text style={styles.sectionTitle}>Today's Progress</Text>
                <View style={styles.progressGrid}>
                  <ProgressRing
                    macro="calories"
                    consumed={dailyProgress.consumed.calories}
                    goal={dailyProgress.goals.daily_calories}
                    color="#EF4444"
                    icon="flame"
                  />
                  <ProgressRing
                    macro="protein"
                    consumed={dailyProgress.consumed.protein}
                    goal={dailyProgress.goals.daily_protein}
                    color="#10B981"
                    icon="fitness"
                  />
                  <ProgressRing
                    macro="carbs"
                    consumed={dailyProgress.consumed.carbs}
                    goal={dailyProgress.goals.daily_carbs}
                    color="#3B82F6"
                    icon="leaf"
                  />
                  <ProgressRing
                    macro="fat"
                    consumed={dailyProgress.consumed.fat}
                    goal={dailyProgress.goals.daily_fat}
                    color="#F59E0B"
                    icon="water"
                  />
                </View>
                
                <View style={styles.summaryCard}>
                  <View style={styles.summaryHeader}>
                    <Ionicons name="target-outline" size={20} color="#6366F1" />
                    <Text style={styles.summaryTitle}>Remaining Goals</Text>
                  </View>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{dailyProgress.remaining.calories}</Text>
                      <Text style={styles.summaryLabel}>calories</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{dailyProgress.remaining.protein}g</Text>
                      <Text style={styles.summaryLabel}>protein</Text>
                    </View>
                    {dailyProgress.remaining.carbs !== null && (
                      <>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryValue}>{dailyProgress.remaining.carbs}g</Text>
                          <Text style={styles.summaryLabel}>carbs</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryValue}>{dailyProgress.remaining.fat}g</Text>
                          <Text style={styles.summaryLabel}>fat</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* No Goals Setup */}
            {!userGoals && (
              <View style={styles.setupCard}>
                <View style={styles.setupIcon}>
                  <Ionicons name="target-outline" size={32} color="#6366F1" />
                </View>
                <Text style={styles.setupTitle}>Set Your Nutrition Goals</Text>
                <Text style={styles.setupDescription}>
                  Start tracking your daily calories and macros by setting personalized goals
                </Text>
                <TouchableOpacity
                  style={styles.setupButton}
                  onPress={() => setIsGoalsModalVisible(true)}
                >
                  <Ionicons name="add-circle-outline" size={18} color="white" />
                  <Text style={styles.setupButtonText}>Set Goals</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Meal Type Selection */}
            <View style={styles.mealTypeSection}>
              <Text style={styles.sectionTitle}>Select Meal Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealTypeScroll}>
                {mealTypes.map((meal) => (
                  <MealTypeCard
                    key={meal.id}
                    meal={meal}
                    isSelected={selectedMealType === meal.id}
                    onPress={() => setSelectedMealType(meal.id)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Food Input Section */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionTitle}>Log Your Food</Text>
              
              <View style={styles.inputCard}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Describe what you ate (e.g., 'grilled chicken with rice and vegetables')"
                  placeholderTextColor="#9CA3AF"
                  value={foodDescription}
                  onChangeText={setFoodDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
                <TouchableOpacity
                  style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
                  onPress={handleVoiceInput}
                >
                  <View style={[styles.voiceIcon, isRecording && styles.voiceIconActive]}>
                    <Ionicons
                      name={isRecording ? "stop" : "mic-outline"}
                      size={22}
                      color={isRecording ? "white" : "#6366F1"}
                    />
                  </View>
                  <View style={styles.voiceContent}>
                    <Text style={[styles.voiceText, isRecording && styles.voiceTextActive]}>
                      {isRecording ? "Stop Recording" : "Voice Input"}
                    </Text>
                    {isRecording && (
                      <Text style={styles.recordingTimer}>
                        {formatRecordingTime(recordingDuration)}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={[styles.logButton, (!foodDescription.trim() || isLoading) && styles.logButtonDisabled]}
                onPress={logFood}
                disabled={!foodDescription.trim() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="add-outline" size={20} color="white" />
                    <Text style={styles.logButtonText}>Log Food</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Today's Meals */}
            {dailyProgress && dailyProgress.entries && dailyProgress.entries.length > 0 && (
              <View style={styles.mealsSection}>
                <View style={styles.mealsSectionHeader}>
                  <Text style={styles.sectionTitle}>Today's Meals</Text>
                  <View style={styles.mealsCount}>
                    <Text style={styles.mealsCountText}>{dailyProgress.entries.length} entries</Text>
                  </View>
                </View>
                {dailyProgress.entries.map((entry, index) => (
                  <TodaysMealCard key={entry.id || index} entry={entry} index={index} />
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Goals Modal */}
        <Modal
          visible={isGoalsModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsGoalsModalVisible(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsGoalsModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nutrition Goals</Text>
              <TouchableOpacity
                onPress={saveGoals}
                disabled={!isSaveEnabled}
                style={[styles.modalSaveButton, !isSaveEnabled && styles.modalSaveButtonDisabled]}
              >
                <Text style={[styles.modalSaveText, !isSaveEnabled && styles.modalSaveTextDisabled]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.modalKeyboardView}
            >
              <ScrollView
                style={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.goalInputContainer}>
                  <Text style={styles.goalLabel}>Daily Protein (g) *</Text>
                  <View style={styles.goalInputWrapper}>
                    <TextInput
                      style={styles.goalInput}
                      placeholder="150"
                      value={dailyProtein}
                      onChangeText={setDailyProtein}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={styles.goalUnit}>g</Text>
                  </View>
                </View>

                <View style={styles.goalInputContainer}>
                  <Text style={styles.goalLabel}>Daily Carbs (g)</Text>
                  <View style={styles.goalInputWrapper}>
                    <TextInput
                      style={styles.goalInput}
                      placeholder="Auto-calculated if empty"
                      value={dailyCarbs}
                      onChangeText={setDailyCarbs}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={styles.goalUnit}>g</Text>
                  </View>
                  {!dailyCarbs && dailyCalories && (
                    <Text style={styles.recommendedText}>
                      Recommended: {getRecommendedIntake(parseInt(dailyCalories) || 2000).carbs}g
                    </Text>
                  )}
                </View>

                <View style={styles.goalInputContainer}>
                  <Text style={styles.goalLabel}>Daily Fat (g)</Text>
                  <View style={styles.goalInputWrapper}>
                    <TextInput
                      style={styles.goalInput}
                      placeholder="Auto-calculated if empty"
                      value={dailyFat}
                      onChangeText={setDailyFat}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={styles.goalUnit}>g</Text>
                  </View>
                  {!dailyFat && dailyCalories && (
                    <Text style={styles.recommendedText}>
                      Recommended: {getRecommendedIntake(parseInt(dailyCalories) || 2000).fat}g
                    </Text>
                  )}
                </View>

                <View style={styles.goalNote}>
                  <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
                  <Text style={styles.goalNoteText}>
                    * Required fields. Carbs and fat will be auto-calculated based on recommended daily intake if left empty.
                  </Text>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        <Toast visible={showToast} message={toastMessage} type={toastType} />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  
  // Header Styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // Scroll View
  scrollView: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },

  // Section Titles
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
    letterSpacing: -0.2,
  },

  // Progress Section
  progressSection: {
    marginBottom: 32,
  },
  progressGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  progressContainer: {
    alignItems: "center",
    flex: 1,
  },
  progressRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 12,
    borderWidth: 3,
    borderColor: "#F3F4F6",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  progressRingOver: {
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  progressFill: {
    position: "absolute",
    width: 6,
    height: 30,
    backgroundColor: "#EF4444",
    borderRadius: 3,
    top: 10,
    transformOrigin: 'center bottom',
  },
  progressContent: {
    alignItems: "center",
    zIndex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  progressValueOver: {
    color: "#EF4444",
  },
  progressGoal: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  progressGoalOver: {
    color: "#EF4444",
  },
  progressLabel: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "capitalize",
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  progressPercentage: {
    fontSize: 11,
    fontWeight: "700",
  },
  overGoalBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 3,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Summary Card
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  summaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },

  // Setup Card (No Goals)
  setupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  setupIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0F4FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  setupDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  setupButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6366F1",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  setupButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 6,
  },

  // Meal Type Section
  mealTypeSection: {
    marginBottom: 32,
  },
  mealTypeScroll: {
    paddingVertical: 4,
  },
  mealTypeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 90,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#F3F4F6",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  mealTypeCardActive: {
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
  mealIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mealTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  mealTypeTextActive: {
    fontWeight: "700",
  },

  // Input Section
  inputSection: {
    marginBottom: 32,
  },
  inputCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  textInput: {
    padding: 20,
    fontSize: 16,
    color: "#111827",
    minHeight: 120,
    maxHeight: 160,
    fontWeight: "400",
    lineHeight: 22,
    textAlignVertical: "top",
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  voiceButtonActive: {
    backgroundColor: "#6366F1",
    borderColor: "#6366F1",
  },
  voiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F4FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  voiceIconActive: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  voiceContent: {
    flex: 1,
  },
  voiceText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  voiceTextActive: {
    color: "white",
  },
  recordingTimer: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: "600",
  },
  logButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    borderRadius: 16,
    paddingVertical: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#10B981",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  logButtonDisabled: {
    opacity: 0.6,
    transform: [{ scale: 0.98 }],
  },
  logButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },

  // Meals Section
  mealsSection: {
    marginBottom: 32,
  },
  mealsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  mealsCount: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealsCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  mealCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  mealCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  mealTypeInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  mealBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  mealBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mealTime: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  deleteButton: {
    padding: 4,
  },
  foodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
    lineHeight: 20,
  },
  nutritionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1,
  },
  nutritionValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  nutritionLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  modalCancelText: {
    fontSize: 16,
    color: "#6366F1",
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#10B981",
  },
  modalSaveButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },
  modalSaveTextDisabled: {
    color: "#9CA3AF",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  goalInputContainer: {
    marginBottom: 24,
  },
  goalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  goalInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  goalInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  goalUnit: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 12,
    color: "#6366F1",
    marginTop: 6,
    fontWeight: "500",
    fontStyle: "italic",
  },
  goalNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  goalNoteText: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginLeft: 8,
    flex: 1,
  },

  // Toast
  toast: {
    position: "absolute",
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    zIndex: 9999,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
    color: "white",
    flex: 1,
  },
});
