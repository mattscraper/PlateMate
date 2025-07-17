import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "recharts";
import { authService } from "../services/auth";

const { width, height } = Dimensions.get("window");

export default function WeightManagerScreen({ navigation }) {
  // Core State
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [weightGoal, setWeightGoal] = useState(null);
  const [weightEntries, setWeightEntries] = useState([]);
  const [currentWeight, setCurrentWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [waistMeasurement, setWaistMeasurement] = useState("");
  
  // Modal States
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [showLogWeight, setShowLogWeight] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  
  // Goal Setup State
  const [goalType, setGoalType] = useState("lose_weight");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetTimeframe, setTargetTimeframe] = useState("12");
  const [gender, setGender] = useState("male");
  
  // Settings State
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyReminders, setWeeklyReminders] = useState(true);
  
  // Progress Animations
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Color Scheme
  const colors = {
    primary: "#2563EB",
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
  };

  // Goal Types
  const goalTypes = [
    { id: "lose_weight", label: "Lose Weight", icon: "trending-down", color: colors.primary },
    { id: "maintain_weight", label: "Maintain Weight", icon: "remove", color: colors.secondary },
    { id: "gain_weight", label: "Gain Weight", icon: "trending-up", color: colors.purple },
  ];

  useEffect(() => {
    initializeWeightManager();
  }, []);

  const initializeWeightManager = async () => {
    setIsLoading(true);
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        await loadWeightData(currentUser.uid);
      }
    } catch (error) {
      console.error("Error initializing weight manager:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeightData = async (userId) => {
    try {
      // Load weight goal and entries from your backend
      // This would be implemented in your weightService
      console.log("Loading weight data for user:", userId);
      
      // Mock data for demonstration
      const mockGoal = {
        type: "lose_weight",
        startWeight: 180,
        targetWeight: 160,
        timeframe: 12,
        dailyCalories: 1850,
        protein: 120,
        carbs: 180,
        fat: 60,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };
      
      const mockEntries = generateMockWeightEntries(mockGoal.startWeight, 30);
      
      setWeightGoal(mockGoal);
      setWeightEntries(mockEntries);
    } catch (error) {
      console.error("Error loading weight data:", error);
    }
  };

  const generateMockWeightEntries = (startWeight, days) => {
    const entries = [];
    let currentWeight = startWeight;
    
    for (let i = 0; i < days; i++) {
      // Simulate realistic weight loss with some fluctuation
      const change = (Math.random() - 0.6) * 0.8; // Slight downward trend
      currentWeight = Math.max(currentWeight + change, startWeight - 20);
      
      entries.push({
        id: i,
        weight: Math.round(currentWeight * 10) / 10,
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000),
        bodyFat: Math.round((25 - (startWeight - currentWeight) * 0.3) * 10) / 10,
      });
    }
    
    return entries;
  };

  const calculateBMR = (weight, height, age, gender) => {
    // Mifflin-St Jeor Equation
    const weightKg = weightUnit === "lbs" ? weight * 0.453592 : weight;
    const heightCm = height; // Assuming stored in cm
    
    if (gender === "male") {
      return (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      return (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
  };

  const calculateTDEE = (bmr, activityLevel) => {
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      very: 1.725,
    };
    return bmr * (multipliers[activityLevel] || 1.55);
  };

  const calculateProgress = () => {
    if (!weightGoal || weightEntries.length === 0) return 0;
    
    const startWeight = weightGoal.startWeight;
    const targetWeight = weightGoal.targetWeight;
    const currentWeight = weightEntries[weightEntries.length - 1]?.weight || startWeight;
    
    const totalChange = Math.abs(targetWeight - startWeight);
    const currentChange = Math.abs(currentWeight - startWeight);
    
    return Math.min((currentChange / totalChange) * 100, 100);
  };

  const getWeeklyChange = () => {
    if (weightEntries.length < 7) return 0;
    
    const currentWeight = weightEntries[weightEntries.length - 1]?.weight;
    const weekAgoWeight = weightEntries[weightEntries.length - 7]?.weight;
    
    return currentWeight - weekAgoWeight;
  };

  const getEstimatedTimeToGoal = () => {
    if (!weightGoal || weightEntries.length < 7) return null;
    
    const weeklyChange = Math.abs(getWeeklyChange());
    const remainingWeight = Math.abs(weightEntries[weightEntries.length - 1]?.weight - weightGoal.targetWeight);
    
    if (weeklyChange === 0) return null;
    
    return Math.ceil(remainingWeight / weeklyChange);
  };

  const logWeight = async () => {
    if (!currentWeight) {
      Alert.alert("Error", "Please enter your current weight");
      return;
    }

    try {
      setIsLoading(true);
      
      const newEntry = {
        id: weightEntries.length,
        weight: parseFloat(currentWeight),
        date: new Date(),
        bodyFat: bodyFat ? parseFloat(bodyFat) : null,
        waistMeasurement: waistMeasurement ? parseFloat(waistMeasurement) : null,
      };
      
      setWeightEntries([...weightEntries, newEntry]);
      setCurrentWeight("");
      setBodyFat("");
      setWaistMeasurement("");
      setShowLogWeight(false);
      
      // Animate progress update
      Animated.spring(progressAnim, {
        toValue: calculateProgress(),
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }).start();
      
      Alert.alert("Success", "Weight logged successfully!");
    } catch (error) {
      console.error("Error logging weight:", error);
      Alert.alert("Error", "Failed to log weight");
    } finally {
      setIsLoading(false);
    }
  };

  const setupGoal = async () => {
    if (!targetWeight) {
      Alert.alert("Error", "Please enter your target weight");
      return;
    }

    try {
      setIsLoading(true);
      
      // Get user profile for calculations
      const profile = await authService.getUserProfile();
      if (!profile) {
        Alert.alert("Error", "Please complete your profile first");
        return;
      }

      const bmr = calculateBMR(
        weightEntries[weightEntries.length - 1]?.weight || profile.weight,
        profile.height,
        profile.age,
        gender
      );
      
      const tdee = calculateTDEE(bmr, profile.activityLevel || "moderate");
      
      // Calculate calorie adjustment based on goal
      let calorieAdjustment = 0;
      if (goalType === "lose_weight") {
        calorieAdjustment = -500; // 1 lb per week
      } else if (goalType === "gain_weight") {
        calorieAdjustment = 500;
      }
      
      const dailyCalories = Math.max(1200, tdee + calorieAdjustment);
      const protein = Math.round((profile.weight || 70) * 1.6); // 1.6g per kg
      const fat = Math.round(dailyCalories * 0.25 / 9);
      const carbs = Math.round((dailyCalories - (protein * 4) - (fat * 9)) / 4);
      
      const newGoal = {
        type: goalType,
        startWeight: weightEntries[weightEntries.length - 1]?.weight || profile.weight,
        targetWeight: parseFloat(targetWeight),
        timeframe: parseInt(targetTimeframe),
        dailyCalories,
        protein,
        carbs,
        fat,
        createdAt: new Date(),
      };
      
      setWeightGoal(newGoal);
      setShowGoalSetup(false);
      
      Alert.alert("Success", "Weight goal set successfully!");
    } catch (error) {
      console.error("Error setting goal:", error);
      Alert.alert("Error", "Failed to set goal");
    } finally {
      setIsLoading(false);
    }
  };

  // Progress Ring Component
  const ProgressRing = ({ progress, size = 120, strokeWidth = 8 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <View style={[styles.progressRing, { width: size, height: size }]}>
        <View style={styles.progressRingInner}>
          <Text style={styles.progressPercentage}>{Math.round(progress)}%</Text>
          <Text style={styles.progressLabel}>Complete</Text>
        </View>
      </View>
    );
  };

  // Goal Card Component
  const GoalCard = () => {
    if (!weightGoal) {
      return (
        <View style={[styles.goalCard, { backgroundColor: colors.surface }]}>
          <View style={styles.goalCardContent}>
            <Ionicons name="target" size={48} color={colors.primary} />
            <Text style={[styles.goalCardTitle, { color: colors.text }]}>
              Set Your Weight Goal
            </Text>
            <Text style={[styles.goalCardSubtitle, { color: colors.textSecondary }]}>
              Get personalized targets and track your progress
            </Text>
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowGoalSetup(true)}
            >
              <Ionicons name="add" size={20} color={colors.surface} />
              <Text style={[styles.setupButtonText, { color: colors.surface }]}>
                Set Goal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const currentWeight = weightEntries[weightEntries.length - 1]?.weight || weightGoal.startWeight;
    const progress = calculateProgress();
    const goalTypeData = goalTypes.find(g => g.id === weightGoal.type);

    return (
      <View style={[styles.goalCard, { backgroundColor: colors.surface }]}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTypeInfo}>
            <View style={[styles.goalTypeIcon, { backgroundColor: goalTypeData.color + '20' }]}>
              <Ionicons name={goalTypeData.icon} size={24} color={goalTypeData.color} />
            </View>
            <View>
              <Text style={[styles.goalType, { color: colors.text }]}>
                {goalTypeData.label}
              </Text>
              <Text style={[styles.goalTarget, { color: colors.textSecondary }]}>
                Target: {weightGoal.targetWeight} {weightUnit}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowGoalSetup(true)}
            style={styles.editGoalButton}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.goalProgress}>
          <ProgressRing progress={progress} />
          <View style={styles.goalStats}>
            <View style={styles.goalStat}>
              <Text style={[styles.goalStatValue, { color: colors.text }]}>
                {weightGoal.startWeight}
              </Text>
              <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>
                Start
              </Text>
            </View>
            <View style={styles.goalStat}>
              <Text style={[styles.goalStatValue, { color: colors.primary }]}>
                {currentWeight}
              </Text>
              <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>
                Current
              </Text>
            </View>
            <View style={styles.goalStat}>
              <Text style={[styles.goalStatValue, { color: colors.text }]}>
                {weightGoal.targetWeight}
              </Text>
              <Text style={[styles.goalStatLabel, { color: colors.textSecondary }]}>
                Goal
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.goalMetrics}>
          <View style={[styles.metricCard, { backgroundColor: colors.muted }]}>
            <Ionicons name="calendar" size={16} color={colors.primary} />
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {getEstimatedTimeToGoal() || "--"} weeks
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              To Goal
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.muted }]}>
            <Ionicons name="trending-down" size={16} color={colors.secondary} />
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {Math.abs(getWeeklyChange()).toFixed(1)} {weightUnit}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              This Week
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.muted }]}>
            <Ionicons name="flame" size={16} color={colors.accent} />
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {weightGoal.dailyCalories}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              Cal/Day
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Weight Chart Component
  const WeightChart = () => {
    if (weightEntries.length === 0) return null;

    const chartData = weightEntries.slice(-30).map(entry => ({
      date: entry.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: entry.weight,
      goal: weightGoal?.targetWeight || entry.weight,
    }));

    return (
      <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Weight Progress
          </Text>
          <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
            Last 30 days
          </Text>
        </View>
        
        <View style={styles.chartWrapper}>
          <LineChart
            width={width - 60}
            height={200}
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            {/* Chart implementation would go here */}
          </LineChart>
        </View>
      </View>
    );
  };

  // Weekly Summary Component
  const WeeklySummary = () => {
    const weeklyChange = getWeeklyChange();
    const isPositive = weeklyChange > 0;
    const isGoalLoss = weightGoal?.type === "lose_weight";
    const isOnTrack = (isGoalLoss && weeklyChange < 0) || (!isGoalLoss && weeklyChange > 0);

    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
        <View style={styles.summaryHeader}>
          <Ionicons name="calendar" size={24} color={colors.primary} />
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            This Week's Progress
          </Text>
        </View>
        
        <View style={styles.summaryContent}>
          <View style={styles.summaryMetric}>
            <Text style={[styles.summaryValue, {
              color: isOnTrack ? colors.success : colors.warning
            }]}>
              {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(1)} {weightUnit}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              Weight Change
            </Text>
          </View>
          
          <View style={styles.summaryMessage}>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              {isOnTrack
                ? "Great job! You're on track with your goal."
                : "No worries - progress isn't always linear."
              }
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Action Buttons
  const ActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowLogWeight(true)}
      >
        <Ionicons name="add" size={20} color={colors.surface} />
        <Text style={[styles.actionButtonText, { color: colors.surface }]}>
          Log Weight
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.secondary }]}
        onPress={() => setShowWeeklySummary(true)}
      >
        <Ionicons name="analytics" size={20} color={colors.surface} />
        <Text style={[styles.actionButtonText, { color: colors.surface }]}>
          Weekly Report
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your weight data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.muted }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Weight Manager
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Track your progress
          </Text>
        </View>
        
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={[styles.settingsButton, { backgroundColor: colors.muted }]}
        >
          <Ionicons name="settings" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GoalCard />
        
        {weightGoal && (
          <>
            <WeightChart />
            <WeeklySummary />
            <ActionButtons />
          </>
        )}
      </ScrollView>

      {/* Goal Setup Modal */}
      <Modal
        visible={showGoalSetup}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGoalSetup(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => setShowGoalSetup(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Weight Goal</Text>
            <TouchableOpacity onPress={setupGoal}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Goal Type Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Goal Type</Text>
              <View style={styles.goalTypeOptions}>
                {goalTypes.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.goalTypeOption,
                      goalType === type.id && [styles.goalTypeOptionActive, { borderColor: type.color }]
                    ]}
                    onPress={() => setGoalType(type.id)}
                  >
                    <Ionicons name={type.icon} size={24} color={type.color} />
                    <Text style={[styles.goalTypeLabel, { color: colors.text }]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Target Weight */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Target Weight</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder={`Enter target weight (${weightUnit})`}
                  placeholderTextColor={colors.textSecondary}
                  value={targetWeight}
                  onChangeText={setTargetWeight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Timeframe */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Timeframe (weeks)</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="12"
                  placeholderTextColor={colors.textSecondary}
                  value={targetTimeframe}
                  onChangeText={setTargetTimeframe}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Gender */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Gender</Text>
              <View style={styles.genderOptions}>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'male' && styles.genderOptionActive
                  ]}
                  onPress={() => setGender('male')}
                >
                  <Text style={[
                    styles.genderLabel,
                    { color: gender === 'male' ? colors.surface : colors.text }
                  ]}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'female' && styles.genderOptionActive
                  ]}
                  onPress={() => setGender('female')}
                >
                  <Text style={[
                    styles.genderLabel,
                    { color: gender === 'female' ? colors.surface : colors.text }
                  ]}>
                    Female
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Log Weight Modal */}
      <Modal
        visible={showLogWeight}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLogWeight(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => setShowLogWeight(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Log Weight</Text>
            <TouchableOpacity onPress={logWeight}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Current Weight */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Current Weight ({weightUnit})
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Enter weight"
                  placeholderTextColor={colors.textSecondary}
                  value={currentWeight}
                  onChangeText={setCurrentWeight}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Body Fat % (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Body Fat % (Optional)
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Enter body fat percentage"
                  placeholderTextColor={colors.textSecondary}
                  value={bodyFat}
                  onChangeText={setBodyFat}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Waist Measurement (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Waist Measurement (Optional)
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface }]}>
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Enter waist measurement"
                  placeholderTextColor={colors.textSecondary}
                  value={waistMeasurement}
                  onChangeText={setWaistMeasurement}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={[styles.modalCancel, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Settings</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            {/* Weight Unit */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Weight Unit</Text>
              <View style={styles.unitSelector}>
                <TouchableOpacity
                  style={[
                    styles.unitOption,
                    weightUnit === 'lbs' && styles.unitOptionActive
                  ]}
                  onPress={() => setWeightUnit('lbs')}
                >
                  <Text style={[
                    styles.unitText,
                    { color: weightUnit === 'lbs' ? colors.surface : colors.text }
                  ]}>
                    lbs
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitOption,
                    weightUnit === 'kg' && styles.unitOptionActive
                  ]}
                  onPress={() => setWeightUnit('kg')}
                >
                  <Text style={[
                    styles.unitText,
                    { color: weightUnit === 'kg' ? colors.surface : colors.text }
                  ]}>
                    kg
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications */}
            <View style={styles.settingGroup}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Notifications
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    notificationsEnabled && styles.toggleActive
                  ]}
                  onPress={() => setNotificationsEnabled(!notificationsEnabled)}
                >
                  <View style={[
                    styles.toggleThumb,
                    notificationsEnabled && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekly Reminders */}
            <View style={styles.settingGroup}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Weekly Reminders
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    weeklyReminders && styles.toggleActive
                  ]}
                  onPress={() => setWeeklyReminders(!weeklyReminders)}
                >
                  <View style={[
                    styles.toggleThumb,
                    weeklyReminders && styles.toggleThumbActive
                  ]} />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  
  // Goal Card
  goalCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  goalCardContent: {
    alignItems: 'center',
  },
  goalCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  goalCardSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  goalTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  goalType: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalTarget: {
    fontSize: 14,
    marginTop: 2,
  },
  editGoalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressRing: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
  },
  progressRingInner: {
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB',
  },
  progressLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  goalStats: {
    flex: 1,
  },
  goalStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalStatLabel: {
    fontSize: 14,
  },
  goalMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 4,
  },

  // Chart
  chartContainer: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  chartHeader: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  chartSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  chartWrapper: {
    alignItems: 'center',
  },

  // Weekly Summary
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  summaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryMetric: {
    alignItems: 'center',
    marginRight: 24,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  summaryMessage: {
    flex: 1,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 22,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 6,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCancel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textInput: {
    padding: 16,
    fontSize: 16,
  },
  goalTypeOptions: {
    gap: 12,
  },
  goalTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  goalTypeOptionActive: {
    borderWidth: 2,
    backgroundColor: '#F8FAFC',
  },
  goalTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  genderOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  genderLabel: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Settings
  settingGroup: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    marginTop: 12,
  },
  unitOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  unitOptionActive: {
    backgroundColor: '#2563EB',
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#2563EB',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
});
