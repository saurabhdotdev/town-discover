import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { MoodPicker } from "../src/components/MoodPicker";
import {
  API_BASE_URL,
  fetchMoodRecommendations,
  fetchTownEvents,
  MoodAxis,
  Place,
} from "../src/api/client";

const CITIES = ["Pune", "Mumbai", "Kolhapur", "Nashik"] as const;

export default function HomeScreen() {
  const [city, setCity] = useState<(typeof CITIES)[number]>("Pune");
  const [mood, setMood] = useState<MoodAxis>("chill");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<{ place: Place; moodScore: number }[]>([]);
  const [events, setEvents] = useState<Place[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, townEvents] = await Promise.all([
        fetchMoodRecommendations({
          city,
          mood,
          lat: coords?.lat,
          lng: coords?.lng,
        }),
        fetchTownEvents(city),
      ]);
      setRecommendations(recs);
      setEvents(townEvents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [city, mood, coords]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    })();
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sheher</Text>
      <Text style={styles.subtitle}>Mood-based picks · separate from the website</Text>
      <Text style={styles.apiHint}>API: {API_BASE_URL}</Text>

      <View style={styles.cityRow}>
        {CITIES.map((item) => (
          <Pressable
            key={item}
            onPress={() => setCity(item)}
            style={[styles.cityChip, city === item && styles.cityChipActive]}
          >
            <Text style={[styles.cityText, city === item && styles.cityTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>How are you feeling?</Text>
      <MoodPicker value={mood} onChange={setMood} />

      {loading ? (
        <ActivityIndicator color="#2dd4bf" style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          style={{ marginTop: 16 }}
          data={[
            { type: "header" as const, title: "For your mood" },
            ...recommendations.map((item) => ({ type: "rec" as const, ...item })),
            { type: "header" as const, title: "Town events & time-pass" },
            ...events.map((place) => ({ type: "event" as const, place })),
          ]}
          keyExtractor={(item, index) =>
            item.type === "header" ? `h-${item.title}` : item.type === "rec" ? item.place.id : `e-${item.place.id}-${index}`
          }
          renderItem={({ item }) => {
            if (item.type === "header") {
              return <Text style={styles.sectionTitle}>{item.title}</Text>;
            }
            const place = item.type === "rec" ? item.place : item.place;
            const score = item.type === "rec" ? item.moodScore : null;
            return (
              <View style={styles.card}>
                <Image source={{ uri: place.image }} style={styles.image} alt="" />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{place.title}</Text>
                  <Text style={styles.cardMeta}>
                    {place.locality} · {place.distance} km
                    {score != null ? ` · match ${Math.round(score * 100)}%` : ""}
                  </Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {place.description}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#020617", padding: 16, paddingTop: 56 },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "800" },
  subtitle: { color: "#94a3b8", marginTop: 4, fontSize: 14 },
  apiHint: { color: "#64748b", fontSize: 11, marginTop: 4, marginBottom: 12 },
  cityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cityChipActive: { borderColor: "#2dd4bf", backgroundColor: "#134e4a" },
  cityText: { color: "#94a3b8", fontWeight: "600" },
  cityTextActive: { color: "#f0fdfa" },
  sectionLabel: { color: "#cbd5e1", fontWeight: "700", marginBottom: 8 },
  sectionTitle: { color: "#e2e8f0", fontSize: 18, fontWeight: "800", marginTop: 12, marginBottom: 8 },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  image: { width: 72, height: 72, borderRadius: 12 },
  cardBody: { flex: 1 },
  cardTitle: { color: "#f8fafc", fontWeight: "700", fontSize: 15 },
  cardMeta: { color: "#2dd4bf", fontSize: 12, marginTop: 2 },
  cardDesc: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  error: { color: "#f87171", marginTop: 16 },
});
