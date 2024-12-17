import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AllergyInput({ allergies, onAdd, onRemove }) {
  const [newAllergy, setNewAllergy] = useState("");

  const handleAdd = () => {
    if (newAllergy.trim()) {
      onAdd(newAllergy.trim());
      setNewAllergy("");
      Keyboard.dismiss();
    }
  };

  const AllergyChip = ({ allergy }) => {
    const scaleAnim = useState(new Animated.Value(0))[0];

    React.useEffect(() => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }, []);

    const handleRemove = () => {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onRemove(allergy));
    };

    return (
      <Animated.View
        style={[styles.chipContainer, { transform: [{ scale: scaleAnim }] }]}
      >
        <View style={styles.chip}>
          <Ionicons name="alert-circle" size={16} color="#008b8b" />
          <Text style={styles.chipText}>{allergy}</Text>
          <TouchableOpacity onPress={handleRemove} style={styles.removeButton}>
            <Ionicons name="close-circle" size={18} color="#008b8b" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newAllergy}
          onChangeText={setNewAllergy}
          placeholder="Add allergy (e.g., peanuts)"
          placeholderTextColor="#a0a0a0"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity
          style={[
            styles.addButton,
            !newAllergy.trim() && styles.addButtonDisabled,
          ]}
          onPress={handleAdd}
          disabled={!newAllergy.trim()}
        >
          <Ionicons
            name="add"
            size={24}
            color={newAllergy.trim() ? "#008b8b" : "#a0a0a0"}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.chipsScrollContainer}>
        <View style={styles.chipsContainer}>
          {allergies.map((allergy, index) => (
            <AllergyChip key={`${allergy}-${index}`} allergy={allergy} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0ffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    color: "#2c3e50",
  },
  addButton: {
    padding: 8,
    borderRadius: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  chipsScrollContainer: {
    marginTop: 8,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipContainer: {
    marginRight: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e6f3f3",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  chipText: {
    color: "#008b8b",
    fontSize: 14,
    fontWeight: "500",
  },
  removeButton: {
    marginLeft: 2,
  },
});
