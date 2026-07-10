import { Pressable, StyleSheet, Text, View } from "react-native";
import { MoodAxis } from "../api/client";

const MOODS: { id: MoodAxis; label: string; emoji: string }[] = [
  { id: "chill", label: "Chill", emoji: "🌿" },
  { id: "foodie", label: "Foodie", emoji: "🍜" },
  { id: "romantic", label: "Date", emoji: "✨" },
  { id: "social", label: "Social", emoji: "🎉" },
  { id: "cultural", label: "Culture", emoji: "🏛️" },
  { id: "adventurous", label: "Explore", emoji: "🥾" },
  { id: "energetic", label: "Energy", emoji: "⚡" },
  { id: "budget", label: "Budget", emoji: "💸" },
];

type Props = {
  value: MoodAxis;
  onChange: (mood: MoodAxis) => void;
};

export function MoodPicker({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      {MOODS.map((mood) => {
        const active = mood.id === value;
        return (
          <Pressable
            key={mood.id}
            onPress={() => onChange(mood.id)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{mood.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipActive: {
    borderColor: "#2dd4bf",
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    shadowColor: "#2dd4bf",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  emoji: { fontSize: 14 },
  label: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  labelActive: { color: "#2dd4bf", fontWeight: "700" },
});

