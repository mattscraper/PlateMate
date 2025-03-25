import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SaveFeedback = ({ visible, onAnimationEnd }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible) {
      // Start animation when visible
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after 1.5 seconds
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          if (onAnimationEnd) onAnimationEnd();
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [visible, fadeAnim, scaleAnim, onAnimationEnd]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark" size={32} color="white" />
      </View>
      <Text style={styles.text}>Recipe Saved!</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -100,
    marginTop: -50,
    width: 200,
    height: 100,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#008b8b",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  text: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SaveFeedback;
