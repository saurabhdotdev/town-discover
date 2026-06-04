import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchPlaceReviews, Place, submitCrowdReport } from "../api/client";

type Props = {
  place: Place | null;
  visible: boolean;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: () => void;
};

const CROWD_OPTIONS = [
  { level: "low", label: "Quiet", desc: "Easy entry", color: "#34d399", bg: "#064e3b" },
  { level: "moderate", label: "Steady", desc: "Normal", color: "#22d3ee", bg: "#164e63" },
  { level: "busy", label: "Busy", desc: "Short wait", color: "#fbbf24", bg: "#78350f" },
  { level: "very_crowded", label: "Packed", desc: "Expect wait", color: "#f87171", bg: "#7f1d1d" },
];

export function PlaceDetailModal({ place, visible, onClose, isSaved, onToggleSave }: Props) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [crowdLevel, setCrowdLevel] = useState<string>("moderate");
  const [crowdNote, setCrowdNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (visible && place) {
      setLoadingReviews(true);
      fetchPlaceReviews(place.id)
        .then((data) => setReviews(data))
        .catch((err) => console.log("Error loading reviews on mobile:", err))
        .finally(() => setLoadingReviews(false));
    } else {
      setReviews([]);
    }
  }, [visible, place]);

  if (!place) return null;

  const handleReportCrowd = async () => {
    setSubmittingReport(true);
    try {
      await submitCrowdReport(place.id, crowdLevel, crowdNote);
      Alert.alert("Success", "Crowd report submitted successfully!");
      setCrowdNote("");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to report crowd status.");
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Image source={{ uri: place.image }} style={styles.heroImage} />
          <View style={styles.overlay} />

          {/* Top Actions */}
          <View style={styles.topBar}>
            <Pressable onPress={onClose} style={styles.iconButton}>
              <Ionicons name="chevron-back" size={24} color="#f8fafc" />
            </Pressable>

            <Pressable onPress={onToggleSave} style={styles.iconButton}>
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={22}
                color={isSaved ? "#2dd4bf" : "#f8fafc"}
              />
            </Pressable>
          </View>

          {/* Hero Place Metadata Info */}
          <View style={styles.heroContent}>
            <Text style={styles.categoryBadge}>{place.category.toUpperCase()}</Text>
            <Text style={styles.title}>{place.title}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location" size={14} color="#2dd4bf" />
              <Text style={styles.metaText}>{place.locality}</Text>
              <Text style={styles.divider}>•</Text>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.metaText}>{place.rating.toFixed(1)}</Text>
              <Text style={styles.divider}>•</Text>
              <Text style={styles.metaText}>{place.distance} km away</Text>
            </View>
          </View>
        </View>

        {/* Scrollable details */}
        <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.scrollContent}>
          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this Spot</Text>
            <Text style={styles.descText}>{place.description}</Text>
            {place.tags && place.tags.length > 0 && (
              <View style={styles.tagWrap}>
                {place.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Crowd Status Report */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Report Crowd Level</Text>
            <Text style={styles.sectionSub}>Help other explorers by reporting live status now:</Text>
            <View style={styles.crowdRow}>
              {CROWD_OPTIONS.map((opt) => {
                const isActive = crowdLevel === opt.level;
                return (
                  <Pressable
                    key={opt.level}
                    onPress={() => setCrowdLevel(opt.level)}
                    style={[
                      styles.crowdBtn,
                      isActive && { borderColor: opt.color, backgroundColor: opt.bg },
                    ]}
                  >
                    <Text style={[styles.crowdLabel, { color: opt.color }]}>{opt.label}</Text>
                    <Text style={styles.crowdSub}>{opt.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={crowdNote}
              onChangeText={setCrowdNote}
              placeholder="Add optional note (e.g., long queue outside, free entry)"
              placeholderTextColor="#64748b"
              maxLength={120}
              style={styles.input}
            />

            <Pressable
              onPress={handleReportCrowd}
              disabled={submittingReport}
              style={styles.submitBtn}
            >
              {submittingReport ? (
                <ActivityIndicator color="#020617" size="small" />
              ) : (
                <>
                  <Ionicons name="people" size={16} color="#020617" />
                  <Text style={styles.submitBtnText}>Submit Live Update</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Visitor Reviews */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Community Reviews</Text>
            {loadingReviews ? (
              <ActivityIndicator color="#2dd4bf" style={{ marginVertical: 20 }} />
            ) : reviews.length === 0 ? (
              <Text style={styles.emptyReviews}>No reviews posted yet. Be the first to share the vibe!</Text>
            ) : (
              reviews.map((rev) => (
                <View key={rev.id} style={styles.revCard}>
                  <View style={styles.revHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {rev.userFullName ? rev.userFullName.charAt(0).toUpperCase() : "E"}
                      </Text>
                    </View>
                    <View style={styles.revUserBox}>
                      <Text style={styles.revUserName}>{rev.userFullName}</Text>
                      <View style={styles.starsRow}>
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Ionicons
                            key={idx}
                            name={idx < rev.rating ? "star" : "star-outline"}
                            size={10}
                            color="#fbbf24"
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.revText}>{rev.text}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  hero: { height: 280, position: "relative" },
  heroImage: { width: "100%", height: "100%", resizeMode: "cover" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.45)",
  },
  topBar: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  iconButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  heroContent: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
  },
  categoryBadge: {
    color: "#2dd4bf",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, flexWrap: "wrap" },
  metaText: { color: "#cbd5e1", fontSize: 13, fontWeight: "600", marginLeft: 4 },
  divider: { color: "#64748b", marginHorizontal: 8 },
  detailsScroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 20,
  },
  sectionTitle: { color: "#f1f5f9", fontSize: 16, fontWeight: "800", marginBottom: 10 },
  sectionSub: { color: "#94a3b8", fontSize: 12, fontWeight: "600", marginBottom: 12 },
  descText: { color: "#94a3b8", fontSize: 14, lineHeight: 22, fontWeight: "500" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  tagText: { color: "#cbd5e1", fontSize: 11, fontWeight: "700" },
  crowdRow: { flexDirection: "row", justifyContent: "space-between", gap: 6, marginBottom: 12 },
  crowdBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
    borderRadius: 8,
  },
  crowdLabel: { fontSize: 12, fontWeight: "800" },
  crowdSub: { fontSize: 8, color: "#64748b", marginTop: 2, fontWeight: "700" },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: "#2dd4bf",
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  submitBtnText: { color: "#020617", fontSize: 13, fontWeight: "800" },
  emptyReviews: { color: "#64748b", fontSize: 12, fontStyle: "italic", marginTop: 4 },
  revCard: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 12,
    marginBottom: 8,
  },
  revHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar: {
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: "#2dd4bf",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#020617", fontSize: 11, fontWeight: "900" },
  revUserBox: { flex: 1 },
  revUserName: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  starsRow: { flexDirection: "row", gap: 1, marginTop: 1 },
  revText: { color: "#94a3b8", fontSize: 12, lineHeight: 18, fontWeight: "500" },
});
