import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const CategoryButton = ({ title, icon, isSelected, onPress }) => {
  const [scaleValue] = useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View
        style={[
          styles.categoryButton,
          isSelected && styles.selectedButton,
          { transform: [{ scale: scaleValue }] },
        ]}
      >
        <Ionicons
          name={icon}
          size={24}
          color={isSelected ? "#ffffff" : "#008b8b"}
        />
        <Text style={[styles.categoryText, isSelected && styles.selectedText]}>
          {title}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function CategorySelector({ setMealType }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setMealType(category);
  };

  const categories = [
    { id: "breakfast", title: "Breakfast", icon: "sunny-outline" },
    { id: "lunch", title: "Lunch", icon: "restaurant-outline" },
    { id: "dinner", title: "Dinner", icon: "moon-outline" },
  ];

  return (
    <View style={styles.container}>
      {categories.map((category) => (
        <CategoryButton
          key={category.id}
          title={category.title}
          icon={category.icon}
          isSelected={selectedCategory === category.id}
          onPress={() => handleCategorySelect(category.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 1,
    paddingVertical: 5,
  },
  categoryButton: {
    backgroundColor: "#f0ffff",

    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  selectedButton: {
    backgroundColor: "#008b8b",
  },
  categoryText: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#008b8b",
  },
  selectedText: {
    color: "#ffffff",
  },
});
