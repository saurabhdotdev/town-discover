"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, Star, Award, Compass, Lock, CheckCircle2, ChevronLeft, ChevronRight, BookOpen, User } from "lucide-react";
import { Place } from "@/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { useBadges } from "@/hooks/useBadges";
import useSWR from "swr";

interface StampData {
  cityName: string;
  stampedAt: string;
}

interface ExplorerPassportProps {
  savedPlaces: Place[];
  onStampClaimed?: () => void; // Callback to trigger parent stats refresh (XP bar)
}

interface PassportCity {
  id: string;
  name: string;
  emoji: string;
  badge: string;
  description: string;
  themeColor: string;
  borderColor: string;
}

const PASSPORT_CITIES: PassportCity[] = [
  {
    id: "pune",
    name: "Pune",
    emoji: "🏰",
    badge: "Lohegaon Fort",
    description: "Cultural hub and historical Maratha capital",
    themeColor: "from-amber-500/20 to-amber-950/40",
    borderColor: "border-amber-500/30 text-amber-400",
  },
  {
    id: "mumbai",
    name: "Mumbai",
    emoji: "🌊",
    badge: "Gateway Ocean",
    description: "City of dreams, sea views, and grand architecture",
    themeColor: "from-cyan-500/20 to-cyan-950/40",
    borderColor: "border-cyan-500/30 text-cyan-400",
  },
  {
    id: "bangalore",
    name: "Bangalore",
    emoji: "🌳",
    badge: "Garden Silicon",
    description: "Tech capital with beautiful parks and micro-breweries",
    themeColor: "from-emerald-500/20 to-emerald-950/40",
    borderColor: "border-emerald-500/30 text-emerald-400",
  },
  {
    id: "delhi",
    name: "Delhi",
    emoji: "🏛️",
    badge: "India Gate",
    description: "Historic heart of India with massive monuments and food",
    themeColor: "from-rose-500/20 to-rose-950/40",
    borderColor: "border-rose-500/30 text-rose-400",
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    emoji: "🕌",
    badge: "Charminar Minar",
    description: "Rich Nizami heritage and legendary Biryani spots",
    themeColor: "from-orange-500/20 to-orange-950/40",
    borderColor: "border-orange-500/30 text-orange-400",
  },
  {
    id: "kolkata",
    name: "Kolkata",
    emoji: "🌉",
    badge: "Victoria Bridge",
    description: "Cultural capital with grand heritage sights and sweets",
    themeColor: "from-purple-500/20 to-purple-950/40",
    borderColor: "border-purple-500/30 text-purple-400",
  },
  {
    id: "chennai",
    name: "Chennai",
    emoji: "☀️",
    badge: "Marina Coast",
    description: "Coastal metropolis with ancient temples and beaches",
    themeColor: "from-pink-500/20 to-pink-950/40",
    borderColor: "border-pink-500/30 text-pink-400",
  },
  {
    id: "jaipur",
    name: "Jaipur",
    emoji: "🌸",
    badge: "Hawa Palace",
    description: "The Royal Pink City full of forts and palaces",
    themeColor: "from-amber-600/20 to-yellow-950/40",
    borderColor: "border-yellow-600/30 text-yellow-500",
  },
];

const BADGE_MAP: Record<string, { name: string; emoji: string; desc: string }> = {
  "first-save": { name: "Wishlist Starter", emoji: "🌱", desc: "Saved first place" },
  "collector": { name: "Collector", emoji: "📌", desc: "Saved 5 spots" },
  "curator": { name: "Curator", emoji: "🎨", desc: "Saved 20 places" },
  "night-rider": { name: "Night Rider", emoji: "🌙", desc: "Saved night-drive" },
  "street-food-guru": { name: "Street Food Guru", emoji: "🍢", desc: "Saved 3 street food spots" },
  "city-eye": { name: "City Eye", emoji: "👁", desc: "Submitted first crowd report" },
  "signal-sender": { name: "Signal Sender", emoji: "📡", desc: "Submitted 5 crowd reports" },
  "community-scout": { name: "Community Scout", emoji: "🗺", desc: "Suggested first place" },
  "spot-approved": { name: "Spot Approved", emoji: "✅", desc: "Suggestion was approved" },
  "first-review": { name: "Local Critic", emoji: "✍️", desc: "Wrote first place review" },
  "pro-critic": { name: "Pro Critic", emoji: "📝", desc: "Wrote 5 place reviews" },
  "elite-critic": { name: "Elite Critic", emoji: "👑", desc: "Wrote 15 place reviews" },
};

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error("Failed to fetch passport stamps");
  return res.json();
});

export const ExplorerPassport = ({ savedPlaces, onStampClaimed }: ExplorerPassportProps) => {
  const { user } = useAuth();
  const { stats } = useBadges(!!user);

  const { data, mutate } = useSWR<{ stamps: StampData[] }>(
    user ? "/api/profile/passport" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 4000,
    }
  );

  const [isOpen, setIsOpen] = useState(false);
  const [claimingCity, setClaimingCity] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiCenter, setConfettiCenter] = useState({ x: 0, y: 0 });

  // Pagination for Right Page
  const [currentPage, setCurrentPage] = useState(0); // 0 = City page A, 1 = City page B, 2 = Badges Page

  // Memoize claimed stamps mapping from SWR data
  const claimedStamps = useMemo<Record<string, string>>(() => {
    if (!data?.stamps) return {};
    const map: Record<string, string> = {};
    data.stamps.forEach((s: StampData) => {
      map[s.cityName.toLowerCase()] = new Date(s.stampedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    });
    return map;
  }, [data]);

  // Helper to count user saved places per city
  const getCitySaveCount = (cityName: string) => {
    return savedPlaces.filter((p) => {
      const c = p.city.toLowerCase();
      const target = cityName.toLowerCase();
      return (
        c === target ||
        (target === "bangalore" && c === "bengaluru") ||
        (target === "bengaluru" && c === "bangalore") ||
        (target === "mumbai" && c === "bombay") ||
        (target === "bombay" && c === "mumbai")
      );
    }).length;
  };

  const handleClaimStamp = async (cityName: string, event: React.MouseEvent) => {
    if (claimingCity) return;
    setClaimingCity(cityName);

    // Save click coordinates for confetti burst
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    setConfettiCenter({ x, y });

    try {
      const res = await fetch("/api/profile/passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: cityName }),
      });

      if (res.ok) {
        // Trigger stamping confetti burst
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        // Reload stamps and stats
        await mutate();
        if (onStampClaimed) {
          onStampClaimed();
        }
      } else {
        const data = await res.json();
        alert(data.error ?? "Failed to claim stamp.");
      }
    } catch (e) {
      console.error("Error claiming stamp:", e);
    } finally {
      setClaimingCity(null);
    }
  };

  // Confetti Star Burst generator
  const renderConfetti = () => {
    const stars = Array.from({ length: 40 });
    return (
      <div className="fixed inset-0 pointer-events-none z-[9999]">
        {stars.map((_, i) => {
          const angle = (i / stars.length) * 360 + Math.random() * 20;
          const velocity = 80 + Math.random() * 120;
          const xDest = Math.cos((angle * Math.PI) / 180) * velocity;
          const yDest = Math.sin((angle * Math.PI) / 180) * velocity;

          return (
            <motion.div
              key={i}
              initial={{
                opacity: 1,
                scale: 0.5,
                x: confettiCenter.x,
                y: confettiCenter.y,
                rotate: 0,
              }}
              animate={{
                opacity: 0,
                scale: [1, 1.5, 0.2],
                x: confettiCenter.x + xDest,
                y: confettiCenter.y + yDest,
                rotate: 360 + Math.random() * 720,
              }}
              transition={{
                duration: 1.5 + Math.random() * 0.8,
                ease: "easeOut",
              }}
              className="absolute text-amber-400 font-bold"
              style={{ fontSize: `${12 + Math.random() * 16}px` }}
            >
              {i % 3 === 0 ? "✨" : i % 3 === 1 ? "★" : "👑"}
            </motion.div>
          );
        })}
      </div>
    );
  };

  const unlockedCount = Object.keys(claimedStamps).length;

  return (
    <div className="w-full">
      {showConfetti && renderConfetti()}

      <AnimatePresence mode="wait">
        {!isOpen ? (
          /* PASSPORT BINDER COVER */
          <motion.div
            key="cover"
            onClick={() => setIsOpen(true)}
            whileHover={{ scale: 1.015, y: -2 }}
            whileTap={{ scale: 0.995 }}
            className="relative cursor-pointer rounded-2xl border-2 border-slate-700/60 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl text-center overflow-hidden flex flex-col justify-between items-center min-h-[300px]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0l40 40-40 40L0 40z' fill='%231e293b' fill-opacity='0.08' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            }}
          >
            <div className="absolute -inset-10 bg-radial-gradient from-amber-500/5 to-transparent blur-3xl opacity-60 pointer-events-none" />

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Republic of Sheher</span>
              <h3 className="text-xl font-black text-white tracking-[0.1em] font-serif">EXPLORER PASSPORT</h3>
            </div>

            <div className="relative my-4 flex h-28 w-28 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/5 shadow-inner">
              <div className="absolute inset-2 rounded-full border border-dashed border-amber-500/30" />
              <Compass size={48} className="text-amber-400 animate-pulse" style={{ animationDuration: "5s" }} />
            </div>

            <div className="space-y-2 w-full max-w-xs text-xs">
              <div className="flex items-center justify-between border-t border-dashed border-slate-800 pt-3 font-bold text-slate-400">
                <span>Stamps Unlocked:</span>
                <span className="font-mono text-amber-400 text-sm font-black">
                  {unlockedCount} / {PASSPORT_CITIES.length}
                </span>
              </div>
              <button
                type="button"
                className="w-full mt-2 rounded-lg bg-amber-500 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                Open Passport Booklet 📖
              </button>
            </div>
          </motion.div>
        ) : (
          /* PASSPORT INNER PAGES (Interactive Double Page Booklet) */
          <motion.div
            key="booklet"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="rounded-3xl border border-slate-800 bg-[#070e12] p-5 sm:p-7 shadow-2xl relative overflow-hidden"
            style={{ perspective: "1500px" }}
          >
            {/* Header Controls */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6 relative z-10">
              <div className="flex items-center gap-2">
                <BookOpen className="text-amber-400" size={16} />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Digital Explorer Booklet</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-400 hover:text-white transition cursor-pointer"
              >
                Close Booklet
              </button>
            </div>

            {/* Book Spine Center Line Overlay (desktop only) */}
            <div className="hidden lg:block absolute left-1/2 top-16 bottom-6 w-[2px] bg-gradient-to-b from-transparent via-slate-800 to-transparent z-20 pointer-events-none" />

            {/* 2-Page Spread Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
              
              {/* LEFT PAGE: Traveler Identification Info */}
              <div className="rounded-2xl bg-slate-900/40 border border-white/5 p-5 sm:p-6 flex flex-col justify-between min-h-[440px] relative overflow-hidden">
                <div className="absolute inset-0 bg-radial-gradient from-teal-500/[0.02] to-transparent pointer-events-none" />
                
                {/* Official Header */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
                  <div className="text-left">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">Republic of Sheher</h4>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Traveler ID Page</span>
                  </div>
                  <Compass size={18} className="text-teal-500/40" />
                </div>

                {/* Main ID Grid */}
                <div className="flex flex-col sm:flex-row gap-5 items-stretch">
                  {/* Photo Slot */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="relative h-28 w-24 rounded-lg border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden shadow-inner">
                      <div className="absolute inset-1 rounded border border-dashed border-slate-800 pointer-events-none" />
                      <User size={40} className="text-teal-400/40" />
                      <div className="absolute bottom-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-teal-500/20 text-[6px] font-bold text-teal-400 border border-teal-500/50">
                        ✓
                      </div>
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-500 tracking-wider">Passport Photo</span>
                  </div>

                  {/* ID Fields */}
                  <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-2.5 text-left text-[10px] font-semibold text-slate-400">
                    <div className="col-span-2">
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Given Names</span>
                      <span className="text-slate-100 font-black text-sm">{user?.fullName || "Explorer Name"}</span>
                    </div>

                    <div>
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Nationality</span>
                      <span className="text-slate-200 font-bold">SHEHER CITIZEN</span>
                    </div>

                    <div>
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Passport No.</span>
                      <span className="font-mono text-teal-400 font-bold">
                        SH-{user?.id ? user.id.slice(0, 8).toUpperCase() : "xxxxxx"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Explorer Level</span>
                      <span className="text-amber-400 font-black flex items-center gap-0.5">
                        Lv.{stats?.level || 1} ({stats?.title || "Wanderer"})
                      </span>
                    </div>

                    <div>
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Status</span>
                      <span className="text-slate-200 font-bold">
                        ACTIVE EXPLORER
                      </span>
                    </div>

                    <div className="col-span-2 pt-1.5 border-t border-slate-800/60 mt-1">
                      <span className="block text-[8px] font-black text-slate-500 uppercase mb-1">Holder's Signature</span>
                      <span className="font-serif italic text-teal-300/50 text-base tracking-wide select-none">
                        {user?.fullName || "Explorer Name"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Tallies */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-[9px] font-black uppercase text-slate-500 tracking-wider">
                  <span>Total XP: <span className="text-slate-200">{stats?.totalXp.toLocaleString() || "0"}</span></span>
                  <span>Stamps: <span className="text-amber-400">{unlockedCount} / {PASSPORT_CITIES.length}</span></span>
                </div>
              </div>

              {/* RIGHT PAGE: Paged Stamp Sheets */}
              <div className="rounded-2xl bg-slate-900/40 border border-white/5 p-5 sm:p-6 flex flex-col justify-between min-h-[440px] relative">
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, rotateY: 30 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    exit={{ opacity: 0, rotateY: -30 }}
                    transition={{ duration: 0.25 }}
                    style={{ transformOrigin: "left center" }}
                    className="w-full h-full flex flex-col justify-between"
                  >
                    
                    {currentPage === 0 || currentPage === 1 ? (
                      /* CITY STAMP PAGES */
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                            {currentPage === 0 ? "Discovery Stamps (Set A)" : "Discovery Stamps (Set B)"}
                          </h4>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            Pages {currentPage * 2 + 2}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5">
                          {PASSPORT_CITIES.slice(currentPage * 4, currentPage * 4 + 4).map((city) => {
                            const saveCount = getCitySaveCount(city.name);
                            const isClaimed = claimedStamps[city.name.toLowerCase()] !== undefined;
                            const canClaim = !isClaimed && saveCount >= 3;
                            const stampedDate = claimedStamps[city.name.toLowerCase()];

                            return (
                              <div
                                key={city.id}
                                className={`rounded-xl border p-3.5 text-center flex flex-col justify-between items-center min-h-[145px] transition duration-200 relative overflow-hidden ${
                                  isClaimed
                                    ? "bg-gradient-to-br " + city.themeColor + " border-amber-500/20"
                                    : canClaim
                                    ? "bg-slate-800/40 border-amber-500/40 animate-pulse shadow-lg"
                                    : "bg-slate-950/10 border-white/5 opacity-55"
                                }`}
                              >
                                <div className="relative flex h-14 w-14 items-center justify-center rounded-full">
                                  {isClaimed ? (
                                    <motion.div
                                      initial={{ scale: 0.8, rotate: -15 }}
                                      animate={{ scale: 1, rotate: -5 }}
                                      className={`flex h-12 w-12 flex-col items-center justify-center rounded-full border border-dashed ${city.borderColor} bg-slate-950/60 shadow-lg relative`}
                                    >
                                      <span className="text-lg filter drop-shadow">{city.emoji}</span>
                                      <span className="text-[6px] font-black uppercase tracking-wider mt-0.5">{city.name}</span>
                                      <div className="absolute -inset-0.5 rounded-full border border-double border-amber-500/20 pointer-events-none" />
                                    </motion.div>
                                  ) : canClaim ? (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-double border-amber-400 bg-amber-500/10 text-amber-400 animate-bounce relative cursor-pointer" style={{ animationDuration: "3s" }}>
                                      <span className="text-lg filter drop-shadow">{city.emoji}</span>
                                      <span className="absolute -top-1 -right-1 text-[8px] animate-pulse">✨</span>
                                    </div>
                                  ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/10 bg-white/5 text-slate-600">
                                      <Lock size={14} className="opacity-45" />
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-0.5 mt-1">
                                  <h5 className="text-[11px] font-black text-white leading-none">{city.name}</h5>
                                  <p className="text-[8px] text-slate-500 font-bold leading-tight line-clamp-1">
                                    {city.badge}
                                  </p>
                                </div>

                                <div className="mt-2 w-full relative z-10 text-[8px]">
                                  {isClaimed ? (
                                    <div className="flex items-center justify-center gap-0.5 font-black text-amber-400 uppercase tracking-wider">
                                      <CheckCircle2 size={8} />
                                      <span>Stamped {stampedDate}</span>
                                    </div>
                                  ) : canClaim ? (
                                    <button
                                      type="button"
                                      disabled={claimingCity === city.name}
                                      onClick={(e) => handleClaimStamp(city.name, e)}
                                      className="w-full rounded bg-amber-400 hover:bg-amber-350 px-1 py-1 font-black uppercase text-slate-950 active:scale-95 transition cursor-pointer shadow"
                                    >
                                      {claimingCity === city.name ? "Stamping..." : "Claim Stamp ✈️"}
                                    </button>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="w-full bg-slate-950 rounded-full h-1 border border-white/5 overflow-hidden">
                                        <div
                                          className="bg-slate-700 h-full rounded-full transition-all duration-300"
                                          style={{ width: `${Math.min(100, (saveCount / 3) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-[8px] text-slate-500 font-bold block leading-none">
                                        {saveCount}/3 saved places
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* BADGES PAGE */
                      <div className="space-y-4 text-left">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-teal-400">
                            Achievement Badges
                          </h4>
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            Page 6
                          </span>
                        </div>

                        {stats?.badges && stats.badges.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3 max-h-[295px] overflow-y-auto pr-1 no-scrollbar">
                            {stats.badges.map((ub: any) => {
                              const badge = BADGE_MAP[ub.badge_id];
                              if (!badge) return null;
                              return (
                                <div
                                  key={ub.badge_id}
                                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-950/30 p-2.5"
                                >
                                  <span className="text-xl shrink-0">{badge.emoji}</span>
                                  <div className="min-w-0 text-left">
                                    <p className="text-[10px] font-black text-slate-200 truncate">{badge.name}</p>
                                    <p className="text-[8px] text-slate-500 font-bold truncate">
                                      Unlocked {new Date(ub.awarded_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-16 text-[var(--muted)] space-y-2">
                            <Award className="mx-auto text-slate-700" size={32} />
                            <p className="text-xs font-black">No badges unlocked yet</p>
                            <p className="text-[10px] font-medium leading-relaxed px-6">
                              Save spots, submit reviews, and coordinate meetups to earn custom accomplishment badges here!
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-4 relative z-10">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="p-1 rounded bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                        Page {currentPage + 1} of 3
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(2, p + 1))}
                        disabled={currentPage === 2}
                        className="p-1 rounded bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 hover:text-white transition disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                  </motion.div>
                </AnimatePresence>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
