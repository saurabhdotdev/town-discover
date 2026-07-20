import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import {
  fetchCurrentUser,
  fetchMoodRecommendations,
  fetchTripPlans,
  createTripPlan,
  Place,
  TripPlan,
  AuthUser,
} from "../../src/api/client";
import AppMapView from "../../src/components/MapView";


const CITIES = ["Pune", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolhapur", "Nashik"] as const;

export default function TripsScreen() {
  const [city, setCity] = useState<(typeof CITIES)[number]>("Pune");
  const [user, setUser] = useState<AuthUser | null>(null);
  
  // Tab selector: New Trip vs Saved Trips
  const [activeTab, setActiveTab] = useState<"builder" | "saved">("builder");

  // Form states
  const [budget, setBudget] = useState<"1" | "3" | "5">("3");
  const [theme, setTheme] = useState<"mix" | "cafe" | "food" | "scenic">("mix");
  const [startPlaceId, setStartPlaceId] = useState("");
  
  // Starting place options
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [searchStartQuery, setSearchStartQuery] = useState("");

  // Plan Generator States
  const [generating, setGenerating] = useState(false);
  const [previewStops, setPreviewStops] = useState<Place[] | null>(null);
  const [previewStats, setPreviewStats] = useState<{ distance: number; duration: number } | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // Saved Plans list
  const [savedPlans, setSavedPlans] = useState<TripPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<TripPlan | null>(null);

  // Fetch active user and active city from focus hooks
  useFocusEffect(
    useCallback(() => {
      fetchCurrentUser()
        .then((u: AuthUser | null) => setUser(u))
        .catch(() => setUser(null));
      
      const loadPersistentCity = async () => {
        try {
          const stored = await AsyncStorage.getItem("sheher_active_city");
          if (stored && CITIES.includes(stored as (typeof CITIES)[number])) {
            setCity(stored as (typeof CITIES)[number]);
          }
        } catch {}
      };
      loadPersistentCity();
    }, [])
  );

  // Saved plans loader — defined before useEffect that references it
  const loadSavedPlans = useCallback(async () => {
    if (!user) {
      setSavedPlans([]);
      return;
    }
    setLoadingPlans(true);
    try {
      const plans = await fetchTripPlans();
      setSavedPlans((plans as TripPlan[]) || []);
    } catch (err) {
      console.log("Error loading trip plans:", err);
    } finally {
      setLoadingPlans(false);
    }
  }, [user]);

  // Load start places when city changes
  useEffect(() => {
    const loadStartPlaces = async () => {
      setLoadingPlaces(true);
      try {
        const recs = await fetchMoodRecommendations({ city, mood: "chill" });
        const cleanPlaces = recs.map(r => r.place);
        setPlaces(cleanPlaces);
        if (cleanPlaces.length > 0) {
          setStartPlaceId(cleanPlaces[0].id);
        }
      } catch (err) {
        console.log("Failed to load starting spots:", err);
      } finally {
        setLoadingPlaces(false);
      }
    };
    void loadStartPlaces();
  }, [city]);

  // Load saved plans when activeTab is "saved"
  useEffect(() => {
    if (activeTab === "saved") {
      const timer = setTimeout(() => { void loadSavedPlans(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, loadSavedPlans]);

  const getThemeScore = (place: Place, t: string) => {
    let score = 0;
    if (t === "cafe") {
      if (place.category === "cafe") score += 10;
      if (place.category === "dessert" || place.category === "ice-cream") score += 5;
    } else if (t === "food") {
      if (["restaurant", "street-food", "food-stall"].includes(place.category)) score += 10;
      if (["dessert", "ice-cream"].includes(place.category)) score += 5;
    } else if (t === "scenic") {
      if (place.tags?.some(tag => ["scenic", "viewpoint", "heritage", "walk", "nature", "park"].includes(tag))) score += 10;
    }
    return score;
  };

  const handleGenerateTrail = async () => {
    const startPlace = places.find(p => p.id === startPlaceId);
    if (!startPlace) {
      Alert.alert("Missing Start Spot", "Please select a starting spot first.");
      return;
    }

    setGenerating(true);
    setPreviewStops(null);
    setPreviewStats(null);

    try {
      const targetStops = budget === "1" ? 2 : budget === "5" ? 4 : 3;
      const maxRadius = budget === "1" ? 0.006 : budget === "5" ? 0.05 : 0.018;

      const isWithinRadius = (p: Place) => {
        const latDelta = p.latitude - startPlace.latitude;
        const lngDelta = p.longitude - startPlace.longitude;
        const dist = Math.hypot(latDelta, lngDelta);
        return dist <= maxRadius;
      };

      const citySpots = places.filter(p => p.id !== startPlace.id && isWithinRadius(p));

      // Group categories to find diverse spots
      const categoryGroups: Record<string, Place[]> = {};
      citySpots.forEach(p => {
        if (!categoryGroups[p.category]) categoryGroups[p.category] = [];
        categoryGroups[p.category].push(p);
      });

      const stops: Place[] = [startPlace];
      const categoriesUsed = new Set<string>([startPlace.category]);

      const availableCategories = Object.keys(categoryGroups).filter(c => !categoriesUsed.has(c));
      if (theme !== "mix") {
        availableCategories.sort((a, b) => {
          const repA = categoryGroups[a][0];
          const repB = categoryGroups[b][0];
          return getThemeScore(repB, theme) - getThemeScore(repA, theme);
        });
      } else {
        availableCategories.sort(() => 0.5 - Math.random());
      }

      for (const cat of availableCategories) {
        if (stops.length >= targetStops) break;
        const group = categoryGroups[cat];
        const sortedByProximity = [...group].sort((a, b) => {
          const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
          const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
          return distA - distB;
        });

        if (sortedByProximity[0]) {
          stops.push(sortedByProximity[0]);
          categoriesUsed.add(cat);
        }
      }

      // Fill up if target not reached
      if (stops.length < targetStops) {
        const remaining = citySpots
          .filter(p => !stops.some(s => s.id === p.id))
          .sort((a, b) => {
            const distA = Math.hypot(a.latitude - startPlace.latitude, a.longitude - startPlace.longitude);
            const distB = Math.hypot(b.latitude - startPlace.latitude, b.longitude - startPlace.longitude);
            return distA - distB;
          });
        while (stops.length < targetStops && remaining.length > 0) {
          stops.push(remaining.shift()!);
        }
      }

      if (stops.length < 2) {
        Alert.alert("Spontaneous Walk Failed", "Not enough nearby spots to generate a route walk in this area.");
        setGenerating(false);
        return;
      }

      const durationLabel = budget === "1" ? "1-Hour" : budget === "5" ? "5-Hour" : "2-3 Hour";
      const themeLabel = theme === "cafe" ? "Cafe Hop" : theme === "food" ? "Foodie" : theme === "scenic" ? "Scenic" : "Spontaneous";
      const name = `${themeLabel} ${durationLabel} ${city} Walk`;

      // Call OSRM Route Foot path
      const coordString = stops.map(s => `${s.longitude},${s.latitude}`).join(";");
      const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${coordString}?overview=full&geometries=geojson`;
      
      let distanceKm = budget === "1" ? 0.6 : budget === "5" ? 4.5 : 1.8;
      let durationMinutes = budget === "1" ? 15 : budget === "5" ? 75 : 30;

      try {
        const res = await fetch(osrmUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.code === "Ok" && data.routes?.[0]) {
            const route = data.routes[0];
            distanceKm = parseFloat((route.distance / 1000).toFixed(1));
            durationMinutes = Math.round(route.duration / 60);
          }
        }
      } catch {}

      setPreviewStops(stops);
      setPreviewStats({ distance: distanceKm, duration: durationMinutes });
      setPreviewName(name);
    } catch (err) {
      console.log("Error building trail:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTrail = async () => {
    if (!previewStops || previewStops.length === 0) return;

    if (!user) {
      Alert.alert("Authentication Required", "Please log in on the Profile tab to save walks directly to your explorer dashboard.");
      return;
    }

    setSavingPlan(true);
    try {
      const stopsPayload = previewStops.map(p => ({
        ...p,
        isOpen: true,
        isTrending: false,
        reviewCount: 5,
        priceRange: "$$",
      }));
      const routePath = previewStops.map(p => ({ latitude: p.latitude, longitude: p.longitude }));

      const payload = {
        name: previewName,
        source: previewStops[0].locality || city,
        destination: previewStops[previewStops.length - 1].locality || city,
        distanceKm: previewStats?.distance ?? null,
        durationMinutes: previewStats?.duration ?? null,
        routePath,
        stops: stopsPayload,
      };

      await createTripPlan(payload);
      Alert.alert("Success", "Trip plan saved to your explorer profile!");
      setPreviewStops(null);
      setPreviewStats(null);
      setPreviewName("");
      setActiveTab("saved");
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Could not save trip plan");
    } finally {
      setSavingPlan(false);
    }
  };

  const filteredPlaces = places.filter(p => {
    if (!searchStartQuery.trim()) return true;
    return (
      p.title.toLowerCase().includes(searchStartQuery.toLowerCase()) ||
      p.locality.toLowerCase().includes(searchStartQuery.toLowerCase())
    );
  });

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trip Planner</Text>
          <Text style={styles.subtitle}>Spontaneous trail walks & itinerary guides</Text>
        </View>
        <Ionicons name="trail-sign" size={28} color="#2dd4bf" />
      </View>

      {/* Builder vs Saved Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          onPress={() => setActiveTab("builder")}
          style={[styles.tabButton, activeTab === "builder" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === "builder" && styles.tabTextActive]}>
            Trail Generator
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("saved")}
          style={[styles.tabButton, activeTab === "saved" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabText, activeTab === "saved" && styles.tabTextActive]}>
            Saved Walks {user && `(${savedPlans.length})`}
          </Text>
        </Pressable>
      </View>

      {activeTab === "builder" ? (
        // ROUTE GENERATOR SCREEN
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          <View style={styles.formCard}>
            <Text style={styles.formSectionTitle}>Customize Walk</Text>

            {/* Time Budget */}
            <Text style={styles.formLabel}>Time Budget</Text>
            <View style={styles.budgetGroup}>
              {[
                { id: "1" as const, label: "1 Hour", desc: "Short Hop (2 stops)" },
                { id: "3" as const, label: "3 Hours", desc: "Moderate (3 stops)" },
                { id: "5" as const, label: "Half Day", desc: "Deep dive (4 stops)" },
              ].map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => setBudget(item.id)}
                  style={[styles.budgetBtn, budget === item.id && styles.budgetBtnActive]}
                >
                  <Text style={[styles.budgetBtnText, budget === item.id && styles.budgetBtnTextActive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.budgetBtnDesc, budget === item.id && styles.budgetBtnDescActive]}>
                    {item.desc}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Vibe Theme */}
            <Text style={styles.formLabel}>Route Theme</Text>
            <View style={styles.themeGroup}>
              {[
                { id: "mix" as const, label: "Spontaneous Mix", icon: "sparkles" },
                { id: "cafe" as const, label: "Cafe Hops", icon: "cafe" },
                { id: "food" as const, label: "Foodie Stalls", icon: "pizza" },
                { id: "scenic" as const, label: "Scenic Spots", icon: "leaf" },
              ].map(item => (
                <Pressable
                  key={item.id}
                  onPress={() => setTheme(item.id)}
                  style={[styles.themeBtn, theme === item.id && styles.themeBtnActive]}
                >
                  <Ionicons name={item.icon as "sparkles" | "cafe" | "pizza" | "leaf"} size={14} color={theme === item.id ? "#020617" : "#2dd4bf"} />
                  <Text style={[styles.themeBtnText, theme === item.id && styles.themeBtnTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Start Spot Selector */}
            <Text style={styles.formLabel}>Choose Starting Spot in {city}</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={14} color="#64748b" style={{ marginRight: 6 }} />
              <TextInput
                value={searchStartQuery}
                onChangeText={setSearchStartQuery}
                placeholder="Search spots to start..."
                placeholderTextColor="#64748b"
                style={styles.searchInput}
              />
            </View>

            {loadingPlaces ? (
              <ActivityIndicator color="#2dd4bf" style={{ marginVertical: 14 }} />
            ) : (
              <View style={styles.pickerWrapper}>
                <ScrollView nestedScrollEnabled style={{ maxHeight: 160 }}>
                  {filteredPlaces.map(p => {
                    const isSelected = startPlaceId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setStartPlaceId(p.id)}
                        style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                      >
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                          {p.title} ({p.locality})
                        </Text>
                      </Pressable>
                    );
                  })}
                  {filteredPlaces.length === 0 && (
                    <Text style={{ color: "#64748b", fontSize: 11, padding: 10 }}>
                      No spots match your search.
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Generate Trigger */}
            <Pressable
              onPress={handleGenerateTrail}
              disabled={generating || places.length === 0}
              style={styles.generateBtn}
            >
              {generating ? (
                <ActivityIndicator color="#020617" size="small" />
              ) : (
                <>
                  <Ionicons name="git-pull-request" size={16} color="#020617" />
                  <Text style={styles.generateBtnText}>Build Spontaneous Route</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* PREVIEW TRAIL WALK RESULTS */}
          {previewStops && previewStats && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>{previewName}</Text>
                  <Text style={styles.previewMeta}>
                    🚶 {previewStats.distance} km walk · ⏳ {previewStats.duration} mins total
                  </Text>
                </View>
                <Pressable
                  onPress={handleSaveTrail}
                  disabled={savingPlan}
                  style={styles.savePlanBtn}
                >
                  {savingPlan ? (
                    <ActivityIndicator size="small" color="#020617" />
                  ) : (
                    <>
                      <Ionicons name="bookmark-outline" size={13} color="#020617" />
                      <Text style={styles.savePlanBtnText}>Save</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <AppMapView
                places={previewStops.map(p => ({
                  id: p.id,
                  title: p.title,
                  latitude: p.latitude,
                  longitude: p.longitude,
                  locality: p.locality,
                  category: p.category,
                  description: p.description
                }))}
                routePath={previewStops.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
                style={styles.previewMap}
              />

              <Text style={styles.itineraryHeader}>Route Stop Itinerary</Text>
              
              {previewStops.map((stop, idx) => (
                <View key={stop.id} style={styles.itineraryStop}>
                  <View style={styles.stopTimeline}>
                    <View style={styles.stopCircle}>
                      <Text style={styles.stopCircleText}>{idx + 1}</Text>
                    </View>
                    {idx < previewStops.length - 1 && <View style={styles.stopLine} />}
                  </View>
                  <View style={styles.stopBody}>
                    <Text style={styles.stopTitle}>{stop.title}</Text>
                    <Text style={styles.stopSub}>
                      {stop.category.toUpperCase()} · {stop.locality}
                    </Text>
                    <Text style={styles.stopDesc} numberOfLines={2}>
                      {stop.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        // SAVED TRIPS PLANS LIST
        <View style={{ flex: 1 }}>
          {!user ? (
            <View style={styles.emptyBox}>
              <Ionicons name="lock-closed-outline" size={42} color="#475569" />
              <Text style={styles.emptyTitle}>Access Locked</Text>
              <Text style={styles.emptySubTitle}>
                Please sign in on the Profile tab to view saved walks sync&apos;d to your account.
              </Text>
            </View>
          ) : loadingPlans ? (
            <ActivityIndicator color="#2dd4bf" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={savedPlans}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.scrollList}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelectedPlanDetails(item)}
                  style={styles.savedPlanCard}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                  </View>
                  <Text style={styles.planSub}>
                    From {item.source} to {item.destination}
                  </Text>
                  <View style={styles.planMetaRow}>
                    <Text style={styles.planMetaText}>
                      📍 {item.stops?.length || 0} stops
                    </Text>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.planMetaText}>
                      🏃 {item.distanceKm || "2.1"} km walk
                    </Text>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.planMetaText}>
                      ⏳ {item.durationMinutes || "40"} mins
                    </Text>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name="map-outline" size={42} color="#475569" />
                  <Text style={styles.emptyTitle}>No saved walks found</Text>
                  <Text style={styles.emptySubTitle}>
                    Generate a new spontaneous route and tap &quot;Save&quot; to keep track of your walks.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* PLAN DETAILS OVERLAY MODAL */}
      <Modal visible={selectedPlanDetails !== null} animationType="slide" transparent={false}>
        {selectedPlanDetails && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedPlanDetails.name}</Text>
                <Text style={styles.modalMeta}>
                  🚶 {selectedPlanDetails.distanceKm || "2.1"} km walk · ⏳ {selectedPlanDetails.durationMinutes || "40"} mins
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedPlanDetails(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color="#f8fafc" />
              </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <AppMapView
                places={(selectedPlanDetails.stops || []).map((s: any) => ({
                  id: s.id || String(s.placeId || Math.random()),
                  title: s.title || "Stop",
                  latitude: Number(s.latitude),
                  longitude: Number(s.longitude),
                  locality: s.locality,
                  category: s.category,
                  description: s.description,
                }))}
                routePath={(selectedPlanDetails.stops || []).map((s: any) => ({
                  latitude: Number(s.latitude),
                  longitude: Number(s.longitude)
                }))}
                style={styles.previewMap}
              />

              <Text style={styles.itineraryHeader}>Trip Stops sequence</Text>
              
              {selectedPlanDetails.stops?.map((stop: TripPlan["stops"][number], idx: number) => (
                <View key={stop.id} style={styles.itineraryStop}>
                  <View style={styles.stopTimeline}>
                    <View style={styles.stopCircle}>
                      <Text style={styles.stopCircleText}>{idx + 1}</Text>
                    </View>
                    {idx < selectedPlanDetails.stops.length - 1 && <View style={styles.stopLine} />}
                  </View>
                  <View style={styles.stopBody}>
                    <Text style={styles.stopTitle}>{stop.title}</Text>
                    <Text style={styles.stopSub}>
                      {stop.category?.toUpperCase()} · {stop.locality}
                    </Text>
                    <Text style={styles.stopDesc}>
                      {stop.description}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Modal>
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
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { color: "#94a3b8", fontSize: 12, fontWeight: "500", marginTop: 2 },

  // Tabs switcher
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabButtonActive: { backgroundColor: "#2dd4bf" },
  tabText: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#020617" },

  // Form Card
  formCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.08)",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  formSectionTitle: { color: "#cbd5e1", fontSize: 15, fontWeight: "900", marginBottom: 12 },
  formLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "800", textTransform: "uppercase", marginBottom: 8, marginTop: 12 },

  // Budget selections
  budgetGroup: { flexDirection: "row", gap: 6, marginBottom: 10 },
  budgetBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  budgetBtnActive: {
    borderColor: "#2dd4bf",
    backgroundColor: "rgba(45, 212, 191, 0.12)",
  },
  budgetBtnText: { color: "#94a3b8", fontSize: 11, fontWeight: "800" },
  budgetBtnTextActive: { color: "#2dd4bf" },
  budgetBtnDesc: { color: "#475569", fontSize: 8, fontWeight: "600", marginTop: 2, textAlign: "center" },
  budgetBtnDescActive: { color: "#2dd4bf" },

  // Theme selector
  themeGroup: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  themeBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  themeBtnActive: {
    borderColor: "#2dd4bf",
    backgroundColor: "#2dd4bf",
  },
  themeBtnText: { color: "#94a3b8", fontSize: 10, fontWeight: "800" },
  themeBtnTextActive: { color: "#020617" },

  // Start Spot Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 8,
  },
  pickerWrapper: {
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    overflow: "hidden",
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.03)",
  },
  pickerItemActive: {
    backgroundColor: "rgba(45, 212, 191, 0.08)",
  },
  pickerItemText: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  pickerItemTextActive: { color: "#2dd4bf", fontWeight: "800" },

  // Trigger Button
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2dd4bf",
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 18,
    gap: 6,
  },
  generateBtnText: { color: "#020617", fontWeight: "900", fontSize: 13 },

  // Preview Walk results
  previewCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.08)",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    paddingBottom: 12,
    marginBottom: 14,
  },
  previewTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "900" },
  previewMeta: { color: "#2dd4bf", fontSize: 11, fontWeight: "700", marginTop: 2 },
  previewMap: { height: 180, width: "100%", borderRadius: 14, marginBottom: 16 },
  savePlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2dd4bf",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 3,
  },
  savePlanBtnText: { color: "#020617", fontSize: 11, fontWeight: "800" },
  itineraryHeader: { color: "#94a3b8", fontSize: 10, fontWeight: "800", textTransform: "uppercase", marginBottom: 12, letterSpacing: 0.5 },

  // Itinerary stops timeline layout
  itineraryStop: { flexDirection: "row", gap: 16, marginBottom: 14 },
  stopTimeline: { alignItems: "center", width: 24 },
  stopCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 2,
    borderColor: "#2dd4bf",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2dd4bf",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  stopCircleText: { color: "#2dd4bf", fontSize: 10, fontWeight: "900" },
  stopLine: { width: 3, flex: 1, backgroundColor: "rgba(45, 212, 191, 0.25)", marginVertical: 2 },
  stopBody: { flex: 1, paddingBottom: 12 },
  stopTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "800" },
  stopSub: { color: "#94a3b8", fontSize: 11, fontWeight: "600", marginTop: 1 },
  stopDesc: { color: "#64748b", fontSize: 12, marginTop: 4, lineHeight: 16 },

  // Empty list box
  emptyBox: { alignItems: "center", justifyContent: "center", marginTop: 80, padding: 20 },
  emptyTitle: { color: "#94a3b8", fontSize: 14, fontWeight: "900", marginTop: 12 },
  emptySubTitle: { color: "#475569", fontSize: 11, fontWeight: "600", marginTop: 4, textAlign: "center", lineHeight: 16 },

  // Saved Plans list rows
  savedPlanCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.08)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "900", flex: 1, paddingRight: 8 },
  planSub: { color: "#64748b", fontSize: 11, fontWeight: "500", marginTop: 2 },
  planMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  planMetaText: { color: "#94a3b8", fontSize: 10, fontWeight: "600" },
  bullet: { color: "#334155", marginHorizontal: 6, fontSize: 8 },

  // Details Modal overlay
  modalContainer: { flex: 1, backgroundColor: "#020617" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "#0f172a",
  },
  modalTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  modalMeta: { color: "#2dd4bf", fontSize: 11, fontWeight: "700", marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  scrollList: {
    paddingBottom: 100,
  },
});

