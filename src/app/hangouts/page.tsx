"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, MapPin, MessageSquare, Plus, Users, X, Search, Trash2, Check, Info, Flag } from "lucide-react";
import { Header } from "@/components/common/Header";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useAuth } from "@/components/auth/AuthProvider";
import { Place } from "@/types";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { CitySwitcher } from "@/components/common/CitySwitcher";

interface RSVPUser {
  userId: string;
  fullName: string;
}

interface Hangout {
  id: string;
  userId: string;
  placeId: string;
  title: string;
  description: string;
  eventDate: string;
  whatsappLink: string;
  city: string;
  createdAt: string;
  userFullName: string;
  userEmail: string;
  placeTitle: string;
  rsvps: RSVPUser[];
  flags: string[];
}

export default function HangoutsPage() {
  const { selectedCity, chooseCity } = useCitySelection();
  const { user, setAuthRequiredMessage } = useAuth();
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "today" | "week" | "upcoming">("all");

  // Selected Place details modal state
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);

  // Plan Hangout Modal Form States
  const [isOpen, setIsOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formPlaceId, setFormPlaceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Actions Loading states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rsvpingId, setRsvpingId] = useState<string | null>(null);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  const fetchHangouts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/hangouts?city=${encodeURIComponent(selectedCity)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load hangouts.");
      setHangouts(data.hangouts || []);
    } catch (err: any) {
      setError(err.message || "Failed to load hangouts.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCityPlaces = async () => {
    setLoadingPlaces(true);
    try {
      const res = await fetch(`/api/places/osm?city=${encodeURIComponent(selectedCity)}`);
      const data = await res.json();
      if (res.ok && data.places) {
        setPlaces(data.places);
        if (data.places.length > 0) {
          setFormPlaceId(data.places[0].id);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoadingPlaces(false);
    }
  };

  useEffect(() => {
    fetchHangouts();
  }, [selectedCity]);

  useEffect(() => {
    if (isOpen) {
      fetchCityPlaces();
    }
  }, [isOpen, selectedCity]);

  const handleOpenModal = () => {
    if (!user) {
      const message = "Please log in to organize a community hangout.";
      setAuthRequiredMessage(message);
      window.location.href = "/profile";
      return;
    }
    setIsOpen(true);
  };

  const getMinDateTime = () => {
    const now = new Date();
    const minTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes in future
    const year = minTime.getFullYear();
    const month = String(minTime.getMonth() + 1).padStart(2, "0");
    const day = String(minTime.getDate()).padStart(2, "0");
    const hours = String(minTime.getHours()).padStart(2, "0");
    const minutes = String(minTime.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim() || !formDesc.trim() || !formDate || !formWhatsapp.trim() || !formPlaceId) {
      setFormError("All fields are required.");
      return;
    }

    if (!formWhatsapp.trim().toLowerCase().startsWith("https://chat.whatsapp.com/")) {
      setFormError("Must be a valid WhatsApp group invite link (starts with https://chat.whatsapp.com/).");
      return;
    }

    const parsedDate = new Date(formDate);
    const now = new Date();
    const minFuture = new Date(now.getTime() + 30 * 60 * 1000);
    const maxFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (parsedDate < minFuture) {
      setFormError("The meetup must be planned at least 30 minutes in the future.");
      return;
    }
    if (parsedDate > maxFuture) {
      setFormError("The meetup cannot be planned more than 30 days in advance.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/hangouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: formPlaceId,
          title: formTitle.trim(),
          description: formDesc.trim(),
          eventDate: formDate,
          whatsappLink: formWhatsapp.trim(),
          city: selectedCity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create hangout.");

      // Refresh badges stats globally
      window.dispatchEvent(new CustomEvent("sheher:refresh-badges"));

      // Reset form
      setFormTitle("");
      setFormDesc("");
      setFormDate("");
      setFormWhatsapp("");
      setIsOpen(false);

      // Refresh hangouts list
      fetchHangouts();
    } catch (err: any) {
      setFormError(err.message || "Failed to save hangout.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRSVP = async (hangoutId: string) => {
    if (!user) {
      setAuthRequiredMessage("Please log in to RSVP to community meetups.");
      window.location.href = "/profile";
      return;
    }

    setRsvpingId(hangoutId);
    try {
      const res = await fetch("/api/hangouts/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hangoutId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update RSVP.");

      // Refresh badges / XP stats globally
      window.dispatchEvent(new CustomEvent("sheher:refresh-badges"));

      // Refresh feed
      fetchHangouts();
    } catch (err: any) {
      alert(err.message || "Could not update RSVP status.");
    } finally {
      setRsvpingId(null);
    }
  };

  const handleFlagHangout = async (hangoutId: string) => {
    if (!user) {
      setAuthRequiredMessage("Please log in to report meetups.");
      window.location.href = "/profile";
      return;
    }

    if (!window.confirm("Are you sure you want to report this hangout for spam, link abuse, or inappropriate content?")) {
      return;
    }

    setFlaggingId(hangoutId);
    try {
      const res = await fetch("/api/hangouts/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hangoutId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to report hangout.");

      alert("Thank you. This meetup has been reported.");
      fetchHangouts();
    } catch (err: any) {
      alert(err.message || "Could not report hangout.");
    } finally {
      setFlaggingId(null);
    }
  };

  const handleDeleteHangout = async (hangoutId: string) => {
    if (!window.confirm("Are you sure you want to cancel and delete this hangout?")) {
      return;
    }

    setDeletingId(hangoutId);
    try {
      const res = await fetch(`/api/hangouts?id=${encodeURIComponent(hangoutId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete hangout.");

      // Refresh feed
      fetchHangouts();
    } catch (err: any) {
      alert(err.message || "Could not delete hangout.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenPlaceDetails = async (placeId: string) => {
    if (resolvingPlaceId) return;
    setResolvingPlaceId(placeId);
    try {
      const res = await fetch(`/api/places/resolve?ids=${encodeURIComponent(placeId)}`);
      const data = await res.json();
      if (res.ok && data.places && data.places.length > 0) {
        setSelectedPlace(data.places[0]);
      }
    } catch (err) {
      console.error("Failed to load spot info:", err);
    } finally {
      setResolvingPlaceId(null);
    }
  };

  const getSubredditUrl = () => {
    return `https://www.reddit.com/r/${selectedCity.toLowerCase()}`;
  };

  const formatEventDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRelativeDateBadge = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 23 * 59 * 59 * 999);

    if (eventDate >= todayStart && eventDate < tomorrowStart) {
      return { text: "Today", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    }
    if (eventDate >= tomorrowStart && eventDate <= tomorrowEnd) {
      return { text: "Tomorrow", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    }
    return null;
  };

  // Client-side filtering logic
  const filteredHangouts = hangouts.filter((h) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = h.title.toLowerCase().includes(q);
      const matchDesc = h.description.toLowerCase().includes(q);
      const matchPlace = h.placeTitle.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchPlace) return false;
    }

    // 2. Date Filters
    const eventDate = new Date(h.eventDate);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (activeFilter === "today") {
      return eventDate >= todayStart && eventDate <= todayEnd;
    }
    if (activeFilter === "week") {
      const nextWeek = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      return eventDate >= todayStart && eventDate <= nextWeek;
    }
    if (activeFilter === "upcoming") {
      return eventDate >= now;
    }

    return true; // "all"
  });

  return (
    <div className="w-full max-w-full min-h-screen overflow-x-hidden bg-[var(--background)] pb-8 text-[var(--foreground)]">
      <Header
        eyebrow="Community"
        title="Community Hangouts"
        subtitle={`Organize and join local meetups, chat on WhatsApp, or browse the city subreddit.`}
        location={selectedCity}
        showLocation={true}
      />

      <div className="w-full max-w-4xl mx-auto px-4 pt-4">
        {/* Hero Card */}
        <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--hero-gradient-from)] via-[var(--hero-gradient-via)] to-[var(--hero-gradient-to)] p-6 md:p-8 shadow-2xl">
          <div className="absolute inset-0 bg-teal-500/5 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <span className="inline-flex rounded-full bg-[var(--panel-soft)] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--fresh)] border border-[var(--border)]">
                💬 Connect & Explore
              </span>
              <h2 className="text-3xl font-black tracking-tight text-[var(--foreground)] md:text-4xl">
                Sheher Hangouts
              </h2>
              <p className="text-sm font-semibold leading-relaxed text-[var(--muted-strong)]">
                Plan a meetup, share a WhatsApp group invite, or jump into your city's local subreddit. Connect with local explorers in <span className="text-[var(--fresh)] font-bold">{selectedCity}</span>!
              </p>
            </div>
            <button
              onClick={handleOpenModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-5 py-3 font-black text-white shadow-lg shadow-teal-600/15 transition hover:scale-[1.02] cursor-pointer shrink-0"
            >
              <Plus size={18} />
              Plan a Meetup (+30 XP)
            </button>
          </div>
        </section>

        {/* City Selector */}
        <div className="mt-8 flex flex-col items-start gap-1">
          <span className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Active City</span>
          <CitySwitcher value={selectedCity} onChange={chooseCity} />
        </div>

        {/* Search & Filters Controls */}
        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hangouts by title, plan, or spot name..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--input)] text-sm font-semibold outline-none focus:border-teal-400 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Reddit Link */}
            <a
              href={getSubredditUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-xs font-black text-orange-400 hover:bg-orange-500/20 transition shrink-0"
            >
              🌐 Visit r/{selectedCity} Subreddit
            </a>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto">
            {(["all", "today", "week", "upcoming"] as const).map((filter) => {
              const label = {
                all: "All Meetups",
                today: "Today",
                week: "This Week",
                upcoming: "Upcoming",
              }[filter];

              const isActive = activeFilter === filter;

              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`relative px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                    isActive ? "text-teal-300" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                  {isActive && (
                    <motion.div
                      layoutId="activeHangoutTab"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-teal-400"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hangouts List */}
        <div className="mt-6">
          {loading ? (
            <p className="text-center text-sm font-semibold text-[var(--muted)] py-12">Loading local meetups...</p>
          ) : error ? (
            <p className="text-center text-sm font-semibold text-rose-400 py-12">{error}</p>
          ) : filteredHangouts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-soft)] py-16 text-center">
              <Users size={40} className="mx-auto text-slate-600 mb-3" />
              <h4 className="text-base font-black text-slate-300">No meetups match your filter</h4>
              <p className="mt-1 text-sm text-[var(--muted)] font-medium">Be the first to organize a hangout in {selectedCity}!</p>
              <button
                onClick={handleOpenModal}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--panel-strong)] border border-[var(--border)] px-4 py-2 text-xs font-black text-teal-300 hover:bg-[var(--panel)] cursor-pointer"
              >
                Plan Hangout
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {filteredHangouts.map((h) => {
                const dateBadge = getRelativeDateBadge(h.eventDate);
                const isUserRsvped = h.rsvps.some((r) => r.userId === user?.id);
                const isHost = h.userId === user?.id;
                const isAdmin = user?.role === "super_admin";
                const isFlaggedByUser = h.flags?.includes(user?.id ?? "");

                return (
                  <div
                    key={h.id}
                    className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-5 hover:bg-[var(--panel-strong)] transition-all shadow-lg hover:border-teal-400/20"
                  >
                    {/* Delete button for host/admin */}
                    {(isHost || isAdmin) && (
                      <button
                        onClick={() => handleDeleteHangout(h.id)}
                        disabled={deletingId === h.id}
                        className="absolute right-4 top-4 text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition cursor-pointer disabled:opacity-50"
                        title="Delete Hangout"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <div className="space-y-3">
                      {/* Host header */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-teal-500/15 text-[10px] font-black text-teal-300 border border-teal-500/10">
                          {h.userFullName ? h.userFullName.slice(0, 2).toUpperCase() : "?"}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-200">Host: {h.userFullName}</span>
                          <span className="text-[9px] text-slate-500 font-semibold">{new Date(h.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Title & relative date badges */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black text-[var(--foreground)] group-hover:text-teal-300 transition-colors">
                            {h.title}
                          </h4>
                          {dateBadge && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${dateBadge.className}`}>
                              {dateBadge.text}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-[var(--muted-strong)] leading-relaxed line-clamp-3">
                          {h.description}
                        </p>
                      </div>

                      {/* Location & Time details */}
                      <div className="space-y-1.5 pt-2.5 border-t border-white/5 text-xs text-[var(--muted)] font-semibold">
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-teal-400 shrink-0" />
                          <button
                            onClick={() => handleOpenPlaceDetails(h.placeId)}
                            disabled={resolvingPlaceId !== null}
                            className="truncate text-left text-slate-300 hover:text-teal-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-60"
                            title="Click to see place details"
                          >
                            <span>Spot: <span className="font-bold">{h.placeTitle}</span></span>
                            <Info size={11} className="inline opacity-60" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-teal-400 shrink-0" />
                          <span className="text-slate-300">{formatEventDate(h.eventDate)}</span>
                        </div>
                      </div>

                      {/* Attending Explorer Avatars */}
                      <div className="flex items-center gap-2 pt-1">
                        {h.rsvps.length > 0 ? (
                          <div className="flex items-center">
                            {/* Avatars Stack */}
                            <div className="flex items-center overflow-hidden">
                              {h.rsvps.slice(0, 3).map((r, idx) => (
                                <div
                                  key={r.userId}
                                  className="relative -ml-2 first:ml-0 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[9px] font-bold text-slate-300 border border-slate-900"
                                  title={r.fullName}
                                >
                                  {r.fullName ? r.fullName.slice(0, 2).toUpperCase() : "?"}
                                </div>
                              ))}
                              {h.rsvps.length > 3 && (
                                <div className="relative -ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-teal-950 text-[9px] font-bold text-teal-300 border border-slate-900">
                                  +{h.rsvps.length - 3}
                                </div>
                              )}
                            </div>
                            <span
                              className="text-[10px] text-slate-400 font-bold ml-2 cursor-help border-b border-dashed border-slate-600"
                              title={h.rsvps.map((r) => r.fullName).join(", ")}
                            >
                              {h.rsvps.length} attending
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-semibold">No RSVPs yet</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      {/* RSVP / Join Toggle */}
                      <button
                        onClick={() => handleToggleRSVP(h.id)}
                        disabled={rsvpingId === h.id}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition cursor-pointer disabled:opacity-50 ${
                          isUserRsvped
                            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
                            : "border border-teal-500/30 bg-teal-500/5 text-teal-400 hover:bg-teal-500/10"
                        }`}
                      >
                        {isUserRsvped ? (
                          <>
                            <Check size={13} />
                            Going
                          </>
                        ) : (
                          <>
                            <Plus size={13} />
                            RSVP (+10 XP)
                          </>
                        )}
                      </button>

                      {/* WhatsApp invite link */}
                      <a
                        href={h.whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 transition"
                      >
                        <MessageSquare size={13} className="fill-slate-950" />
                        Join Group
                      </a>

                      {/* Report / Flag button */}
                      <button
                        onClick={() => handleFlagHangout(h.id)}
                        disabled={flaggingId === h.id || isFlaggedByUser}
                        className={`inline-flex items-center justify-center p-2 rounded-lg border transition cursor-pointer disabled:opacity-60 shrink-0 ${
                          isFlaggedByUser
                            ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                            : "border-slate-700 bg-slate-800/20 text-slate-400 hover:text-rose-400 hover:border-rose-500/30"
                        }`}
                        title={isFlaggedByUser ? "You reported this" : "Report Spam"}
                      >
                        <Flag size={13} className={isFlaggedByUser ? "fill-rose-400" : ""} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Place details modal popover */}
      {selectedPlace && (
        <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      )}

      {/* Plan Hangout Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>

              <h3 className="text-lg font-black text-white mb-1">Plan a Community Hangout</h3>
              <p className="text-xs text-[var(--muted)] font-semibold mb-4">Organize a meetup and earn +30 XP! Make sure to create a WhatsApp group invite link first.</p>

              <form onSubmit={handleSubmit} className="space-y-4 text-sm font-semibold">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">Meetup Title</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Saturday Cafe Crawl"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">Target Place in {selectedCity}</label>
                  {loadingPlaces ? (
                    <p className="text-xs font-bold text-slate-500">Loading places list...</p>
                  ) : (
                    <select
                      value={formPlaceId}
                      onChange={(e) => setFormPlaceId(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                    >
                      {places.map((p) => (
                        <option key={p.id} value={p.id}>{p.title} ({p.locality})</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Meetup Date & Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      min={getMinDateTime()}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">WhatsApp Group Invite Link</label>
                  <input
                    type="url"
                    required
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">Description / Plan</label>
                  <textarea
                    required
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    maxLength={1000}
                    placeholder="What are we doing? Where are we meeting?"
                    className="min-h-20 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-teal-300"
                  />
                </div>

                {formError && <p className="text-xs font-bold text-rose-400">{formError}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 hover:bg-teal-300 px-4 py-3 font-black text-slate-950 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? "Publishing..." : "Publish Meetup (+30 XP)"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
