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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipActive: { borderColor: "#2dd4bf", backgroundColor: "#134e4a" },
  emoji: { fontSize: 14 },
  label: { color: "#94a3b8", fontWeight: "600", fontSize: 13 },
  labelActive: { color: "#f0fdfa" },
});
