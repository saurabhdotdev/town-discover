"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Bell, Bookmark, ChevronRight, Compass, Lock, LogOut, Mail, MapPin, Radio, Shield, Sparkles, Star, User, Folder, Plus, X, Check, Trash2 } from "lucide-react";
import { Header } from "@/components/common/Header";
import { BrandMark } from "@/components/common/BrandMark";
import Link from "next/link";
import { getPlacesWithDistance, MOCK_PLACES } from "@/data/mock-places";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Place } from "@/types";
import { formatDistance, formatPlaceArea, getCategoryLabel, getInitials } from "@/lib/utils";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { useBadges } from "@/hooks/useBadges";
import { BadgeShelf } from "@/components/profile/BadgeShelf";
import { XPProgressBar } from "@/components/profile/XPProgressBar";
import { clearOnboarding } from "@/hooks/useOnboarding";
import { SheherPassCard } from "@/components/profile/SheherPassCard";
import { useRouter } from "next/navigation";
import { ExplorerPassport } from "@/components/profile/ExplorerPassport";
import { AffiliateOffersCard } from "@/components/profile/AffiliateOffersCard";

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
  quickPicks: Array<{
    id: string;
    title: string;
    category: Place["category"];
    city: string;
    locality: string;
    rating: number;
    priceRange: string;
    image: string;
    reason: string;
    privateSignal: string;
  }>;
  premiumUnlocks: Array<{
    id: string;
    title: string;
    category: Place["category"];
    city: string;
    locality: string;
    rating: number;
    priceRange: string;
    image: string;
    reason: string;
    privateSignal: string;
  }>;
  nextMoves: string[];
}

const MOCK_PLACES_BY_ID = new Map(MOCK_PLACES.map((place) => [place.id, place]));

export default function ProfilePage() {
  const { location } = useGeolocation();
  const { user, loading, authRequiredMessage, submitAuth, logout } = useAuth();
  const router = useRouter();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privateMode, setPrivateMode] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [authMessage, setAuthMessage] = useState("");
  const { savedPlaces: rawSavedPlaces, toggleSave } = useSavedPlaces();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [errorSuggestions, setErrorSuggestions] = useState("");
  const [privateBrief, setPrivateBrief] = useState<PrivateDiscoveryBrief | null>(null);
  const [privateBriefLoading, setPrivateBriefLoading] = useState(false);
  const [privateBriefError, setPrivateBriefError] = useState("");
    const [newSuggestion, setNewSuggestion] = useState("");
    const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const { stats: gamificationStats, refresh: refreshGamificationStats } = useBadges(!!user);

  // Admin Management Modal states
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminAction, setAdminAction] = useState<"promote" | "create">("promote");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPromoEmail, setAdminPromoEmail] = useState("");
  const [adminStatus, setAdminStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [adminMessage, setAdminMessage] = useState("");

  // Collections (Folders) state
  const [folders, setFolders] = useState<any[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [activeDropdownPlaceId, setActiveDropdownPlaceId] = useState<string | null>(null);

  const savedPlaces = useMemo(
    () => getPlacesWithDistance(rawSavedPlaces, location),
    [location, rawSavedPlaces]
  );
  const savedCities = useMemo(() => Array.from(new Set(savedPlaces.map((place) => place.city))), [savedPlaces]);
  const topSavedCity = savedCities[0] ?? "No city yet";
  const privatePickPlaces = useMemo(() => {
    if (!privateBrief) return [];
    return privateBrief.quickPicks
      .map((pick) => MOCK_PLACES_BY_ID.get(pick.id))
      .filter((place): place is Place => Boolean(place));
  }, [privateBrief]);

  const fetchPrivateBrief = async () => {
    if (!user) return;
    setPrivateBriefLoading(true);
    setPrivateBriefError("");
    try {
      const response = await fetch("/api/private-discovery", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message ?? data.error ?? "Unable to build private discovery.");
      setPrivateBrief(data);
    } catch (err) {
      setPrivateBriefError(err instanceof Error ? err.message : "Unable to build private discovery.");
    } finally {
      setPrivateBriefLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await fetch("/api/saved-places/folders");
      const data = await res.json();
      if (res.ok) {
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFolders();
    }
  }, [user]);

  useEffect(() => {
    if (!user || !privateMode) {
      setPrivateBrief(null);
      setPrivateBriefError("");
      return;
    }

    fetchPrivateBrief();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, privateMode, rawSavedPlaces.length, folders.length]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/saved-places/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create collection.");

      setNewFolderName("");
      setShowCreateFolderModal(false);
      fetchFolders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm("Are you sure you want to delete this collection? The places inside will remain saved overall.")) {
      return;
    }
    setDeletingFolderId(folderId);
    try {
      const res = await fetch(`/api/saved-places/folders?id=${encodeURIComponent(folderId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete collection.");

      setActiveFolderId(null);
      fetchFolders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingFolderId(null);
    }
  };

  const handleTogglePlaceInFolder = async (placeId: string, folderId: string, isInFolder: boolean) => {
    try {
      const res = await fetch(
        isInFolder
          ? `/api/saved-places?placeId=${encodeURIComponent(placeId)}&folderId=${encodeURIComponent(folderId)}`
          : "/api/saved-places",
        {
          method: isInFolder ? "DELETE" : "POST",
          headers: isInFolder ? undefined : { "Content-Type": "application/json" },
          body: isInFolder ? undefined : JSON.stringify({ placeId, folderId }),
        }
      );
      if (!res.ok) throw new Error("Failed to update folder content.");
      fetchFolders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter saved places by active folder
  const displayedSavedPlaces = useMemo(() => {
    if (!activeFolderId) return savedPlaces;
    const folder = folders.find((f) => f.id === activeFolderId);
    if (!folder) return savedPlaces;
    return savedPlaces.filter((p) => folder.placeIds.includes(p.id));
  }, [savedPlaces, activeFolderId, folders]);

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthStatus("submitting");
    setAuthMessage("");

    const result = await submitAuth(mode, email, password, fullName);
    if (!result.ok) {
      setAuthStatus("error");
      setAuthMessage(result.error ?? "Unable to continue.");
      return;
    }

    setAuthStatus("idle");
    setPassword("");
    setFullName("");
  };

  useEffect(() => {
    if (user?.role === "super_admin") {
      fetchSuggestions();
    }
  }, [user]);

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    setErrorSuggestions("");
    try {
      const res = await fetch("/api/admin/suggestions");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load suggestions.");
      }
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setErrorSuggestions(err.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleModerateSuggestion = async (id: string, status: "approved" | "rejected") => {
    try {
      const res = await fetch("/api/admin/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to update suggestion to ${status}`);
      }
      fetchSuggestions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPromoEmail.trim()) return;
    setAdminStatus("submitting");
    setAdminMessage("");
    try {
      if (adminAction === "promote") {
        const res = await fetch("/api/admin/users/role", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: adminPromoEmail.trim(), role: "super_admin" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to promote user.");

        setAdminStatus("success");
        setAdminMessage(`Successfully promoted ${data.user.email} to Super Admin!`);
        setAdminPromoEmail("");
      } else {
        if (!adminName.trim() || !adminPassword.trim()) {
          throw new Error("Full name and password are required.");
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: adminName.trim(),
            email: adminPromoEmail.trim(),
            password: adminPassword,
            role: "super_admin",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create admin account.");

        setAdminStatus("success");
        setAdminMessage(`Successfully created Super Admin account for ${data.user.email}!`);
        setAdminName("");
        setAdminPassword("");
        setAdminPromoEmail("");
      }
    } catch (err: any) {
      setAdminStatus("error");
      setAdminMessage(err.message || "Failed to complete request.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <p className="text-sm font-semibold text-[var(--muted)]">Loading explorer profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-full min-h-screen overflow-x-hidden bg-[var(--background)] pb-8 text-[var(--foreground)]">
        {authRequiredMessage ? (
          <Header eyebrow="Profile" title="Explorer Profile" subtitle={authRequiredMessage} showLocation={false} />
        ) : mode === "signup" ? (
          <Header eyebrow="Profile" title="Create Explorer Account" subtitle="Create a Sheher account to save places and report live crowd updates." showLocation={false} />
        ) : (
          <Header eyebrow="Profile" title="Log In" subtitle="Sign in to sync saved places, create collections, and earn XP." showLocation={false} />
        )}

        <main className="mx-auto max-w-md px-4 pt-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-5 shadow-xl sm:p-6"
          >
            <h2 className="text-lg font-black tracking-tight text-[var(--foreground)] sm:text-xl">
              {mode === "login" ? "Welcome Back Explorer" : "Create Explorer Account"}
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)] font-semibold">Sign in to sync saved places, create collections, and earn XP.</p>

            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-black uppercase text-[var(--muted)] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-[var(--muted)] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="explorer@sheher.in"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-[var(--muted)] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                />
              </div>

              {authStatus === "error" && <p className="text-xs font-bold text-rose-400">{authMessage}</p>}

              <button
                type="submit"
                disabled={authStatus === "submitting"}
                className="w-full inline-flex items-center justify-center rounded-lg bg-teal-400 hover:bg-teal-300 px-4 py-2.5 font-black text-slate-950 shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                {authStatus === "submitting" ? "Authenticating..." : mode === "login" ? "Log In" : "Register"}
              </button>
            </form>

            <div className="mt-5 border-t border-[var(--border)] pt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode((current) => (current === "login" ? "signup" : "login"));
                  setAuthMessage("");
                  setAuthStatus("idle");
                  setPassword("");
                  setFullName("");
                }}
                className="text-xs font-bold text-teal-300 hover:underline"
              >
                {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-h-screen overflow-x-hidden bg-[var(--background)] pb-8 text-[var(--foreground)]">
      <header className="relative z-10 border-b border-[var(--border)] bg-[var(--nav)]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-2 px-3 py-2.5 sm:px-4 md:px-6 md:py-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--fresh)]">
            <Radio size={13} />
            Profile
          </div>
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <BrandMark size="md" showWordmark={false} />
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight tracking-tight text-[var(--foreground)] sm:text-2xl md:text-3xl">
                Sheher Explorer Profile
              </h1>
              <p className="mt-0.5 max-w-2xl text-xs leading-5 text-[var(--muted)] sm:text-sm">
                Saved places, collections, and your account overview.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-screen-xl mx-auto grid gap-6 px-3 py-3 sm:px-4 md:grid-cols-[280px_minmax(0,1fr)] md:px-6 md:py-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.42 }}
          className="min-w-0 space-y-5"
        >
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/15 text-sm font-black text-teal-300 border border-teal-500/10">
                {getInitials(user.fullName || user.email)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-black text-[var(--foreground)]">{user.fullName || "Explorer"}</h2>
                <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-[var(--muted)]">
                  <Mail size={12} className="shrink-0" />
                  {user.email}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Saved", value: savedPlaces.length.toString() },
                { label: "Access", value: user?.role === "super_admin" ? "Admin" : "Explorer" },
                { label: "Cities", value: savedCities.length.toString() },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2 text-center sm:p-3">
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl font-black text-[var(--foreground)] truncate px-0.5">{stat.value}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4">
            <h3 className="mb-3 font-black text-[var(--foreground)]">Preferences</h3>
            {[
              {
                icon: <Bell size={18} />,
                label: "Tonight alerts",
                value: notificationsEnabled,
                onToggle: () => setNotificationsEnabled((current) => !current),
              },
              {
                icon: <Shield size={18} />,
                label: "Private discovery",
                value: privateMode,
                onToggle: () => setPrivateMode((current) => !current),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onToggle}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-[var(--panel-soft)]"
              >
                <span className="flex items-center gap-3 font-semibold text-[var(--muted-strong)]">
                  <span className="text-[var(--muted)]">{item.icon}</span>
                  {item.label}
                </span>
                <span
                  className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
                    item.value ? "bg-teal-300" : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white transition ${item.value ? "translate-x-5" : "translate-x-0"}`}
                  />
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                clearOnboarding();
                router.push("/");
              }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left font-semibold text-[var(--muted-strong)] transition hover:bg-[var(--panel-soft)]"
            >
              <span className="flex items-center gap-3">
                <Sparkles size={18} className="text-[var(--muted)]" />
                Retake vibe quiz
              </span>
              <ChevronRight size={18} className="text-[var(--muted)]" />
            </button>

            {user?.role === "super_admin" && (
              <button
                type="button"
                onClick={() => {
                  setAdminMessage("");
                  setAdminStatus("idle");
                  setShowAdminModal(true);
                }}
                className="mt-2 flex w-full items-center justify-between rounded-lg px-2 py-3 text-left font-semibold text-[var(--muted-strong)] transition hover:bg-[var(--panel-soft)]"
              >
                <span className="flex items-center gap-3">
                  <Shield size={18} className="text-teal-300" />
                  Add Super Admin
                </span>
                <ChevronRight size={18} className="text-[var(--muted)]" />
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full items-center justify-between rounded-lg px-2 py-3 text-left font-semibold text-[var(--muted-strong)] transition hover:bg-[var(--panel-soft)]"
            >
              <span className="flex items-center gap-3">
                <LogOut size={18} className="text-[var(--muted)]" />
                Log out
              </span>
              <ChevronRight size={18} className="text-[var(--muted)]" />
            </button>
          </div>

          <SheherPassCard />
          <AffiliateOffersCard />
        </motion.aside>

        <main className="min-w-0 space-y-5">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.03 }}
            className="rounded-lg border border-teal-300/20 bg-[var(--panel)] p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-teal-200">
                  <Lock size={13} />
                  Private Discovery
                </p>
                <h2 className="mt-1 text-xl font-black text-[var(--foreground)] sm:text-2xl">
                  Your Personal City Brief
                </h2>
                <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[var(--muted)]">
                  {privateMode
                    ? privateBrief?.summary.privacy ?? "Computed privately from your saved places and collections."
                    : "Turn this on to see picks shaped by your saved places and collections."}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setPrivateMode((current) => !current)}
                  className={`inline-flex h-10 items-center justify-center rounded-lg px-3 text-xs font-black transition ${
                    privateMode
                      ? "bg-teal-300 text-slate-950"
                      : "border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--foreground)]"
                  }`}
                >
                  {privateMode ? "Private On" : "Turn On"}
                </button>
                {privateMode && (
                  <button
                    type="button"
                    onClick={fetchPrivateBrief}
                    disabled={privateBriefLoading}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 text-xs font-black text-[var(--foreground)] transition hover:bg-[var(--panel-strong)] disabled:opacity-50"
                  >
                    {privateBriefLoading ? "Updating..." : "Refresh"}
                  </button>
                )}
              </div>
            </div>

            {!privateMode ? (
              <div className="mt-5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-5 text-sm font-semibold text-[var(--muted)]">
                Private discovery is paused. Your saved places still stay in your account.
              </div>
            ) : privateBriefLoading && !privateBrief ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-32 animate-pulse rounded-lg bg-[var(--panel-soft)]" />
                ))}
              </div>
            ) : privateBriefError ? (
              <div className="mt-5 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
                {privateBriefError}
              </div>
            ) : privateBrief ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "Saved signal", value: privateBrief.summary.savedCount.toString() },
                    { label: "Collections", value: privateBrief.summary.collectionCount.toString() },
                    { label: "Best city", value: privateBrief.summary.primaryCity },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                      <p className="truncate text-lg font-black text-[var(--foreground)]">{stat.value}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_0.78fr]">
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-[var(--foreground)]">Private picks to try next</h3>
                      <Link href="/discover" className="inline-flex items-center gap-1 text-xs font-black text-teal-300">
                        Discover
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      {privatePickPlaces.length > 0 ? (
                        privateBrief.quickPicks.map((pick) => {
                          const place = MOCK_PLACES_BY_ID.get(pick.id);
                          if (!place) return null;

                          return (
                            <button
                              key={pick.id}
                              type="button"
                              onClick={() => setSelectedPlace(place)}
                              className="group grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 text-left transition hover:border-teal-300/40"
                            >
                              <div className="relative h-20 overflow-hidden rounded-md bg-slate-900">
                                <Image
                                  src={place.image}
                                  alt={place.title}
                                  fill
                                  sizes="72px"
                                  className="object-cover transition duration-500 group-hover:scale-105"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                                  {getCategoryLabel(place.category)}
                                </p>
                                <h4 className="mt-1 line-clamp-1 text-sm font-black text-[var(--foreground)]">{pick.title}</h4>
                                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--muted)]">{pick.reason}</p>
                                <p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[var(--muted-strong)]">
                                  <MapPin size={11} className="text-cyan-300" />
                                  {pick.locality}
                                  <Star size={11} className="fill-yellow-300 text-yellow-300" />
                                  {pick.rating}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm font-semibold text-[var(--muted)] xl:col-span-2">
                          Save a few places first and this will become a personal shortlist.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                      <h3 className="text-sm font-black text-[var(--foreground)]">Signals</h3>
                      <div className="mt-3 space-y-2">
                        {privateBrief.insights.map((insight) => (
                          <p key={insight} className="rounded-md bg-[var(--panel)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--muted-strong)]">
                            {insight}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-amber-300/20 bg-amber-300/8 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-[var(--foreground)]">Explorer Pass value</h3>
                        {!user.isPremiumPass && <Lock size={15} className="text-amber-300" />}
                      </div>
                      <div className="mt-3 space-y-2">
                        {privateBrief.premiumUnlocks.slice(0, 2).map((pick) => (
                          <div key={pick.id} className="rounded-md border border-amber-300/10 bg-[var(--panel)] p-3">
                            <p className="text-xs font-black text-amber-200">{pick.title}</p>
                            <p className="mt-1 text-[11px] font-semibold leading-5 text-[var(--muted)]">
                              {user.isPremiumPass ? pick.privateSignal : "Hidden matching reason, deal readiness, and extended shortlist."}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                      <h3 className="text-sm font-black text-[var(--foreground)]">Next moves</h3>
                      <div className="mt-3 space-y-2">
                        {privateBrief.nextMoves.map((move) => (
                          <p key={move} className="flex gap-2 text-xs font-semibold leading-5 text-[var(--muted-strong)]">
                            <Sparkles size={13} className="mt-0.5 shrink-0 text-teal-300" />
                            {move}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.05 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">Saved collection</p>
                <h2 className="mt-1 text-xl font-black text-[var(--foreground)] sm:text-2xl">Places To Try Next</h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-sm font-bold text-[var(--muted-strong)]">
                <Bookmark size={15} />
                {savedPlaces.length} saved
              </span>
            </div>

            {/* Folders switcher tab row */}
            <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto pb-1.5 border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                className={`relative px-4 py-2 text-xs font-black uppercase tracking-wider transition shrink-0 ${
                  activeFolderId === null ? "text-teal-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All ({savedPlaces.length})
                {activeFolderId === null && (
                  <motion.div
                    layoutId="activeFolderTab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-400"
                  />
                )}
              </button>

              {folders.map((f) => {
                const isActive = activeFolderId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFolderId(f.id)}
                    className={`relative px-4 py-2 text-xs font-black uppercase tracking-wider transition shrink-0 ${
                      isActive ? "text-teal-300" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    📁 {f.name} ({f.placeIds.length})
                    {isActive && (
                      <motion.div
                        layoutId="activeFolderTab"
                        className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-400"
                      />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setShowCreateFolderModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-teal-500/30 text-teal-300 text-xs font-black hover:bg-teal-400/10 transition shrink-0 ml-auto cursor-pointer"
              >
                <Plus size={12} />
                New Collection
              </button>
            </div>

            {/* Selected Folder Header Panel */}
            {activeFolderId && (
              <div className="mt-4 flex items-center justify-between gap-4 bg-teal-500/5 border border-teal-500/10 rounded-xl p-3.5">
                <div>
                  <h4 className="text-sm font-black text-white">
                    Collection: {folders.find((f) => f.id === activeFolderId)?.name}
                  </h4>
                  <p className="text-[11px] font-semibold text-[var(--muted)]">
                    Only showing spots saved in this collection.
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteFolder(activeFolderId)}
                  disabled={deletingFolderId === activeFolderId}
                  className="inline-flex items-center justify-center p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer disabled:opacity-50"
                  title="Delete Collection"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {displayedSavedPlaces.length > 0 ? displayedSavedPlaces.map((place) => (
                <div
                  key={place.id}
                  className="group relative grid grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-left transition hover:bg-[var(--panel-strong)] sm:grid-cols-[96px_minmax(0,1fr)]"
                >
                  {/* Click trigger background */}
                  <div
                    onClick={() => setSelectedPlace(place)}
                    className="absolute inset-0 cursor-pointer z-0"
                  />

                  {/* Thumbnail image */}
                  <div className="relative h-24 overflow-hidden rounded-lg bg-slate-900 z-10 pointer-events-none">
                    <Image
                      src={place.image}
                      alt={`${place.title} in ${place.locality}`}
                      fill
                      sizes="96px"
                      className="transition duration-500 group-hover:scale-105"
                    />
                  </div>

                  {/* Card Content */}
                  <div className="min-w-0 flex flex-col justify-between pr-8">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                        {getCategoryLabel(place.category)}
                      </p>
                      <h3 className="mt-1 line-clamp-1 font-black text-[var(--foreground)]">{place.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)] leading-relaxed">{place.description}</p>
                      <p className="mt-1.5 flex items-start gap-1 text-xs font-semibold leading-4 text-[var(--muted-strong)]">
                        <MapPin size={12} className="mt-0.5 shrink-0 text-cyan-300" />
                        <span className="line-clamp-2">{formatPlaceArea(place)}</span>
                      </p>
                    </div>

                    <div className="mt-2 flex items-center gap-3 text-xs font-bold text-[var(--muted-strong)]">
                      <span>{formatDistance(place.distance)} away</span>
                      <span className="inline-flex items-center gap-1">
                        <Star size={13} className="fill-yellow-300 text-yellow-300" />
                        {place.rating}
                      </span>
                    </div>
                  </div>

                  {/* Action Controls top right */}
                  <div className="absolute right-2 top-2 z-25 flex items-center gap-1">
                    {/* Collection dropdown toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdownPlaceId((current) => (current === place.id ? null : place.id));
                      }}
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        activeDropdownPlaceId === place.id
                          ? "bg-teal-400/20 text-teal-300"
                          : "text-slate-400 hover:text-teal-300 hover:bg-teal-400/10"
                      }`}
                      title="Manage Collection"
                    >
                      <Folder size={14} />
                    </button>

                    {/* Unsave Bookmark */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Remove this place from your saved list?")) {
                          toggleSave(place);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      title="Unsave Spot"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Manage Collection dropdown popover overlay */}
                  <AnimatePresence>
                    {activeDropdownPlaceId === place.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-2 top-11 z-30 w-48 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2 shadow-2xl space-y-1 text-left"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-1 px-1 mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-400">Collections</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownPlaceId(null);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {folders.length === 0 ? (
                          <p className="text-[10px] text-slate-500 font-semibold p-2 text-center">No collections created yet.</p>
                        ) : (
                          <div className="max-h-36 overflow-y-auto space-y-0.5">
                            {folders.map((f) => {
                              const inFolder = f.placeIds.includes(place.id);
                              return (
                                <button
                                  key={f.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePlaceInFolder(place.id, f.id, inFolder);
                                  }}
                                  className="w-full flex items-center justify-between text-left rounded-md px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition font-semibold"
                                >
                                  <span className="truncate">📁 {f.name}</span>
                                  {inFolder ? (
                                    <Check size={12} className="text-teal-400 font-black shrink-0" />
                                  ) : (
                                    <Plus size={12} className="text-slate-600 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCreateFolderModal(true);
                            setActiveDropdownPlaceId(null);
                          }}
                          className="w-full flex items-center justify-center gap-1 border border-dashed border-teal-500/30 text-teal-300 hover:bg-teal-500/10 rounded-lg py-1.5 text-[10px] font-black transition cursor-pointer mt-1"
                        >
                          <Plus size={10} />
                          New Collection
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-5 text-center text-sm font-semibold text-[var(--muted)] xl:col-span-2">
                  <Bookmark size={28} className="mx-auto mb-3 text-teal-300" />
                  <p className="text-base font-black text-[var(--foreground)]">No saved places yet</p>
                  <p className="mx-auto mt-1 max-w-sm">Start a shortlist from Discover, then group your favorite spots into collections.</p>
                  <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                    <Link
                      href="/discover"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-xs font-black text-[var(--primary-foreground)]"
                    >
                      <Compass size={14} />
                      Explore Places
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowCreateFolderModal(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 text-xs font-black text-[var(--foreground)]"
                    >
                      <Plus size={14} />
                      Create Collection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.1 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">Account overview</p>
                <h2 className="mt-1 text-xl font-black text-[var(--foreground)] sm:text-2xl">Discovery Board</h2>
              </div>
              <Sparkles className="text-amber-300" size={24} />
            </div>

            <div className="mt-5 space-y-3">
              {[
                {
                  icon: <Bookmark size={17} />,
                  title: savedPlaces.length > 0 ? `${savedPlaces.length} saved places` : "No saved places yet",
                  detail:
                    savedPlaces.length > 0
                      ? `Your saved list spans ${savedCities.length} ${savedCities.length === 1 ? "city" : "cities"}.`
                      : "Save a place from Home or Discover and it will appear here.",
                },
                {
                  icon: <MapPin size={17} />,
                  title: `Top saved city: ${topSavedCity}`,
                  detail:
                    savedPlaces.length > 0
                      ? "Use this as your quick shortlist when planning where to go next."
                      : "Mumbai, Kolhapur, Nashik, Pune, Bangalore, Chennai, and Delhi are now available to explore.",
                },
                {
                  icon: <Compass size={17} />,
                  title: user.role === "super_admin" ? "Super admin access active" : "Explorer account active",
                  detail:
                    user.role === "super_admin"
                      ? "You can manage super admin access through the protected admin role endpoint."
                      : "You can save places and submit live crowd reports when signed in.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--panel)] text-[var(--fresh)]">
                    {item.icon}
                  </span>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">{item.title}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ── Explorer Stats & Badges ── */}
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.12 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">Gamification</p>
                <h2 className="mt-1 text-xl font-black text-[var(--foreground)] sm:text-2xl">Explorer Stats</h2>
              </div>
              <span className="text-2xl">🏅</span>
            </div>

            {gamificationStats ? (
              <>
                <XPProgressBar
                  totalXp={gamificationStats.totalXp}
                  level={gamificationStats.level}
                  title={gamificationStats.title}
                  progress={gamificationStats.progress}
                  xpForLevel={gamificationStats.xpForLevel}
                  xpForNext={gamificationStats.xpForNext}
                />
                <div className="mt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)] mb-1">Badge Collection</p>
                  <BadgeShelf earnedBadgeIds={gamificationStats.badges.map((b) => b.badge_id)} />
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-5 text-sm font-semibold text-[var(--muted)] text-center">
                Earn XP by saving places, submitting crowd reports, and suggesting new spots.
              </div>
            )}
          </motion.section>

          {/* ── Explorer Passport & City Stamps ── */}
          {user && (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.14 }}
            >
              <ExplorerPassport
                savedPlaces={rawSavedPlaces}
                onStampClaimed={() => {
                  refreshGamificationStats();
                  window.dispatchEvent(new Event("sheher:refresh-badges"));
                }}
              />
            </motion.section>
          )}

          {user?.role === "super_admin" && (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.15 }}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">Moderation Queue</p>
                  <h2 className="mt-1 text-xl font-black text-[var(--foreground)] sm:text-2xl">Pending Place Suggestions</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">Review suggestions from the community before publishing them live.</p>
                </div>
                <button
                  onClick={fetchSuggestions}
                  className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-black text-teal-300 hover:bg-[var(--panel-strong)] cursor-pointer"
                >
                  Refresh Queue
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {loadingSuggestions ? (
                  <p className="text-sm font-semibold text-[var(--muted)]">Loading suggestions queue...</p>
                ) : errorSuggestions ? (
                  <p className="text-sm font-semibold text-rose-300">{errorSuggestions}</p>
                ) : suggestions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-6 text-center text-sm font-semibold text-[var(--muted)]">
                    All clear! No pending place suggestions.
                  </div>
                ) : (
                  suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-4 flex flex-col gap-4 sm:flex-row sm:items-start justify-between"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-teal-400/10 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-teal-300">
                            {getCategoryLabel(s.category)}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-slate-300">
                            {s.priceRange}
                          </span>
                          <span className="text-xs text-[var(--muted)] font-bold">
                            in {formatPlaceArea(s)}
                          </span>
                        </div>
                        <h3 className="text-base font-black text-[var(--foreground)] leading-snug">{s.title}</h3>
                        <p className="text-sm text-[var(--muted)] font-medium leading-relaxed">{s.description}</p>

                        {/* Meta Fields */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-xs font-bold text-[var(--muted-strong)]">
                          {s.hours && (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                              Hours: {s.hours}
                            </span>
                          )}
                          {s.phone && (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                              Phone: {s.phone}
                            </span>
                          )}
                          {s.website && (
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                              Website: <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">{s.website.replace(/^https?:\/\/(www\.)?/, "")}</a>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                            Coords: {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                          </span>
                        </div>

                        <div className="pt-2 text-xs font-semibold text-[var(--muted)] border-t border-white/5 flex items-center gap-1.5">
                          Suggested by <span className="font-bold text-[var(--foreground)]">{s.userFullName || s.userEmail}</span> ({s.userEmail}) on {new Date(s.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => handleModerateSuggestion(s.id, "approved")}
                          className="flex items-center justify-center gap-1 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 text-xs font-black text-slate-950 transition cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModerateSuggestion(s.id, "rejected")}
                          className="flex items-center justify-center gap-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-500 px-3.5 text-xs font-black text-white transition cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.section>
          )}

        {/* User Suggestion Section */}
        <div className="mt-6">
          <h3 className="text-lg font-black text-[var(--foreground)]">Suggest a New Place</h3>
          <textarea
            value={newSuggestion}
            onChange={(e) => setNewSuggestion(e.target.value)}
            placeholder="Describe the place, location, and any details..."
            rows={3}
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 text-[var(--foreground)] focus:outline-none focus:border-teal-300"
          />
          <button
            onClick={async () => {
              if (!newSuggestion.trim()) return;
              setSubmittingSuggestion(true);
              try {
                await fetch('/api/suggestions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ suggestion: newSuggestion.trim() }),
                });
                setNewSuggestion('');
                alert('Suggestion submitted!');
              } catch (err) {
                alert('Failed to submit suggestion.');
              } finally {
                setSubmittingSuggestion(false);
              }
            }}
            disabled={submittingSuggestion}
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-teal-400 px-4 py-2 font-black text-white hover:bg-teal-300 disabled:opacity-50"
          >
            Submit Suggestion
          </button>
        </div>
        </main>
      </div>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {showCreateFolderModal && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl text-sm font-semibold"
            >
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>

              <h3 className="text-lg font-black text-white mb-1">Create Collection</h3>
              <p className="text-xs text-[var(--muted)] font-semibold mb-4">Create a folder to organize your saved spots.</p>

              <form onSubmit={handleCreateFolder} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">Collection Name</label>
                  <input
                    type="text"
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    maxLength={30}
                    placeholder="e.g. Weekend Cafes, Night Drives"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 hover:bg-teal-300 px-4 py-2.5 font-black text-slate-950 shadow-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {creatingFolder ? "Creating..." : "Create Collection"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Super Admin Management Modal */}
      <AnimatePresence>
        {showAdminModal && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8 backdrop-blur-sm sm:items-center">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl text-sm font-semibold"
            >
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminMessage("");
                  setAdminStatus("idle");
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>

              <h3 className="text-lg font-black text-white mb-1">Add Super Admin Access</h3>
              <p className="text-xs text-[var(--muted)] font-semibold mb-4">Grant administrative privileges or create a new admin profile.</p>

              {/* Mode Toggles */}
              <div className="flex gap-2 p-1 bg-[var(--input)] border border-[var(--border)] rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAdminAction("promote");
                    setAdminMessage("");
                    setAdminStatus("idle");
                  }}
                  className={`flex-1 py-1.5 text-xs font-black rounded-md transition ${
                    adminAction === "promote"
                      ? "bg-teal-400 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Promote Existing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminAction("create");
                    setAdminMessage("");
                    setAdminStatus("idle");
                  }}
                  className={`flex-1 py-1.5 text-xs font-black rounded-md transition ${
                    adminAction === "create"
                      ? "bg-teal-400 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Create New Account
                </button>
              </div>

              {adminAction === "promote" ? (
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">User Email Address</label>
                    <input
                      type="email"
                      required
                      value={adminPromoEmail}
                      onChange={(e) => setAdminPromoEmail(e.target.value)}
                      placeholder="explorer@sheher.in"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={adminStatus === "submitting"}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 hover:bg-teal-300 px-4 py-2.5 font-black text-slate-950 shadow-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {adminStatus === "submitting" ? "Promoting..." : "Grant Super Admin Access"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Admin Explorer"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={adminPromoEmail}
                      onChange={(e) => setAdminPromoEmail(e.target.value)}
                      placeholder="admin@sheher.in"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={adminStatus === "submitting"}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 hover:bg-teal-300 px-4 py-2.5 font-black text-slate-950 shadow-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {adminStatus === "submitting" ? "Creating..." : "Create Admin Account"}
                  </button>
                </form>
              )}

              {adminMessage && (
                <p className={`mt-3 text-xs font-bold text-center ${adminStatus === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                  {adminMessage}
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
