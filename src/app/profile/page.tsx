"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Bell, Bookmark, ChevronRight, Compass, Lock, LogOut, Mail, MapPin, Shield, Sparkles, Star, User } from "lucide-react";
import { Header } from "@/components/common/Header";
import { MOCK_PLACES, getPlacesWithDistance } from "@/data/mock-places";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Place } from "@/types";
import { formatDistance, getCategoryLabel, getInitials } from "@/lib/utils";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";

export default function ProfilePage() {
  const { location } = useGeolocation();
  const { user, loading, authRequiredMessage, submitAuth, logout } = useAuth();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [privateMode, setPrivateMode] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [authMessage, setAuthMessage] = useState("");
  const { savedPlaceIds } = useSavedPlaces();
  const placesById = useMemo(() => new Map(MOCK_PLACES.map((place) => [place.id, place])), []);
  const savedPlaces = useMemo(
    () => getPlacesWithDistance([...savedPlaceIds].map((id) => placesById.get(id)).filter(Boolean) as Place[], location),
    [location, placesById, savedPlaceIds]
  );
  const savedCities = useMemo(() => Array.from(new Set(savedPlaces.map((place) => place.city))), [savedPlaces]);
  const topSavedCity = savedCities[0] ?? "No city yet";

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

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header eyebrow="Profile" title="Explorer Profile" subtitle="Checking your secure session." showLocation={false} />
        <div className="mx-auto max-w-screen-md px-3 py-4 sm:px-4 md:px-6 md:py-8">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 font-bold text-[var(--muted)]">
            Loading account...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header eyebrow="Profile" title="Log In" subtitle="Create an account to save places and report live crowd updates." showLocation={false} />

        <div className="mx-auto grid max-w-screen-md gap-4 px-3 py-4 sm:px-4 md:px-6 md:py-8">
          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42 }}
            onSubmit={handleAuthSubmit}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6"
          >
            {authRequiredMessage && (
              <div className="mb-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
                {authRequiredMessage}
              </div>
            )}

            <div className="mb-5 flex rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-1">
              {(["login", "signup"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setMode(item);
                    setAuthMessage("");
                  }}
                  className={`h-11 flex-1 rounded-lg text-sm font-black capitalize transition ${
                    mode === item ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-strong)]"
                  }`}
                >
                  {item === "signup" ? "Sign Up" : "Log In"}
                </button>
              ))}
            </div>

            {mode === "signup" && (
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  <User size={14} />
                  Full name
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-300"
                  placeholder="Your full name"
                />
              </label>
            )}

            <label className={mode === "signup" ? "mt-4 block" : "block"}>
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Mail size={14} />
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-300"
                placeholder="you@example.com"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                <Lock size={14} />
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={8}
                className="h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-teal-300"
                placeholder="At least 8 characters"
              />
            </label>

            <button
              type="submit"
              disabled={authStatus === "submitting"}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 font-black text-[var(--primary-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authStatus === "submitting" ? "Please wait..." : mode === "signup" ? "Create Account" : "Log In"}
            </button>

            {authMessage && (
              <p className={`mt-3 text-sm font-semibold ${authStatus === "error" ? "text-rose-300" : "text-emerald-300"}`}>
                {authMessage}
              </p>
            )}

            <p className="mt-4 text-sm text-[var(--muted)]">
              Browsing places and opening directions stays public. Saving and crowd reports need an account.
            </p>
          </motion.form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header eyebrow="Profile" title="Explorer Profile" subtitle="Saved places, preferences, and your account overview." showLocation={false} />

      <div className="mx-auto grid max-w-screen-xl gap-4 px-3 py-4 sm:px-4 md:px-6 md:py-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className="space-y-4"
        >
          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 via-teal-300 to-amber-300 text-xl font-black text-slate-950 shadow-xl sm:h-20 sm:w-20 sm:text-2xl">
                {getInitials(user?.fullName || user?.email || "City Explorer")}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">{user?.role === "super_admin" ? "Admin account" : "Explorer account"}</p>
                <h2 className="mt-1 break-words text-xl font-black text-[var(--foreground)] sm:text-2xl">{user?.fullName || "City Explorer"}</h2>
                <p className="mt-1 break-all text-sm font-semibold text-[var(--muted)]">{user?.email}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Signed in securely</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Saved", value: savedPlaces.length.toString() },
                { label: "Access", value: user?.role === "super_admin" ? "Admin" : "Explorer" },
                { label: "Cities", value: savedCities.length.toString() },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-2 text-center sm:p-3">
                  <p className="text-lg font-black text-[var(--foreground)] sm:text-xl">{stat.value}</p>
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
              onClick={logout}
              className="mt-2 flex w-full items-center justify-between rounded-lg px-2 py-3 text-left font-semibold text-[var(--muted-strong)] transition hover:bg-[var(--panel-soft)]"
            >
              <span className="flex items-center gap-3">
                <LogOut size={18} className="text-[var(--muted)]" />
                Log out
              </span>
              <ChevronRight size={18} className="text-[var(--muted)]" />
            </button>
          </div>
        </motion.aside>

        <main className="space-y-5">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.05 }}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-5"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">Saved collection</p>
                <h2 className="mt-1 text-xl font-black text-[var(--foreground)] sm:text-2xl">Places To Try Next</h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1.5 text-sm font-bold text-[var(--muted-strong)]">
                <Bookmark size={15} />
                {savedPlaces.length} saved
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {savedPlaces.length > 0 ? savedPlaces.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setSelectedPlace(place)}
                  className="group grid grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 text-left transition hover:bg-[var(--panel)] sm:grid-cols-[96px_minmax(0,1fr)]"
                >
                  <div className="relative h-24 overflow-hidden rounded-lg bg-slate-900">
                    <Image
                      src={place.image}
                      alt={`${place.title} in ${place.locality}`}
                      fill
                      sizes="96px"
                      className="transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                      {getCategoryLabel(place.category)}
                    </p>
                    <h3 className="mt-1 line-clamp-1 font-black text-[var(--foreground)]">{place.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{place.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs font-bold text-[var(--muted-strong)]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} className="text-cyan-300" />
                        {formatDistance(place.distance)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Star size={13} className="fill-yellow-300 text-yellow-300" />
                        {place.rating}
                      </span>
                    </div>
                  </div>
                </button>
              )) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel-soft)] p-5 text-sm font-semibold text-[var(--muted)] md:col-span-2">
                  No saved places yet. Browse the home or discover page and tap the bookmark on any card.
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
                      : "Mumbai, Kolhapur, Nashik, and Pune are now available to explore.",
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
        </main>
      </div>

      <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
    </div>
  );
}
