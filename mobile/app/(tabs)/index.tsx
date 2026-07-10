import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { MoodPicker } from "../../src/components/MoodPicker";
import { PlaceDetailModal } from "../../src/components/PlaceDetailModal";
import { OnboardingModal } from "../../src/components/OnboardingModal";
import {
  fetchMoodRecommendations,
  fetchTownEvents,
  fetchCurrentUser,
  fetchGamificationStats,
  MoodAxis,
  Place,
  AuthUser,
  GamificationStats,
} from "../../src/api/client";

const CITIES = ["Pune", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolhapur", "Nashik"] as const;

export function SpotlightCard({ place, onOpen }: { place: Place; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={styles.spotlightCard}>
      {place.image ? (
        <Image source={{ uri: place.image }} style={styles.spotlightImage} />
      ) : (
        <View style={[styles.spotlightImage, { backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" }]}>
          <Ionicons name="image-outline" size={36} color="#64748b" />
        </View>
      )}
      <View style={[
        styles.spotlightOverlay,
        Platform.OS === 'web' && { backgroundImage: 'linear-gradient(to top, rgba(2, 6, 23, 0.95) 0%, rgba(2, 6, 23, 0.4) 60%, rgba(2, 6, 23, 0) 100%)' } as any
      ]} />
      <View style={styles.spotlightContent}>
        <View style={styles.spotlightBadgeRow}>
          <Text style={styles.spotlightBadge}>★ SPOTLIGHT</Text>
          <Text style={styles.spotlightCategoryBadge}>{place.category.toUpperCase()}</Text>
        </View>
        <Text style={styles.spotlightTitle}>{place.title}</Text>
        <Text style={styles.spotlightDesc} numberOfLines={2}>{place.description}</Text>
        <View style={styles.spotlightFooter}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#fbbf24" />
            <Text style={styles.spotlightRating}>{place.rating.toFixed(1)}</Text>
            <Text style={styles.spotlightDistance}>· {place.distance} km</Text>
          </View>
          <View style={styles.spotlightExploreBtn}>
            <Text style={styles.spotlightExploreText}>Explore</Text>
            <Ionicons name="chevron-forward" size={12} color="#020617" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

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
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState<"explore" | "saved">("explore");
  const [savedPlaces, setSavedPlaces] = useState<Record<string, Place>>({});
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Authenticated gamification states
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userStats, setUserStats] = useState<GamificationStats | null>(null);

  // Check onboarding completion on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem("sheher_onboarding_completed");
        if (completed !== "true") {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.log("Error checking onboarding status:", err);
      }
    };
    void checkOnboarding();
  }, []);

  const handleOnboardingComplete = async (selectedCity: (typeof CITIES)[number], interests: string[]) => {
    try {
      await AsyncStorage.setItem("sheher_onboarding_completed", "true");
      await AsyncStorage.setItem("sheher_active_city", selectedCity);
      if (interests.length > 0) {
        await AsyncStorage.setItem("sheher_user_interests", JSON.stringify(interests));
      }
      setCity(selectedCity);
      setShowOnboarding(false);
    } catch (err) {
      console.log("Error saving onboarding details:", err);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [recs, townEvents] = await Promise.all([
        fetchMoodRecommendations({
          city,
          mood,
          query: debouncedSearchQuery,
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
  }, [city, mood, coords, debouncedSearchQuery]);

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

  // Sync city selection and user info when screen gains focus
  useFocusEffect(
    useCallback(() => {
      const loadCityAndUser = async () => {
        try {
          const storedCity = await AsyncStorage.getItem("sheher_active_city");
          if (storedCity && CITIES.includes(storedCity as (typeof CITIES)[number])) {
            setCity(storedCity as (typeof CITIES)[number]);
          }
        } catch (err) {
          console.log("Error loading active city on focus:", err);
        }

        try {
          const currentUser = await fetchCurrentUser();
          setUser(currentUser);
          if (currentUser) {
            const stats = await fetchGamificationStats();
            setUserStats(stats);
          } else {
            setUserStats(null);
          }
        } catch (err) {
          console.log("Error loading user or gamification stats:", err);
        }
      };
      void loadCityAndUser();
    }, [])
  );

  const handleCityChange = async (newCity: (typeof CITIES)[number]) => {
    setCity(newCity);
    try {
      await AsyncStorage.setItem("sheher_active_city", newCity);
    } catch (err) {
      console.log("Error saving active city:", err);
    }
  };

  // Load saved places from local storage on mount
  useEffect(() => {
    const loadSavedPlaces = async () => {
      try {
        const stored = await AsyncStorage.getItem("sheher_saved_places");
        if (stored) {
          setSavedPlaces(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Failed to load saved places from AsyncStorage:", err);
      }
    };
    loadSavedPlaces();
  }, []);

  const handleToggleSave = (place: Place) => {
    setSavedPlaces((prev) => {
      const next = { ...prev };
      if (next[place.id]) {
        delete next[place.id];
      } else {
        next[place.id] = place;
      }
      AsyncStorage.setItem("sheher_saved_places", JSON.stringify(next)).catch((err) => {
        console.error("Failed to save places to AsyncStorage:", err);
      });
      return next;
    });
  };

  const handleOpenPlace = (place: Place) => {
    setSelectedPlace(place);
    setModalVisible(true);
  };

  // Filter lists based on search query
  const matchesSearch = (place: Place | undefined) => {
    if (!place) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (place.title || "").toLowerCase().includes(query) ||
      (place.locality || "").toLowerCase().includes(query) ||
      (place.category || "").toLowerCase().includes(query)
    );
  };

  const filteredRecs = recommendations;
  const filteredEvents = events.filter((place) => matchesSearch(place));
  const savedList = Object.values(savedPlaces).filter(matchesSearch);

  const spotlightSpot = recommendations.find(r => r.place?.isTrending)?.place ?? recommendations[0]?.place;

  return (
    <View style={styles.screen}>
      {/* Header Title */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sheher</Text>
          <Text style={styles.subtitle}>Explore the heartbeat of your city</Text>
        </View>
        <View style={styles.headerRight}>
          {userStats && (
            <View style={styles.xpHeaderChip}>
              <Text style={styles.xpText}>Lv.{userStats.level}</Text>
            </View>
          )}
          <Ionicons name="compass" size={28} color="#2dd4bf" />
        </View>
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
                  onPress={() => handleCityChange(item)}
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
              contentContainerStyle={styles.scrollList}
              data={[
                ...(spotlightSpot && !searchQuery.trim()
                  ? [{ type: "spotlight" as const, place: spotlightSpot }]
                  : []),
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
                item.type === "spotlight"
                  ? `s-${item.place.id}`
                  : item.type === "header"
                  ? `h-${item.title}`
                  : item.type === "rec"
                  ? `r-${item.place.id}`
                  : `e-${item.place.id}-${index}`
              }
              renderItem={({ item }) => {
                if (item.type === "spotlight") {
                  return <SpotlightCard place={item.place} onOpen={() => handleOpenPlace(item.place)} />;
                }

                if (item.type === "header") {
                  return <Text style={styles.sectionTitle}>{item.title}</Text>;
                }

                const place = item.place;
                if (!place) return null;

                const score = item.type === "rec" ? (item as { moodScore: number }).moodScore : null;
                const isSaved = !!savedPlaces[place.id];

                return (
                  <Pressable onPress={() => handleOpenPlace(place)} style={styles.card}>
                    <View style={styles.imageContainer}>
                      {place.image ? (
                        <Image source={{ uri: place.image }} style={styles.image} alt="" />
                      ) : (
                        <View style={[styles.image, { backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" }]}>
                          <Ionicons name="image-outline" size={24} color="#64748b" />
                        </View>
                      )}
                      <View style={styles.cardCategoryBadge}>
                        <Text style={styles.cardCategoryText}>{place.category.toUpperCase()}</Text>
                      </View>
                      <View style={styles.cardRatingBadge}>
                        <Ionicons name="star" size={10} color="#fbbf24" />
                        <Text style={styles.cardRatingText}>{place.rating.toFixed(1)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.cardBody}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {place.title}
                        </Text>
                        <Pressable onPress={() => handleToggleSave(place)} style={styles.bookmarkButton}>
                          <Ionicons
                            name={isSaved ? "bookmark" : "bookmark-outline"}
                            size={18}
                            color={isSaved ? "#2dd4bf" : "#94a3b8"}
                          />
                        </Pressable>
                      </View>
                      
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={12} color="#94a3b8" />
                        <Text style={styles.cardMeta}>{place.locality}</Text>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.cardMeta}>{place.distance} km away</Text>
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

                      {place.tags && place.tags.length > 0 && (
                        <View style={styles.cardTagsRow}>
                          {place.tags.slice(0, 3).map((t) => {
                            let iconName: keyof typeof Ionicons.glyphMap | null = null;
                            if (t === "metro-access" || t === "metro") iconName = "train-outline";
                            else if (t === "foreigner-friendly") iconName = "globe-outline";
                            else if (t === "pet-friendly" || t === "pets") iconName = "paw-outline";
                            else if (t === "wifi-friendly" || t === "wifi" || t === "work-friendly") iconName = "wifi-outline";

                            return (
                              <View key={t} style={styles.cardTagChip}>
                                {iconName && (
                                  <Ionicons name={iconName} size={10} color="#cbd5e1" style={{ marginRight: 3 }} />
                                )}
                                <Text style={styles.cardTagText}>{t}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={48} color="#2dd4bf" style={{ opacity: 0.8 }} />
                  <Text style={styles.emptyText}>No spots found matching search</Text>
                  <Text style={styles.emptySubText}>
                    We couldn't find any places matching "{searchQuery}" in {city} under this vibe. Try a different term or clear the filter.
                  </Text>
                  
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    style={styles.resetButton}
                  >
                    <Text style={styles.resetButtonText}>Clear Search</Text>
                  </Pressable>

                  <Text style={styles.suggestionTitle}>Try browsing popular categories:</Text>
                  <View style={styles.suggestionGrid}>
                    {["Cafes", "Street Food", "Restaurants", "Events"].map((cat) => (
                      <Pressable
                        key={cat}
                        onPress={() => setSearchQuery(cat)}
                        style={styles.suggestionChip}
                      >
                        <Text style={styles.suggestionChipText}>{cat}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              }
            />
          )}
        </>
      ) : (
        /* Saved Bookmarks Tab View */
        <FlatList
          style={{ flex: 1, marginTop: 12 }}
          contentContainerStyle={styles.scrollList}
          data={savedList}
          keyExtractor={(item) => `saved-${item.id}`}
          renderItem={({ item: place }) => (
            <Pressable onPress={() => handleOpenPlace(place)} style={styles.card}>
              <View style={styles.imageContainer}>
                <Image source={{ uri: place.image }} style={styles.image} alt="" />
                <View style={styles.cardCategoryBadge}>
                  <Text style={styles.cardCategoryText}>{place.category.toUpperCase()}</Text>
                </View>
                <View style={styles.cardRatingBadge}>
                  <Ionicons name="star" size={10} color="#fbbf24" />
                  <Text style={styles.cardRatingText}>{place.rating.toFixed(1)}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {place.title}
                  </Text>
                  <Pressable onPress={() => handleToggleSave(place)} style={styles.bookmarkButton}>
                    <Ionicons name="bookmark" size={18} color="#2dd4bf" />
                  </Pressable>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={12} color="#94a3b8" />
                  <Text style={styles.cardMeta}>{place.locality}</Text>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.cardMeta}>{place.city}</Text>
                </View>

                <Text style={styles.cardDesc} numberOfLines={2}>
                  {place.description}
                </Text>

                {place.tags && place.tags.length > 0 && (
                  <View style={styles.cardTagsRow}>
                    {place.tags.slice(0, 3).map((t) => (
                      <View key={t} style={styles.cardTagChip}>
                        <Text style={styles.cardTagText}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>You haven&apos;t saved any spots yet!</Text>
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

      {/* Onboarding Wizard Modal */}
      <OnboardingModal
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
      />
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  xpHeaderChip: {
    backgroundColor: "rgba(45, 212, 191, 0.12)",
    borderColor: "rgba(45, 212, 191, 0.3)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  xpText: {
    color: "#2dd4bf",
    fontSize: 11,
    fontWeight: "900",
  },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { color: "#94a3b8", fontSize: 13, fontWeight: "500", marginTop: 2 },
  
  // Tabs Navigation
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#2dd4bf",
  },
  tabText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#020617",
  },

  // Search input
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
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
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  cityChipActive: {
    borderColor: "#2dd4bf",
    backgroundColor: "rgba(45, 212, 191, 0.12)",
  },
  cityText: { color: "#94a3b8", fontWeight: "700", fontSize: 12 },
  cityTextActive: { color: "#2dd4bf" },

  // Sections labels
  sectionLabel: { color: "#e2e8f0", fontWeight: "800", fontSize: 13, marginBottom: 8 },
  sectionTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900", marginTop: 14, marginBottom: 10 },
  
  // Spotlight Styling
  spotlightCard: {
    height: 250,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 18,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 8,
  },
  spotlightImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  spotlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.45)"
  },
  spotlightContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16
  },
  spotlightBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6
  },
  spotlightBadge: {
    backgroundColor: "#fbbf24",
    color: "#020617",
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  spotlightCategoryBadge: {
    backgroundColor: "rgba(45, 212, 191, 0.2)",
    color: "#2dd4bf",
    fontSize: 9,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)"
  },
  spotlightTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4
  },
  spotlightDesc: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 10,
    lineHeight: 16
  },
  spotlightFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  spotlightRating: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800"
  },
  spotlightDistance: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600"
  },
  spotlightExploreBtn: {
    backgroundColor: "#2dd4bf",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  spotlightExploreText: {
    color: "#020617",
    fontSize: 11,
    fontWeight: "800"
  },

  // Cards Layout
  card: {
    flexDirection: "column",
    backgroundColor: "#0f172a",
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.08)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4
  },
  imageContainer: {
    width: "100%",
    height: 180,
    position: "relative"
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  cardCategoryBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  cardCategoryText: {
    color: "#2dd4bf",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1
  },
  cardRatingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  cardRatingText: {
    color: "#fbbf24",
    fontSize: 10,
    fontWeight: "800"
  },
  cardBody: {
    padding: 14,
    justifyContent: "space-between"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  cardTitle: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 15,
    flex: 1,
    paddingRight: 6
  },
  bookmarkButton: {
    padding: 2
  },
  
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 4
  },
  cardMeta: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 2
  },
  bullet: {
    color: "#475569",
    marginHorizontal: 2,
    fontSize: 10
  },
  matchText: {
    color: "#2dd4bf",
    fontSize: 11,
    fontWeight: "800"
  },

  cardDesc: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500"
  },
  
  cardTagsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 10
  },
  cardTagChip: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3
  },
  cardTagText: {
    color: "#cbd5e1",
    fontSize: 9,
    fontWeight: "700"
  },

  // Error handling
  errorBox: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    gap: 10
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center"
  },
  
  // Empty states
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 35,
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  emptyText: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center"
  },
  emptySubText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  resetButton: {
    backgroundColor: "rgba(45, 212, 191, 0.12)",
    borderColor: "rgba(45, 212, 191, 0.3)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  resetButtonText: {
    color: "#2dd4bf",
    fontSize: 12,
    fontWeight: "800",
  },
  suggestionTitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  suggestionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
  },
  scrollList: {
    paddingBottom: 100,
  },
});


