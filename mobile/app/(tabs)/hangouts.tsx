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
  createHangout,
  deleteHangout,
  fetchCurrentUser,
  fetchHangouts,
  fetchOsmPlaces,
  fetchShoutboxMessages,
  postShoutboxMessage,
  toggleRSVP,
  Place,
  AuthUser,
} from "../../src/api/client";
import {
  cachePlaces,
  getCachedPlaces,
  cacheHangouts,
  getCachedHangouts,
} from "../../src/api/cache";
import AppMapView from "../../src/components/MapView";


const CITIES = ["Pune", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolhapur", "Nashik"] as const;

interface HangoutRSVP {
  userId: string;
}

interface Hangout {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  whatsappLink: string;
  placeTitle: string;
  placeId?: string;
  userId: string;
  userFullName: string;
  createdAt: string;
  rsvps?: HangoutRSVP[];
}

interface ShoutboxMessage {
  id: string;
  text: string;
  userFullName: string;
  createdAt: string;
  level?: number;
}

export default function HangoutsScreen() {
  const [city, setCity] = useState<(typeof CITIES)[number]>("Pune");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [viewMode, setViewMode] = useState<"meetups" | "shoutbox">("meetups");
  const [showMap, setShowMap] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  // Meetup States
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [loadingHangouts, setLoadingHangouts] = useState(true);
  const [meetupSearch, setMeetupSearch] = useState("");

  // Shoutbox States
  const [shoutboxMessages, setShoutboxMessages] = useState<ShoutboxMessage[]>([]);
  const [shoutboxLoading, setShoutboxLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState("");
  const [submittingShoutout, setSubmittingShoutout] = useState(false);

  // Create Meetup Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formPlaceId, setFormPlaceId] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [formError, setFormError] = useState("");
  const [submittingMeetup, setSubmittingMeetup] = useState(false);

  // Sync city whenever we focus the screen
  useFocusEffect(
    useCallback(() => {
      const loadCity = async () => {
        try {
          const storedCity = await AsyncStorage.getItem("sheher_active_city");
          if (storedCity && CITIES.includes(storedCity as (typeof CITIES)[number])) {
            setCity(storedCity as (typeof CITIES)[number]);
          }
        } catch (err) {
          console.log("Error loading persistent city on focus:", err);
        }
      };
      loadCity();
      
      // Fetch authenticated user info
      fetchCurrentUser()
        .then((u: AuthUser | null) => setUser(u))
        .catch(() => setUser(null));
    }, [])
  );

  const handleCityChange = async (newCity: (typeof CITIES)[number]) => {
    setCity(newCity);
    try {
      await AsyncStorage.setItem("sheher_active_city", newCity);
    } catch (err) {
      console.log("Error storing active city:", err);
    }
  };

  const loadHangouts = useCallback(async (silent = false) => {
    if (!silent) setLoadingHangouts(true);
    try {
      const list = await fetchHangouts(city);
      setHangouts(list);
      setIsOffline(false);
      void cacheHangouts(list);
    } catch (err) {
      console.log("Error loading hangouts, falling back to cache:", err);
      setIsOffline(true);
      const cached = await getCachedHangouts();
      if (cached) {
        setHangouts(cached);
      }
    } finally {
      if (!silent) setLoadingHangouts(false);
    }
  }, [city]);

  const loadShoutbox = useCallback(async (silent = false) => {
    if (!silent) setShoutboxLoading(true);
    try {
      const messages = await fetchShoutboxMessages(city);
      setShoutboxMessages(messages);
    } catch (err) {
      console.log("Error loading shoutbox:", err);
    } finally {
      if (!silent) setShoutboxLoading(false);
    }
  }, [city]);

  const loadPlaces = useCallback(async () => {
    setLoadingPlaces(true);
    try {
      const osmPlaces = await fetchOsmPlaces(city);
      setPlaces(osmPlaces);
      setIsOffline(false);
      if (osmPlaces.length > 0) {
        setFormPlaceId(osmPlaces[0].id);
      }
      void cachePlaces(osmPlaces);
    } catch (err) {
      console.log("Error loading places for creator modal, falling back to cache:", err);
      setIsOffline(true);
      const cached = await getCachedPlaces();
      if (cached) {
        const cityPlaces = cached.filter((p: any) => p.city?.toLowerCase() === city.toLowerCase());
        setPlaces(cityPlaces);
        if (cityPlaces.length > 0) {
          setFormPlaceId(cityPlaces[0].id);
        }
      }
    } finally {
      setLoadingPlaces(false);
    }
  }, [city]);

  useEffect(() => {
    const timer = setTimeout(() => { 
      void loadHangouts(); 
      void loadShoutbox(); 
      void loadPlaces(); 
    }, 0);
    return () => clearTimeout(timer);
  }, [loadHangouts, loadShoutbox, loadPlaces]);

  // Poll shoutbox messages every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (viewMode === "shoutbox") {
        void loadShoutbox(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [loadShoutbox, viewMode]);

  useEffect(() => {
    if (isCreateOpen) {
      const timer = setTimeout(() => { void loadPlaces(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [isCreateOpen, loadPlaces]);

  const handleToggleRSVP = async (hangoutId: string) => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in on the website to RSVP to meetups.");
      return;
    }
    try {
      await toggleRSVP(hangoutId);
      void loadHangouts(true);
    } catch (err) {
      Alert.alert("RSVP Failed", err instanceof Error ? err.message : "Could not toggle RSVP");
    }
  };

  const handleDeleteMeetup = async (hangoutId: string) => {
    Alert.alert("Cancel Meetup", "Are you sure you want to delete this hangout?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteHangout(hangoutId);
            void loadHangouts(true);
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to cancel meetup");
          }
        },
      },
    ]);
  };

  const handlePostShoutout = async () => {
    if (!user) {
      Alert.alert("Authentication Required", "Please log in on the website to post vibe updates.");
      return;
    }
    if (!newMessageText.trim()) return;

    setSubmittingShoutout(true);
    try {
      await postShoutboxMessage(newMessageText.trim(), city);
      setNewMessageText("");
      void loadShoutbox(true);
    } catch (err) {
      Alert.alert("Post Failed", err instanceof Error ? err.message : "Could not publish vibe update");
    } finally {
      setSubmittingShoutout(false);
    }
  };

  const handleCreateMeetup = async () => {
    setFormError("");
    if (!formTitle.trim() || !formDesc.trim() || !formDate || !formWhatsapp.trim() || !formPlaceId) {
      setFormError("All fields are required.");
      return;
    }

    if (!formWhatsapp.trim().toLowerCase().startsWith("https://chat.whatsapp.com/")) {
      setFormError("Must be a valid WhatsApp invite link.");
      return;
    }

    setSubmittingMeetup(true);
    try {
      await createHangout({
        placeId: formPlaceId,
        title: formTitle.trim(),
        description: formDesc.trim(),
        eventDate: formDate,
        whatsappLink: formWhatsapp.trim(),
        city,
      });

      // Clear Form and reload
      setFormTitle("");
      setFormDesc("");
      setFormDate("");
      setFormWhatsapp("");
      setIsCreateOpen(false);
      void loadHangouts();
      Alert.alert("Success", "Meetup created! Check it out in the feed.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create hangout.");
    } finally {
      setSubmittingMeetup(false);
    }
  };

  // Helper date formatter
  const formatEventDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const matchesSearch = (h: Hangout) => {
    if (!meetupSearch.trim()) return true;
    const query = meetupSearch.toLowerCase();
    return (
      h.title.toLowerCase().includes(query) ||
      h.description.toLowerCase().includes(query) ||
      h.placeTitle.toLowerCase().includes(query)
    );
  };

  const filteredHangouts = hangouts.filter(matchesSearch);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sheher Hub</Text>
          <Text style={styles.subtitle}>Connect and explore the city together</Text>
        </View>
        <Ionicons name="people" size={28} color="#2dd4bf" />
      </View>

      {/* Cities Selector Row */}
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
              <Text style={[styles.cityText, city === item && styles.cityTextActive]}>{item}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ gap: 8 }}
        />
      </View>

      {/* Segmented Controller (Meetups vs Shoutbox) */}
      <View style={styles.segmentedContainer}>
        <Pressable
          onPress={() => setViewMode("meetups")}
          style={[styles.segmentBtn, viewMode === "meetups" && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, viewMode === "meetups" && styles.segmentTextActive]}>
            Meetups ({filteredHangouts.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode("shoutbox")}
          style={[styles.segmentBtn, viewMode === "shoutbox" && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, viewMode === "shoutbox" && styles.segmentTextActive]}>
            Vibe Shoutbox ({shoutboxMessages.length})
          </Text>
        </Pressable>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={13} color="#f59e0b" />
          <Text style={styles.offlineBannerText}>Offline Mode — Showing Cached Meetup Data</Text>
        </View>
      )}

      {viewMode === "meetups" ? (
        // MEETUPS SECTION
        <View style={{ flex: 1 }}>
          {/* Action buttons bar */}
          <View style={styles.actionsBar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 6 }} />
              <TextInput
                value={meetupSearch}
                onChangeText={setMeetupSearch}
                placeholder="Search plans or spots..."
                placeholderTextColor="#64748b"
                style={styles.searchInput}
              />
            </View>
            <Pressable onPress={() => setIsCreateOpen(true)} style={styles.planBtn}>
              <Ionicons name="add" size={16} color="#020617" />
              <Text style={styles.planBtnText}>Plan</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowMap(!showMap)}
              style={[styles.mapToggleBtn, showMap && styles.mapToggleActive]}
            >
              <Ionicons name={showMap ? "list" : "map"} size={16} color={showMap ? "#020617" : "#2dd4bf"} />
            </Pressable>
          </View>

          {loadingHangouts ? (
            <ActivityIndicator color="#2dd4bf" style={{ marginTop: 40 }} />
          ) : showMap ? (
            <AppMapView
              places={filteredHangouts
                .map((h) => {
                  const place = places.find((p) => p.id === h.placeId);
                  if (!place) return null;
                  return {
                    id: place.id,
                    title: `${h.title} (at ${place.title})`,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    locality: place.locality,
                    category: place.category,
                    description: h.description,
                  };
                })
                .filter((p): p is any => p !== null)}
              style={styles.hangoutsMap}
            />
          ) : filteredHangouts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>No meetups planned in {city} yet!</Text>
              <Text style={styles.emptySub}>Be the first to plan a Saturday crawl or food walk.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredHangouts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.scrollList}
              renderItem={({ item: h }) => {
                const isGoing = h.rsvps?.some((r: HangoutRSVP) => r.userId === user?.id);
                const isHost = h.userId === user?.id;

                return (
                  <View style={styles.meetupCard}>
                    {/* Host Header */}
                    <View style={styles.cardHeader}>
                      <View style={styles.hostAvatar}>
                        <Text style={styles.hostAvatarText}>
                          {h.userFullName ? h.userFullName.slice(0, 2).toUpperCase() : "?"}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.hostName}>{h.userFullName} (Host)</Text>
                        <Text style={styles.timeAgo}>
                          {new Date(h.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {isHost && (
                        <Pressable onPress={() => handleDeleteMeetup(h.id)} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={16} color="#f87171" />
                        </Pressable>
                      )}
                    </View>

                    {/* Content */}
                    <Text style={styles.meetupTitle}>{h.title}</Text>
                    <Text style={styles.meetupDesc}>{h.description}</Text>

                    {/* Spot and Time details */}
                    <View style={styles.detailsRow}>
                      <Ionicons name="location" size={14} color="#2dd4bf" />
                      <Text style={styles.detailsText} numberOfLines={1}>
                        Spot: <Text style={{ fontWeight: "700" }}>{h.placeTitle}</Text>
                      </Text>
                    </View>
                    <View style={styles.detailsRow}>
                      <Ionicons name="time" size={14} color="#2dd4bf" />
                      <Text style={styles.detailsText}>{formatEventDate(h.eventDate)}</Text>
                    </View>

                    {/* RSVP lists count */}
                    <View style={styles.rsvpSummary}>
                      <Ionicons name="checkmark-circle-outline" size={14} color="#34d399" />
                      <Text style={styles.rsvpText}>
                        {h.rsvps?.length || 0} explorers going
                      </Text>
                    </View>

                    {/* Meetup Action buttons */}
                    <View style={styles.btnRow}>
                      <Pressable
                        onPress={() => handleToggleRSVP(h.id)}
                        style={[styles.rsvpToggleBtn, isGoing && styles.rsvpToggleActive]}
                      >
                        <Ionicons
                          name={isGoing ? "checkmark-done" : "add"}
                          size={14}
                          color={isGoing ? "#34d399" : "#2dd4bf"}
                        />
                        <Text style={[styles.rsvpToggleText, isGoing && styles.rsvpToggleActiveText]}>
                          {isGoing ? "Going" : "RSVP"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => Alert.alert("WhatsApp Invite", `Forwarding to WhatsApp Link: \n${h.whatsappLink}`)}
                        style={styles.chatBtn}
                      >
                        <Ionicons name="logo-whatsapp" size={14} color="#020617" />
                        <Text style={styles.chatBtnText}>Join Group</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      ) : (
        // SHOUTBOX SECTION
        <View style={{ flex: 1 }}>
          {/* Shoutbox Message Input bar */}
          <View style={styles.shoutboxInputContainer}>
            <TextInput
              value={newMessageText}
              onChangeText={(txt) => setNewMessageText(txt.slice(0, 200))}
              placeholder={user ? `What's the vibe in ${city} right now?` : "Please log in to post..."}
              placeholderTextColor="#64748b"
              editable={!submittingShoutout && user !== null}
              style={styles.shoutboxInput}
            />
            <Pressable
              onPress={handlePostShoutout}
              disabled={submittingShoutout || !newMessageText.trim() || !user}
              style={styles.shoutboxSendBtn}
            >
              {submittingShoutout ? (
                <ActivityIndicator size="small" color="#020617" />
              ) : (
                <Ionicons name="send" size={16} color="#020617" />
              )}
            </Pressable>
          </View>

          {shoutboxLoading ? (
            <ActivityIndicator color="#2dd4bf" style={{ marginTop: 40 }} />
          ) : shoutboxMessages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color="#475569" />
              <Text style={styles.emptyText}>Shoutbox is quiet in {city}.</Text>
              <Text style={styles.emptySub}>Post a crowd check or ask what&apos;s happening!</Text>
            </View>
          ) : (
            <FlatList
              data={shoutboxMessages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.scrollList}
              renderItem={({ item: msg }) => (
                <View style={styles.shoutboxMsg}>
                  <View style={styles.shoutboxHeader}>
                    <View style={styles.levelBadge}>
                      <Text style={styles.levelBadgeText}>Lv.{msg.level || 1}</Text>
                    </View>
                    <Text style={styles.shoutboxUser}>{msg.userFullName}</Text>
                    <Text style={styles.shoutboxTime}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text style={styles.shoutboxText}>{msg.text}</Text>
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* CREATE HANGOUT MODAL FORM */}
      <Modal visible={isCreateOpen} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Plan a Hangout</Text>
            <Pressable onPress={() => setIsCreateOpen(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color="#f8fafc" />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.formLabel}>Meetup Title</Text>
            <TextInput
              value={formTitle}
              onChangeText={setFormTitle}
              maxLength={100}
              placeholder="e.g., Board games & craft beer crawl"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
            />

            <Text style={styles.formLabel}>Target Spot in {city}</Text>
            {loadingPlaces ? (
              <ActivityIndicator color="#2dd4bf" style={{ marginVertical: 10 }} />
            ) : (
              <View style={styles.pickerContainer}>
                <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                  {places.map((p) => {
                    const isSelected = formPlaceId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => setFormPlaceId(p.id)}
                        style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                      >
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                          {p.title} ({p.locality})
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <Text style={styles.formLabel}>Date & Time (YYYY-MM-DD HH:MM)</Text>
            <TextInput
              value={formDate}
              onChangeText={setFormDate}
              placeholder="e.g. 2026-06-15 19:30"
              placeholderTextColor="#64748b"
              style={styles.modalInput}
            />

            <Text style={styles.formLabel}>WhatsApp Group Invite Link</Text>
            <TextInput
              value={formWhatsapp}
              onChangeText={setFormWhatsapp}
              placeholder="https://chat.whatsapp.com/..."
              placeholderTextColor="#64748b"
              style={styles.modalInput}
            />

            <Text style={styles.formLabel}>Meetup Plan / Description</Text>
            <TextInput
              value={formDesc}
              onChangeText={setFormDesc}
              multiline
              numberOfLines={4}
              maxLength={1000}
              placeholder="Where are we meeting? What's the plan?"
              placeholderTextColor="#64748b"
              style={[styles.modalInput, { height: 100, textAlignVertical: "top" }]}
            />

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Pressable
              onPress={handleCreateMeetup}
              disabled={submittingMeetup}
              style={styles.formSubmitBtn}
            >
              {submittingMeetup ? (
                <ActivityIndicator color="#020617" size="small" />
              ) : (
                <Text style={styles.formSubmitText}>Publish Meetup Plan</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
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
  
  // Cities Row
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

  // Segment Controller
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: "#2dd4bf",
  },
  segmentText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#020617",
  },

  // Actions Bar (Search + Plan Button)
  actionsBar: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 8,
  },
  planBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2dd4bf",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  planBtnText: { color: "#020617", fontSize: 12, fontWeight: "800" },
  mapToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapToggleActive: {
    backgroundColor: "#2dd4bf",
    borderColor: "#2dd4bf",
  },
  hangoutsMap: {
    flex: 1,
    width: "100%",
    borderRadius: 20,
    marginBottom: 16,
  },

  // Meetup Cards Feed
  meetupCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.08)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  hostAvatar: {
    height: 32,
    width: 32,
    borderRadius: 16,
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  hostAvatarText: { color: "#2dd4bf", fontWeight: "900", fontSize: 11 },
  hostName: { color: "#e2e8f0", fontSize: 12, fontWeight: "800" },
  timeAgo: { color: "#64748b", fontSize: 10, fontWeight: "600", marginTop: 1 },
  deleteBtn: { padding: 4 },
  meetupTitle: { color: "#f8fafc", fontSize: 15, fontWeight: "900", marginBottom: 4 },
  meetupDesc: { color: "#cbd5e1", fontSize: 12, lineHeight: 18, fontWeight: "500", marginBottom: 12 },
  detailsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  detailsText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  rsvpSummary: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.05)", paddingTop: 8 },
  rsvpText: { color: "#34d399", fontSize: 11, fontWeight: "700" },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  rsvpToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(45, 212, 191, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.25)",
    borderRadius: 10,
    paddingVertical: 10,
    gap: 4,
  },
  rsvpToggleActive: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    borderColor: "rgba(52, 211, 153, 0.35)",
  },
  rsvpToggleText: { color: "#2dd4bf", fontSize: 12, fontWeight: "800" },
  rsvpToggleActiveText: { color: "#34d399" },
  chatBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2dd4bf",
    borderRadius: 10,
    paddingVertical: 10,
    gap: 4,
  },
  chatBtnText: { color: "#020617", fontSize: 12, fontWeight: "800" },

  // Shoutbox Styles
  shoutboxInputContainer: { flexDirection: "row", gap: 8, marginBottom: 16 },
  shoutboxInput: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  shoutboxSendBtn: {
    backgroundColor: "#2dd4bf",
    borderRadius: 12,
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  shoutboxMsg: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.08)",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  shoutboxHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  levelBadge: {
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    borderColor: "rgba(45, 212, 191, 0.25)",
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  levelBadgeText: { color: "#2dd4bf", fontSize: 8, fontWeight: "900" },
  shoutboxUser: { color: "#cbd5e1", fontSize: 11, fontWeight: "800", flex: 1 },
  shoutboxTime: { color: "#64748b", fontSize: 9, fontWeight: "600" },
  shoutboxText: { color: "#cbd5e1", fontSize: 12, lineHeight: 18, fontWeight: "500" },

  // Empty Box State
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 80, padding: 20 },
  emptyText: { color: "#94a3b8", fontSize: 14, fontWeight: "800", marginTop: 12 },
  emptySub: { color: "#475569", fontSize: 11, fontWeight: "600", marginTop: 4, textAlign: "center" },

  // Modals Plan Form
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
  modalTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "900" },
  modalCloseBtn: { padding: 4 },
  formLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 6, marginTop: 14 },
  modalInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  pickerContainer: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 10,
    padding: 6,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  pickerItemActive: {
    backgroundColor: "rgba(45, 212, 191, 0.1)",
  },
  pickerItemText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  pickerItemTextActive: { color: "#2dd4bf", fontWeight: "700" },
  formError: { color: "#f87171", fontSize: 11, fontWeight: "700", marginTop: 8 },
  formSubmitBtn: {
    backgroundColor: "#2dd4bf",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  formSubmitText: { color: "#020617", fontSize: 13, fontWeight: "900" },
  scrollList: {
    paddingBottom: 100,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  offlineBannerText: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "700",
  },
});
