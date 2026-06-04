"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, Star, Award, Compass, Lock, CheckCircle2 } from "lucide-react";
import { Place } from "@/types";

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

export const ExplorerPassport = ({ savedPlaces, onStampClaimed }: ExplorerPassportProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [claimedStamps, setClaimedStamps] = useState<Record<string, string>>({}); // cityName -> stampedAt
  const [loading, setLoading] = useState(true);
  const [claimingCity, setClaimingCity] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiCenter, setConfettiCenter] = useState({ x: 0, y: 0 });

  // Fetch claimed stamps
  useEffect(() => {
    fetchStamps();
  }, []);

  const fetchStamps = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile/passport");
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        data.stamps.forEach((s: StampData) => {
          map[s.cityName.toLowerCase()] = new Date(s.stampedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        });
        setClaimedStamps(map);
      }
    } catch (e) {
      console.error("Error loading passport stamps:", e);
    } finally {
      setLoading(false);
    }
  };

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
        await fetchStamps();
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
      <div className="fixed inset-0 pointer-events-none z-[999]">
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
            {/* Glowing aura */}
            <div className="absolute -inset-10 bg-radial-gradient from-amber-500/5 to-transparent blur-3xl opacity-60 pointer-events-none" />

            {/* Passport Header */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Republic of Sheher</span>
              <h3 className="text-xl font-black text-white tracking-[0.1em] font-serif">EXPLORER PASSPORT</h3>
            </div>

            {/* Passport Emblem */}
            <div className="relative my-4 flex h-28 w-28 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/5 shadow-inner">
              <div className="absolute inset-2 rounded-full border border-dashed border-amber-500/30" />
              <Compass size={48} className="text-amber-400 animate-pulse" style={{ animationDuration: "5s" }} />
            </div>

            {/* Passport Footer Info */}
            <div className="space-y-2 w-full max-w-xs">
              <div className="flex items-center justify-between border-t border-dashed border-slate-800 pt-3 text-xs font-bold text-slate-400">
                <span>Stamps Unlocked:</span>
                <span className="font-mono text-amber-400 text-sm font-black">
                  {unlockedCount} / {PASSPORT_CITIES.length}
                </span>
              </div>
              <button
                type="button"
                className="w-full mt-2 rounded-lg bg-amber-500 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-amber-450 active:scale-95 transition shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                Open Passport Booklet 📖
              </button>
            </div>
          </motion.div>
        ) : (
          /* PASSPORT INNER PAGES */
          <motion.div
            key="booklet"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="rounded-2xl border border-slate-800 bg-[#070e12] p-5 sm:p-6 shadow-2xl relative overflow-hidden"
          >
            {/* Header / Action bar */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5">
              <div className="flex items-center gap-2.5 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Explorer stamps</h3>
                  <p className="text-xs text-slate-400">
                    Earn 100 XP for every stamp. Save 3 places in a city to unlock its stamp!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-400 hover:text-white transition cursor-pointer"
              >
                Close Book
              </button>
            </div>

            {/* Stamps Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PASSPORT_CITIES.map((city) => {
                const saveCount = getCitySaveCount(city.name);
                const isClaimed = claimedStamps[city.name.toLowerCase()] !== undefined;
                const canClaim = !isClaimed && saveCount >= 3;
                const stampedDate = claimedStamps[city.name.toLowerCase()];

                return (
                  <div
                    key={city.id}
                    className={`rounded-xl border p-4 text-center flex flex-col justify-between items-center min-h-[210px] transition duration-200 relative overflow-hidden ${
                      isClaimed
                        ? "bg-gradient-to-br " + city.themeColor + " border-amber-500/20"
                        : canClaim
                        ? "bg-slate-900/60 border-amber-500/40 animate-pulse-slow shadow-lg shadow-amber-500/5"
                        : "bg-slate-900/20 border-white/5 opacity-55"
                    }`}
                  >
                    {/* Stamp illustration circular container */}
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full">
                      {/* Interactive Stamp Visual representation */}
                      {isClaimed ? (
                        /* CLAIMED STAMP (GOLD INSIGNIA STYLE) */
                        <motion.div
                          initial={{ scale: 0.8, rotate: -15 }}
                          animate={{ scale: 1, rotate: -5 }}
                          className={`flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-dashed ${city.borderColor} bg-slate-950/60 shadow-lg relative`}
                        >
                          <span className="text-xl filter drop-shadow">{city.emoji}</span>
                          <span className="text-[7px] font-black uppercase tracking-wider mt-0.5">{city.name}</span>
                          <div className="absolute -inset-1 rounded-full border border-double border-amber-500/20 pointer-events-none" />
                        </motion.div>
                      ) : canClaim ? (
                        /* CLAIMABLE STATE (GOLD HIGHLIGHT) */
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-double border-amber-400 bg-amber-500/10 text-amber-400 animate-bounce relative cursor-pointer" style={{ animationDuration: "3s" }}>
                          <span className="text-xl filter drop-shadow">{city.emoji}</span>
                          <span className="absolute -top-1 -right-1 text-[9px] animate-pulse">✨</span>
                        </div>
                      ) : (
                        /* LOCKED WATERMARK STATE */
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-white/10 bg-white/5 text-slate-500">
                          <Lock size={18} className="opacity-40" />
                        </div>
                      )}
                    </div>

                    {/* Text Details */}
                    <div className="space-y-1 mt-2">
                      <h4 className="text-sm font-black text-white">{city.name}</h4>
                      <p className="text-[9px] text-slate-500 font-bold leading-tight line-clamp-2 px-1">
                        {city.description}
                      </p>
                    </div>

                    {/* Progress / Actions */}
                    <div className="mt-3 w-full relative z-10">
                      {isClaimed ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-center gap-1 text-[9px] font-black text-amber-400 uppercase tracking-wider">
                            <CheckCircle2 size={10} className="text-amber-400" />
                            <span>STAMPED</span>
                          </div>
                          <p className="text-[8px] text-slate-500 font-bold">{stampedDate}</p>
                        </div>
                      ) : canClaim ? (
                        <button
                          type="button"
                          disabled={claimingCity === city.name}
                          onClick={(e) => handleClaimStamp(city.name, e)}
                          className="w-full rounded bg-amber-400 hover:bg-amber-350 px-2 py-1 text-[9px] font-black uppercase text-slate-950 active:scale-95 transition cursor-pointer shadow-md shadow-amber-500/10"
                        >
                          {claimingCity === city.name ? "Stamping..." : "Claim Stamp ✈️"}
                        </button>
                      ) : (
                        <div className="space-y-1">
                          <div className="w-full bg-slate-950 rounded-full h-1.5 border border-white/5 overflow-hidden">
                            <div
                              className="bg-slate-700 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, (saveCount / 3) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 font-bold">
                            {saveCount}/3 saved places
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Passport Stamps Stat Footer info */}
            <div className="mt-5 border-t border-white/5 pt-4 text-center text-xs font-semibold text-slate-400">
              ✈️ Level up your rank by claiming stamps in every city you discover.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
