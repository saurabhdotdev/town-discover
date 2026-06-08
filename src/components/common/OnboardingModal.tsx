"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, MapPin, Sparkles } from "lucide-react";
import { SUPPORTED_CITY_NAMES, SupportedCityName } from "@/lib/pune-location";
import { OnboardingInterest, OnboardingPrefs } from "@/hooks/useOnboarding";

// ─── City metadata ─────────────────────────────────────────────────────────────

const CITY_META: Record<SupportedCityName, { emoji: string; tagline: string }> = {
  Delhi:     { emoji: "🏛", tagline: "History, food & night life" },
  Mumbai:    { emoji: "🌊", tagline: "The city that never sleeps" },
  Bangalore: { emoji: "🌿", tagline: "Breweries & startup vibes" },
  Pune:      { emoji: "🎓", tagline: "Cafes, culture & chill" },
  Chennai:   { emoji: "🎭", tagline: "Filter coffee & beaches" },
  Nashik:    { emoji: "🍇", tagline: "Vineyards & ghats" },
  Kolhapur:  { emoji: "🌶", tagline: "Spice & heritage" },
  CherryHill:{ emoji: "🌳", tagline: "Suburbs & parks" },
  Hyderabad: { emoji: "🕌", tagline: "Biryani, palaces & IT hubs" },
  Kolkata:   { emoji: "🚋", tagline: "Sweet treats & colonial art" },
  Ahmedabad: { emoji: "🪁", tagline: "Textiles, ashrams & locho" },
  Jaipur:    { emoji: "🏰", tagline: "Pink walls & royal palaces" },
  Lucknow:   { emoji: "🍢", tagline: "Awadhi kebabs & chikankari" },
  Kochi:     { emoji: "⛵", tagline: "Backwaters & spice markets" },
  Panaji:    { emoji: "🏖", tagline: "Colonial alleys & beaches" },
  Chandigarh:{ emoji: "🏢", tagline: "Modern layouts & gardens" },
  Udaipur:   { emoji: "⛵", tagline: "Romantic lakes & palaces" },
  Agra:      { emoji: "🕌", tagline: "Taj Mahal & petha sweets" },
  Varanasi:  { emoji: "🪔", tagline: "Ghat aartis & holy rituals" },
  Amritsar:  { emoji: "🪙", tagline: "Golden temple & hot kulchas" },
  Surat:     { emoji: "💎", tagline: "Diamonds, textiles & locho" },
  Patna:     { emoji: "🌾", tagline: "Historic ruins & delicious litti" },
  Bhubaneswar:{ emoji: "🛕", tagline: "Ancient temples & Odia thali" },
  Visakhapatnam: { emoji: "⚓", tagline: "Sandy beaches & shipyards" },
  Indore:    { emoji: "🍲", tagline: "Sarafa eats & cleanest streets" },
  Nagpur:    { emoji: "🍊", tagline: "Oranges, lakes & tarri poha" },
  Guwahati:  { emoji: "🦏", tagline: "Hill shrines & Brahmaputra" },
  Coimbatore:{ emoji: "⚙", tagline: "Western ghats & filter coffee" },
  Mysore:    { emoji: "🛕", tagline: "Sandalwood & grand palaces" },
  Dehradun:  { emoji: "🏔", tagline: "Mountain views & river caves" },
  Shimla:    { emoji: "❄", tagline: "Snowy ridges & colonial walks" },
  Srinagar:  { emoji: "🛶", tagline: "Dal Lake houseboats & wazwan" },
  Pondicherry:{ emoji: "🏖", tagline: "French quarter ocean strolls" },
  Hubli:     { emoji: "🏙", tagline: "Markets, food streets & railway energy" },
  Dharwad:   { emoji: "🏙", tagline: "Music, campuses & pedha trails" },
  PCMC:      { emoji: "🏙", tagline: "Auto hubs, IT parks & cafe pockets" },
  Ujjain:    { emoji: "🏙", tagline: "Mahakal darshan & old-city snacks" },
  Secunderabad: { emoji: "🏙", tagline: "Lake walks, bazaars & twin-city classics" },
  HubliDharwad: { emoji: "🔀", tagline: "Twin heritage & pedha sweets" },
  PunePCMC:  { emoji: "🎓", tagline: "IT parks, auto hubs & cafes" },
  BangaloreMysore: { emoji: "🌿", tagline: "High-tech to royal heritage corridor" },
  IndoreUjjain: { emoji: "🍲", tagline: "Cleanest street food & holy ghats" },
  HyderabadSecunderabad: { emoji: "🕌", tagline: "Twin cities, lake walk & biryani" },
};

// ─── Interest chips ────────────────────────────────────────────────────────────

const INTERESTS: { id: OnboardingInterest; label: string; emoji: string; desc: string }[] = [
  { id: "cafe",        label: "Cafes",        emoji: "☕", desc: "Coffee shops & workspaces" },
  { id: "restaurant",  label: "Fine Dining",  emoji: "🍽", desc: "Sit-down restaurants" },
  { id: "street-food", label: "Street Food",  emoji: "🍢", desc: "Chaat, rolls & tapris" },
  { id: "nightlife",   label: "Nightlife",    emoji: "🌙", desc: "Clubs, late-night spots" },
  { id: "bar",         label: "Bars",         emoji: "🍺", desc: "Pubs & craft beer" },
  { id: "event",       label: "Events",       emoji: "🎉", desc: "Live shows & pop-ups" },
  { id: "heritage",    label: "Heritage",     emoji: "🏯", desc: "History & culture" },
  { id: "hidden-gems", label: "Hidden Gems",  emoji: "💎", desc: "Off-the-beaten-path" },
];

// ─── Step type ────────────────────────────────────────────────────────────────

type Step = "city" | "interests" | "done";

interface OnboardingModalProps {
  onComplete: (prefs: OnboardingPrefs) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>("city");
  const [selectedCity, setSelectedCity] = useState<SupportedCityName | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<Set<OnboardingInterest>>(new Set());
  const [leaving, setLeaving] = useState(false);

  const toggleInterest = (id: OnboardingInterest) => {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCityNext = () => {
    if (!selectedCity) return;
    setStep("interests");
  };

  const handleFinish = () => {
    if (!selectedCity) return;
    setLeaving(true);
    setTimeout(() => {
      onComplete({
        city: selectedCity,
        interests: Array.from(selectedInterests),
      });
    }, 500);
  };

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
        >
          {/* Sheet */}
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="relative w-full max-w-lg rounded-t-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl sm:rounded-2xl sm:p-8"
          >
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-teal-500/10 via-transparent to-cyan-500/5" />

            {/* Header */}
            <div className="mb-7 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 shadow-xl shadow-teal-500/30">
                <Sparkles size={26} className="text-slate-950" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-teal-300">Welcome to Sheher</p>
              {step === "city" && (
                <h2 className="mt-1 text-2xl font-black text-[var(--foreground)]">Which city are you in?</h2>
              )}
              {step === "interests" && (
                <h2 className="mt-1 text-2xl font-black text-[var(--foreground)]">What are you into?</h2>
              )}
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {step === "city"
                  ? "We'll personalise your feed and show the best spots near you."
                  : "Pick as many as you like — your home feed will match your vibe."}
              </p>
            </div>

            {/* Step indicator */}
            <div className="mb-6 flex justify-center gap-1.5">
              {(["city", "interests"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    step === s
                      ? "w-8 bg-teal-400"
                      : i < (step === "interests" ? 1 : 0)
                      ? "w-4 bg-teal-400/60"
                      : "w-4 bg-[var(--border)]"
                  }`}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === "city" && (
                <motion.div
                  key="city"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22 }}
                >
                  {/* City Grid */}
                  <div className="max-h-[50dvh] sm:max-h-[380px] overflow-y-auto pr-1 grid grid-cols-2 gap-2 sm:grid-cols-4 no-scrollbar pb-2">
                    {SUPPORTED_CITY_NAMES.map((city) => {
                      const meta = CITY_META[city];
                      const active = selectedCity === city;
                      return (
                        <button
                          key={city}
                          type="button"
                          onClick={() => setSelectedCity(city)}
                          className={`group relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                            active
                              ? "border-teal-400/60 bg-teal-500/10 shadow-lg shadow-teal-500/10"
                              : "border-[var(--border)] bg-[var(--panel-soft)] hover:border-teal-400/30 hover:bg-[var(--panel)]"
                          }`}
                        >
                          {active && (
                            <div className="absolute inset-0 rounded-xl bg-teal-400/5 blur-md" />
                          )}
                          <span className="text-2xl leading-none">{meta.emoji}</span>
                          <span className={`text-sm font-black leading-tight ${active ? "text-teal-200" : "text-[var(--foreground)]"}`}>
                            {city}
                          </span>
                          <span className="text-[9px] font-semibold text-[var(--muted)] leading-tight line-clamp-1">
                            {meta.tagline}
                          </span>
                          {active && (
                            <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-teal-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedCity}
                    onClick={handleCityNext}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3.5 font-black text-slate-950 shadow-lg shadow-teal-500/25 transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ChevronRight size={18} />
                  </button>
                </motion.div>
              )}

              {step === "interests" && (
                <motion.div
                  key="interests"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.22 }}
                >
                  {/* Selected city reminder */}
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-teal-400/20 bg-teal-500/5 px-3 py-2">
                    <MapPin size={14} className="text-teal-400" />
                    <span className="text-sm font-black text-teal-200">{selectedCity}</span>
                    <button
                      type="button"
                      onClick={() => setStep("city")}
                      className="ml-auto text-[10px] font-bold text-[var(--muted)] hover:text-teal-300 transition"
                    >
                      Change
                    </button>
                  </div>

                  {/* Interest Grid */}
                  <div className="max-h-[50dvh] sm:max-h-[380px] overflow-y-auto pr-1 grid grid-cols-2 gap-2 sm:grid-cols-4 no-scrollbar pb-2">
                    {INTERESTS.map(({ id, label, emoji, desc }) => {
                      const active = selectedInterests.has(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleInterest(id)}
                          className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                            active
                              ? "border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                              : "border-[var(--border)] bg-[var(--panel-soft)] hover:border-cyan-400/30 hover:bg-[var(--panel)]"
                          }`}
                        >
                          <span className="text-2xl leading-none">{emoji}</span>
                          <span className={`text-sm font-black leading-tight ${active ? "text-cyan-200" : "text-[var(--foreground)]"}`}>
                            {label}
                          </span>
                          <span className="text-[9px] font-semibold text-[var(--muted)] leading-tight">
                            {desc}
                          </span>
                          {active && (
                            <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleFinish}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3.5 font-black text-slate-950 shadow-lg shadow-teal-500/25 transition hover:opacity-90"
                    >
                      {selectedInterests.size > 0
                        ? `Let's go — ${selectedInterests.size} ${selectedInterests.size === 1 ? "vibe" : "vibes"} set 🚀`
                        : "Skip & explore everything"}
                      <Sparkles size={17} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
