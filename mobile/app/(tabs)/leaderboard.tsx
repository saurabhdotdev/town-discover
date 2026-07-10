import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { fetchLeaderboard, fetchCurrentUser, AuthUser } from "../../src/api/client";



interface LeaderboardEntry {
  userId: string;
  fullName: string;
  rank: number;
  level: number;
  levelTitle: string;
  totalXp: number;
  badgeCount: number;
}

const CITIES = ["Pune", "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolhapur", "Nashik"] as const;
const CITY_OPTIONS = ["All Cities", ...CITIES];

const getCityQuests = (city: string) => [
  {
    title: "🌙 Late Night Wanderer",
    desc: `Check-in or report crowd level at any street food stall or bar in ${city} after 10 PM.`,
    reward: 50,
    icon: "time-outline" as const,
    query: "food-stall",
  },
  {
    title: "☕ Nomad Workspace Vibe",
    desc: `Leave a rating/review at a work-friendly cafe in ${city} to help fellow remote explorers.`,
    reward: 30,
    icon: "cafe-outline" as const,
    query: "cafe",
  },
  {
    title: "⚡ Pulse Check Curator",
    desc: `Submit a crowd report at any trending live event in ${city} to help check the city's active vibe.`,
    reward: 40,
    icon: "compass-outline" as const,
    query: "event",
  },
];

export default function LeaderboardScreen() {
  const router = useRouter();
  const [cityFilter, setCityFilter] = useState("All Cities");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const city = cityFilter === "All Cities" ? undefined : cityFilter;
      const list = await fetchLeaderboard(city);
      setData((list as LeaderboardEntry[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [cityFilter]);

  // Sync user state and persistent active city choice when tab gains focus
  useFocusEffect(
    useCallback(() => {
      fetchCurrentUser()
        .then((u: AuthUser | null) => setUser(u))
        .catch(() => setUser(null));
      
      const syncActiveCity = async () => {
        try {
          const stored = await AsyncStorage.getItem("sheher_active_city");
          if (stored && CITIES.includes(stored as (typeof CITIES)[number])) {
            setCityFilter(stored);
          }
        } catch {}
      };
      syncActiveCity();
    }, [])
  );

  useEffect(() => {
    const timer = setTimeout(() => { void loadLeaderboard(); }, 0);
    return () => clearTimeout(timer);
  }, [loadLeaderboard]);

  const filtered = data.filter((item) => {
    if (!search.trim()) return true;
    return item.fullName.toLowerCase().includes(search.toLowerCase());
  });

  const top3 = filtered.slice(0, 3);
  const remaining = filtered.slice(3);
  const myEntry = user ? data.find((e) => e.userId === user.id) : null;

  const handleQuestAction = async (query: string) => {
    // We can push the search query to Explore and redirect
    try {
      await AsyncStorage.setItem("sheher_search_query_temp", query);
    } catch {}
    router.push("/(tabs)");
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "#fbbf24"; // Amber gold
    if (rank === 2) return "#cbd5e1"; // Slate silver
    if (rank === 3) return "#d97706"; // Bronze orange
    return "#64748b";
  };

  const renderRankRow = (item: LeaderboardEntry) => {
    const isCurrentUser = user && item.userId === user.id;
    return (
      <View key={item.userId} style={[styles.rankRow, isCurrentUser && styles.rankRowMe]}>
        <View style={[styles.rankNumBadge, { backgroundColor: getRankColor(item.rank) + "1f", borderColor: getRankColor(item.rank) + "4f" }]}>
          <Text style={[styles.rankNumText, { color: getRankColor(item.rank) }]}>
            {item.rank}
          </Text>
        </View>
        <View style={styles.rankAvatar}>
          <Text style={styles.rankAvatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.rankName} numberOfLines={1}>
              {item.fullName}
            </Text>
            {isCurrentUser && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={styles.rankSubText}>
            Lv.{item.level} · {item.levelTitle}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons name="flash" size={11} color="#2dd4bf" />
            <Text style={styles.rankXP}>{item.totalXp.toLocaleString()}</Text>
          </View>
          <Text style={styles.rankBadgeCount}>{item.badgeCount} badges</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hall of Fame</Text>
          <Text style={styles.subtitle}>Top city discoverers ranked by explorer XP</Text>
        </View>
        <Ionicons name="trophy" size={28} color="#fbbf24" />
      </View>

      {/* Ranks search/filter row */}
      <View style={styles.controlsRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={14} color="#64748b" style={{ marginRight: 6 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search explorer..."
            placeholderTextColor="#64748b"
            style={styles.searchInput}
          />
        </View>
        <Pressable onPress={() => void loadLeaderboard()} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={16} color="#94a3b8" />
        </Pressable>
      </View>

      {/* Horizontal City options */}
      <View style={styles.cityScrollRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CITY_OPTIONS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setCityFilter(item)}
              style={[styles.cityChip, cityFilter === item && styles.cityChipActive]}
            >
              <Text style={[styles.cityText, cityFilter === item && styles.cityTextActive]}>
                {item}
              </Text>
            </Pressable>
          )}
          contentContainerStyle={{ gap: 8 }}
        />
      </View>

      {/* Main content scroll container */}
      {loading ? (
        <ActivityIndicator color="#fbbf24" style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={32} color="#f87171" />
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void loadLeaderboard()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {/* My Rank banner if authenticated and exists */}
          {myEntry && (
            <View style={styles.myRankCard}>
              <Ionicons name="ribbon" size={20} color="#fbbf24" />
              <Text style={styles.myRankText}>
                Your rank in {cityFilter === "All Cities" ? "India" : cityFilter}:{" "}
                <Text style={{ fontWeight: "900", color: "#fbbf24" }}>#{myEntry.rank}</Text> with{" "}
                {myEntry.totalXp} XP
              </Text>
            </View>
          )}

          {/* Quests Container */}
          <Text style={styles.sectionHeader}>Active City Quests</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.questsContainer}
          >
            {getCityQuests(cityFilter === "All Cities" ? "Pune" : cityFilter).map((quest, idx) => (
              <View key={idx} style={styles.questCard}>
                <View style={styles.questTop}>
                  <View style={styles.questIconBg}>
                    <Ionicons name={quest.icon} size={16} color="#2dd4bf" />
                  </View>
                  <View style={styles.questXpBadge}>
                    <Text style={styles.questXpText}>+{quest.reward} XP</Text>
                  </View>
                </View>
                <Text style={styles.questTitle}>{quest.title}</Text>
                <Text style={styles.questDesc}>{quest.desc}</Text>
                <Pressable onPress={() => handleQuestAction(quest.query)} style={styles.questBtn}>
                  <Text style={styles.questBtnText}>Start Quest</Text>
                  <Ionicons name="chevron-forward" size={10} color="#020617" />
                </Pressable>
              </View>
            ))}
          </ScrollView>

          {/* Podium (Top 3) */}
          {top3.length > 0 && (
            <View style={styles.podiumContainer}>
              {/* Rank 2 */}
              {top3[1] && (
                <View style={styles.podiumCol}>
                  <View style={styles.podiumAvatarOuter}>
                    <Text style={styles.podiumAvatar}>{top3[1].fullName.charAt(0).toUpperCase()}</Text>
                    <View style={[styles.podiumBadge, { backgroundColor: "#cbd5e1" }]}>
                      <Text style={styles.podiumBadgeText}>2</Text>
                    </View>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {top3[1].fullName}
                  </Text>
                  <Text style={styles.podiumXp}>{top3[1].totalXp} XP</Text>
                  <View style={[styles.podiumBase, { height: 70, backgroundColor: "rgba(203, 213, 225, 0.1)", borderColor: "rgba(203, 213, 225, 0.25)" }]}>
                    <Ionicons name="ribbon-outline" size={18} color="#cbd5e1" />
                  </View>
                </View>
              )}

              {/* Rank 1 */}
              {top3[0] && (
                <View style={[styles.podiumCol, { transform: [{ translateY: -12 }] }]}>
                  <Ionicons name="star" size={18} color="#fbbf24" style={{ marginBottom: 4 }} />
                  <View style={[styles.podiumAvatarOuter, { borderColor: "#fbbf24", borderWidth: 2 }]}>
                    <Text style={[styles.podiumAvatar, { fontSize: 20 }]}>
                      {top3[0].fullName.charAt(0).toUpperCase()}
                    </Text>
                    <View style={[styles.podiumBadge, { backgroundColor: "#fbbf24" }]}>
                      <Text style={[styles.podiumBadgeText, { color: "#020617" }]}>1</Text>
                    </View>
                  </View>
                  <Text style={[styles.podiumName, { fontWeight: "900" }]} numberOfLines={1}>
                    {top3[0].fullName}
                  </Text>
                  <Text style={[styles.podiumXp, { color: "#fbbf24" }]}>{top3[0].totalXp} XP</Text>
                  <View style={[styles.podiumBase, { height: 90, backgroundColor: "rgba(251, 191, 36, 0.12)", borderColor: "rgba(251, 191, 36, 0.3)" }]}>
                    <Ionicons name="trophy" size={24} color="#fbbf24" />
                  </View>
                </View>
              )}

              {/* Rank 3 */}
              {top3[2] && (
                <View style={styles.podiumCol}>
                  <View style={styles.podiumAvatarOuter}>
                    <Text style={styles.podiumAvatar}>{top3[2].fullName.charAt(0).toUpperCase()}</Text>
                    <View style={[styles.podiumBadge, { backgroundColor: "#d97706" }]}>
                      <Text style={styles.podiumBadgeText}>3</Text>
                    </View>
                  </View>
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {top3[2].fullName}
                  </Text>
                  <Text style={styles.podiumXp}>{top3[2].totalXp} XP</Text>
                  <View style={[styles.podiumBase, { height: 50, backgroundColor: "rgba(217, 119, 6, 0.1)", borderColor: "rgba(217, 119, 6, 0.25)" }]}>
                    <Ionicons name="ribbon-outline" size={16} color="#d97706" />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Ranks list */}
          <Text style={styles.sectionHeader}>Full Rankings</Text>
          <View style={{ gap: 8, paddingBottom: 24 }}>
            {top3.map((item) => renderRankRow(item))}
            {remaining.map((item) => renderRankRow(item))}
            {filtered.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={36} color="#475569" />
                <Text style={styles.emptyText}>No explorers match your search</Text>
              </View>
            )}
          </View>
        </ScrollView>
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
  title: { color: "#f8fafc", fontSize: 24, fontWeight: "900", letterSpacing: 0.5 },
  subtitle: { color: "#94a3b8", fontSize: 12, fontWeight: "500", marginTop: 2 },

  // Filters controls
  controlsRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 12 },
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
  refreshBtn: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  // City list
  cityScrollRow: { marginBottom: 16 },
  cityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  cityChipActive: {
    borderColor: "#fbbf24",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
  },
  cityText: { color: "#94a3b8", fontWeight: "700", fontSize: 12 },
  cityTextActive: { color: "#fbbf24" },

  // Sections
  sectionHeader: { color: "#94a3b8", fontWeight: "800", fontSize: 12, textTransform: "uppercase", marginBottom: 10, marginTop: 14, letterSpacing: 1 },

  // Quests
  questsContainer: { gap: 12, paddingRight: 20 },
  questCard: {
    width: 220,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.08)",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  questTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  questIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  questXpBadge: {
    backgroundColor: "rgba(45, 212, 191, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  questXpText: { color: "#2dd4bf", fontSize: 10, fontWeight: "800" },
  questTitle: { color: "#f8fafc", fontSize: 13, fontWeight: "800", marginBottom: 4 },
  questDesc: { color: "#64748b", fontSize: 10, fontWeight: "500", lineHeight: 14, marginBottom: 10, height: 42 },
  questBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2dd4bf",
    borderRadius: 8,
    paddingVertical: 8,
    gap: 3,
  },
  questBtnText: { color: "#020617", fontSize: 10, fontWeight: "800" },

  // My Rank
  myRankCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  myRankText: { color: "#f8fafc", fontSize: 12, fontWeight: "600", flex: 1 },

  // Podium
  podiumContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  podiumCol: {
    flex: 1,
    alignItems: "center",
  },
  podiumAvatarOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#020617",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  podiumAvatar: { color: "#f8fafc", fontWeight: "900", fontSize: 16 },
  podiumBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#020617",
  },
  podiumBadgeText: { color: "#020617", fontSize: 9, fontWeight: "900" },
  podiumName: { color: "#f8fafc", fontSize: 11, fontWeight: "800", marginTop: 8, width: 80, textAlign: "center" },
  podiumXp: { color: "#94a3b8", fontSize: 9, fontWeight: "700", marginTop: 2, marginBottom: 8 },
  podiumBase: {
    width: "80%",
    borderRadius: 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  // Rank Rows
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  rankRowMe: {
    borderColor: "rgba(45, 212, 191, 0.35)",
    backgroundColor: "rgba(45, 212, 191, 0.08)",
  },
  rankNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumText: { fontSize: 11, fontWeight: "900" },
  rankAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  rankAvatarText: { color: "#2dd4bf", fontWeight: "900", fontSize: 13 },
  rankName: { color: "#f8fafc", fontWeight: "800", fontSize: 13, maxWidth: 140 },
  youBadge: {
    backgroundColor: "#2dd4bf",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6,
  },
  youBadgeText: { color: "#020617", fontSize: 7, fontWeight: "900" },
  rankSubText: { color: "#64748b", fontSize: 10, fontWeight: "600", marginTop: 1 },
  rankXP: { color: "#cbd5e1", fontWeight: "900", fontSize: 13 },
  rankBadgeCount: { color: "#64748b", fontSize: 9, fontWeight: "600", marginTop: 1 },

  // Empty state
  emptyCard: { alignItems: "center", padding: 24, gap: 8 },
  emptyText: { color: "#64748b", fontSize: 12, fontWeight: "700" },

  // Error handling
  errorBox: { alignItems: "center", justifyContent: "center", marginTop: 40, gap: 10 },
  error: { color: "#f87171", fontSize: 12, fontWeight: "700", textAlign: "center" },
  retryBtn: { backgroundColor: "#f87171", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: "#020617", fontWeight: "800", fontSize: 12 },
  scrollList: {
    paddingBottom: 100,
  },
});
