import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Supported Cities and Metadata matching the Web Onboarding
const CITIES = ["Pune", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolhapur", "Nashik"] as const;

const CITY_META: Record<(typeof CITIES)[number], { emoji: string; tagline: string }> = {
  Delhi: { emoji: "🏛", tagline: "History, food & nightlife" },
  Mumbai: { emoji: "🌊", tagline: "The city that never sleeps" },
  Bangalore: { emoji: "🌿", tagline: "Breweries & startup vibes" },
  Pune: { emoji: "🎓", tagline: "Cafes, culture & chill" },
  Chennai: { emoji: "🎭", tagline: "Filter coffee & beaches" },
  Nashik: { emoji: "🍇", tagline: "Vineyards & ghats" },
  Kolhapur: { emoji: "🌶", tagline: "Spice & heritage" },
};

// Interests matching the Web Onboarding
const INTERESTS = [
  { id: "cafe", label: "Cafes", emoji: "☕", desc: "Coffee & work" },
  { id: "restaurant", label: "Dining", emoji: "🍽", desc: "Fine restaurants" },
  { id: "street-food", label: "Street Food", emoji: "🍢", desc: "Chaat & tapris" },
  { id: "nightlife", label: "Nightlife", emoji: "🌙", desc: "Late-night spots" },
  { id: "bar", label: "Bars", emoji: "🍺", desc: "Pubs & craft beer" },
  { id: "event", label: "Events", emoji: "🎉", desc: "Live shows" },
  { id: "heritage", label: "Heritage", emoji: "🏯", desc: "History & culture" },
  { id: "hidden-gems", label: "Hidden Gems", emoji: "💎", desc: "Local secrets" },
] as const;

interface OnboardingModalProps {
  visible: boolean;
  onComplete: (city: (typeof CITIES)[number], interests: string[]) => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<"city" | "interests">("city");
  const [selectedCity, setSelectedCity] = useState<(typeof CITIES)[number] | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (selectedCity) {
      setStep("interests");
    }
  };

  const handleFinish = () => {
    if (selectedCity) {
      onComplete(selectedCity, Array.from(selectedInterests));
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        {/* Decorative elements */}
        <View style={styles.glowCircle} />

        {/* Top Header Card */}
        <View style={styles.header}>
          <View style={styles.iconBg}>
            <Ionicons name="sparkles" size={28} color="#020617" />
          </View>
          <Text style={styles.eyebrow}>Welcome to Sheher</Text>
          <Text style={styles.title}>
            {step === "city" ? "Which city are you in?" : "What are you into?"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "city"
              ? "We'll personalise your feed and show the best spots near you."
              : "Pick your interests — your home feed will match your vibe."}
          </Text>
        </View>

        {/* Step Indicator */}
        <View style={styles.indicatorRow}>
          <View style={[styles.indicatorLine, styles.indicatorLineActive]} />
          <View style={[styles.indicatorLine, step === "interests" && styles.indicatorLineActive]} />
        </View>

        {step === "city" ? (
          /* CITY SELECTION STEP */
          <View style={styles.stepContainer}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cityGrid}>
              {CITIES.map((c) => {
                const meta = CITY_META[c];
                const isSelected = selectedCity === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setSelectedCity(c)}
                    style={[styles.cityCard, isSelected && styles.cityCardActive]}
                  >
                    <Text style={styles.cityEmoji}>{meta.emoji}</Text>
                    <Text style={[styles.cityName, isSelected && styles.cityNameActive]}>
                      {c}
                    </Text>
                    <Text style={styles.cityTagline}>{meta.tagline}</Text>
                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Ionicons name="checkmark-circle" size={16} color="#2dd4bf" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={handleNext}
              disabled={!selectedCity}
              style={[styles.btn, !selectedCity && styles.btnDisabled]}
            >
              <Text style={styles.btnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color="#020617" />
            </Pressable>
          </View>
        ) : (
          /* INTERESTS SELECTION STEP */
          <View style={styles.stepContainer}>
            <View style={styles.cityBadge}>
              <Ionicons name="location-sharp" size={14} color="#2dd4bf" />
              <Text style={styles.cityBadgeText}>{selectedCity}</Text>
              <Pressable onPress={() => setStep("city")} style={styles.changeCityBtn}>
                <Text style={styles.changeCityText}>Change</Text>
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.interestGrid}>
              {INTERESTS.map(({ id, label, emoji, desc }) => {
                const isSelected = selectedInterests.has(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggleInterest(id)}
                    style={[styles.interestCard, isSelected && styles.interestCardActive]}
                  >
                    <Text style={styles.interestEmoji}>{emoji}</Text>
                    <Text style={[styles.interestName, isSelected && styles.interestNameActive]}>
                      {label}
                    </Text>
                    <Text style={styles.interestDesc}>{desc}</Text>
                    {isSelected && (
                      <View style={styles.checkIcon}>
                        <Ionicons name="checkmark-circle" size={16} color="#2dd4bf" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable onPress={handleFinish} style={styles.btn}>
              <Text style={styles.btnText}>
                {selectedInterests.size > 0
                  ? `Let's Explore (${selectedInterests.size})`
                  : "Skip & Explore All"}
              </Text>
              <Ionicons name="rocket-sharp" size={16} color="#020617" />
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
    padding: 20,
    paddingTop: 60,
    position: "relative",
  },
  glowCircle: {
    position: "absolute",
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(45, 212, 191, 0.04)",
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconBg: {
    height: 56,
    width: 56,
    borderRadius: 16,
    backgroundColor: "#2dd4bf",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#2dd4bf",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  eyebrow: {
    color: "#2dd4bf",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 15,
  },

  // Steps indicator
  indicatorRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  indicatorLine: {
    height: 5,
    width: 28,
    borderRadius: 3,
    backgroundColor: "#1e293b",
  },
  indicatorLineActive: {
    backgroundColor: "#2dd4bf",
  },

  stepContainer: {
    flex: 1,
    justifyContent: "space-between",
  },

  // City grids
  cityGrid: {
    gap: 10,
    paddingBottom: 20,
  },
  cityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 14,
    position: "relative",
  },
  cityCardActive: {
    borderColor: "rgba(45, 212, 191, 0.4)",
    backgroundColor: "rgba(45, 212, 191, 0.08)",
  },
  cityEmoji: {
    fontSize: 22,
    marginRight: 12,
  },
  cityName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  cityNameActive: {
    color: "#2dd4bf",
  },
  cityTagline: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "500",
    marginLeft: "auto",
    marginRight: 24,
    maxWidth: 150,
    textAlign: "right",
  },

  // Interests step
  cityBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(45, 212, 191, 0.08)",
    borderColor: "rgba(45, 212, 191, 0.2)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  cityBadgeText: {
    color: "#2dd4bf",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 4,
  },
  changeCityBtn: {
    marginLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(45, 212, 191, 0.2)",
    paddingLeft: 12,
  },
  changeCityText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },

  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 20,
  },
  interestCard: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 12,
    position: "relative",
  },
  interestCardActive: {
    borderColor: "rgba(45, 212, 191, 0.4)",
    backgroundColor: "rgba(45, 212, 191, 0.08)",
  },
  interestEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  interestName: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  interestNameActive: {
    color: "#2dd4bf",
  },
  interestDesc: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },

  // Common buttons
  btn: {
    flexDirection: "row",
    backgroundColor: "#2dd4bf",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 16,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "900",
  },
  checkIcon: {
    position: "absolute",
    right: 12,
    top: 12,
  },
});
