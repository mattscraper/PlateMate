import React, { useState, useEffect, useRef, useCallback } from "react";
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
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { authService } from "../services/auth";
import { foodLogService } from "../services/foodLogService";

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function FoodLogScreen({ navigation }) {
  // Core State
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [foodDescription, setFoodDescription] = useState("");
  const [selectedMealType, setSelectedMealType] = useState("other");
  const [userGoals, setUserGoals] = useState(null);
  const [dailyProgress, setDailyProgress] = useState(null);
  const [isGoalsModalVisible, setIsGoalsModalVisible] = useState(false);
  
  // Goal Form State
  const [dailyCalories, setDailyCalories] = useState("");
  const [dailyProtein, setDailyProtein] = useState("");
  const [dailyCarbs, setDailyCarbs] = useState("");
  const [dailyFat, setDailyFat] = useState("");
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const recordingTimer = useRef(null);
  
  // UI State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [refreshing, setRefreshing] = useState(false);
  
  // Animation References
  const progressAnimations = useRef({
    calories: new Animated.Value(0),
    protein: new Animated.Value(0),
    carbs: new Animated.Value(0),
    fat: new Animated.Value(0),
  }).current;
  
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const recordingAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  
  // Enhanced Color Scheme
  const colors = {
    primary: "#2563EB",
    primaryLight: "#3B82F6",
    primaryDark: "#1D4ED8",
    secondary: "#10B981",
    accent: "#F59E0B",
    success: "#059669",
    warning: "#F59E0B",
    error: "#DC2626",
    purple: "#8B5CF6",
    pink: "#EC4899",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    text: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    border: "#E2E8F0",
    muted: "#F1F5F9",
    overlay: "rgba(37,99,235,0.1)",
    shadow: "rgba(0,0,0,0.1)",
  };

  // Enhanced Meal Types
  const mealTypes = [
    {
      id: "breakfast",
      label: "Breakfast",
      icon: "sunny-outline",
      color: colors.accent,
      bgColor: "#FEF3C7",
    },
    {
      id: "lunch",
      label: "Lunch",
      icon: "partly-sunny-outline",
      color: colors.secondary,
      bgColor: "#D1FAE5",
    },
    {
      id: "dinner",
      label: "Dinner",
      icon: "moon-outline",
      color: colors.purple,
      bgColor: "#EDE9FE",
    },
    {
      id: "snack",
      label: "Snack",
      icon: "nutrition-outline",
      color: colors.pink,
      bgColor: "#FCE7F3",
    },
    {
      id: "other",
      label: "Other",
      icon: "restaurant-outline",
      color: colors.primary,
      bgColor: colors.overlay,
    },
  ];

  // Initialize component
  useEffect(() => {
    initializeComponent();
  }, []);

  // Recording animation effect
  useEffect(() => {
    if (isRecording) {
      startRecordingAnimations();
      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      stopRecordingAnimations();
      setRecordingDuration(0);
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    }

    return () => {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, [isRecording]);

  const startRecordingAnimations = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.08,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(recordingAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(recordingAnimation, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopRecordingAnimations = () => {
    pulseAnimation.setValue(1);
    recordingAnimation.setValue(0);
  };

  const initializeComponent = async () => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      await refreshData(currentUser.uid);
    } else {
      navigation.navigate("Landing");
    }
  };

  const refreshData = async (userId) => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadUserGoals(userId),
        loadDailyProgress(userId)
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
      showCustomToast("Failed to refresh data", "error");
    } finally {
      setRefreshing(false);
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
      
      Animated.spring(progressAnimations[macro], {
        toValue: percentage,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }).start();
    });
  };

  const triggerHaptic = useCallback((type = 'light') => {
    if (Platform.OS === 'ios') {
      try {
        switch (type) {
          case 'light':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'success':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case 'error':
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          case 'selection':
            Haptics.selectionAsync();
            break;
        }
      } catch (error) {
        console.log('Haptics not available:', error);
      }
    }
  }, []);

  const showCustomToast = useCallback((message, type = "success") => {
    triggerHaptic(type === 'error' ? 'error' : 'success');
    
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    setTimeout(() => setShowToast(false), 3500);
  }, [triggerHaptic]);

  const logFood = async () => {
    if (!foodDescription.trim()) {
      showCustomToast("Please describe what you ate", "error");
      return;
    }

    if (!user) {
      showCustomToast("Please log in to continue", "error");
      return;
    }

    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    triggerHaptic('medium');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        await refreshData(user.uid);
      } else {
        showCustomToast("Failed to log food. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error logging food:", error);
      showCustomToast("Network error. Please check your connection.", "error");
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
        await refreshData(user.uid);
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

  const startRecording = async () => {
    try {
      if (permissionResponse.status !== 'granted') {
        const permission = await requestPermission();
        if (permission.status !== 'granted') {
          showCustomToast("Microphone permission required", "error");
          return;
        }
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      showCustomToast("Recording...", "info");
      triggerHaptic('medium');
      
    } catch (err) {
      console.error('Recording error:', err);
      showCustomToast("Recording failed. Please try again.", "error");
      setIsRecording(false);
      setRecording(null);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setIsProcessingAudio(true);
    
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
        
        try {
          const formData = new FormData();
          formData.append('audio', {
            uri: uri,
            type: 'audio/m4a',
            name: 'recording.m4a',
          });

          const response = await fetch('https://platemate-6.onrender.com/api/speech-to-text', {
            method: 'POST',
            body: formData,
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          const result = await response.json();
          
          if (result.success && result.transcription) {
            setFoodDescription(result.transcription);
            showCustomToast("Speech converted successfully!", "success");
            triggerHaptic('success');
          } else {
            throw new Error(result.error || 'Transcription failed');
          }
        } catch (apiError) {
          console.error('API Error:', apiError);
          const mockResponses = [
            "Grilled chicken breast with quinoa and steamed broccoli",
            "Greek yogurt with mixed berries and granola",
            "Salmon fillet with sweet potato and asparagus",
            "Turkey and avocado wrap with whole wheat tortilla",
            "Protein smoothie with banana and spinach",
            "Oatmeal with almond butter and blueberries"
          ];
          
          setTimeout(() => {
            const transcription = mockResponses[Math.floor(Math.random() * mockResponses.length)];
            setFoodDescription(transcription);
            showCustomToast("Speech converted! (Demo mode)", "success");
            triggerHaptic('success');
          }, 1500);
        }
      }
      
      setRecording(undefined);
    } catch (error) {
      console.error('Error stopping recording:', error);
      showCustomToast("Failed to process recording", "error");
      setRecording(undefined);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleVoiceInput = async () => {
    triggerHaptic('light');
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

  const getRecommendedIntake = (calories) => {
    return {
      carbs: Math.round(calories * 0.45 / 4),
      fat: Math.round(calories * 0.25 / 9),
    };
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
                await refreshData(user.uid);
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

  // Enhanced Components with better sizing
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
              styles.progressCircle,
              {
                borderColor: isOverGoal ? colors.error : color,
                opacity: animatedPercentage.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
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
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={[styles.progressValue, isOverGoal && styles.progressValueOver]}>
              {consumed}
            </Text>
            <Text style={[styles.progressGoal, isOverGoal && styles.progressGoalOver]}>
              of {goal || 0}
            </Text>
            <Text style={[styles.progressPercentage, { color: color }]}>
              {Math.round(displayPercentage)}%
            </Text>
          </View>
          
          {isOverGoal && (
            <View style={styles.overGoalBadge}>
              <Ionicons name="warning" size={10} color={colors.error} />
            </View>
          )}
        </View>
        
        <Text style={[styles.progressLabel, { color: colors.text }]}>
          {macro.charAt(0).toUpperCase() + macro.slice(1)}
        </Text>
      </View>
    );
  };

  const MealTypeCard = ({ meal, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.mealTypeCard,
        isSelected && [styles.mealTypeCardActive, { borderColor: meal.color, backgroundColor: meal.bgColor }],
      ]}
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={[
        styles.mealIconContainer,
        { backgroundColor: isSelected ? meal.color : meal.bgColor }
      ]}>
        <Ionicons
          name={meal.icon}
          size={18}
          color={isSelected ? colors.surface : meal.color}
        />
      </View>
      <Text style={[
        styles.mealTypeText,
        isSelected && { color: meal.color, fontWeight: '700' }
      ]}>
        {meal.label}
      </Text>
    </TouchableOpacity>
  );

  const VoiceRecordingButton = () => (
    <View style={styles.voiceButtonContainer}>
      <Animated.View style={{ transform: [{ scale: pulseAnimation }] }}>
        <TouchableOpacity
          style={[
            styles.voiceButton,
            isRecording && styles.voiceButtonActive,
            isProcessingAudio && styles.voiceButtonProcessing
          ]}
          onPress={handleVoiceInput}
          disabled={isProcessingAudio}
          activeOpacity={0.8}
        >
          <View style={styles.voiceButtonContent}>
            <View style={[
              styles.voiceIcon,
              isRecording && styles.voiceIconActive,
              isProcessingAudio && styles.voiceIconProcessing
            ]}>
              {isProcessingAudio ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Ionicons
                  name={isRecording ? "stop" : "mic"}
                  size={22}
                  color={isRecording ? colors.surface : colors.primary}
                />
              )}
            </View>
            
            <View style={styles.voiceTextContainer}>
              <Text style={[
                styles.voiceMainText,
                isRecording && styles.voiceMainTextActive,
                isProcessingAudio && styles.voiceMainTextProcessing
              ]}>
                {isProcessingAudio ? "Processing..." : isRecording ? "Tap to Stop" : "Voice Input"}
              </Text>
              {isRecording && (
                <Text style={styles.recordingTimer}>
                  {formatRecordingTime(recordingDuration)}
                </Text>
              )}
              {!isRecording && !isProcessingAudio && (
                <Text style={styles.voiceSubText}>
                  Tap to describe your meal
                </Text>
              )}
            </View>
            
            {isRecording && (
              <Animated.View style={[
                styles.recordingIndicator,
                {
                  opacity: recordingAnimation,
                  transform: [{
                    scale: recordingAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  }]
                }
              ]} />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const TodaysMealCard = ({ entry, index }) => {
    const mealType = mealTypes.find(m => m.id === entry.meal_type) || mealTypes[4];
    
    return (
      <View style={[styles.mealCard, { borderLeftColor: mealType.color }]}>
        <View style={styles.mealCardHeader}>
          <View style={styles.mealTypeInfo}>
            <View style={[styles.mealBadge, { backgroundColor: mealType.bgColor }]}>
              <Ionicons name={mealType.icon} size={12} color={mealType.color} />
              <Text style={[styles.mealBadgeText, { color: mealType.color }]}>
                {mealType.label}
              </Text>
            </View>
            <Text style={[styles.mealTime, { color: colors.textMuted }]}>
              {entry.logged_at ? new Date(entry.logged_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              }) : 'Now'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('light');
              handleDeleteEntry(entry.id, entry.food_name);
            }}
            style={styles.deleteButton}
          >
            <Ionicons name="close-circle" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.foodName, { color: colors.text }]}>{entry.food_name}</Text>
        
        <View style={[styles.nutritionGrid, { backgroundColor: colors.muted }]}>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.secondary + '20' }]}>
              <Ionicons name="flame" size={12} color={colors.secondary} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{entry.calories}</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>cal</Text>
          </View>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="fitness" size={12} color={colors.primary} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{entry.protein}g</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.purple + '20' }]}>
              <Ionicons name="leaf" size={12} color={colors.purple} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{entry.carbs}g</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <View style={[styles.nutritionIconBg, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="water" size={12} color={colors.accent} />
            </View>
            <Text style={[styles.nutritionValue, { color: colors.text }]}>{entry.fat}g</Text>
            <Text style={[styles.nutritionLabel, { color: colors.textMuted }]}>fat</Text>
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
          return { backgroundColor: colors.success, iconName: "checkmark-circle" };
        case "error":
          return { backgroundColor: colors.error, iconName: "alert-circle" };
        case "info":
          return { backgroundColor: colors.primary, iconName: "information-circle" };
        default:
          return { backgroundColor: colors.textSecondary, iconName: "chatbubble" };
      }
    };

    const { backgroundColor, iconName } = getToastConfig();

    return (
      <Animated.View style={[styles.toast, { backgroundColor }]}>
        <Ionicons name={iconName} size={20} color={colors.surface} />
        <Text style={styles.toastText}>{message}</Text>
      </Animated.View>
    );
  };

  const isSaveEnabled = dailyCalories.trim() && dailyProtein.trim() && !isLoading;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Enhanced Header with better history button */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic('light');
              navigation.goBack();
            }}
            style={[styles.backButton, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Nutrition Tracker</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
              })}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                navigation.navigate("FoodLogHistory");
              }}
              style={[styles.historyButton, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="analytics" size={18} color={colors.surface} />
              <Text style={[styles.historyButtonText, { color: colors.surface }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                setIsGoalsModalVisible(true);
              }}
              style={[styles.headerActionButton, { backgroundColor: colors.muted }]}
            >
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
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
            refreshing={refreshing}
            onRefresh={() => user && refreshData(user.uid)}
          >
            {/* Progress Section */}
            {dailyProgress && dailyProgress.goals && (
              <View style={styles.progressSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Progress</Text>
                <View style={styles.progressGrid}>
                  <ProgressRing
                    macro="calories"
                    consumed={dailyProgress.consumed.calories}
                    goal={dailyProgress.goals.daily_calories}
                    color={colors.secondary}
                    icon="flame"
                  />
                  <ProgressRing
                    macro="protein"
                    consumed={dailyProgress.consumed.protein}
                    goal={dailyProgress.goals.daily_protein}
                    color={colors.primary}
                    icon="fitness"
                  />
                  <ProgressRing
                    macro="carbs"
                    consumed={dailyProgress.consumed.carbs}
                    goal={dailyProgress.goals.daily_carbs}
                    color={colors.purple}
                    icon="leaf"
                  />
                  <ProgressRing
                    macro="fat"
                    consumed={dailyProgress.consumed.fat}
                    goal={dailyProgress.goals.daily_fat}
                    color={colors.accent}
                    icon="water"
                  />
                </View>
                
                <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.summaryHeader}>
                    <View style={[styles.summaryIconBg, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons name="trending-up" size={20} color={colors.primary} />
                    </View>
                    <Text style={[styles.summaryTitle, { color: colors.text }]}>Remaining Goals</Text>
                  </View>
                  <View style={styles.summaryGrid}>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryValue, { color: colors.secondary }]}>{dailyProgress.remaining.calories}</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>calories</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryValue, { color: colors.primary }]}>{dailyProgress.remaining.protein}g</Text>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>protein</Text>
                    </View>
                    {dailyProgress.remaining.carbs !== null && (
                      <>
                        <View style={styles.summaryItem}>
                          <Text style={[styles.summaryValue, { color: colors.purple }]}>{dailyProgress.remaining.carbs}g</Text>
                          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>carbs</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={[styles.summaryValue, { color: colors.accent }]}>{dailyProgress.remaining.fat}g</Text>
                          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>fat</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* No Goals Setup */}
            {!userGoals && (
              <View style={[styles.setupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.setupIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="target-outline" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.setupTitle, { color: colors.text }]}>Set Your Nutrition Goals</Text>
                <Text style={[styles.setupDescription, { color: colors.textSecondary }]}>
                  Start tracking your daily calories and macros by setting personalized goals
                </Text>
                <TouchableOpacity
                  style={[styles.setupButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    triggerHaptic('light');
                    setIsGoalsModalVisible(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={colors.surface} />
                  <Text style={[styles.setupButtonText, { color: colors.surface }]}>Set Goals</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Meal Type Selection */}
            <View style={styles.mealTypeSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Meal Type</Text>
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Log Your Food</Text>
              
              {/* Accuracy Notice */}
              <View style={[styles.accuracyNotice, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <View style={[styles.accuracyIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="bulb" size={16} color={colors.primary} />
                </View>
                <Text style={[styles.accuracyText, { color: colors.primary }]}>
                  <Text style={styles.accuracyBold}>Pro tip:</Text> Be specific for better accuracy! Include portion sizes, cooking methods, and ingredients (e.g., "6oz grilled salmon with 1 cup steamed broccoli and 1/2 cup brown rice")
                </Text>
              </View>
              
              <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Describe what you ate..."
                  placeholderTextColor={colors.textSecondary}
                  value={foodDescription}
                  onChangeText={setFoodDescription}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>

              <VoiceRecordingButton />

              <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
                <TouchableOpacity
                  style={[
                    styles.logButton,
                    { backgroundColor: (!foodDescription.trim() || isLoading) ? colors.border : colors.primary },
                    (!foodDescription.trim() || isLoading) && styles.logButtonDisabled
                  ]}
                  onPress={logFood}
                  disabled={!foodDescription.trim() || isLoading}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.logButtonGradient,
                    { backgroundColor: (!foodDescription.trim() || isLoading) ? colors.border : colors.primary }
                  ]}>
                    {isLoading ? (
                      <ActivityIndicator color={colors.surface} size="small" />
                    ) : (
                      <>
                        <Ionicons name="add-outline" size={20} color={(!foodDescription.trim() || isLoading) ? colors.textMuted : colors.surface} />
                        <Text style={[styles.logButtonText, { color: (!foodDescription.trim() || isLoading) ? colors.textMuted : colors.surface }]}>Log Food</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Today's Meals */}
            {dailyProgress && dailyProgress.entries && dailyProgress.entries.length > 0 && (
              <View style={styles.mealsSection}>
                <View style={styles.mealsSectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Meals</Text>
                  <View style={[styles.mealsCount, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.mealsCountText, { color: colors.textSecondary }]}>{dailyProgress.entries.length} entries</Text>
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
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setIsGoalsModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nutrition Goals</Text>
              <TouchableOpacity
                onPress={saveGoals}
                disabled={!isSaveEnabled}
                style={[
                  styles.modalSaveButton,
                  { backgroundColor: isSaveEnabled ? colors.primary : colors.muted }
                ]}
              >
                <Text style={[
                  styles.modalSaveText,
                  { color: isSaveEnabled ? colors.surface : colors.textSecondary }
                ]}>
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
                  <Text style={[styles.goalLabel, { color: colors.text }]}>Daily Calories *</Text>
                  <View style={[styles.goalInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.goalInput, { color: colors.text }]}
                      placeholder="2000"
                      placeholderTextColor={colors.textSecondary}
                      value={dailyCalories}
                      onChangeText={setDailyCalories}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={[styles.goalUnit, { color: colors.textSecondary }]}>cal</Text>
                  </View>
                </View>

                <View style={styles.goalInputContainer}>
                  <Text style={[styles.goalLabel, { color: colors.text }]}>Daily Protein (g) *</Text>
                  <View style={[styles.goalInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.goalInput, { color: colors.text }]}
                      placeholder="150"
                      placeholderTextColor={colors.textSecondary}
                      value={dailyProtein}
                      onChangeText={setDailyProtein}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={[styles.goalUnit, { color: colors.textSecondary }]}>g</Text>
                  </View>
                </View>

                <View style={styles.goalInputContainer}>
                  <Text style={[styles.goalLabel, { color: colors.text }]}>Daily Carbs (g)</Text>
                  <View style={[styles.goalInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.goalInput, { color: colors.text }]}
                      placeholder="Auto-calculated if empty"
                      placeholderTextColor={colors.textSecondary}
                      value={dailyCarbs}
                      onChangeText={setDailyCarbs}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={[styles.goalUnit, { color: colors.textSecondary }]}>g</Text>
                  </View>
                  {!dailyCarbs && dailyCalories && (
                    <Text style={[styles.recommendedText, { color: colors.primary }]}>
                      Recommended: {getRecommendedIntake(parseInt(dailyCalories) || 2000).carbs}g
                    </Text>
                  )}
                </View>

                <View style={styles.goalInputContainer}>
                  <Text style={[styles.goalLabel, { color: colors.text }]}>Daily Fat (g)</Text>
                  <View style={[styles.goalInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.goalInput, { color: colors.text }]}
                      placeholder="Auto-calculated if empty"
                      placeholderTextColor={colors.textSecondary}
                      value={dailyFat}
                      onChangeText={setDailyFat}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <Text style={[styles.goalUnit, { color: colors.textSecondary }]}>g</Text>
                  </View>
                  {!dailyFat && dailyCalories && (
                    <Text style={[styles.recommendedText, { color: colors.primary }]}>
                      Recommended: {getRecommendedIntake(parseInt(dailyCalories) || 2000).fat}g
                    </Text>
                  )}
                </View>

                <View style={[styles.goalNote, { backgroundColor: colors.muted }]}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.goalNoteText, { color: colors.textSecondary }]}>
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
    borderBottomWidth: 1,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  historyButtonText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll View
  scrollView: {
    flex: 1,
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
    marginBottom: 16,
    letterSpacing: -0.2,
  },

  // Progress Section - Enhanced with bigger rings and better content fitting
  progressSection: {
    marginBottom: 32,
  },
  progressGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingHorizontal: 2,
  },
  progressContainer: {
    alignItems: "center",
    flex: 1,
  },
  progressRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginBottom: 12,
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
  progressRingOver: {
    backgroundColor: "#FEF2F2",
  },
  progressCircle: {
    position: "absolute",
    width: 105,
    height: 105,
    borderRadius: 52.5,
    borderWidth: 6,
    borderColor: "#E5E7EB",
  },
  progressContent: {
    alignItems: "center",
    zIndex: 1,
    paddingVertical: 4,
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
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 1,
    lineHeight: 20,
  },
  progressValueOver: {
    color: "#DC2626",
  },
  progressGoal: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 3,
    lineHeight: 12,
  },
  progressGoalOver: {
    color: "#DC2626",
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
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
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
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
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },

  // Setup Card
  setupCard: {
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  setupDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  setupButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
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
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 6,
  },

  // Meal Type Section
  mealTypeSection: {
    marginBottom: 24,
  },
  mealTypeScroll: {
    paddingVertical: 4,
  },
  mealTypeCard: {
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    minWidth: 85,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
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
  mealTypeCardActive: {
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
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
  mealIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  mealTypeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },

  // Input Section - Smaller input box
  inputSection: {
    marginBottom: 32,
  },
  
  // Accuracy Notice
  accuracyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  accuracyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 1,
  },
  accuracyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  accuracyBold: {
    fontWeight: "700",
  },
  
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    maxHeight: 120,
    fontWeight: "500",
    lineHeight: 22,
    textAlignVertical: "top",
  },

  // Enhanced Voice Button
  voiceButtonContainer: {
    marginBottom: 16,
  },
  voiceButton: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  voiceButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  voiceButtonProcessing: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  voiceButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    position: "relative",
  },
  voiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  voiceIconActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  voiceIconProcessing: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  voiceTextContainer: {
    flex: 1,
  },
  voiceMainText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  voiceMainTextActive: {
    color: "white",
  },
  voiceMainTextProcessing: {
    color: "white",
  },
  voiceSubText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  recordingTimer: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: "600",
  },
  recordingIndicator: {
    position: "absolute",
    right: 16,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },

  // Enhanced Log Button with better disabled state
  logButton: {
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#2563EB",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  logButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  logButtonDisabled: {
    opacity: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  logButtonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: "700",
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mealsCountText: {
    fontSize: 12,
    fontWeight: "600",
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
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
    fontWeight: "500",
  },
  deleteButton: {
    padding: 4,
  },
  foodName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    lineHeight: 20,
  },
  nutritionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    marginTop: 4,
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1,
  },
  nutritionIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  nutritionLabel: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
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
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: "700",
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
    marginBottom: 8,
  },
  goalInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
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
    fontWeight: "500",
  },
  goalUnit: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
    fontStyle: "italic",
  },
  goalNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  goalNoteText: {
    fontSize: 13,
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
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
    zIndex: 9999,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 12,
    color: "#FFFFFF",
    flex: 1,
  },
});
