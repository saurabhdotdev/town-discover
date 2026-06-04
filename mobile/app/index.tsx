import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { MoodPicker } from "../src/components/MoodPicker";
import { PlaceDetailModal } from "../src/components/PlaceDetailModal";
import {
  API_BASE_URL,
  fetchMoodRecommendations,
  fetchTownEvents,
  MoodAxis,
  Place,
} from "../src/api/client";

const CITIES = ["Pune", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolhapur", "Nashik"] as const;

export default function HomeScreen() {
  const [city, setCity] = useState<(typeof CITIES)[number]>("Pune");
  const [mood, setMood] = useState<MoodAxis>("chill");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data State
  const [recommendations, setRecommendations] = useState<{ place: Place; moodScore: number }[]>([]);
  const [events, setEvents] = useState<Place[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // User custom UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"explore" | "saved">("explore");
  const [savedPlaces, setSavedPlaces] = useState<Record<string, Place>>({});
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

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

  const handleToggleSave = (place: Place) => {
    setSavedPlaces((prev) => {
      const next = { ...prev };
      if (next[place.id]) {
        delete next[place.id];
      } else {
        next[place.id] = place;
      }
      return next;
    });
  };

  const handleOpenPlace = (place: Place) => {
    setSelectedPlace(place);
    setModalVisible(true);
  };

  // Filter lists based on search query
  const matchesSearch = (place: Place) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      place.title.toLowerCase().includes(query) ||
      place.locality.toLowerCase().includes(query) ||
      place.category.toLowerCase().includes(query)
    );
  };

  const filteredRecs = recommendations.filter((item) => matchesSearch(item.place));
  const filteredEvents = events.filter((place) => matchesSearch(place));
  const savedList = Object.values(savedPlaces).filter(matchesSearch);

  return (
    <View style={styles.screen}>
      {/* Header Title */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sheher</Text>
          <Text style={styles.subtitle}>Explore the heartbeat of your city</Text>
        </View>
        <Ionicons name="compass" size={28} color="#2dd4bf" />
      </View>

      {/* Explore vs Saved Tab Bar */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab("explore")}
          style={[styles.tabButton, activeTab === "explore" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === "explore" && styles.tabTextActive]}>Explore</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("saved")}
          style={[styles.tabButton, activeTab === "saved" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === "saved" && styles.tabTextActive]}>
            Saved ({Object.keys(savedPlaces).length})
          </Text>
        </Pressable>
      </View>

      {/* Global Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#64748b" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, locality, or tag..."
          placeholderTextColor="#64748b"
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} style={styles.clearSearch}>
            <Ionicons name="close" size={16} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {activeTab === "explore" ? (
        <>
          {/* Cities horizontal scroll row */}
          <View style={styles.cityScrollRow}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CITIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setCity(item)}
                  style={[styles.cityChip, city === item && styles.cityChipActive]}
                >
                  <Text style={[styles.cityText, city === item && styles.cityTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              )}
              contentContainerStyle={{ gap: 8 }}
            />
          </View>

          {/* Mood chips section */}
          <Text style={styles.sectionLabel}>Pick a vibe</Text>
          <View style={{ marginBottom: 12 }}>
            <MoodPicker value={mood} onChange={setMood} />
          </View>

          {loading ? (
            <ActivityIndicator color="#2dd4bf" style={{ marginTop: 40 }} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={32} color="#f87171" />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={[
                ...(filteredRecs.length > 0
                  ? [
                      { type: "header" as const, title: "Curated Vibe Picks" },
                      ...filteredRecs.map((item) => ({ type: "rec" as const, ...item })),
                    ]
                  : []),
                ...(filteredEvents.length > 0
                  ? [
                      { type: "header" as const, title: "Town Events & Trails" },
                      ...filteredEvents.map((place) => ({ type: "event" as const, place })),
                    ]
                  : []),
              ]}
              keyExtractor={(item, index) =>
                item.type === "header"
                  ? `h-${item.title}`
                  : item.type === "rec"
                  ? `r-${item.place.id}`
                  : `e-${item.place.id}-${index}`
              }
              renderItem={({ item }) => {
                if (item.type === "header") {
                  return <Text style={styles.sectionTitle}>{item.title}</Text>;
                }

                const place = item.type === "rec" ? item.place : item.place;
                const score = item.type === "rec" ? item.moodScore : null;
                const isSaved = !!savedPlaces[place.id];

                return (
                  <Pressable onPress={() => handleOpenPlace(place)} style={styles.card}>
                    <Image source={{ uri: place.image }} style={styles.image} alt="" />
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {place.title}
                        </Text>
                        <Pressable onPress={() => handleToggleSave(place)} style={styles.bookmarkButton}>
                          <Ionicons
                            name={isSaved ? "bookmark" : "bookmark-outline"}
                            size={16}
                            color={isSaved ? "#2dd4bf" : "#94a3b8"}
                          />
                        </Pressable>
                      </View>
                      
                      <View style={styles.metaRow}>
                        <Text style={styles.cardMeta}>{place.locality}</Text>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.cardMeta}>{place.distance} km</Text>
                        {score != null && (
                          <>
                            <Text style={styles.bullet}>•</Text>
                            <Text style={styles.matchText}>{Math.round(score * 100)}% match</Text>
                          </>
                        )}
                      </View>

                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {place.description}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No matching spots found for "{city}" under this vibe.</Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        /* Saved Bookmarks Tab View */
        <FlatList
          style={{ flex: 1, marginTop: 12 }}
          data={savedList}
          keyExtractor={(item) => `saved-${item.id}`}
          renderItem={({ item: place }) => (
            <Pressable onPress={() => handleOpenPlace(place)} style={styles.card}>
              <Image source={{ uri: place.image }} style={styles.image} alt="" />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {place.title}
                  </Text>
                  <Pressable onPress={() => handleToggleSave(place)} style={styles.bookmarkButton}>
                    <Ionicons name="bookmark" size={16} color="#2dd4bf" />
                  </Pressable>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.cardMeta}>{place.locality}</Text>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.cardMeta}>{place.city}</Text>
                </View>

                <Text style={styles.cardDesc} numberOfLines={2}>
                  {place.description}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>You haven't saved any spots yet!</Text>
              <Text style={styles.emptySubText}>
                Tapping the bookmark icon on any spot will save it here for offline viewing.
              </Text>
            </View>
          }
        />
      )}

      {/* Details modal overlay */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          isSaved={!!savedPlaces[selectedPlace.id]}
          onToggleSave={() => handleToggleSave(selectedPlace)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#020617", padding: 16, paddingTop: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { color: "#94a3b8", fontSize: 13, fontWeight: "500", marginTop: 2 },
  
  // Tabs Navigation
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: "#1e293b",
  },
  tabText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#f8fafc",
  },

  // Search input
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 8,
  },
  clearSearch: { padding: 4 },

  // Cities Selector
  cityScrollRow: { marginBottom: 14 },
  cityChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  cityChipActive: {
    borderColor: "#2dd4bf",
    backgroundColor: "rgba(45, 212, 191, 0.15)",
  },
  cityText: { color: "#94a3b8", fontWeight: "700", fontSize: 12 },
  cityTextActive: { color: "#2dd4bf" },

  // Sections labels
  sectionLabel: { color: "#e2e8f0", fontWeight: "800", fontSize: 13, marginBottom: 8 },
  sectionTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 14, marginBottom: 10 },
  
  // Cards Layout
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  image: { width: 80, height: 80, borderRadius: 8, resizeMode: "cover" },
  cardBody: { flex: 1, justifyContent: "space-between" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#f8fafc", fontWeight: "800", fontSize: 14, flex: 1, paddingRight: 6 },
  bookmarkButton: { padding: 2 },
  
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  cardMeta: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  bullet: { color: "#475569", marginHorizontal: 4, fontSize: 10 },
  matchText: { color: "#2dd4bf", fontSize: 11, fontWeight: "800" },

  cardDesc: { color: "#64748b", fontSize: 11, marginTop: 4, lineHeight: 16, fontWeight: "500" },
  
  // Error handling
  errorBox: { alignItems: "center", justifyContent: "center", marginTop: 40, gap: 10 },
  error: { color: "#f87171", fontSize: 13, fontWeight: "600", textAlign: "center" },
  
  // Empty states
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 50, padding: 20 },
  emptyText: { color: "#94a3b8", fontSize: 13, fontWeight: "700", marginTop: 12, textAlign: "center" },
  emptySubText: { color: "#475569", fontSize: 11, fontWeight: "500", marginTop: 4, textAlign: "center", lineHeight: 16 },
});

