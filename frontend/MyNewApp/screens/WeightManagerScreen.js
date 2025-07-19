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
  KeyboardAvoidingView,
  Share,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "../services/auth";

const { width, height } = Dimensions.get("window");

export default function WeightManagerScreen({ navigation }) {
  // Core State
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentGoal, setCurrentGoal] = useState(null);
  const [weightEntries, setWeightEntries] = useState([]);
  const [goalHistory, setGoalHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Modal States
  const [showInitialSetup, setShowInitialSetup] = useState(false);
  const [showWeightConfirmation, setShowWeightConfirmation] = useState(false);
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [showLogWeight, setShowLogWeight] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProgressChart, setShowProgressChart] = useState(false);
  const [showGoalComplete, setShowGoalComplete] = useState(false);
  const [showGoalHistory, setShowGoalHistory] = useState(false);
  const [showBMICalculator, setShowBMICalculator] = useState(false);
  const [showCalorieCalculator, setShowCalorieCalculator] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  
  // Form State
  const [goalType, setGoalType] = useState("lose_weight");
  const [targetWeight, setTargetWeight] = useState("");
  const [targetTimeframe, setTargetTimeframe] = useState("12");
  const [initialWeight, setInitialWeight] = useState("");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [initialAge, setInitialAge] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [confirmWeight, setConfirmWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  
  // Settings
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [activityLevel, setActivityLevel] = useState("moderately_active");
  const [gender, setGender] = useState("male");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // Tracking
  const [streak, setStreak] = useState(0);
  const [lastLogDate, setLastLogDate] = useState(null);
  
  // Insights
  const [insights, setInsights] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  
  // Celebration State
  const [celebrationData, setCelebrationData] = useState(null);
  
  // Animations
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  
  // Input refs
  const heightFeetRef = useRef(null);
  const heightInchesRef = useRef(null);
  const ageRef = useRef(null);
  const currentWeightRef = useRef(null);

  // Enhanced color scheme
  const colors = {
    primary: "#3B82F6",
    primaryDark: "#2563EB",
    primaryLight: "#EFF6FF",
    secondary: "#10B981",
    secondaryDark: "#047857",
    secondaryLight: "#D1FAE5",
    accent: "#F59E0B",
    accentLight: "#FEF3C7",
    purple: "#8B5CF6",
    purpleLight: "#F3E8FF",
    pink: "#EC4899",
    pinkLight: "#FCE7F3",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    white: "#FFFFFF",
    gray50: "#F9FAFB",
    gray100: "#F3F4F6",
    gray200: "#E5E7EB",
    gray300: "#D1D5DB",
    gray400: "#9CA3AF",
    gray500: "#6B7280",
    gray600: "#4B5563",
    gray700: "#374151",
    gray800: "#1F2937",
    gray900: "#111827",
    background: "#F9FAFB",
    surface: "#FFFFFF",
    text: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    border: "#E5E7EB",
    divider: "#F3F4F6",
  };

  // Enhanced goal types
  const goalTypes = [
    {
      id: "lose_weight",
      label: "Lose Weight",
      subtitle: "Burn fat & get lean",
      icon: "trending-down-outline",
      color: colors.primary,
      emoji: "📉",
      description: "Create a caloric deficit to lose body fat while preserving muscle"
    },
    {
      id: "maintain_weight",
      label: "Maintain Weight",
      subtitle: "Stay balanced",
      icon: "remove-outline",
      color: colors.secondary,
      emoji: "⚖️",
      description: "Maintain current weight while improving body composition"
    },
    {
      id: "gain_weight",
      label: "Gain Weight",
      subtitle: "Build muscle",
      icon: "trending-up-outline",
      color: colors.accent,
      emoji: "📈",
      description: "Increase muscle mass through strategic caloric surplus"
    },
    {
      id: "body_recomp",
      label: "Body Recomposition",
      subtitle: "Lose fat, gain muscle",
      icon: "fitness-outline",
      color: colors.purple,
      emoji: "💪",
      description: "Simultaneously lose fat and gain muscle through precise nutrition"
    },
  ];

  // Activity levels for calorie calculation
  const activityLevels = [
    { id: "sedentary", label: "Sedentary", multiplier: 1.2, description: "Little to no exercise" },
    { id: "lightly_active", label: "Lightly Active", multiplier: 1.375, description: "Light exercise 1-3 days/week" },
    { id: "moderately_active", label: "Moderately Active", multiplier: 1.55, description: "Moderate exercise 3-5 days/week" },
    { id: "very_active", label: "Very Active", multiplier: 1.725, description: "Hard exercise 6-7 days/week" },
    { id: "extremely_active", label: "Extremely Active", multiplier: 1.9, description: "Very hard exercise, physical job" },
  ];

  // Tab configuration (removed meal planning)
  const tabs = [
    { id: "overview", label: "Overview", icon: "home-outline" },
    { id: "progress", label: "Progress", icon: "analytics-outline" },
    { id: "nutrition", label: "Nutrition", icon: "restaurant-outline" },
    { id: "workouts", label: "Workouts", icon: "fitness-outline" },
    { id: "education", label: "Learn", icon: "library-outline" },
    { id: "tools", label: "Tools", icon: "calculator-outline" },
  ];

  // Enhanced educational content with MORE tips
  const tipsByGoalType = {
    lose_weight: {
      title: "Weight Loss Success Tips",
      tips: [
        "Create a moderate calorie deficit of 500-750 calories per day for 1-1.5 lbs loss per week",
        "Prioritize protein (0.8-1.2g per lb) to preserve muscle mass during weight loss",
        "Include strength training 3-4x per week to maintain lean body mass",
        "Eat plenty of fiber-rich foods (vegetables, fruits, whole grains) for satiety",
        "Stay hydrated - drink water before meals to help control appetite",
        "Get 7-9 hours of quality sleep - poor sleep disrupts hunger hormones",
        "Practice portion control - use smaller plates and measure serving sizes",
        "Eat slowly and mindfully - it takes 20 minutes for satiety signals to register",
        "Plan and prep meals in advance to avoid impulsive food choices",
        "Track your food intake consistently for the first few weeks",
        "Focus on whole, minimally processed foods over packaged items",
        "Include healthy fats (avocado, nuts, olive oil) for hormone production",
        "Time your largest meals earlier in the day when metabolism is higher",
        "Consider intermittent fasting if it fits your lifestyle and preferences",
        "Don't eliminate entire food groups - aim for balance and sustainability",
        "Allow yourself occasional treats to prevent feeling deprived",
        "Increase NEAT (non-exercise activity) - take stairs, park farther, etc.",
        "Monitor progress through measurements and photos, not just the scale",
        "Be patient - healthy weight loss takes time and consistency",
        "Seek support from friends, family, or online communities"
      ]
    },
    gain_weight: {
      title: "Healthy Weight Gain Tips",
      tips: [
        "Aim for a moderate calorie surplus of 300-500 calories above maintenance",
        "Target 1.2-1.6g protein per pound of body weight for muscle building",
        "Focus on compound exercises: squats, deadlifts, bench press, rows",
        "Progressive overload - gradually increase weight, reps, or sets each week",
        "Eat frequent meals throughout the day (5-6 smaller meals vs 3 large)",
        "Include calorie-dense, nutrient-rich foods like nuts, nut butters, avocados",
        "Drink calories - smoothies with protein powder, milk, fruits, oats",
        "Don't fill up on water before meals - drink liquids between meals",
        "Add healthy fats to meals - olive oil, coconut oil, nuts, seeds",
        "Consider creatine supplementation (3-5g daily) for strength gains",
        "Get adequate sleep (7-9 hours) for optimal recovery and growth hormone",
        "Limit cardio to 2-3 sessions per week to preserve calories for growth",
        "Track your workouts and progressively challenge your muscles",
        "Be consistent with training - aim for 3-4 strength sessions per week",
        "Allow 48-72 hours rest between training the same muscle groups",
        "Focus on form over ego - proper technique prevents injury",
        "Eat protein within 2 hours post-workout for optimal muscle synthesis",
        "Include complex carbohydrates to fuel your workouts",
        "Be patient - quality muscle gain takes 6+ months to become noticeable",
        "Consider working with a trainer if you're new to strength training"
      ]
    },
    maintain_weight: {
      title: "Weight Maintenance Strategies",
      tips: [
        "Eat at your maintenance calorie level - track for a few weeks to find your range",
        "Continue strength training to preserve muscle mass and metabolic rate",
        "Weigh yourself weekly and adjust intake if weight trends up or down",
        "Focus on body composition rather than just the scale number",
        "Maintain consistent eating patterns and meal timing",
        "Continue tracking food intake periodically to stay aware",
        "Include variety in your diet to prevent boredom and maintain nutrients",
        "Practice mindful eating and listen to hunger/fullness cues",
        "Stay active with a mix of strength training and cardiovascular exercise",
        "Plan for special occasions and social events without guilt",
        "Keep healthy snacks available for when hunger strikes",
        "Monitor stress levels - chronic stress can affect weight maintenance",
        "Stay hydrated and maintain good sleep hygiene",
        "Build a sustainable routine that fits your lifestyle long-term",
        "Allow for small fluctuations (2-3 lbs) - this is normal",
        "Focus on maintaining healthy habits rather than perfection",
        "Include flexibility in your approach - rigid rules often backfire",
        "Celebrate non-scale victories like energy levels and strength gains",
        "Consider maintenance breaks if you've been dieting for extended periods",
        "Stay connected with supportive communities or accountability partners"
      ]
    },
    body_recomp: {
      title: "Body Recomposition Guide",
      tips: [
        "Eat at maintenance calories or slight deficit while prioritizing protein",
        "Aim for 1.2-1.6g protein per pound to support muscle growth in a deficit",
        "Focus heavily on progressive resistance training 4-5x per week",
        "Be patient - body recomp is slower than pure cutting or bulking",
        "Track body measurements and progress photos over scale weight",
        "Cycle between small deficits and maintenance periods",
        "Prioritize compound movements that work multiple muscle groups",
        "Include adequate carbohydrates around workout times for performance",
        "Get sufficient sleep for recovery and optimal hormone production",
        "Consider nutrient timing - protein and carbs post-workout",
        "Stay consistent for at least 6-12 months to see significant changes",
        "Monitor strength gains as a key indicator of progress",
        "Include deload weeks every 4-6 weeks to manage fatigue",
        "Focus on form and mind-muscle connection during exercises",
        "Consider working with a qualified trainer for program design",
        "Track your workouts to ensure progressive overload",
        "Include mobility and flexibility work to prevent injury",
        "Manage stress levels as cortisol can interfere with body composition",
        "Consider body fat testing methods beyond just visual assessment",
        "Be realistic about timeline - meaningful recomp takes 6+ months"
      ]
    }
  };

  // FIXED: Goal-specific recommendations with realistic protein amounts
  const getGoalSpecificRecommendations = () => {
    if (!currentGoal || !userProfile) {
      return {
        nutrition: [
          "Set a specific goal to receive personalized nutrition recommendations",
          "Focus on eating whole, unprocessed foods",
          "Stay hydrated with 8-10 glasses of water daily"
        ],
        lifestyle: [
          "Establish a consistent sleep schedule of 7-9 hours",
          "Manage stress through meditation or relaxation techniques",
          "Create a structured daily routine"
        ],
        activity: [
          "Include both strength training and cardio in your routine",
          "Aim for at least 150 minutes of moderate activity per week",
          "Take regular breaks from sitting throughout the day"
        ]
      };
    }

    const currentWeightLbs = Math.round(kgToLbs(userProfile.weight));
    const targetWeightLbs = currentGoal.targetWeightLbs;
    const bmr = calculateBMR(userProfile.weight, userProfile.height, userProfile.age, gender);
    const tdee = calculateTDEE(bmr, activityLevel);

    switch (currentGoal.type) {
      case "lose_weight":
        return {
          nutrition: [
            `Target ${Math.round(tdee - 500)} calories daily for 1 lb/week loss`,
            `Eat ${Math.round(currentWeightLbs * 0.8)}g protein daily to preserve muscle`,
            "Fill half your plate with vegetables at each meal",
            "Choose lean proteins: chicken, fish, eggs, tofu, legumes",
            "Include fiber-rich foods to increase satiety",
            "Drink water before meals to help control appetite",
            "Limit liquid calories from sodas, juices, and alcohol",
            "Use smaller plates and bowls to control portions"
          ],
          lifestyle: [
            "Get 7-9 hours of quality sleep to regulate hunger hormones",
            "Manage stress as cortisol can promote fat storage",
            "Eat slowly and chew thoroughly to improve satiety",
            "Plan and prep meals in advance",
            "Keep healthy snacks readily available",
            "Practice mindful eating without distractions",
            "Stay consistent with meal timing",
            "Find non-food ways to cope with emotions"
          ],
          activity: [
            "Include strength training 3-4x per week to preserve muscle",
            "Add 20-30 minutes of cardio 3-4x per week",
            "Increase daily steps to 8,000-10,000",
            "Take stairs instead of elevators when possible",
            "Try HIIT workouts for efficient fat burning",
            "Include active recovery like walking or yoga",
            "Focus on compound movements: squats, deadlifts, pushups",
            "Track workouts to ensure progressive overload"
          ]
        };

      case "gain_weight":
        return {
          nutrition: [
            `Target ${Math.round(tdee + 300)} calories daily for healthy weight gain`,
            `Eat ${Math.round(currentWeightLbs * 0.9)}g protein daily for muscle building`,
            "Include calorie-dense foods: nuts, avocados, olive oil",
            "Eat frequent meals (5-6 smaller meals vs 3 large)",
            "Add healthy fats to every meal",
            "Drink smoothies with protein powder, oats, and fruits",
            "Choose complex carbs: oats, quinoa, sweet potatoes",
            "Don't fill up on water before meals"
          ],
          lifestyle: [
            "Prioritize 8-9 hours of sleep for optimal recovery",
            "Minimize stress which can suppress appetite",
            "Set meal reminders to ensure consistent eating",
            "Prepare calorie-dense snacks in advance",
            "Track your weight and measurements weekly",
            "Be patient - healthy weight gain takes time",
            "Focus on gradual, sustainable changes",
            "Celebrate small victories along the way"
          ],
          activity: [
            "Focus heavily on strength training 4-5x per week",
            "Emphasize compound movements for maximum muscle growth",
            "Progressive overload - increase weight/reps each week",
            "Limit cardio to 2-3 sessions to preserve calories",
            "Allow 48-72 hours rest between training same muscles",
            "Consider creatine supplementation for strength gains",
            "Track all workouts to monitor progress",
            "Work with a trainer if new to strength training"
          ]
        };

      case "maintain_weight":
        return {
          nutrition: [
            `Eat around ${Math.round(tdee)} calories daily for maintenance`,
            `Target ${Math.round(currentWeightLbs * 0.7)}g protein daily`,
            "Focus on nutrient-dense whole foods",
            "Include variety to prevent boredom",
            "Practice portion awareness without strict tracking",
            "Allow flexibility for social events",
            "Maintain consistent meal timing",
            "Listen to hunger and fullness cues"
          ],
          lifestyle: [
            "Maintain consistent sleep and wake times",
            "Develop sustainable daily routines",
            "Practice stress management techniques regularly",
            "Monitor weight weekly, not daily",
            "Focus on non-scale victories",
            "Build supportive social connections",
            "Plan for challenging situations in advance",
            "Celebrate maintaining healthy habits"
          ],
          activity: [
            "Continue strength training 3-4x per week",
            "Include regular cardiovascular exercise",
            "Try new activities to prevent boredom",
            "Focus on functional fitness movements",
            "Include flexibility and mobility work",
            "Stay active throughout the day",
            "Set performance-based goals vs weight goals",
            "Find activities you genuinely enjoy"
          ]
        };

      case "body_recomp":
        return {
          nutrition: [
            `Eat around ${Math.round(tdee)} calories with precise macro tracking`,
            `Prioritize ${Math.round(currentWeightLbs * 1.0)}g protein daily`,
            "Time carbs around workouts for performance",
            "Include healthy fats for hormone production",
            "Track food intake meticulously for first 8 weeks",
            "Consider nutrient timing for optimal results",
            "Cycle between slight deficits and maintenance",
            "Focus on food quality over just quantity"
          ],
          lifestyle: [
            "Prioritize sleep quality for optimal body composition",
            "Manage stress to optimize hormone balance",
            "Be patient - recomp takes 6-12 months minimum",
            "Take progress photos and measurements regularly",
            "Focus on strength gains over scale weight",
            "Stay consistent with your approach",
            "Consider working with professionals",
            "Celebrate small improvements in physique"
          ],
          activity: [
            "Strength training 4-5x per week is essential",
            "Focus on progressive overload consistently",
            "Include both compound and isolation exercises",
            "Limit cardio to maintain muscle mass",
            "Track all workouts meticulously",
            "Include deload weeks every 4-6 weeks",
            "Focus on mind-muscle connection",
            "Consider periodization for optimal results"
          ]
        };

      default:
        return {
          nutrition: ["Focus on balanced, whole food nutrition"],
          lifestyle: ["Maintain healthy daily habits"],
          activity: ["Stay active with regular exercise"]
        };
    }
  };

  // Comprehensive educational content
  const educationalContent = {
    weight_loss: {
      title: "Weight Loss Science",
      icon: "trending-down-outline",
      color: colors.primary,
      sections: [
        {
          title: "Creating a Caloric Deficit",
          content: [
            "Weight loss occurs when you burn more calories than you consume",
            "A deficit of 3,500 calories equals approximately 1 pound of fat loss",
            "Aim for 1-2 pounds per week maximum for sustainable results",
            "Too large a deficit can lead to muscle loss and metabolic slowdown",
            "Track intake and adjust based on weekly weight trends, not daily fluctuations"
          ]
        },
        {
          title: "Preserving Muscle During Weight Loss",
          content: [
            "Include resistance training 3-4 times per week",
            "Consume adequate protein (0.8-1.2g per pound of body weight)",
            "Don't crash diet - moderate deficits preserve more muscle",
            "Get sufficient sleep for recovery and hormone optimization",
            "Consider refeed days or diet breaks for long-term dieting"
          ]
        }
      ]
    },
    nutrition: {
      title: "Nutrition Fundamentals",
      icon: "restaurant-outline",
      color: colors.secondary,
      sections: [
        {
          title: "Macronutrients Explained",
          content: [
            "Protein: 4 calories per gram, builds and repairs tissue",
            "Carbohydrates: 4 calories per gram, primary energy source",
            "Fats: 9 calories per gram, hormone production and vitamin absorption",
            "Aim for balance: 30% protein, 40% carbs, 30% fats as a starting point",
            "Adjust ratios based on activity level and personal preferences"
          ]
        },
        {
          title: "Meal Timing and Frequency",
          content: [
            "Total daily calories matter more than meal timing",
            "Eat when it fits your schedule and preferences",
            "Include protein every 3-4 hours to optimize muscle protein synthesis",
            "Pre-workout: Light carbs for energy",
            "Post-workout: Protein and carbs for recovery"
          ]
        }
      ]
    },
    exercise: {
      title: "Exercise Principles",
      icon: "fitness-outline",
      color: colors.purple,
      sections: [
        {
          title: "Strength Training Basics",
          content: [
            "Focus on compound movements: squats, deadlifts, presses, rows",
            "Progressive overload: gradually increase weight, reps, or sets",
            "Train each muscle group 2-3 times per week",
            "Allow 48-72 hours rest between training the same muscles",
            "Proper form prevents injury and maximizes effectiveness"
          ]
        },
        {
          title: "Cardiovascular Exercise",
          content: [
            "Include both steady-state and high-intensity interval training",
            "Start with 150 minutes of moderate activity per week",
            "Cardio supports heart health and can aid in calorie burn",
            "Don't rely solely on cardio for weight loss",
            "Find activities you enjoy for long-term adherence"
          ]
        }
      ]
    }
  };

  // Utility functions
  const kgToLbs = (kg) => kg * 2.20462;
  const lbsToKg = (lbs) => lbs / 2.20462;
  const feetInchesToCm = (feet, inches) => ((feet * 12) + inches) * 2.54;

  // BMI Calculation
  const calculateBMI = (weightKg, heightCm) => {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  };

  // BMR Calculation (Mifflin-St Jeor Equation)
  const calculateBMR = (weightKg, heightCm, age, gender) => {
    if (gender === "male") {
      return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    } else {
      return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    }
  };

  // TDEE Calculation
  const calculateTDEE = (bmr, activityLevel) => {
    const multiplier = activityLevels.find(level => level.id === activityLevel)?.multiplier || 1.55;
    return bmr * multiplier;
  };

  // Date utilities
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isYesterday = (date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  };

  const daysBetween = (date1, date2) => {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1 - date2) / oneDay));
  };

  // Generate insights based on user data
  const generateInsights = () => {
    const insights = [];
    
    if (weightEntries.length >= 7) {
      const lastWeek = weightEntries.slice(-7);
      const weeklyChange = lastWeek[lastWeek.length - 1].weightLbs - lastWeek[0].weightLbs;
      
      if (Math.abs(weeklyChange) > 2) {
        insights.push({
          type: weeklyChange > 0 ? "warning" : "success",
          title: `${Math.abs(weeklyChange).toFixed(1)} lbs change this week`,
          description: weeklyChange > 0 ?
            "Consider reviewing your caloric intake" :
            "Great progress! Keep up the consistency",
          icon: weeklyChange > 0 ? "trending-up" : "trending-down"
        });
      }
    }

    if (streak >= 7) {
      insights.push({
        type: "success",
        title: `${streak} day tracking streak!`,
        description: "Consistency is key to reaching your goals",
        icon: "flame"
      });
    }

    if (currentGoal && userProfile) {
      const progress = calculateProgress();
      if (progress > 75) {
        insights.push({
          type: "success",
          title: "Almost there!",
          description: `You're ${Math.round(progress)}% of the way to your goal`,
          icon: "trophy"
        });
      }
    }

    return insights;
  };

  // FIXED: Generate personalized recommendations based on goal
  const generateRecommendations = () => {
    const recommendations = [];
    
    // Always show personalized recommendations button
    recommendations.push({
      title: "View Personalized Recommendations",
      description: currentGoal ?
        `Get specific advice for your ${goalTypes.find(g => g.id === currentGoal.type)?.label.toLowerCase()} goal` :
        "Get nutrition, lifestyle, and activity recommendations",
      action: "View Recommendations",
      priority: "high",
      onPress: () => setShowRecommendations(true)
    });

    if (weightEntries.length < 7) {
      recommendations.push({
        title: "Log weight more consistently",
        description: "Daily tracking provides better insights into your progress",
        action: "Set up daily logging",
        priority: "high",
        onPress: () => setShowLogWeight(true)
      });
    }

    if (!currentGoal) {
      recommendations.push({
        title: "Set a specific goal",
        description: "Having a clear target makes success more likely",
        action: "Create your first goal",
        priority: "high",
        onPress: () => setShowGoalSetup(true)
      });
    }

    return recommendations;
  };

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (userProfile && weightEntries.length > 0) {
      setInsights(generateInsights());
      setRecommendations(generateRecommendations());
    }
  }, [weightEntries, streak, currentGoal, userProfile]);

  const initializeApp = async () => {
    setIsLoading(true);
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        const profile = await authService.getUserProfile();
        setUserProfile(profile);
        
        // Load tracking data
        setStreak(profile?.streak || 0);
        setLastLogDate(profile?.lastLogDate ? new Date(profile.lastLogDate) : null);
        setActivityLevel(profile?.activityLevel || "moderately_active");
        setGender(profile?.gender || "male");
        
        if (profile?.goalHistory) {
          setGoalHistory(profile.goalHistory);
        }
        
        if (profile?.currentGoal) {
          setCurrentGoal(profile.currentGoal);
          await loadWeightEntries(profile);
        }
        
        // Check if profile is incomplete
        if (!profile?.weight || !profile?.height || !profile?.age) {
          setShowInitialSetup(true);
        } else if (!profile?.hasConfirmedWeight) {
          // Show weight confirmation if they haven't confirmed recently
          const weightInLbs = Math.round(kgToLbs(profile.weight));
          setConfirmWeight(weightInLbs.toString());
          setShowWeightConfirmation(true);
        }
      }
    } catch (error) {
      console.error("Error initializing app:", error);
      Alert.alert("Error", "Failed to load your data");
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeightEntries = async (profile = userProfile) => {
    try {
      const entries = profile?.weightEntries || [];
      
      if (entries.length === 0 && profile?.weight) {
        const initialEntry = {
          id: Date.now().toString(),
          weight: profile.weight,
          weightLbs: Math.round(kgToLbs(profile.weight)),
          date: new Date().toISOString(),
          bodyFat: null,
          notes: "Initial weight"
        };
        entries.push(initialEntry);
        
        await authService.updateUserProfile({
          weightEntries: entries
        });
      }
      
      const processedEntries = entries.map(entry => ({
        ...entry,
        date: new Date(entry.date)
      }));
      
      setWeightEntries(processedEntries);
      
      if (currentGoal && !currentGoal.completed && processedEntries.length > 0) {
        checkGoalCompletion(processedEntries);
      }
      
    } catch (error) {
      console.error("Error loading weight entries:", error);
      setWeightEntries([]);
    }
  };

  const checkGoalCompletion = (entries) => {
    if (!currentGoal || entries.length === 0 || currentGoal.completed) return;
    
    const latestEntry = entries[entries.length - 1];
    const currentWeight = latestEntry.weight;
    const targetWeight = currentGoal.targetWeight;
    const tolerance = 0.5;
    
    let isCompleted = false;
    
    switch (currentGoal.type) {
      case "lose_weight":
        isCompleted = currentWeight <= targetWeight;
        break;
      case "gain_weight":
        isCompleted = currentWeight >= targetWeight;
        break;
      case "maintain_weight":
        const variance = Math.abs(currentWeight - targetWeight);
        isCompleted = variance <= tolerance;
        break;
      case "body_recomp":
        const timeProgress = (new Date() - new Date(currentGoal.createdAt)) / (1000 * 60 * 60 * 24 * 7);
        isCompleted = timeProgress >= currentGoal.timeframe && Math.abs(currentWeight - currentGoal.startWeight) <= 2;
        break;
    }
    
    if (isCompleted) {
      triggerGoalCompletion(latestEntry);
    }
  };

  const triggerGoalCompletion = (finalEntry) => {
    const completedGoal = {
      ...currentGoal,
      completed: true,
      completedAt: new Date().toISOString(),
      finalWeight: finalEntry.weight,
      finalWeightLbs: finalEntry.weightLbs,
    };
    
    const stats = calculateCompletionStats(completedGoal);
    
    setCelebrationData({
      goal: completedGoal,
      stats,
      shareText: generateShareText(completedGoal, stats)
    });
    
    setShowGoalComplete(true);
    startCelebrationAnimation();
    
    if (Platform.OS === 'ios') {
      Vibration.vibrate([0, 200, 100, 200]);
    }
  };

  const startCelebrationAnimation = () => {
    celebrationScale.setValue(0);
    celebrationOpacity.setValue(0);
    
    Animated.parallel([
      Animated.spring(celebrationScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(celebrationOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const calculateCompletionStats = (completedGoal) => {
    const startDate = new Date(completedGoal.createdAt);
    const endDate = new Date(completedGoal.completedAt);
    const daysElapsed = daysBetween(endDate, startDate);
    const targetDays = completedGoal.timeframe * 7;
    
    const weightChange = Math.abs(completedGoal.startWeight - completedGoal.finalWeight);
    const weightChangeLbs = Math.round(kgToLbs(weightChange) * 10) / 10;
    
    return {
      daysElapsed,
      targetDays,
      weightChange: weightChangeLbs,
      efficiency: daysElapsed <= targetDays ? "Early" : "On Time",
      daysAhead: Math.max(0, targetDays - daysElapsed)
    };
  };

  const generateShareText = (goal, stats) => {
    const goalTypeData = goalTypes.find(g => g.id === goal.type);
    const action = goal.type === "lose_weight" ? "lost" :
                  goal.type === "gain_weight" ? "gained" :
                  goal.type === "body_recomp" ? "transformed my body in" : "maintained";
    
    return `🎉 Goal achieved! I just ${action} ${stats.weightChange} lbs in ${stats.daysElapsed} days! ${goalTypeData.emoji} #WeightGoals #HealthyLiving`;
  };

  const calculateProgress = () => {
    if (!currentGoal || !userProfile?.weight) return 0;
    
    const startWeight = currentGoal.startWeight;
    const targetWeight = currentGoal.targetWeight;
    const currentWeight = userProfile.weight;
    
    if (startWeight === targetWeight) return 100;
    
    const totalChange = Math.abs(targetWeight - startWeight);
    const currentChange = Math.abs(currentWeight - startWeight);
    
    const progress = Math.min((currentChange / totalChange) * 100, 100);
    
    if (currentGoal.type === "maintain_weight") {
      const variance = Math.abs(currentWeight - targetWeight);
      const maxVariance = 2;
      return Math.max(0, ((maxVariance - variance) / maxVariance) * 100);
    }
    
    return Math.max(0, progress);
  };

  const updateStreak = () => {
    const today = new Date();
    
    if (!lastLogDate) {
      setStreak(1);
      setLastLogDate(today);
      return;
    }
    
    if (isToday(lastLogDate)) {
      return;
    }
    
    if (isYesterday(lastLogDate)) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setLastLogDate(today);
    } else {
      setStreak(1);
      setLastLogDate(today);
    }
  };

  const completeInitialSetup = async () => {
    if (!initialWeight || (!heightFeet && !heightInches) || !initialAge) {
      Alert.alert("Missing Information", "Please fill in all fields to continue");
      return;
    }

    try {
      setIsLoading(true);
      
      const heightInCm = feetInchesToCm(
        parseInt(heightFeet) || 0,
        parseInt(heightInches) || 0
      );
      const weightInKg = lbsToKg(parseFloat(initialWeight));
      
      const profileData = {
        weight: weightInKg,
        height: heightInCm,
        age: parseInt(initialAge),
        gender: gender,
        activityLevel: activityLevel,
        streak: 0,
        lastLogDate: null,
        weightEntries: [],
        hasConfirmedWeight: true,
      };
      
      await authService.updateUserProfile(profileData);
      setUserProfile(prev => ({ ...prev, ...profileData }));
      setShowInitialSetup(false);
      
      setTimeout(() => setShowGoalSetup(true), 300);
      
    } catch (error) {
      console.error("Error saving setup:", error);
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmCurrentWeight = async () => {
    if (!confirmWeight || confirmWeight.trim() === "") {
      Alert.alert("Missing Weight", "Please enter your current weight");
      return;
    }

    try {
      setIsLoading(true);
      
      const weightInKg = lbsToKg(parseFloat(confirmWeight));
      const updatedProfile = {
        ...userProfile,
        weight: weightInKg,
        hasConfirmedWeight: true
      };
      
      await authService.updateUserProfile(updatedProfile);
      setUserProfile(updatedProfile);
      
      setShowWeightConfirmation(false);
      
      if (currentGoal) {
        await loadWeightEntries(updatedProfile);
      }
      
    } catch (error) {
      console.error("Error confirming weight:", error);
      Alert.alert("Error", "Failed to update weight");
    } finally {
      setIsLoading(false);
    }
  };

  const setupGoal = async () => {
    if (!targetWeight || !targetTimeframe) {
      Alert.alert("Missing Information", "Please enter target weight and timeframe");
      return;
    }

    const validation = validateGoalInputs(
      userProfile?.weight ? Math.round(kgToLbs(userProfile.weight)) : parseFloat(initialWeight),
      targetWeight,
      goalType
    );
    
    if (!validation.valid) {
      Alert.alert("Invalid Goal", validation.message);
      return;
    }

    try {
      setIsLoading(true);
      
      const weightKg = userProfile?.weight || lbsToKg(parseFloat(initialWeight));
      const targetWeightKg = lbsToKg(parseFloat(targetWeight));
      
      const newGoal = {
        id: Date.now().toString(),
        type: goalType,
        startWeight: weightKg,
        targetWeight: targetWeightKg,
        startWeightLbs: Math.round(kgToLbs(weightKg)),
        targetWeightLbs: parseFloat(targetWeight),
        timeframe: parseInt(targetTimeframe),
        createdAt: new Date().toISOString(),
        expectedCompletionDate: new Date(
          Date.now() + parseInt(targetTimeframe) * 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        completed: false,
      };
      
      await authService.updateUserProfile({ currentGoal: newGoal });
      setCurrentGoal(newGoal);
      setShowGoalSetup(false);
      
      Alert.alert("Goal Set! 🎯", "Your transformation journey begins now!");
      
    } catch (error) {
      console.error("Error setting goal:", error);
      Alert.alert("Error", "Failed to set goal");
    } finally {
      setIsLoading(false);
    }
  };

  const validateGoalInputs = (currentWeightLbs, targetWeightLbs, goalType) => {
    const current = parseFloat(currentWeightLbs);
    const target = parseFloat(targetWeightLbs);
    
    if (isNaN(current) || isNaN(target)) {
      return { valid: false, message: "Please enter valid weight values" };
    }
    
    if (goalType === "lose_weight" && target >= current) {
      return {
        valid: false,
        message: "Target weight must be less than current weight for weight loss goals"
      };
    }
    
    if (goalType === "gain_weight" && target <= current) {
      return {
        valid: false,
        message: "Target weight must be greater than current weight for weight gain goals"
      };
    }
    
    if (goalType === "maintain_weight" && Math.abs(target - current) > 5) {
      return {
        valid: false,
        message: "Target weight should be within 5 lbs of current weight for maintenance goals"
      };
    }
    
    return { valid: true };
  };

  const logWeight = async () => {
    if (!currentWeight || currentWeight.trim() === "") {
      Alert.alert("Missing Weight", "Please enter your current weight");
      return;
    }

    const weightValue = parseFloat(currentWeight);
    if (isNaN(weightValue) || weightValue <= 0 || weightValue > 1000) {
      Alert.alert("Invalid Weight", "Please enter a valid weight between 1 and 1000 lbs");
      return;
    }

    try {
      setIsLoading(true);
      
      const weightKg = lbsToKg(weightValue);
      const currentDate = new Date();
      
      const newEntry = {
        id: Date.now().toString(),
        weight: weightKg,
        weightLbs: weightValue,
        date: currentDate.toISOString(),
        bodyFat: bodyFat && !isNaN(parseFloat(bodyFat)) ? parseFloat(bodyFat) : null,
        notes: ""
      };
      
      const updatedEntries = [...weightEntries, {
        ...newEntry,
        date: currentDate
      }];
      setWeightEntries(updatedEntries);
      
      updateStreak();
      
      const updatedProfile = {
        ...userProfile,
        weight: weightKg,
        weightEntries: updatedEntries.map(entry => ({
          ...entry,
          date: entry.date.toISOString()
        })),
        streak: streak,
        lastLogDate: currentDate.toISOString()
      };
      
      await authService.updateUserProfile(updatedProfile);
      setUserProfile(updatedProfile);
      
      setCurrentWeight("");
      setBodyFat("");
      setShowLogWeight(false);
      
      if (currentGoal && !currentGoal.completed) {
        setTimeout(() => {
          checkGoalCompletion(updatedEntries);
        }, 500);
      }
      
      Alert.alert("Success! 📊", `Weight logged: ${weightValue} lbs`);
      
    } catch (error) {
      console.error("Error logging weight:", error);
      Alert.alert("Error", "Failed to log weight. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const completeGoal = async () => {
    if (!celebrationData) return;
    
    try {
      setIsLoading(true);
      
      const updatedHistory = [...goalHistory, celebrationData.goal];
      setGoalHistory(updatedHistory);
      setCurrentGoal(null);
      
      await authService.updateUserProfile({
        goalHistory: updatedHistory,
        currentGoal: null
      });
      
      setShowGoalComplete(false);
      setCelebrationData(null);
      
    } catch (error) {
      console.error("Error completing goal:", error);
      Alert.alert("Error", "Failed to complete goal");
    } finally {
      setIsLoading(false);
    }
  };

  const shareGoal = async () => {
    if (!celebrationData) return;
    
    try {
      await Share.share({
        message: celebrationData.shareText,
        title: "My Weight Goal Achievement!"
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const startNewGoalFromCelebration = () => {
    setShowGoalComplete(false);
    setCelebrationData(null);
    setShowGoalSetup(true);
  };

  // Component implementations
  const OverviewTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <GoalCard />
      {userProfile && <StatsGrid />}
      {insights.length > 0 && <InsightsSection />}
      {recommendations.length > 0 && <RecommendationsSection />}
      <QuickActionsGrid />
    </ScrollView>
  );

  const ProgressTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {weightEntries.length > 0 ? (
        <>
          <ProgressChart entries={weightEntries} />
          <WeightTrendChart />
          <ProgressStats />
        </>
      ) : (
        <View style={[styles.emptyStateCard, styles.shadowCard]}>
          <Ionicons name="analytics-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
            No Progress Data Yet
          </Text>
          <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>
            Start logging your weight to see detailed progress charts and trends
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowLogWeight(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: colors.white }]}>
              Log Your First Weight
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  const NutritionTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <CalorieCalculatorCard />
      {userProfile && <MacroBreakdownCard />}
      <NutritionTips />
    </ScrollView>
  );

  const WorkoutsTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <WorkoutRecommendations />
      <TrainingPrinciples />
    </ScrollView>
  );

  const EducationTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <EducationCategories />
    </ScrollView>
  );

  const ToolsTab = () => (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <ToolsGrid />
    </ScrollView>
  );

  // Enhanced Components
  const GoalCard = () => {
    if (!currentGoal) {
      return (
        <View style={[styles.goalCard, styles.shadowCard]}>
          <View style={styles.emptyGoalContent}>
            <View style={styles.emptyGoalIcon}>
              <Ionicons name="flag" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyGoalTitle, { color: colors.text }]}>
              Ready to Transform?
            </Text>
            <Text style={[styles.emptyGoalSubtitle, { color: colors.textSecondary }]}>
              Set your personalized weight goal and start tracking your journey
            </Text>
            
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowGoalSetup(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="rocket" size={20} color={colors.white} />
              <Text style={[styles.primaryButtonText, { color: colors.white }]}>
                Start Your Journey
              </Text>
            </TouchableOpacity>
            
            {goalHistory.length > 0 && (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={() => setShowGoalHistory(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="trophy" size={20} color={colors.textSecondary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                  View History ({goalHistory.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    const currentWeightKg = userProfile?.weight || currentGoal.startWeight;
    const currentWeightLbs = Math.round(kgToLbs(currentWeightKg));
    const progress = calculateProgress();
    const goalTypeData = goalTypes.find(g => g.id === currentGoal.type);
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(currentGoal.expectedCompletionDate) - new Date()) / (1000 * 60 * 60 * 24)
    ));

    return (
      <View style={[styles.goalCard, styles.shadowCard]}>
        <View style={[styles.goalHeader, { backgroundColor: goalTypeData.color }]}>
          <View style={styles.goalHeaderContent}>
            <View style={styles.goalTypeContainer}>
              <Text style={styles.goalEmoji}>{goalTypeData.emoji}</Text>
              <View style={styles.goalTypeInfo}>
                <Text style={[styles.goalTypeLabel, { color: colors.white }]}>
                  {goalTypeData.label}
                </Text>
                <Text style={[styles.goalTarget, { color: colors.white }]}>
                  Target: {currentGoal.targetWeightLbs} lbs
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowGoalSetup(true)}
              style={styles.editGoalButton}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressSection}>
          <ProgressRing progress={progress} size={100} />
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>START</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {currentGoal.startWeightLbs}
              </Text>
              <Text style={[styles.statUnit, { color: colors.textMuted }]}>lbs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>CURRENT</Text>
              <Text style={[styles.statValue, { color: goalTypeData.color }]}>
                {currentWeightLbs}
              </Text>
              <Text style={[styles.statUnit, { color: colors.textMuted }]}>lbs</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>GOAL</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {currentGoal.targetWeightLbs}
              </Text>
              <Text style={[styles.statUnit, { color: colors.textMuted }]}>lbs</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickStats}>
          <View style={[styles.quickStat, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>
              {daysLeft}
            </Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>
              days left
            </Text>
          </View>
          
          <View style={[styles.quickStat, { backgroundColor: colors.secondaryLight }]}>
            <Ionicons name="flame-outline" size={18} color={colors.secondary} />
            <Text style={[styles.quickStatValue, { color: colors.text }]}>
              {streak}
            </Text>
            <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>
              day streak
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.quickStat, styles.logWeightButton, { backgroundColor: goalTypeData.color }]}
            onPress={() => setShowLogWeight(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={[styles.quickStatLabel, { color: colors.white, fontWeight: '600' }]}>
              Log Weight
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const StatsGrid = () => {
    if (!userProfile) return null;

    const bmi = calculateBMI(userProfile.weight, userProfile.height);
    const bmr = calculateBMR(userProfile.weight, userProfile.height, userProfile.age, gender);
    const tdee = calculateTDEE(bmr, activityLevel);

    const getBMICategory = (bmi) => {
      if (bmi < 18.5) return { category: "Underweight", color: colors.warning };
      if (bmi < 25) return { category: "Normal", color: colors.success };
      if (bmi < 30) return { category: "Overweight", color: colors.warning };
      return { category: "Obese", color: colors.error };
    };

    const bmiData = getBMICategory(bmi);

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={[styles.statGridCard, styles.shadowCard]}>
            <View style={styles.statHeader}>
              <Ionicons name="fitness-outline" size={20} color={colors.primary} />
              <Text style={[styles.statCardTitle, { color: colors.text }]}>BMI</Text>
            </View>
            <Text style={[styles.statCardValue, { color: colors.text }]}>
              {bmi.toFixed(1)}
            </Text>
            <Text style={[styles.statCardLabel, { color: bmiData.color }]}>
              {bmiData.category}
            </Text>
          </View>

          <View style={[styles.statGridCard, styles.shadowCard]}>
            <View style={styles.statHeader}>
              <Ionicons name="flame-outline" size={20} color={colors.accent} />
              <Text style={[styles.statCardTitle, { color: colors.text }]}>BMR</Text>
            </View>
            <Text style={[styles.statCardValue, { color: colors.text }]}>
              {Math.round(bmr)}
            </Text>
            <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>
              cal/day
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statGridCard, styles.shadowCard]}>
            <View style={styles.statHeader}>
              <Ionicons name="speedometer-outline" size={20} color={colors.secondary} />
              <Text style={[styles.statCardTitle, { color: colors.text }]}>TDEE</Text>
            </View>
            <Text style={[styles.statCardValue, { color: colors.text }]}>
              {Math.round(tdee)}
            </Text>
            <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>
              cal/day
            </Text>
          </View>

          <View style={[styles.statGridCard, styles.shadowCard]}>
            <View style={styles.statHeader}>
              <Ionicons name="trophy-outline" size={20} color={colors.purple} />
              <Text style={[styles.statCardTitle, { color: colors.text }]}>Streak</Text>
            </View>
            <Text style={[styles.statCardValue, { color: colors.text }]}>
              {streak}
            </Text>
            <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>
              days
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const InsightsSection = () => {
    if (insights.length === 0) return null;

    return (
      <View style={[styles.insightsSection, styles.shadowCard]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          📊 Your Insights
        </Text>
        {insights.map((insight, index) => (
          <View key={index} style={[styles.insightCard, {
            backgroundColor: insight.type === 'success' ? colors.secondaryLight :
                           insight.type === 'warning' ? colors.accentLight : colors.primaryLight
          }]}>
            <Ionicons
              name={insight.icon}
              size={20}
              color={insight.type === 'success' ? colors.secondary :
                     insight.type === 'warning' ? colors.accent : colors.primary}
            />
            <View style={styles.insightContent}>
              <Text style={[styles.insightTitle, { color: colors.text }]}>
                {insight.title}
              </Text>
              <Text style={[styles.insightDescription, { color: colors.textSecondary }]}>
                {insight.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // FIXED: RecommendationsSection with working onPress
  const RecommendationsSection = () => {
    if (recommendations.length === 0) return null;

    return (
      <View style={[styles.recommendationsSection, styles.shadowCard]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          💡 Recommendations
        </Text>
        {recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationCard}>
            <View style={styles.recommendationHeader}>
              <Text style={[styles.recommendationTitle, { color: colors.text }]}>
                {rec.title}
              </Text>
              <View style={[styles.priorityBadge, {
                backgroundColor: rec.priority === 'high' ? colors.error :
                               rec.priority === 'medium' ? colors.accent : colors.secondary
              }]}>
                <Text style={[styles.priorityText, { color: colors.white }]}>
                  {rec.priority.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.recommendationDescription, { color: colors.textSecondary }]}>
              {rec.description}
            </Text>
            <TouchableOpacity
              style={[styles.recommendationAction, { borderColor: colors.primary }]}
              onPress={rec.onPress}
              activeOpacity={0.8}
            >
              <Text style={[styles.recommendationActionText, { color: colors.primary }]}>
                {rec.action}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const QuickActionsGrid = () => (
    <View style={styles.quickActionsGrid}>
      <TouchableOpacity
        style={[styles.quickActionCard, { backgroundColor: colors.primary }]}
        onPress={() => setShowLogWeight(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle-outline" size={28} color={colors.white} />
        <Text style={[styles.quickActionText, { color: colors.white }]}>Log Weight</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.quickActionCard, { backgroundColor: colors.secondary }]}
        onPress={() => setShowProgressChart(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="analytics-outline" size={28} color={colors.white} />
        <Text style={[styles.quickActionText, { color: colors.white }]}>View Progress</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.quickActionCard, { backgroundColor: colors.accent }]}
        onPress={() => setShowCalorieCalculator(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="calculator-outline" size={28} color={colors.white} />
        <Text style={[styles.quickActionText, { color: colors.white }]}>Calories</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.quickActionCard, { backgroundColor: colors.purple }]}
        onPress={() => setShowBMICalculator(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="fitness-outline" size={28} color={colors.white} />
        <Text style={[styles.quickActionText, { color: colors.white }]}>BMI Check</Text>
      </TouchableOpacity>
    </View>
  );

  // Enhanced Progress Chart with actual implementation
  const ProgressChart = ({ entries }) => {
    if (!entries || entries.length === 0) {
      return (
        <View style={[styles.chartContainer, styles.shadowCard]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            📈 Weight Progress
          </Text>
          <View style={styles.noDataContainer}>
            <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
              No weight data available yet
            </Text>
            <Text style={[styles.noDataSubtext, { color: colors.textMuted }]}>
              Start logging your weight to see progress
            </Text>
          </View>
        </View>
      );
    }

    const chartWidth = width - 60;
    const chartHeight = 220;
    const padding = 50;
    const graphWidth = chartWidth - (padding * 2);
    const graphHeight = chartHeight - (padding * 2);

    // Calculate weight range for chart scaling
    const weights = entries.map(entry => entry.weightLbs);
    const minWeight = Math.min(...weights) - 2;
    const maxWeight = Math.max(...weights) + 2;
    const weightRange = maxWeight - minWeight || 1;

    // Calculate positions for data points
    const dataPoints = entries.map((entry, index) => {
      const x = padding + (index / Math.max(1, entries.length - 1)) * graphWidth;
      const y = padding + ((maxWeight - entry.weightLbs) / weightRange) * graphHeight;
      return { x, y, entry };
    });

    return (
      <View style={[styles.chartContainer, styles.shadowCard]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>
          📈 Weight Progress ({entries.length} entries)
        </Text>
        
        <View style={[styles.chartWrapper, { width: chartWidth, height: chartHeight }]}>
          {/* Y-axis labels */}
          <View style={styles.yAxisContainer}>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
              {Math.round(maxWeight)}
            </Text>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
              {Math.round((maxWeight + minWeight) / 2)}
            </Text>
            <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
              {Math.round(minWeight)}
            </Text>
          </View>

          {/* Chart area */}
          <View style={[styles.chartArea, { marginLeft: 35 }]}>
            {/* Grid lines */}
            {[0, 1, 2].map(i => (
              <View
                key={i}
                style={[
                  styles.gridLine,
                  {
                    top: padding + (i / 2) * graphHeight,
                    backgroundColor: colors.gray200,
                  }
                ]}
              />
            ))}

            {/* Data points and lines */}
            {dataPoints.map((point, index) => (
              <React.Fragment key={index}>
                {/* Line to next point */}
                {index < dataPoints.length - 1 && (
                  (() => {
                    const nextPoint = dataPoints[index + 1];
                    const deltaX = nextPoint.x - point.x;
                    const deltaY = nextPoint.y - point.y;
                    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
                    
                    return (
                      <View
                        style={[
                          styles.chartLine,
                          {
                            left: point.x - padding,
                            top: point.y,
                            width: length,
                            backgroundColor: colors.primary,
                            transform: [{ rotate: `${angle}deg` }]
                          }
                        ]}
                      />
                    );
                  })()
                )}

                {/* Data point */}
                <View
                  style={[
                    styles.dataPoint,
                    {
                      left: point.x - padding - 4,
                      top: point.y - 4,
                      backgroundColor: colors.primary,
                      borderColor: colors.white,
                    }
                  ]}
                />
              </React.Fragment>
            ))}

            {/* Current weight indicator */}
            {dataPoints.length > 0 && (
              <View
                style={[
                  styles.currentIndicator,
                  {
                    right: 10,
                    top: 10,
                    backgroundColor: colors.primaryLight,
                  }
                ]}
              >
                <Text style={[styles.currentIndicatorText, { color: colors.primary }]}>
                  Current: {dataPoints[dataPoints.length - 1].entry.weightLbs} lbs
                </Text>
              </View>
            )}
          </View>

          {/* X-axis labels */}
          <View style={[styles.xAxisContainer, { marginLeft: 35 }]}>
            {entries.length > 0 && (
              <>
                <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
                  {entries[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                {entries.length > 2 && (
                  <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
                    {entries[Math.floor(entries.length / 2)].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
                <Text style={[styles.axisLabel, { color: colors.textMuted }]}>
                  {entries[entries.length - 1].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Chart Statistics */}
        <View style={styles.chartStats}>
          {entries.length > 1 && (
            <View style={styles.chartStatRow}>
              <View style={styles.chartStat}>
                <Text style={[styles.chartStatLabel, { color: colors.textSecondary }]}>
                  Total Change
                </Text>
                <Text style={[styles.chartStatValue, { color: colors.text }]}>
                  {(entries[entries.length - 1].weightLbs - entries[0].weightLbs).toFixed(1)} lbs
                </Text>
              </View>
              <View style={styles.chartStat}>
                <Text style={[styles.chartStatLabel, { color: colors.textSecondary }]}>
                  Avg Weekly
                </Text>
                <Text style={[styles.chartStatValue, { color: colors.text }]}>
                  {(((entries[entries.length - 1].weightLbs - entries[0].weightLbs) / entries.length) * 7).toFixed(1)} lbs
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  const WeightTrendChart = () => {
    if (weightEntries.length < 7) return null;

    const lastWeek = weightEntries.slice(-7);
    const previousWeek = weightEntries.slice(-14, -7);
    
    const lastWeekChange = lastWeek.length > 1 ?
      lastWeek[lastWeek.length - 1].weightLbs - lastWeek[0].weightLbs : 0;
    const previousWeekChange = previousWeek.length > 1 ?
      previousWeek[previousWeek.length - 1].weightLbs - previousWeek[0].weightLbs : 0;

    return (
      <View style={[styles.trendChart, styles.shadowCard]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>
          📊 Weekly Trends
        </Text>
        <View style={styles.trendGrid}>
          <View style={styles.trendItem}>
            <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>This Week</Text>
            <Text style={[styles.trendValue, {
              color: lastWeekChange < 0 ? colors.success : lastWeekChange > 0 ? colors.error : colors.textSecondary
            }]}>
              {lastWeekChange > 0 ? '+' : ''}{lastWeekChange.toFixed(1)} lbs
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Last Week</Text>
            <Text style={[styles.trendValue, {
              color: previousWeekChange < 0 ? colors.success : previousWeekChange > 0 ? colors.error : colors.textSecondary
            }]}>
              {previousWeekChange > 0 ? '+' : ''}{previousWeekChange.toFixed(1)} lbs
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Total Entries</Text>
            <Text style={[styles.trendValue, { color: colors.primary }]}>
              {weightEntries.length}
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Current Streak</Text>
            <Text style={[styles.trendValue, { color: colors.secondary }]}>
              {streak} days
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const ProgressStats = () => (
    <View style={[styles.progressStatsCard, styles.shadowCard]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        📊 Progress Statistics
      </Text>
      <View style={styles.progressStatsGrid}>
        <View style={styles.progressStatItem}>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>
            Total Entries
          </Text>
          <Text style={[styles.progressStatValue, { color: colors.text }]}>
            {weightEntries.length}
          </Text>
        </View>
        <View style={styles.progressStatItem}>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>
            Best Streak
          </Text>
          <Text style={[styles.progressStatValue, { color: colors.secondary }]}>
            {streak} days
          </Text>
        </View>
        <View style={styles.progressStatItem}>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>
            Goals Completed
          </Text>
          <Text style={[styles.progressStatValue, { color: colors.accent }]}>
            {goalHistory.length}
          </Text>
        </View>
        <View style={styles.progressStatItem}>
          <Text style={[styles.progressStatLabel, { color: colors.textSecondary }]}>
            Days Tracking
          </Text>
          <Text style={[styles.progressStatValue, { color: colors.purple }]}>
            {weightEntries.length > 0 ?
              Math.ceil((new Date() - weightEntries[0].date) / (1000 * 60 * 60 * 24)) : 0}
          </Text>
        </View>
      </View>
    </View>
  );

  const CalorieCalculatorCard = () => (
    <TouchableOpacity
      style={[styles.quickAccessCard, styles.shadowCard]}
      onPress={() => setShowCalorieCalculator(true)}
      activeOpacity={0.8}
    >
      <View style={[styles.quickAccessIcon, { backgroundColor: colors.accentLight }]}>
        <Ionicons name="calculator-outline" size={24} color={colors.accent} />
      </View>
      <View style={styles.quickAccessContent}>
        <Text style={[styles.quickAccessTitle, { color: colors.text }]}>
          Calculate Daily Calories
        </Text>
        <Text style={[styles.quickAccessDescription, { color: colors.textSecondary }]}>
          Find your BMR and TDEE for optimal results
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const MacroBreakdownCard = () => {
    if (!userProfile) return null;

    const currentWeightLbs = Math.round(kgToLbs(userProfile.weight));

    return (
      <View style={[styles.macroCard, styles.shadowCard]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          🥗 Recommended Macros
        </Text>
        <View style={styles.macroBreakdown}>
          <View style={styles.macroItem}>
            <View style={[styles.macroColor, { backgroundColor: colors.primary }]} />
            <Text style={[styles.macroLabel, { color: colors.text }]}>Protein</Text>
            <Text style={[styles.macroValue, { color: colors.textSecondary }]}>
              {Math.round(currentWeightLbs * 0.8)}g
            </Text>
          </View>
          <View style={styles.macroItem}>
            <View style={[styles.macroColor, { backgroundColor: colors.secondary }]} />
            <Text style={[styles.macroLabel, { color: colors.text }]}>Carbs</Text>
            <Text style={[styles.macroValue, { color: colors.textSecondary }]}>
              {Math.round(currentWeightLbs * 1.5)}g
            </Text>
          </View>
          <View style={styles.macroItem}>
            <View style={[styles.macroColor, { backgroundColor: colors.accent }]} />
            <Text style={[styles.macroLabel, { color: colors.text }]}>Fats</Text>
            <Text style={[styles.macroValue, { color: colors.textSecondary }]}>
              {Math.round(currentWeightLbs * 0.4)}g
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const NutritionTips = () => (
    <View style={[styles.nutritionTipsCard, styles.shadowCard]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        💡 Nutrition Tips
      </Text>
      <View style={styles.tipsList}>
        <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
          • Eat protein with every meal to maintain muscle mass
        </Text>
        <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
          • Stay hydrated - aim for half your body weight in ounces
        </Text>
        <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
          • Include fiber-rich foods for better satiety
        </Text>
        <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
          • Time carbs around your workouts for energy
        </Text>
        <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
          • Focus on whole, minimally processed foods
        </Text>
        <Text style={[styles.tipItem, { color: colors.textSecondary }]}>
          • Plan and prep meals in advance for success
        </Text>
      </View>
    </View>
  );

  const WorkoutRecommendations = () => (
    <View style={[styles.workoutCard, styles.shadowCard]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        💪 Workout Recommendations
      </Text>
      <View style={styles.workoutList}>
        <View style={styles.workoutItem}>
          <Text style={[styles.workoutTitle, { color: colors.text }]}>
            Strength Training
          </Text>
          <Text style={[styles.workoutDescription, { color: colors.textSecondary }]}>
            3-4 times per week • Focus on compound movements • Progressive overload
          </Text>
        </View>
        <View style={styles.workoutItem}>
          <Text style={[styles.workoutTitle, { color: colors.text }]}>
            Cardiovascular Exercise
          </Text>
          <Text style={[styles.workoutDescription, { color: colors.textSecondary }]}>
            2-3 times per week • Mix steady-state and HIIT • 150+ minutes moderate intensity
          </Text>
        </View>
        <View style={styles.workoutItem}>
          <Text style={[styles.workoutTitle, { color: colors.text }]}>
            Active Recovery
          </Text>
          <Text style={[styles.workoutDescription, { color: colors.textSecondary }]}>
            Daily walks • Yoga or stretching • Light movement on rest days
          </Text>
        </View>
      </View>
    </View>
  );

  const TrainingPrinciples = () => (
    <View style={[styles.principlesCard, styles.shadowCard]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        🎯 Training Principles
      </Text>
      <View style={styles.principlesList}>
        <Text style={[styles.principleItem, { color: colors.textSecondary }]}>
          • Progressive overload - gradually increase difficulty over time
        </Text>
        <Text style={[styles.principleItem, { color: colors.textSecondary }]}>
          • Consistency beats perfection - aim for 3-4 sessions per week
        </Text>
        <Text style={[styles.principleItem, { color: colors.textSecondary }]}>
          • Focus on compound movements first: squats, deadlifts, presses
        </Text>
        <Text style={[styles.principleItem, { color: colors.textSecondary }]}>
          • Allow adequate recovery - 48-72 hours between training same muscles
        </Text>
        <Text style={[styles.principleItem, { color: colors.textSecondary }]}>
          • Proper form prevents injury and maximizes effectiveness
        </Text>
        <Text style={[styles.principleItem, { color: colors.textSecondary }]}>
          • Track your workouts to ensure you're progressing
        </Text>
      </View>
    </View>
  );

  const EducationCategories = () => (
    <View style={styles.educationContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        📚 Learn & Improve
      </Text>
      {Object.entries(educationalContent).map(([key, category]) => (
        <View key={key} style={[styles.educationCard, styles.shadowCard]}>
          <View style={[styles.educationHeader, { backgroundColor: category.color }]}>
            <Ionicons name={category.icon} size={24} color={colors.white} />
            <Text style={[styles.educationTitle, { color: colors.white }]}>
              {category.title}
            </Text>
          </View>
          <View style={styles.educationContent}>
            {category.sections.map((section, index) => (
              <View key={index} style={styles.educationSection}>
                <Text style={[styles.educationSectionTitle, { color: colors.text }]}>
                  {section.title}
                </Text>
                {section.content.slice(0, 3).map((item, itemIndex) => (
                  <Text key={itemIndex} style={[styles.educationItem, { color: colors.textSecondary }]}>
                    • {item}
                  </Text>
                ))}
                {section.content.length > 3 && (
                  <Text style={[styles.educationMore, { color: colors.primary }]}>
                    +{section.content.length - 3} more tips
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const ToolsGrid = () => (
    <View style={styles.toolsGrid}>
      <TouchableOpacity
        style={[styles.toolCard, styles.shadowCard]}
        onPress={() => setShowBMICalculator(true)}
        activeOpacity={0.8}
      >
        <View style={[styles.toolIcon, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="fitness-outline" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.toolTitle, { color: colors.text }]}>BMI Calculator</Text>
        <Text style={[styles.toolDescription, { color: colors.textSecondary }]}>
          Calculate and understand your Body Mass Index
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolCard, styles.shadowCard]}
        onPress={() => setShowCalorieCalculator(true)}
        activeOpacity={0.8}
      >
        <View style={[styles.toolIcon, { backgroundColor: colors.accentLight }]}>
          <Ionicons name="calculator-outline" size={28} color={colors.accent} />
        </View>
        <Text style={[styles.toolTitle, { color: colors.text }]}>Calorie Calculator</Text>
        <Text style={[styles.toolDescription, { color: colors.textSecondary }]}>
          Find your daily caloric needs and goals
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolCard, styles.shadowCard]}
        onPress={() => setShowGoalHistory(true)}
        activeOpacity={0.8}
      >
        <View style={[styles.toolIcon, { backgroundColor: colors.secondaryLight }]}>
          <Ionicons name="trophy-outline" size={28} color={colors.secondary} />
        </View>
        <Text style={[styles.toolTitle, { color: colors.text }]}>Goal History</Text>
        <Text style={[styles.toolDescription, { color: colors.textSecondary }]}>
          View your completed goals and achievements
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toolCard, styles.shadowCard]}
        onPress={() => setShowSettings(true)}
        activeOpacity={0.8}
      >
        <View style={[styles.toolIcon, { backgroundColor: colors.purpleLight }]}>
          <Ionicons name="settings-outline" size={28} color={colors.purple} />
        </View>
        <Text style={[styles.toolTitle, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.toolDescription, { color: colors.textSecondary }]}>
          Customize your experience and preferences
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Progress Ring Component
  const ProgressRing = ({ progress, size = 120 }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    
    return (
      <View style={[styles.progressContainer, { width: size, height: size }]}>
        <View style={[styles.progressBg, {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.gray200
        }]} />
        <View style={styles.progressContent}>
          <Text style={[styles.progressText, { color: colors.text }]}>
            {Math.round(progress)}%
          </Text>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            Complete
          </Text>
        </View>
      </View>
    );
  };

  // Tab Navigation
  const TabNavigation = () => (
    <View style={[styles.tabNavigation, { backgroundColor: colors.surface }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollContainer}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && { backgroundColor: colors.primaryLight }
            ]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? colors.primary : colors.textMuted}
            />
            <Text style={[
              styles.tabLabel,
              { color: activeTab === tab.id ? colors.primary : colors.textMuted }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <OverviewTab />;
      case "progress":
        return <ProgressTab />;
      case "nutrition":
        return <NutritionTab />;
      case "workouts":
        return <WorkoutsTab />;
      case "education":
        return <EducationTab />;
      case "tools":
        return <ToolsTab />;
      default:
        return <OverviewTab />;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your progress...
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      
      <SafeAreaView style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Weight Manager Pro
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {weightEntries.length} entries • {streak} day streak
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={[styles.headerButton, { backgroundColor: colors.gray100 }]}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <TabNavigation />

      <View style={styles.contentContainer}>
        {renderTabContent()}
      </View>

      {/* Goal Completion Celebration Modal */}
      <Modal visible={showGoalComplete} transparent={true} animationType="none">
        <View style={styles.celebrationOverlay}>
          <Animated.View
            style={[
              styles.celebrationContainer,
              {
                transform: [{ scale: celebrationScale }],
                opacity: celebrationOpacity,
              }
            ]}
          >
            <View style={[styles.celebrationContent, { backgroundColor: colors.surface }]}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <Text style={[styles.celebrationTitle, { color: colors.text }]}>
                Goal Achieved!
              </Text>
              <Text style={[styles.celebrationSubtitle, { color: colors.textSecondary }]}>
                Congratulations! You've reached your target weight.
              </Text>

              {celebrationData && (
                <View style={styles.celebrationStats}>
                  <View style={[styles.celebrationStat, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.celebrationStatValue, { color: colors.primary }]}>
                      {celebrationData.stats.weightChange}
                    </Text>
                    <Text style={[styles.celebrationStatLabel, { color: colors.textSecondary }]}>
                      lbs {celebrationData.goal.type === 'lose_weight' ? 'lost' : 'changed'}
                    </Text>
                  </View>
                  <View style={[styles.celebrationStat, { backgroundColor: colors.secondaryLight }]}>
                    <Text style={[styles.celebrationStatValue, { color: colors.secondary }]}>
                      {celebrationData.stats.daysElapsed}
                    </Text>
                    <Text style={[styles.celebrationStatLabel, { color: colors.textSecondary }]}>
                      days
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.celebrationActions}>
                <TouchableOpacity
                  style={[styles.celebrationButton, { backgroundColor: colors.secondary }]}
                  onPress={shareGoal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-outline" size={18} color={colors.white} />
                  <Text style={[styles.celebrationButtonText, { color: colors.white }]}>
                    Share Achievement
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.celebrationButton, { backgroundColor: colors.primary }]}
                  onPress={startNewGoalFromCelebration}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-outline" size={18} color={colors.white} />
                  <Text style={[styles.celebrationButtonText, { color: colors.white }]}>
                    New Goal
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.completionButton, { backgroundColor: colors.accent }]}
                onPress={completeGoal}
                activeOpacity={0.8}
              >
                <Text style={[styles.completionButtonText, { color: colors.white }]}>
                  Complete & Continue
                </Text>
                <Ionicons name="arrow-forward" size={20} color={colors.white} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Weight Confirmation Modal - FIXED HEADER */}
      <Modal visible={showWeightConfirmation} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Back</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Confirm Weight</Text>
              <TouchableOpacity onPress={confirmCurrentWeight}>
                <Text style={[styles.modalSave, { color: colors.primary }]}>Confirm</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <View style={[styles.weightConfirmCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.confirmTitle, { color: colors.text }]}>
                  Confirm Your Current Weight
                </Text>
                <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
                  This ensures accurate tracking and progress calculation
                </Text>
                
                <View style={styles.weightInputContainer}>
                  <TextInput
                    style={[styles.weightInput, { color: colors.text }]}
                    value={confirmWeight}
                    onChangeText={setConfirmWeight}
                    keyboardType="numeric"
                    placeholder="Enter weight"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={[styles.weightUnit, { color: colors.textSecondary }]}>lbs</Text>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

          {/* Initial Setup Modal - FIXED HEADER */}
          <Modal visible={showInitialSetup} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalFullContainer}>
              <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
              
              {/* Fixed Header */}
              <View style={styles.modalHeaderFixed}>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.modalHeaderButton}
                >
                  <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Setup Profile</Text>
                <TouchableOpacity
                  onPress={completeInitialSetup}
                  style={styles.modalHeaderButton}
                >
                  <Text style={[styles.modalSave, { color: colors.primary }]}>Continue</Text>
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalContentFlex}
              >
                <ScrollView
                  style={styles.modalBodyFlex}
                  contentContainerStyle={styles.modalBodyContent}
                  keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.setupHeader}>
                      <Text style={[styles.setupTitle, { color: colors.text }]}>
                        Let's Set Up Your Profile
                      </Text>
                      <Text style={[styles.setupSubtitle, { color: colors.textSecondary }]}>
                        Just a few details to get started with weight tracking
                      </Text>
                    </View>
                    
                    <View style={styles.setupForm}>
                      <View style={styles.setupInputGroup}>
                        <Text style={[styles.setupLabel, { color: colors.text }]}>
                          Current Weight (lbs)
                        </Text>
                        <TextInput
                          ref={currentWeightRef}
                          style={[styles.setupInput, { backgroundColor: colors.surface }]}
                          placeholder="Enter your current weight"
                          placeholderTextColor={colors.textMuted}
                          value={initialWeight}
                          onChangeText={setInitialWeight}
                          keyboardType="numeric"
                          returnKeyType="next"
                          onSubmitEditing={() => heightFeetRef?.current?.focus()}
                          blurOnSubmit={false}
                        />
                      </View>
                      
                      <View style={styles.setupInputGroup}>
                        <Text style={[styles.setupLabel, { color: colors.text }]}>Height</Text>
                        <View style={styles.heightInputRow}>
                          <TextInput
                            ref={heightFeetRef}
                            style={[styles.setupInput, styles.heightInput, { backgroundColor: colors.surface }]}
                            placeholder="Feet"
                            placeholderTextColor={colors.textMuted}
                            value={heightFeet}
                            onChangeText={setHeightFeet}
                            keyboardType="numeric"
                            returnKeyType="next"
                            maxLength={1}
                            onSubmitEditing={() => heightInchesRef?.current?.focus()}
                            blurOnSubmit={false}
                          />
                          <TextInput
                            ref={heightInchesRef}
                            style={[styles.setupInput, styles.heightInput, { backgroundColor: colors.surface }]}
                            placeholder="Inches"
                            placeholderTextColor={colors.textMuted}
                            value={heightInches}
                            onChangeText={setHeightInches}
                            keyboardType="numeric"
                            returnKeyType="next"
                            maxLength={2}
                            onSubmitEditing={() => ageRef?.current?.focus()}
                            blurOnSubmit={false}
                          />
                        </View>
                      </View>
                      
                      <View style={styles.setupInputGroup}>
                        <Text style={[styles.setupLabel, { color: colors.text }]}>Age</Text>
                        <TextInput
                          ref={ageRef}
                          style={[styles.setupInput, { backgroundColor: colors.surface }]}
                          placeholder="Enter your age"
                          placeholderTextColor={colors.textMuted}
                          value={initialAge}
                          onChangeText={setInitialAge}
                          keyboardType="numeric"
                          returnKeyType="done"
                        />
                      </View>

                      <View style={styles.setupInputGroup}>
                        <Text style={[styles.setupLabel, { color: colors.text }]}>Gender</Text>
                        <View style={styles.genderSelector}>
                          <TouchableOpacity
                            style={[
                              styles.genderOption,
                              gender === 'male' && { backgroundColor: colors.primary }
                            ]}
                            onPress={() => setGender('male')}
                          >
                            <Text style={[
                              styles.genderText,
                              { color: gender === 'male' ? colors.white : colors.text }
                            ]}>
                              Male
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.genderOption,
                              gender === 'female' && { backgroundColor: colors.primary }
                            ]}
                            onPress={() => setGender('female')}
                          >
                            <Text style={[
                              styles.genderText,
                              { color: gender === 'female' ? colors.white : colors.text }
                            ]}>
                              Female
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </ScrollView>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </Modal>

      {/* Enhanced Goal Setup Modal - FIXED HEADER AND KEYBOARD */}
      <Modal visible={showGoalSetup} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowGoalSetup(false)}>
                <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Set Your Goal</Text>
              <TouchableOpacity onPress={setupGoal}>
                <Text style={[styles.modalSave, { color: colors.primary }]}>Create Goal</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.goalSetupHeader}>
                <Text style={[styles.goalSetupTitle, { color: colors.text }]}>
                  🎯 Define Your Transformation
                </Text>
                <Text style={[styles.goalSetupSubtitle, { color: colors.textSecondary }]}>
                  Choose a goal that aligns with your lifestyle and capabilities
                </Text>
              </View>

              <View style={styles.goalTypeSelection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Goal Type
                </Text>
                {goalTypes.map(type => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.goalTypeOptionEnhanced,
                      {
                        backgroundColor: goalType === type.id ? type.color : colors.surface,
                        borderColor: goalType === type.id ? type.color : colors.border
                      }
                    ]}
                    onPress={() => setGoalType(type.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.goalTypeEmoji}>{type.emoji}</Text>
                    <View style={styles.goalTypeTextContainer}>
                      <Text style={[styles.goalTypeText, {
                        color: goalType === type.id ? colors.white : colors.text
                      }]}>
                        {type.label}
                      </Text>
                      <Text style={[styles.goalTypeSubtext, {
                        color: goalType === type.id ? colors.white : colors.textSecondary,
                        opacity: goalType === type.id ? 0.9 : 1
                      }]}>
                        {type.subtitle}
                      </Text>
                      <Text style={[styles.goalTypeDescription, {
                        color: goalType === type.id ? colors.white : colors.textMuted,
                        opacity: goalType === type.id ? 0.8 : 1
                      }]}>
                        {type.description}
                      </Text>
                    </View>
                    {goalType === type.id && (
                      <Ionicons name="checkmark-circle" size={24} color={colors.white} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.goalDetailsSection}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Goal Details
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Target Weight ({weightUnit})
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surface }]}
                    placeholder={`Enter target weight in ${weightUnit}`}
                    placeholderTextColor={colors.textMuted}
                    value={targetWeight}
                    onChangeText={setTargetWeight}
                    keyboardType="numeric"
                  />
                  {userProfile && (
                    <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                      Current: {Math.round(kgToLbs(userProfile.weight))} lbs
                    </Text>
                  )}
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Timeline (weeks)
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.surface }]}
                    placeholder="12"
                    placeholderTextColor={colors.textMuted}
                    value={targetTimeframe}
                    onChangeText={setTargetTimeframe}
                    keyboardType="numeric"
                  />
                  <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                    Recommended: 8-16 weeks for sustainable results
                  </Text>
                </View>

                {targetWeight && targetTimeframe && userProfile && (
                  <View style={[styles.goalPreview, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.goalPreviewTitle, { color: colors.primary }]}>
                      📋 Goal Preview
                    </Text>
                    <Text style={[styles.goalPreviewText, { color: colors.text }]}>
                      Target: {goalType === "lose_weight" ? "Lose" : goalType === "gain_weight" ? "Gain" : "Maintain"} {" "}
                      {Math.abs(parseFloat(targetWeight) - Math.round(kgToLbs(userProfile.weight))).toFixed(1)} lbs
                      in {targetTimeframe} weeks
                    </Text>
                    <Text style={[styles.goalPreviewText, { color: colors.textSecondary }]}>
                      Weekly rate: {(Math.abs(parseFloat(targetWeight) - Math.round(kgToLbs(userProfile.weight))) / parseFloat(targetTimeframe)).toFixed(1)} lbs/week
                    </Text>
                  </View>
                )}
              </View>

              {/* FIXED: Success Tips Button - Now actually works */}
              <TouchableOpacity
                style={[styles.tipsButton, { backgroundColor: colors.accentLight }]}
                onPress={() => setShowTips(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="lightbulb-outline" size={20} color={colors.accent} />
                <Text style={[styles.tipsButtonText, { color: colors.accent }]}>
                  View Success Tips for {goalTypes.find(g => g.id === goalType)?.label}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Enhanced Log Weight Modal */}
      <Modal visible={showLogWeight} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowLogWeight(false)}>
                <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Log Weight Entry</Text>
              <TouchableOpacity onPress={logWeight}>
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={[styles.inputCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.inputCardTitle, { color: colors.text }]}>
                  📊 Record Your Progress
                </Text>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Weight ({weightUnit})</Text>
                  <View style={styles.weightInputContainer}>
                    <TextInput
                      style={[styles.weightInputLarge, { color: colors.text }]}
                      placeholder="Enter weight"
                      placeholderTextColor={colors.textMuted}
                      value={currentWeight}
                      onChangeText={setCurrentWeight}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                    <Text style={[styles.weightUnitLabel, { color: colors.textSecondary }]}>
                      {weightUnit}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Body Fat % (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.gray100, color: colors.text }]}
                    placeholder="15.2"
                    placeholderTextColor={colors.textMuted}
                    value={bodyFat}
                    onChangeText={setBodyFat}
                    keyboardType="numeric"
                    returnKeyType="done"
                  />
                </View>

                <View style={[styles.streakInfo, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="flame" size={16} color={colors.primary} />
                  <Text style={[styles.streakInfoText, { color: colors.primary }]}>
                    Current streak: {streak} days
                  </Text>
                </View>

                <View style={styles.logBenefits}>
                  <Text style={[styles.benefitsTitle, { color: colors.text }]}>
                    💡 Daily logging helps you:
                  </Text>
                  <Text style={[styles.benefitItem, { color: colors.textSecondary }]}>
                    • Track true progress beyond daily fluctuations
                  </Text>
                  <Text style={[styles.benefitItem, { color: colors.textSecondary }]}>
                    • Identify patterns and trends in your journey
                  </Text>
                  <Text style={[styles.benefitItem, { color: colors.textSecondary }]}>
                    • Stay accountable and motivated
                  </Text>
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* NEW: Recommendations Modal - Goal-specific recommendations */}
      <Modal visible={showRecommendations} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRecommendations(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Your Recommendations
            </Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalBody}>
            {(() => {
              const recommendations = getGoalSpecificRecommendations();
              return (
                <View>
                  {currentGoal && (
                    <View style={[styles.recommendationsHeader, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.recommendationsTitle, { color: colors.primary }]}>
                        🎯 {goalTypes.find(g => g.id === currentGoal.type)?.label} Recommendations
                      </Text>
                      <Text style={[styles.recommendationsSubtitle, { color: colors.textSecondary }]}>
                        Personalized advice for your current goal
                      </Text>
                    </View>
                  )}

                  {/* Nutrition Recommendations */}
                  <View style={[styles.recommendationCategory, { backgroundColor: colors.surface }]}>
                    <View style={[styles.categoryHeader, { backgroundColor: colors.secondary }]}>
                      <Ionicons name="restaurant-outline" size={20} color={colors.white} />
                      <Text style={[styles.categoryHeaderTitle, { color: colors.white }]}>
                        Nutrition
                      </Text>
                    </View>
                    <View style={styles.categoryContent}>
                      {recommendations.nutrition.map((tip, index) => (
                        <View key={index} style={styles.recommendationItem}>
                          <View style={[styles.recommendationBullet, { backgroundColor: colors.secondary }]} />
                          <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>
                            {tip}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Lifestyle Recommendations */}
                  <View style={[styles.recommendationCategory, { backgroundColor: colors.surface }]}>
                    <View style={[styles.categoryHeader, { backgroundColor: colors.accent }]}>
                      <Ionicons name="moon-outline" size={20} color={colors.white} />
                      <Text style={[styles.categoryHeaderTitle, { color: colors.white }]}>
                        Lifestyle
                      </Text>
                    </View>
                    <View style={styles.categoryContent}>
                      {recommendations.lifestyle.map((tip, index) => (
                        <View key={index} style={styles.recommendationItem}>
                          <View style={[styles.recommendationBullet, { backgroundColor: colors.accent }]} />
                          <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>
                            {tip}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Activity Recommendations */}
                  <View style={[styles.recommendationCategory, { backgroundColor: colors.surface }]}>
                    <View style={[styles.categoryHeader, { backgroundColor: colors.purple }]}>
                      <Ionicons name="fitness-outline" size={20} color={colors.white} />
                      <Text style={[styles.categoryHeaderTitle, { color: colors.white }]}>
                        Activity & Exercise
                      </Text>
                    </View>
                    <View style={styles.categoryContent}>
                      {recommendations.activity.map((tip, index) => (
                        <View key={index} style={styles.recommendationItem}>
                          <View style={[styles.recommendationBullet, { backgroundColor: colors.purple }]} />
                          <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>
                            {tip}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.recommendationsFooter, { backgroundColor: colors.gray50 }]}>
                    <Text style={[styles.footerText, { color: colors.textMuted }]}>
                      💡 These recommendations are personalized based on your current goal and profile.
                      Consistency is key to achieving your transformation!
                    </Text>
                  </View>
                </View>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Settings Modal - FUNCTIONAL */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Settings</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.settingsCardTitle, { color: colors.text }]}>
                Preferences
              </Text>
              
              <View style={styles.settingGroup}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Weight Unit</Text>
                <View style={[styles.unitSelector, { backgroundColor: colors.gray100 }]}>
                  <TouchableOpacity
                    style={[
                      styles.unitOption,
                      weightUnit === 'lbs' && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => setWeightUnit('lbs')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.unitText,
                      { color: weightUnit === 'lbs' ? colors.white : colors.text }
                    ]}>
                      lbs
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.unitOption,
                      weightUnit === 'kg' && { backgroundColor: colors.primary }
                    ]}
                    onPress={() => setWeightUnit('kg')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.unitText,
                      { color: weightUnit === 'kg' ? colors.white : colors.text }
                    ]}>
                      kg
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingGroup}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Daily Reminders
                    </Text>
                    <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                      Get reminded to log your weight
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggle,
                      { backgroundColor: notificationsEnabled ? colors.primary : colors.gray300 }
                    ]}
                    onPress={() => setNotificationsEnabled(!notificationsEnabled)}
                    activeOpacity={0.8}
                  >
                    <View style={[
                      styles.toggleThumb,
                      { backgroundColor: colors.white },
                      notificationsEnabled && styles.toggleThumbActive
                    ]} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingGroup}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Activity Level</Text>
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Used for calorie calculations
                </Text>
                {activityLevels.map(level => (
                  <TouchableOpacity
                    key={level.id}
                    style={[
                      styles.activityOption,
                      {
                        backgroundColor: activityLevel === level.id ? colors.primaryLight : colors.gray50,
                        borderColor: activityLevel === level.id ? colors.primary : colors.border
                      }
                    ]}
                    onPress={() => setActivityLevel(level.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.activityLabel, {
                      color: activityLevel === level.id ? colors.primary : colors.text
                    }]}>
                      {level.label}
                    </Text>
                    <Text style={[styles.activityDescription, {
                      color: activityLevel === level.id ? colors.primary : colors.textSecondary
                    }]}>
                      {level.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.settingsCardTitle, { color: colors.text }]}>
                Your Stats
              </Text>
              
              <View style={styles.statRow}>
                <Text style={[styles.statRowLabel, { color: colors.textSecondary }]}>Total Entries</Text>
                <Text style={[styles.statRowValue, { color: colors.text }]}>{weightEntries.length}</Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={[styles.statRowLabel, { color: colors.textSecondary }]}>Current Streak</Text>
                <Text style={[styles.statRowValue, { color: colors.primary }]}>{streak} days</Text>
              </View>
              
              <View style={styles.statRow}>
                <Text style={[styles.statRowLabel, { color: colors.textSecondary }]}>Goals Completed</Text>
                <Text style={[styles.statRowValue, { color: colors.secondary }]}>{goalHistory.length}</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Tips Modal - FUNCTIONAL with proper tips */}
      <Modal visible={showTips} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTips(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Success Tips</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalBody}>
            {tipsByGoalType[goalType] && (
              <View style={[styles.tipsCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.tipsCardTitle, { color: colors.text }]}>
                  {tipsByGoalType[goalType].title}
                </Text>
                
                {tipsByGoalType[goalType].tips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <View style={[styles.tipNumber, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.tipNumberText, { color: colors.primary }]}>
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Progress Chart Modal */}
      <Modal visible={showProgressChart} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProgressChart(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Progress Chart</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalBody}>
            <ProgressChart entries={weightEntries} />
            {weightEntries.length >= 7 && <WeightTrendChart />}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* BMI Calculator Modal */}
      <Modal visible={showBMICalculator} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBMICalculator(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>BMI Calculator</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={[styles.calculatorCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.calculatorTitle, { color: colors.text }]}>
                📏 Body Mass Index Calculator
              </Text>
              
              {userProfile && (
                <View style={[styles.currentBMI, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.currentBMITitle, { color: colors.primary }]}>
                    Your Current BMI
                  </Text>
                  <Text style={[styles.currentBMIValue, { color: colors.text }]}>
                    {calculateBMI(userProfile.weight, userProfile.height).toFixed(1)}
                  </Text>
                  <Text style={[styles.currentBMICategory, { color: colors.textSecondary }]}>
                    {(() => {
                      const bmi = calculateBMI(userProfile.weight, userProfile.height);
                      if (bmi < 18.5) return "Underweight";
                      if (bmi < 25) return "Normal Weight";
                      if (bmi < 30) return "Overweight";
                      return "Obese";
                    })()}
                  </Text>
                </View>
              )}

              <View style={styles.bmiRanges}>
                <Text style={[styles.bmiRangesTitle, { color: colors.text }]}>
                  BMI Categories
                </Text>
                <View style={styles.bmiRange}>
                  <View style={[styles.bmiRangeColor, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.bmiRangeText, { color: colors.textSecondary }]}>
                    Under 18.5 - Underweight
                  </Text>
                </View>
                <View style={styles.bmiRange}>
                  <View style={[styles.bmiRangeColor, { backgroundColor: colors.success }]} />
                  <Text style={[styles.bmiRangeText, { color: colors.textSecondary }]}>
                    18.5 - 24.9 - Normal Weight
                  </Text>
                </View>
                <View style={styles.bmiRange}>
                  <View style={[styles.bmiRangeColor, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.bmiRangeText, { color: colors.textSecondary }]}>
                    25.0 - 29.9 - Overweight
                  </Text>
                </View>
                <View style={styles.bmiRange}>
                  <View style={[styles.bmiRangeColor, { backgroundColor: colors.error }]} />
                  <Text style={[styles.bmiRangeText, { color: colors.textSecondary }]}>
                    30.0+ - Obese
                  </Text>
                </View>
              </View>

              <View style={styles.bmiLimitations}>
                <Text style={[styles.bmiLimitationsTitle, { color: colors.text }]}>
                  ⚠️ Important Notes
                </Text>
                <Text style={[styles.bmiLimitationText, { color: colors.textSecondary }]}>
                  • BMI doesn't distinguish between muscle and fat
                </Text>
                <Text style={[styles.bmiLimitationText, { color: colors.textSecondary }]}>
                  • Athletes may have high BMI due to muscle mass
                </Text>
                <Text style={[styles.bmiLimitationText, { color: colors.textSecondary }]}>
                  • Age, gender, and ethnicity can affect interpretation
                </Text>
                <Text style={[styles.bmiLimitationText, { color: colors.textSecondary }]}>
                  • Consider body fat percentage for better accuracy
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Calorie Calculator Modal */}
      <Modal visible={showCalorieCalculator} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCalorieCalculator(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Calorie Calculator</Text>
            <View style={{ width: 60 }} />
          </View>
          
          <ScrollView style={styles.modalBody}>
            <View style={[styles.calculatorCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.calculatorTitle, { color: colors.text }]}>
                🔥 Daily Calorie Needs
              </Text>
              
              {userProfile && (
                <>
                  <View style={styles.calorieResults}>
                    <View style={[styles.calorieCard, { backgroundColor: colors.accentLight }]}>
                      <Text style={[styles.calorieCardTitle, { color: colors.accent }]}>
                        BMR (Basal Metabolic Rate)
                      </Text>
                      <Text style={[styles.calorieCardValue, { color: colors.text }]}>
                        {Math.round(calculateBMR(userProfile.weight, userProfile.height, userProfile.age, gender))} calories
                      </Text>
                      <Text style={[styles.calorieCardDescription, { color: colors.textSecondary }]}>
                        Calories burned at rest
                      </Text>
                    </View>

                    <View style={[styles.calorieCard, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.calorieCardTitle, { color: colors.primary }]}>
                        TDEE (Total Daily Energy)
                      </Text>
                      <Text style={[styles.calorieCardValue, { color: colors.text }]}>
                        {Math.round(calculateTDEE(
                          calculateBMR(userProfile.weight, userProfile.height, userProfile.age, gender),
                          activityLevel
                        ))} calories
                      </Text>
                      <Text style={[styles.calorieCardDescription, { color: colors.textSecondary }]}>
                        Total daily needs ({activityLevels.find(a => a.id === activityLevel)?.label})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.calorieGoals}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Calorie Goals by Objective
                    </Text>
                    
                    <View style={styles.calorieGoalGrid}>
                      <View style={[styles.calorieGoalCard, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.calorieGoalTitle, { color: colors.primary }]}>
                          Lose Weight
                        </Text>
                        <Text style={[styles.calorieGoalValue, { color: colors.text }]}>
                          {Math.round(calculateTDEE(
                            calculateBMR(userProfile.weight, userProfile.height, userProfile.age, gender),
                            activityLevel
                          ) - 500)} cal/day
                        </Text>
                        <Text style={[styles.calorieGoalDescription, { color: colors.textSecondary }]}>
                          1 lb/week loss
                        </Text>
                      </View>

                      <View style={[styles.calorieGoalCard, { backgroundColor: colors.secondaryLight }]}>
                        <Text style={[styles.calorieGoalTitle, { color: colors.secondary }]}>
                          Maintain
                        </Text>
                        <Text style={[styles.calorieGoalValue, { color: colors.text }]}>
                          {Math.round(calculateTDEE(
                            calculateBMR(userProfile.weight, userProfile.height, userProfile.age, gender),
                            activityLevel
                          ))} cal/day
                        </Text>
                        <Text style={[styles.calorieGoalDescription, { color: colors.textSecondary }]}>
                          Current weight
                        </Text>
                      </View>

                      <View style={[styles.calorieGoalCard, { backgroundColor: colors.accentLight }]}>
                        <Text style={[styles.calorieGoalTitle, { color: colors.accent }]}>
                          Gain Weight
                        </Text>
                        <Text style={[styles.calorieGoalValue, { color: colors.text }]}>
                          {Math.round(calculateTDEE(
                            calculateBMR(userProfile.weight, userProfile.height, userProfile.age, gender),
                            activityLevel
                          ) + 300)} cal/day
                        </Text>
                        <Text style={[styles.calorieGoalDescription, { color: colors.textSecondary }]}>
                          0.5 lb/week gain
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Goal History Modal */}
      <Modal visible={showGoalHistory} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowGoalHistory(false)}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Goal History</Text>
            <TouchableOpacity onPress={() => {
              setShowGoalHistory(false);
              setShowGoalSetup(true);
            }}>
              <Text style={[styles.modalSave, { color: colors.primary }]}>New Goal</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalBody}>
            {goalHistory.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryEmoji}>🏆</Text>
                <Text style={[styles.emptyHistoryTitle, { color: colors.text }]}>
                  No completed goals yet
                </Text>
                <Text style={[styles.emptyHistorySubtitle, { color: colors.textSecondary }]}>
                  Complete your first goal to see it here
                </Text>
              </View>
            ) : (
              goalHistory.map((goal, index) => {
                const goalTypeData = goalTypes.find(g => g.id === goal.type);
                return (
                  <View key={index} style={[styles.historyCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.historyContent}>
                      <Text style={styles.historyEmoji}>{goalTypeData.emoji}</Text>
                      <View style={styles.historyInfo}>
                        <Text style={[styles.historySubtitle, { color: colors.textSecondary }]}>
                          {Math.round(kgToLbs(goal.startWeight))} → {goal.targetWeightLbs} lbs
                        </Text>
                        <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                          Completed {new Date(goal.completedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
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
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerButton: {
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
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },

  // Tab Navigation
  tabNavigation: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabScrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    gap: 6,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  contentContainer: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
    paddingBottom: 100,
  },
  
  shadowCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  
  // Goal Card
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  
  emptyGoalContent: {
    padding: 32,
    alignItems: 'center',
  },
  emptyGoalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyGoalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyGoalSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  
  goalHeader: {
    padding: 20,
  },
  goalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  goalEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  goalTypeInfo: {
    flex: 1,
  },
  goalTypeLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  goalTarget: {
    fontSize: 14,
    marginTop: 2,
    opacity: 0.9,
  },
  editGoalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
    position: 'relative',
  },
  progressBg: {
    position: 'absolute',
  },
  progressContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  progressText: {
    fontSize: 20,
    fontWeight: '800',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  statsGrid: {
    flex: 1,
    gap: 16,
  },
  statCard: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 10,
    marginTop: 2,
  },
  
  quickStats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  quickStatValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  logWeightButton: {
    flex: 1.2,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Stats Grid
  statsContainer: {
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statGridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Empty State
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Insights Section
  insightsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    gap: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  insightDescription: {
    fontSize: 12,
    lineHeight: 16,
  },

  // Recommendations Section
  recommendationsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  recommendationCard: {
    marginBottom: 16,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  recommendationDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  recommendationAction: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
  },
  recommendationActionText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    minWidth: (width - 60) / 2,
    maxWidth: (width - 60) / 2,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Chart Components
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  chartWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  yAxisContainer: {
    position: 'absolute',
    left: 0,
    top: 50,
    bottom: 30,
    width: 30,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartArea: {
    position: 'relative',
    height: 220,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },
  chartLine: {
    position: 'absolute',
    height: 2,
    transformOrigin: 'left center',
  },
  dataPoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
  },
  currentIndicator: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currentIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  xAxisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  axisLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  chartStats: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  chartStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  chartStat: {
    alignItems: 'center',
  },
  chartStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  noDataSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Trend Chart
  trendChart: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  trendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  trendItem: {
    flex: 1,
    minWidth: (width - 80) / 2,
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Progress Stats
  progressStatsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  progressStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  progressStatItem: {
    flex: 1,
    minWidth: (width - 80) / 2,
    alignItems: 'center',
  },
  progressStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  progressStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },

  // Quick Access Cards
  quickAccessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickAccessIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessContent: {
    flex: 1,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  quickAccessDescription: {
    fontSize: 12,
    lineHeight: 16,
  },

  // Macro Card
  macroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  macroBreakdown: {
    gap: 12,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  macroColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Nutrition Tips
  nutritionTipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Workout Cards
  workoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  workoutList: {
    gap: 16,
  },
  workoutItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  workoutDescription: {
    fontSize: 13,
    lineHeight: 18,
  },

  principlesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  principlesList: {
    gap: 8,
  },
  principleItem: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Education Components
  educationContainer: {
    gap: 16,
  },
  educationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  educationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  educationTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  educationContent: {
    padding: 16,
    paddingTop: 0,
  },
  educationSection: {
    marginBottom: 16,
  },
  educationSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  educationItem: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  educationMore: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // Tools Grid
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  toolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flex: 1,
    minWidth: (width - 60) / 2,
    maxWidth: (width - 60) / 2,
    alignItems: 'center',
  },
  toolIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  toolDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    marginTop:14,
  },
  modalHeader: {
    flexDirection: 'row',
    marginTop: 9,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },

  // Weight Confirmation
  weightConfirmCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 150,
  },
  weightInput: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  weightUnit: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Setup Modal
  setupHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  setupSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  setupForm: {
    gap: 20,
    marginBottom: 32,
  },
  setupInputGroup: {
    gap: 8,
  },
  setupLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  setupInput: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heightInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heightInput: {
    flex: 1,
  },
  genderSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 3,
  },
  genderOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  genderText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Goal Setup
  goalSetupHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  goalSetupTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  goalSetupSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  goalTypeSelection: {
    marginBottom: 24,
  },
  goalTypeOptionEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    gap: 12,
  },
  goalTypeEmoji: {
    fontSize: 24,
  },
  goalTypeTextContainer: {
    flex: 1,
  },
  goalTypeText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  goalTypeSubtext: {
    fontSize: 12,
    marginBottom: 4,
  },
  goalTypeDescription: {
    fontSize: 11,
    lineHeight: 14,
  },
  goalDetailsSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputHint: {
    fontSize: 11,
    marginTop: 4,
  },
  goalPreview: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  goalPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  goalPreviewText: {
    fontSize: 13,
    marginBottom: 4,
  },
  tipsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  tipsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Enhanced Log Weight Modal
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  inputCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  weightInputLarge: {
    fontSize: 28,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  weightUnitLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 6,
  },
  streakInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logBenefits: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  benefitItem: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },

  // NEW: Recommendations Modal Styles
  recommendationsHeader: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  recommendationsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  recommendationsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  recommendationCategory: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  categoryHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  categoryContent: {
    padding: 16,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  recommendationBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  recommendationText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  recommendationsFooter: {
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // Settings Modal
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  settingsCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  unitSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  unitOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  activityOption: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 11,
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statRowLabel: {
    fontSize: 14,
  },
  statRowValue: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Tips Modal
  tipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  tipsCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  tipNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },

  // Calculator Modals
  calculatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  calculatorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  currentBMI: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  currentBMITitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  currentBMIValue: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  currentBMICategory: {
    fontSize: 14,
    fontWeight: '500',
  },
  bmiRanges: {
    marginBottom: 20,
  },
  bmiRangesTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  bmiRange: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  bmiRangeColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  bmiRangeText: {
    fontSize: 13,
  },
  bmiLimitations: {
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  bmiLimitationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  bmiLimitationText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },

  // Calorie Calculator
  calorieResults: {
    gap: 16,
    marginBottom: 24,
  },
  calorieCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  calorieCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  calorieCardValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  calorieCardDescription: {
    fontSize: 11,
    textAlign: 'center',
  },
  calorieGoals: {
    marginTop: 20,
  },
  calorieGoalGrid: {
    gap: 12,
  },
  calorieGoalCard: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  calorieGoalTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  calorieGoalValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  calorieGoalDescription: {
    fontSize: 10,
  },

  // Celebration Modal
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationContainer: {
    width: width - 40,
    maxWidth: 400,
  },
  celebrationContent: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  celebrationSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  celebrationStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  celebrationStat: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    minWidth: 80,
  },
  celebrationStatValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  celebrationStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  celebrationActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    width: '100%',
  },
  celebrationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  celebrationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  completionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  completionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // History
  emptyHistory: {
    alignItems: 'center',
    padding: 40,
  },
  emptyHistoryEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyHistoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyHistorySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  historyCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  historySubtitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
  },
  modalFullContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF', // colors.surface
  },
  modalHeaderFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 33,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', // colors.border
    backgroundColor: '#FFFFFF', // colors.surface
    minHeight: 60,
    zIndex: 1,
  },
  modalHeaderButton: {
    minWidth: 60,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentFlex: {
    flex: 1,
    backgroundColor: '#F9FAFB', // colors.background
  },
  modalBodyFlex: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
});
