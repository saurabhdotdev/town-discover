import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import {
  fetchCurrentUser,
  loginUser,
  signupUser,
  logoutUser,
  fetchGamificationStats,
  fetchSavedFolders,
  createFolder,
  deleteFolder,
  togglePlaceInFolder,
  fetchPrivateDiscoveryBrief,
  Place,
} from "../../src/api/client";
import { PlaceDetailModal } from "../../src/components/PlaceDetailModal";

interface PrivateDiscoveryBrief {
  summary: {
    savedCount: number;
    collectionCount: number;
    primaryCity: string;
    primaryCategory: string | null;
    isPremium: boolean;
    privacy: string;
  };
  insights: string[];
  quickPicks: Array<Place & {
    reason: string;
    privateSignal: string;
  }>;
  premiumUnlocks: Array<Place & {
    reason: string;
    privateSignal: string;
  }>;
  nextMoves: string[];
}

interface CurrentUser {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
  isPremiumPass?: boolean;
}

interface Badge {
  badge_id: string;
}

interface GamificationStats {
  level: number;
  title: string;
  totalXp: number;
  xpForNext: number;
  progress: number;
  badges: Badge[];
}

interface SavedFolder {
  id: string;
  name: string;
  placeIds: string[];
}

const BADGES = [
  { id: "first-save", name: "Wishlist Starter", desc: "Save your first place to unlock your journey.", emoji: "🌱" },
  { id: "collector", name: "Collector", desc: "Save 5 different spots across any city.", emoji: "📌" },
  { id: "curator", name: "Curator", desc: "Save 20 places. You have impeccable taste.", emoji: "🎨" },
  { id: "night-rider", name: "Night Rider", desc: "Save a night-drive route. Midnight is your lane.", emoji: "🌙" },
  { id: "street-food-guru", name: "Street Food Guru", desc: "Save 3 street-food spots. Taste the city.", emoji: "🍢" },
  { id: "city-eye", name: "City Eye", desc: "Submit your first crowd report. Help the community.", emoji: "👁" },
  { id: "signal-sender", name: "Signal Sender", desc: "Submit 5 crowd reports. You're on the pulse.", emoji: "📡" },
  { id: "community-scout", name: "Community Scout", desc: "Suggest your first place. Help put it on the map.", emoji: "🗺" },
  { id: "spot-approved", name: "Spot Approved", desc: "One of your suggestions was approved!", emoji: "✅" },
  { id: "first-review", name: "Local Critic", desc: "Write your first place review. Let others know the vibe.", emoji: "✍️" },
  { id: "pro-critic", name: "Pro Critic", desc: "Write 5 place reviews. A true guide for the town.", emoji: "📝" },
  { id: "elite-critic", name: "Elite Critic", desc: "Write 15 place reviews. Your reviews are legendary.", emoji: "👑" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth Forms
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authError, setAuthError] = useState("");
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Gamification Stats
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Private Discovery
  const [privateMode, setPrivateMode] = useState(true);
  const [privateBrief, setPrivateBrief] = useState<PrivateDiscoveryBrief | null>(null);
  const [privateBriefLoading, setPrivateBriefLoading] = useState(false);
  const [privateBriefError, setPrivateBriefError] = useState("");

  // Folders & Bookmarks
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [localBookmarks, setLocalBookmarks] = useState<Record<string, Place>>({});
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Detail Modal
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Dropdown place manager
  const [selectedPlaceForFolder, setSelectedPlaceForFolder] = useState<Place | null>(null);
  const [isManageFolderOpen, setIsManageFolderOpen] = useState(false);

  const loadPrivateBrief = useCallback(async (isSilent = false) => {
    if (!privateMode) {
      setPrivateBrief(null);
      return;
    }
    if (!isSilent) setPrivateBriefLoading(true);
    setPrivateBriefError("");
    try {
      const res = await fetchPrivateDiscoveryBrief();
      setPrivateBrief(res);
    } catch (err) {
      setPrivateBriefError(err instanceof Error ? err.message : "Could not load private brief");
      setPrivateBrief(null);
    } finally {
      if (!isSilent) setPrivateBriefLoading(false);
    }
  }, [privateMode]);

  const syncProfile = async () => {
    setLoading(true);
    setAuthError("");
    try {
      const u = await fetchCurrentUser();
      setUser(u);
      if (u) {
        // Load stats & folders
        void loadStatsAndFolders();
        void loadPrivateBrief();
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadStatsAndFolders = async () => {
    setLoadingStats(true);
    try {
      const [gamification, collectionFolders] = await Promise.all([
        fetchGamificationStats(),
        fetchSavedFolders(),
      ]);
      setStats(gamification);
      setFolders(collectionFolders || []);
    } catch (err) {
      console.log("Error loading stats/folders:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const syncLocalBookmarks = async () => {
    try {
      const stored = await AsyncStorage.getItem("sheher_saved_places");
      if (stored) {
        setLocalBookmarks(JSON.parse(stored));
      } else {
        setLocalBookmarks({});
      }
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      const loadPrivateMode = async () => {
        try {
          const stored = await AsyncStorage.getItem("sheher_private_mode");
          if (stored !== null) {
            setPrivateMode(stored === "true");
          }
        } catch (err) {
          console.log("Error loading private mode preference:", err);
        }
      };
      void loadPrivateMode();
      void syncProfile();
      void syncLocalBookmarks();
    }, [])
  );

  useEffect(() => {
    if (user && privateMode) {
      void loadPrivateBrief();
    } else {
      setPrivateBrief(null);
    }
  }, [privateMode, user, loadPrivateBrief]);

  const handleTogglePrivateMode = async () => {
    const nextMode = !privateMode;
    setPrivateMode(nextMode);
    try {
      await AsyncStorage.setItem("sheher_private_mode", String(nextMode));
    } catch (err) {
      console.log("Error saving private mode preference:", err);
    }
  };

  const handleAuthSubmit = async () => {
    setAuthError("");
    if (!email.trim() || !password) {
      setAuthError("All fields are required.");
      return;
    }
    if (authMode === "signup" && !fullName.trim()) {
      setAuthError("Full Name is required.");
      return;
    }

    setSubmittingAuth(true);
    try {
      if (authMode === "login") {
        const res = await loginUser(email.trim(), password);
        setUser(res.user);
      } else {
        const res = await signupUser(email.trim(), password, fullName.trim());
        setUser(res.user);
      }
      setEmail("");
      setPassword("");
      setFullName("");
      void loadStatsAndFolders();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          try {
            await logoutUser();
            setUser(null);
            setStats(null);
            setFolders([]);
            setActiveFolderId(null);
          } catch (err) {
            Alert.alert("Logout Failed", err instanceof Error ? err.message : "Failed to complete request");
          }
        },
      },
    ]);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const folder = await createFolder(newFolderName.trim());
      setFolders((prev) => [folder, ...prev]);
      setNewFolderName("");
      setIsFolderModalOpen(false);
      void loadPrivateBrief(true);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = (folderId: string, folderName: string) => {
    Alert.alert("Delete Collection", `Are you sure you want to delete "${folderName}"? Places inside will remain bookmarked overall.`, [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFolder(folderId);
            setFolders((prev) => prev.filter((f) => f.id !== folderId));
            if (activeFolderId === folderId) {
              setActiveFolderId(null);
            }
            void loadPrivateBrief(true);
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete collection");
          }
        },
      },
    ]);
  };

  const handleTogglePlaceFolder = async (folderId: string) => {
    if (!selectedPlaceForFolder) return;
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;

    const isInFolder = folder.placeIds.includes(selectedPlaceForFolder.id);
    try {
      await togglePlaceInFolder(selectedPlaceForFolder.id, folderId, isInFolder);
      // Local state sync
      setFolders((prev) =>
        prev.map((f) => {
          if (f.id === folderId) {
            const nextPlaceIds = isInFolder
              ? f.placeIds.filter((id: string) => id !== selectedPlaceForFolder.id)
              : [...f.placeIds, selectedPlaceForFolder.id];
            return { ...f, placeIds: nextPlaceIds };
          }
          return f;
        })
      );
      void loadPrivateBrief(true);
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Could not update collection");
    }
  };

  const handleRetakeQuiz = async () => {
    try {
      await AsyncStorage.removeItem("sheher_onboarding_completed");
      await AsyncStorage.removeItem("sheher_active_city");
      Alert.alert("Onboarding Reset", "Go back to Explore to start fresh!", [
        { text: "OK", onPress: () => router.push("/(tabs)") },
      ]);
    } catch {}
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Saved bookmarks filtered by folder selection
  const displayedBookmarks = Object.values(localBookmarks).filter((place) => {
    if (!activeFolderId) return true;
    const folder = folders.find((f) => f.id === activeFolderId);
    return folder ? folder.placeIds.includes(place.id) : true;
  });

  const isBadgeUnlocked = (badgeId: string) => {
    if (!stats || !stats.badges) return false;
    return stats.badges.some((b: Badge) => b.badge_id === badgeId);
  };

  const openPlaceDetail = (place: Place) => {
    setSelectedPlace(place);
    setDetailModalOpen(true);
  };

  const handleToggleSaveGlobal = async (place: Place) => {
    // Modify AsyncStorage bookmarks
    const next = { ...localBookmarks };
    if (next[place.id]) {
      delete next[place.id];
    } else {
      next[place.id] = place;
    }
    setLocalBookmarks(next);
    await AsyncStorage.setItem("sheher_saved_places", JSON.stringify(next));
    void loadPrivateBrief(true);
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#2dd4bf" />
      </View>
    );
  }

  if (!user) {
    // Auth Login / Register Screen
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: 60, paddingBottom: 40 }}>
        <View style={styles.headerCentered}>
          <Ionicons name="compass" size={54} color="#2dd4bf" />
          <Text style={styles.welcomeTitle}>Sheher Explorer</Text>
          <Text style={styles.welcomeSub}>Sign in to earn XP, unlock city badges, and sync custom collections</Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.authCardTitle}>
            {authMode === "login" ? "Welcome Back Explorer" : "Create Explorer Account"}
          </Text>

          {authMode === "signup" && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
                placeholderTextColor="#64748b"
                style={styles.authInput}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="explorer@sheher.in"
              placeholderTextColor="#64748b"
              style={styles.authInput}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              style={styles.authInput}
            />
          </View>

          {authError ? <Text style={styles.authError}>{authError}</Text> : null}

          <Pressable
            onPress={handleAuthSubmit}
            disabled={submittingAuth}
            style={styles.authSubmitBtn}
          >
            {submittingAuth ? (
              <ActivityIndicator color="#020617" size="small" />
            ) : (
              <Text style={styles.authSubmitBtnText}>
                {authMode === "login" ? "Log In" : "Register Account"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setAuthMode((prev) => (prev === "login" ? "signup" : "login"));
              setAuthError("");
            }}
            style={styles.authToggleBtn}
          >
            <Text style={styles.authToggleText}>
              {authMode === "login"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Log In"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // Authenticated Profile Dashboard Screen
  return (
    <View style={styles.screen}>
      <FlatList
        data={displayedBookmarks}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
        ListHeaderComponent={
          <View>
            {/* Header User Card */}
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user.fullName || user.email)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.profileName}>{user.fullName || "Explorer"}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
                <View style={styles.roleRow}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {user.role === "super_admin" ? "SUPER ADMIN" : "EXPLORER"}
                    </Text>
                  </View>
                  {user.isPremiumPass && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="sparkles" size={10} color="#fbbf24" />
                      <Text style={styles.premiumBadgeText}>PREMIUM PASS</Text>
                    </View>
                  )}
                </View>
              </View>
              <Pressable onPress={handleLogout} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={18} color="#f87171" />
              </Pressable>
            </View>

            {/* Passport & XP progress bar */}
            {loadingStats ? (
              <ActivityIndicator color="#2dd4bf" style={{ marginVertical: 20 }} />
            ) : (
              stats && (
                <View style={styles.passportCard}>
                  <View style={styles.passportHeader}>
                    <Ionicons name="ribbon" size={18} color="#2dd4bf" />
                    <Text style={styles.passportTitle}>Sheher Explorer Passport</Text>
                  </View>
                  <View style={styles.passportRow}>
                    <View style={styles.levelIndicator}>
                      <Text style={styles.levelNum}>{stats.level}</Text>
                      <Text style={styles.levelLabel}>Level</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <Text style={styles.passportStatsTitle}>{stats.title}</Text>
                      <Text style={styles.passportXpSub}>
                        {stats.totalXp} / {stats.xpForNext} total XP earned
                      </Text>
                      {/* Bar indicator */}
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${stats.progress}%` }]} />
                      </View>
                    </View>
                  </View>

                  {/* Badge Shelf Grid */}
                  <Text style={styles.badgeShelfHeader}>Unlocked Badges</Text>
                  <View style={styles.badgeGrid}>
                    {BADGES.map((badge) => {
                      const unlocked = isBadgeUnlocked(badge.id);
                      return (
                        <View
                          key={badge.id}
                          style={[styles.badgeItem, unlocked ? styles.badgeItemUnlocked : styles.badgeItemLocked]}
                        >
                          <Text style={[styles.badgeEmoji, !unlocked && { opacity: 0.25 }]}>
                            {badge.emoji}
                          </Text>
                          <Text style={[styles.badgeName, !unlocked && { color: "#475569" }]} numberOfLines={1}>
                            {badge.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )
            )}

            {/* Private Discovery Brief Panel */}
            <View style={styles.privatePanel}>
              <View style={styles.privatePanelHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.privateBadgeRow}>
                    <Ionicons name="lock-closed" size={12} color="#2dd4bf" style={{ marginRight: 4 }} />
                    <Text style={styles.privateBadgeText}>PRIVATE DISCOVERY</Text>
                  </View>
                  <Text style={styles.privateTitle}>Your Personal City Brief</Text>
                </View>
                {privateMode && (
                  <Pressable
                    onPress={() => void loadPrivateBrief(false)}
                    disabled={privateBriefLoading}
                    style={styles.privateRefreshBtn}
                  >
                    <Ionicons
                      name="reload"
                      size={16}
                      color="#2dd4bf"
                    />
                  </Pressable>
                )}
              </View>

              {!privateMode ? (
                <View style={styles.privateEmptyCard}>
                  <Text style={styles.privateEmptyText}>
                    Private discovery is paused. Your saved places still stay in your account. Turn it on in Preferences below.
                  </Text>
                </View>
              ) : privateBriefLoading && !privateBrief ? (
                <View style={styles.privateLoadingBox}>
                  <ActivityIndicator color="#2dd4bf" style={{ marginBottom: 8 }} />
                  <Text style={styles.privateLoadingText}>Computing private city insights...</Text>
                </View>
              ) : privateBriefError ? (
                <View style={styles.privateErrorBox}>
                  <Ionicons name="alert-circle" size={24} color="#f87171" />
                  <Text style={styles.privateErrorText}>{privateBriefError}</Text>
                </View>
              ) : privateBrief ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.privatePrivacySub}>{privateBrief.summary.privacy}</Text>

                  {/* Stats Grid */}
                  <View style={styles.privateStatsGrid}>
                    <View style={styles.privateStatCard}>
                      <Text style={styles.privateStatValue}>{privateBrief.summary.savedCount}</Text>
                      <Text style={styles.privateStatLabel}>SAVED SIGNAL</Text>
                    </View>
                    <View style={styles.privateStatCard}>
                      <Text style={styles.privateStatValue}>{privateBrief.summary.collectionCount}</Text>
                      <Text style={styles.privateStatLabel}>COLLECTIONS</Text>
                    </View>
                    <View style={styles.privateStatCard}>
                      <Text style={styles.privateStatValue} numberOfLines={1}>
                        {privateBrief.summary.primaryCity}
                      </Text>
                      <Text style={styles.privateStatLabel}>BEST CITY</Text>
                    </View>
                  </View>

                  {/* Private Picks */}
                  <Text style={styles.privateSectionTitle}>Private Picks to Try Next</Text>
                  {privateBrief.quickPicks.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.picksScroll}
                    >
                      {privateBrief.quickPicks.map((pick) => (
                        <Pressable
                          key={pick.id}
                          onPress={() => openPlaceDetail(pick)}
                          style={styles.pickCard}
                        >
                          <View style={styles.pickImageContainer}>
                            {pick.image ? (
                              <Image source={{ uri: pick.image }} style={styles.pickImage} />
                            ) : (
                              <View style={[styles.pickImage, { backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" }]}>
                                <Ionicons name="image-outline" size={20} color="#64748b" />
                              </View>
                            )}
                            <View style={styles.pickCategoryBadge}>
                              <Text style={styles.pickCategoryText}>{pick.category.toUpperCase()}</Text>
                            </View>
                          </View>
                          <View style={styles.pickCardBody}>
                            <Text style={styles.pickTitle} numberOfLines={1}>
                              {pick.title}
                            </Text>
                            <Text style={styles.pickReason} numberOfLines={2}>
                              {pick.reason}
                            </Text>
                            <View style={styles.pickMeta}>
                              <Ionicons name="location-outline" size={10} color="#94a3b8" />
                              <Text style={styles.pickMetaText} numberOfLines={1}>{pick.locality}</Text>
                              <Text style={styles.pickBullet}>•</Text>
                              <Ionicons name="star" size={10} color="#fbbf24" />
                              <Text style={styles.pickMetaText}>{pick.rating.toFixed(1)}</Text>
                            </View>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.privateEmptyCard}>
                      <Text style={styles.privateEmptyText}>
                        Save a few places first and this will become a personal shortlist.
                      </Text>
                    </View>
                  )}

                  {/* Insights & Signals */}
                  <Text style={styles.privateSectionTitle}>Signals</Text>
                  <View style={styles.insightsWrapper}>
                    {privateBrief.insights.map((insight, idx) => (
                      <View key={idx} style={styles.insightRow}>
                        <Ionicons name="radio-outline" size={14} color="#2dd4bf" style={{ marginRight: 6 }} />
                        <Text style={styles.insightText}>{insight}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Premium unlocks section */}
                  <Text style={styles.privateSectionTitle}>Explorer Pass Value</Text>
                  <View style={styles.premiumValueCard}>
                    <View style={styles.premiumHeaderRow}>
                      <Text style={styles.premiumValueTitle}>Premium Private Shortlist</Text>
                      {!user.isPremiumPass && <Ionicons name="lock-closed" size={14} color="#fbbf24" />}
                    </View>
                    <View style={{ gap: 8, marginTop: 8 }}>
                      {privateBrief.premiumUnlocks.slice(0, 2).map((pick) => (
                        <View key={pick.id} style={styles.premiumItem}>
                          <Text style={styles.premiumItemTitle} numberOfLines={1}>{pick.title}</Text>
                          <Text style={styles.premiumItemDesc}>
                            {user.isPremiumPass
                              ? pick.privateSignal
                              : "Hidden matching reason, deal readiness, and extended shortlist."}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Next moves */}
                  <Text style={styles.privateSectionTitle}>Next moves</Text>
                  <View style={styles.nextMovesWrapper}>
                    {privateBrief.nextMoves.map((move, idx) => (
                      <View key={idx} style={styles.nextMoveRow}>
                        <Ionicons name="sparkles" size={14} color="#2dd4bf" style={{ marginRight: 6 }} />
                        <Text style={styles.nextMoveText}>{move}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>

            {/* Collections & saved place selector */}
            <View style={styles.collectionsSection}>
              <View style={styles.collectionsHeader}>
                <Text style={styles.collectionsTitle}>Saved Places</Text>
                <Pressable onPress={() => setIsFolderModalOpen(true)} style={styles.addFolderBtn}>
                  <Ionicons name="add-circle-outline" size={16} color="#2dd4bf" />
                  <Text style={styles.addFolderText}>Collection</Text>
                </Pressable>
              </View>

              {/* Collections pill switcher */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.folderScroll}
              >
                <Pressable
                  onPress={() => setActiveFolderId(null)}
                  style={[styles.folderChip, activeFolderId === null && styles.folderChipActive]}
                >
                  <Text style={[styles.folderChipText, activeFolderId === null && styles.folderChipTextActive]}>
                    All ({Object.keys(localBookmarks).length})
                  </Text>
                </Pressable>

                {folders.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => setActiveFolderId(f.id)}
                    onLongPress={() => handleDeleteFolder(f.id, f.name)}
                    style={[styles.folderChip, activeFolderId === f.id && styles.folderChipActive]}
                  >
                    <Text style={[styles.folderChipText, activeFolderId === f.id && styles.folderChipTextActive]}>
                      📁 {f.name} ({f.placeIds?.length || 0})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item: place }) => (
          <Pressable onPress={() => openPlaceDetail(place)} style={styles.card}>
            {place.image ? (
              <Image source={{ uri: place.image }} style={styles.image} resizeMode="cover" alt="" />
            ) : (
              <View style={[styles.image, { backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="image-outline" size={24} color="#64748b" />
              </View>
            )}
            <View style={styles.cardBody}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {place.title}
                </Text>
                <Pressable
                  onPress={() => {
                    setSelectedPlaceForFolder(place);
                    setIsManageFolderOpen(true);
                  }}
                  style={styles.folderMoveBtn}
                >
                  <Ionicons name="folder-open-outline" size={15} color="#94a3b8" />
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
            <Ionicons name="bookmark-outline" size={42} color="#475569" />
            <Text style={styles.emptyText}>No saved spots in this collection</Text>
            <Text style={styles.emptySub}>Tap bookmarks in Explore to save places locally.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerContainer}>
            <View style={styles.preferencesCard}>
              <Text style={styles.preferencesTitle}>Preferences</Text>
              
              <Pressable onPress={handleTogglePrivateMode} style={styles.prefRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.prefLabel}>Private Discovery</Text>
                  <Text style={styles.prefSub}>Build personalized briefs from saves</Text>
                </View>
                <Ionicons
                  name={privateMode ? "toggle" : "toggle-outline"}
                  size={28}
                  color={privateMode ? "#2dd4bf" : "#475569"}
                />
              </Pressable>

              <Pressable onPress={handleRetakeQuiz} style={styles.prefRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefLabel}>Retake Vibe Quiz</Text>
                  <Text style={styles.prefSub}>Reset onboarding selection</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748b" style={{ marginLeft: "auto" }} />
              </Pressable>
            </View>
          </View>
        }
      />

      {/* CREATE COLLECTION MODAL */}
      <Modal visible={isFolderModalOpen} animationType="slide" transparent>
        <View style={styles.overlayContainer}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Create Collection</Text>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="e.g. Saturday coffee hops"
              placeholderTextColor="#64748b"
              style={styles.dialogInput}
            />
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setIsFolderModalOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                style={styles.confirmBtn}
              >
                <Text style={styles.confirmBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MANAGE PLACE FOLDER MODAL */}
      <Modal visible={isManageFolderOpen} animationType="slide" transparent>
        <View style={styles.overlayContainer}>
          <View style={styles.dialogCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={styles.dialogTitle} numberOfLines={1}>
                Save to Collection
              </Text>
              <Pressable onPress={() => setIsManageFolderOpen(false)}>
                <Ionicons name="close" size={20} color="#f8fafc" />
              </Pressable>
            </View>
            <Text style={styles.dialogSub}>Select folders to save &quot;{selectedPlaceForFolder?.title}&quot;:</Text>
            
            {folders.length === 0 ? (
              <Text style={{ color: "#64748b", fontSize: 12, marginVertical: 14 }}>
                No custom collections created yet.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 200, marginVertical: 8 }}>
                {folders.map((f) => {
                  const hasSpot = selectedPlaceForFolder && f.placeIds.includes(selectedPlaceForFolder.id);
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => handleTogglePlaceFolder(f.id)}
                      style={styles.folderSelectItem}
                    >
                      <Ionicons
                        name={hasSpot ? "checkbox" : "square-outline"}
                        size={18}
                        color={hasSpot ? "#2dd4bf" : "#64748b"}
                      />
                      <Text style={[styles.folderSelectName, hasSpot && { color: "#f8fafc" }]}>
                        {f.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "#1e293b", paddingTop: 10 }}>
              <Pressable
                onPress={() => {
                  if (selectedPlaceForFolder) {
                    void handleToggleSaveGlobal(selectedPlaceForFolder);
                  }
                  setIsManageFolderOpen(false);
                }}
                style={styles.unsaveGlobalBtn}
              >
                <Ionicons name="trash-outline" size={14} color="#f87171" />
                <Text style={styles.unsaveGlobalText}>Unsave place completely</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Place Detail Modal Overlay */}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          visible={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          isSaved={!!localBookmarks[selectedPlace.id]}
          onToggleSave={() => handleToggleSaveGlobal(selectedPlace)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#020617", padding: 16, paddingTop: 48 },
  centered: { alignItems: "center", justifyContent: "center" },
  headerCentered: { alignItems: "center", justifyContent: "center", marginTop: 20, marginBottom: 30, paddingHorizontal: 20 },
  welcomeTitle: { color: "#f8fafc", fontSize: 24, fontWeight: "900", marginTop: 12 },
  welcomeSub: { color: "#64748b", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 6, lineHeight: 18 },

  // Auth Card
  authCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 8,
  },
  authCardTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "900", marginBottom: 16 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "800", textTransform: "uppercase", marginBottom: 6 },
  authInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  authError: { color: "#f87171", fontSize: 11, fontWeight: "700", marginBottom: 10 },
  authSubmitBtn: {
    backgroundColor: "#2dd4bf",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  authSubmitBtnText: { color: "#020617", fontWeight: "900", fontSize: 13 },
  authToggleBtn: { alignSelf: "center", marginTop: 16 },
  authToggleText: { color: "#2dd4bf", fontSize: 11, fontWeight: "700" },

  // Authenticated Header
  profileHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#2dd4bf", fontWeight: "900", fontSize: 15 },
  profileName: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  profileEmail: { color: "#64748b", fontSize: 12, fontWeight: "500", marginTop: 1 },
  roleRow: { flexDirection: "row", gap: 6, marginTop: 4, alignItems: "center" },
  roleBadge: { backgroundColor: "#1e293b", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  roleBadgeText: { color: "#94a3b8", fontSize: 8, fontWeight: "800" },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    gap: 3,
  },
  premiumBadgeText: { color: "#fbbf24", fontSize: 8, fontWeight: "900" },
  logoutBtn: { padding: 8 },

  // Passport Card
  passportCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  passportHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  passportTitle: { color: "#2dd4bf", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  passportRow: { flexDirection: "row", alignItems: "center" },
  levelIndicator: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(45, 212, 191, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelNum: { color: "#2dd4bf", fontSize: 18, fontWeight: "900" },
  levelLabel: { color: "#64748b", fontSize: 8, fontWeight: "800", textTransform: "uppercase", marginTop: -2 },
  passportStatsTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  passportXpSub: { color: "#64748b", fontSize: 11, fontWeight: "600", marginTop: 2 },
  progressBarBg: { height: 6, backgroundColor: "#020617", borderRadius: 3, marginTop: 8, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#2dd4bf", borderRadius: 3 },

  // Badge Shelf
  badgeShelfHeader: { color: "#94a3b8", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginTop: 14, marginBottom: 8 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeItem: {
    width: "30.8%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  badgeItemUnlocked: {
    backgroundColor: "#020617",
    borderColor: "#1e293b",
  },
  badgeItemLocked: {
    backgroundColor: "rgba(15, 23, 42, 0.3)",
    borderColor: "rgba(30, 41, 59, 0.4)",
    opacity: 0.5,
  },
  badgeEmoji: { fontSize: 20, marginBottom: 4 },
  badgeName: { color: "#e2e8f0", fontSize: 9, fontWeight: "800", textAlign: "center" },

  // Collections Header
  collectionsSection: { marginTop: 4, marginBottom: 12 },
  collectionsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  collectionsTitle: { color: "#cbd5e1", fontSize: 15, fontWeight: "900" },
  addFolderBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  addFolderText: { color: "#2dd4bf", fontSize: 11, fontWeight: "800" },
  folderScroll: { gap: 8, paddingBottom: 6 },
  folderChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  folderChipActive: {
    borderColor: "#2dd4bf",
    backgroundColor: "rgba(45, 212, 191, 0.12)",
  },
  folderChipText: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  folderChipTextActive: { color: "#2dd4bf" },

  // Bookmark Card Row
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  image: { width: 72, height: 72, borderRadius: 8 },
  cardBody: { flex: 1, justifyContent: "space-between" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#f8fafc", fontWeight: "800", fontSize: 13, flex: 1, paddingRight: 6 },
  folderMoveBtn: { padding: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 1 },
  cardMeta: { color: "#64748b", fontSize: 10, fontWeight: "600" },
  bullet: { color: "#334155", marginHorizontal: 4, fontSize: 8 },
  cardDesc: { color: "#64748b", fontSize: 11, marginTop: 2, lineHeight: 15, fontWeight: "500" },

  // Empty List
  emptyContainer: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "#64748b", fontSize: 12, fontWeight: "700", marginTop: 8 },
  emptySub: { color: "#475569", fontSize: 10, fontWeight: "500", textAlign: "center", marginTop: 4 },

  // Dialog Modals
  overlayContainer: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.75)", justifyContent: "center", alignItems: "center", padding: 20 },
  dialogCard: { width: "100%", maxWidth: 320, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#1e293b", borderRadius: 14, padding: 18 },
  dialogTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "900" },
  dialogSub: { color: "#64748b", fontSize: 11, fontWeight: "600", marginTop: 2, marginBottom: 10 },
  dialogInput: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
    marginVertical: 14,
  },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  cancelBtnText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  confirmBtn: { backgroundColor: "#2dd4bf", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  confirmBtnText: { color: "#020617", fontSize: 12, fontWeight: "900" },

  // Folder Select Dialog Checkboxes
  folderSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  folderSelectName: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  unsaveGlobalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6, width: "100%" },
  unsaveGlobalText: { color: "#f87171", fontSize: 11, fontWeight: "800" },

  // Private Discovery styling
  privatePanel: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  privatePanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 10,
  },
  privateBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  privateBadgeText: {
    color: "#2dd4bf",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  privateTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  privateRefreshBtn: {
    padding: 6,
  },
  privateEmptyCard: {
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  privateEmptyText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },
  privateLoadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  privateLoadingText: {
    color: "#2dd4bf",
    fontSize: 11,
    fontWeight: "700",
  },
  privateErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    gap: 8,
  },
  privateErrorText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  privatePrivacySub: {
    color: "#64748b",
    fontSize: 10,
    fontStyle: "italic",
    lineHeight: 14,
  },
  privateStatsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  privateStatCard: {
    flex: 1,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    padding: 10,
  },
  privateStatValue: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  privateStatLabel: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "800",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  privateSectionTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  picksScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  pickCard: {
    width: 190,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    overflow: "hidden",
  },
  pickImageContainer: {
    height: 90,
    position: "relative",
  },
  pickImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  pickCategoryBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pickCategoryText: {
    color: "#2dd4bf",
    fontSize: 8,
    fontWeight: "900",
  },
  pickCardBody: {
    padding: 8,
  },
  pickTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  pickReason: {
    color: "#64748b",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  pickMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 3,
  },
  pickMetaText: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "600",
  },
  pickBullet: {
    color: "#334155",
    fontSize: 7,
  },
  insightsWrapper: {
    gap: 6,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  insightText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  premiumValueCard: {
    backgroundColor: "rgba(251, 191, 36, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.15)",
    borderRadius: 12,
    padding: 12,
  },
  premiumHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(251, 191, 36, 0.1)",
    paddingBottom: 6,
  },
  premiumValueTitle: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  premiumItem: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    padding: 10,
  },
  premiumItemTitle: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "800",
  },
  premiumItemDesc: {
    color: "#64748b",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  nextMovesWrapper: {
    gap: 6,
  },
  nextMoveRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 8,
    padding: 10,
  },
  nextMoveText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
    lineHeight: 15,
  },

  // Preferences Section
  footerContainer: {
    marginTop: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 16,
  },
  preferencesCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 16,
  },
  preferencesTitle: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  prefLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  prefSub: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  resetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  resetBtnText: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  scrollList: {
    paddingBottom: 100,
  },
});
