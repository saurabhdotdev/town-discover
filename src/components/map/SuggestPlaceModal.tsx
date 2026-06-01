"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X, Sparkles } from "lucide-react";

interface SuggestPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCity: string;
  defaultCoords: { latitude: number; longitude: number };
}

const categories = [
  { value: "cafe", label: "Cafe" },
  { value: "restaurant", label: "Restaurant" },
  { value: "event", label: "Event / Sightseeing" },
  { value: "nightlife", label: "Nightlife / Club" },
  { value: "food-stall", label: "Food Stall" },
  { value: "bar", label: "Bar" },
  { value: "dessert", label: "Dessert Shop" },
  { value: "street-food", label: "Street Food" },
];

export const SuggestPlaceModal: React.FC<SuggestPlaceModalProps> = ({
  isOpen,
  onClose,
  defaultCity,
  defaultCoords,
}) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [city, setCity] = useState(defaultCity);
  const [locality, setLocality] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState(defaultCoords.latitude.toString());
  const [lng, setLng] = useState(defaultCoords.longitude.toString());
  const [priceRange, setPriceRange] = useState("$$");
  const [hours, setHours] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Sync defaultCoords when they change
  useEffect(() => {
    if (isOpen) {
      setLat(defaultCoords.latitude.toFixed(6));
      setLng(defaultCoords.longitude.toFixed(6));
      setCity(defaultCity);
    }
  }, [isOpen, defaultCoords, defaultCity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/places/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          latitude: Number(lat),
          longitude: Number(lng),
          city,
          locality: locality.trim() || "Nearby",
          priceRange,
          hours: hours.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to submit suggestion.");
      }

      setStatus("success");
      setMessage("Thank you! Your suggestion has been sent to our superadmins for review.");
      setTitle("");
      setLocality("");
      setDescription("");
      setHours("");
      setPhone("");
      setWebsite("");
      setTimeout(() => {
        onClose();
        setStatus("idle");
        setMessage("");
      }, 3500);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please check your inputs.");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 text-white shadow-2xl backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-teal-400" />
              <h2 className="text-lg font-black tracking-tight">Suggest a New Spot</h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 hover:bg-white/10 transition text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="max-h-[70vh] overflow-y-auto p-4 space-y-4 no-scrollbar">
            {status === "success" ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-6 text-center text-sm font-bold text-emerald-300"
              >
                {message}
              </motion.div>
            ) : (
              <>
                {status === "error" && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm font-bold text-rose-300 font-semibold">
                    {message}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Place Title *</span>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Vaishali Cafe, India Gate Loop"
                      className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Category *</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition cursor-pointer"
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value} className="bg-slate-900">
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Price Range</span>
                    <select
                      value={priceRange}
                      onChange={(e) => setPriceRange(e.target.value)}
                      className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition cursor-pointer"
                    >
                      <option value="$" className="bg-slate-900">$ (Budget / Free)</option>
                      <option value="$$" className="bg-slate-900">$$ (Moderate)</option>
                      <option value="$$$" className="bg-slate-900">$$$ (Premium)</option>
                      <option value="$$$$" className="bg-slate-900">$$$$ (Luxury)</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">City *</span>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Pune, Delhi"
                      className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Locality *</span>
                    <input
                      type="text"
                      required
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      placeholder="e.g. FC Road, Hauz Khas"
                      className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Description *</span>
                    <textarea
                      required
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell us what makes this spot worth exploring..."
                      className="w-full p-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition resize-none"
                    />
                  </label>

                  <div className="border-t border-white/10 pt-4 sm:col-span-2 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-teal-400 flex items-center gap-1.5">
                      <MapPin size={14} /> Coordinates
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Latitude</span>
                        <input
                          type="number"
                          step="0.000001"
                          required
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                          className="w-full h-10 px-3 text-xs font-semibold rounded-lg border border-white/10 bg-slate-850 focus:border-teal-400 outline-none transition"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Longitude</span>
                        <input
                          type="number"
                          step="0.000001"
                          required
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          className="w-full h-10 px-3 text-xs font-semibold rounded-lg border border-white/10 bg-slate-850 focus:border-teal-400 outline-none transition"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4 sm:col-span-2 grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Opening Hours (e.g. 09:00 - 22:00)</span>
                      <input
                        type="text"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        placeholder="e.g. 07:00 - 23:00 or 24/7"
                        className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Phone Number</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Website URL</span>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="e.g. https://vaishalicafe.com"
                        className="w-full h-11 px-3 text-sm font-semibold rounded-lg border border-white/10 bg-slate-800 focus:border-teal-400 outline-none transition"
                      />
                    </label>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 px-5 text-sm font-bold rounded-lg border border-white/10 hover:bg-white/5 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="h-11 px-6 text-sm font-black rounded-lg bg-teal-400 text-slate-950 hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {status === "submitting" ? "Submitting..." : "Submit Spot"}
                  </button>
                </div>
              </>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
