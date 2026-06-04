"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, MapPin, Search, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SupportedCityName,
  CITY_DISPLAY_NAMES,
  CITY_GROUPS,
  CITY_CENTERS,
} from "@/lib/pune-location";

interface CitySwitcherProps {
  value: SupportedCityName;
  onChange: (city: SupportedCityName) => void;
}

export const CitySwitcher: React.FC<CitySwitcherProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter groups and cities based on search query
  const filteredGroups = CITY_GROUPS.map((group) => {
    const matchingCities = group.cities.filter((city) => {
      const displayName = CITY_DISPLAY_NAMES[city] || city;
      return (
        displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
    return { ...group, cities: matchingCities };
  }).filter((group) => group.cities.length > 0);

  const handleSelect = (city: SupportedCityName) => {
    onChange(city);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Determine if currently selected is a twin city
  const isTwinSelected = CITY_GROUPS.find((g) => g.id === "twins")?.cities.includes(value);

  return (
    <div ref={dropdownRef} className="relative mb-3 w-full sm:max-w-xs z-30">
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-12 w-full items-center justify-between rounded-xl border px-4 text-sm font-black transition-all duration-200 outline-none ${
          isOpen
            ? "border-teal-400 bg-[var(--panel-strong)] shadow-lg shadow-teal-500/10"
            : isTwinSelected
            ? "border-teal-500/30 bg-gradient-to-r from-teal-500/5 to-cyan-500/5 hover:border-teal-500/50"
            : "border-[var(--border)] bg-[var(--input)] hover:border-[var(--muted)]"
        }`}
      >
        <div className="flex items-center gap-2 text-[var(--foreground)]">
          {isTwinSelected ? (
            <Sparkles size={16} className="text-teal-400 animate-pulse" />
          ) : (
            <MapPin size={16} className="text-teal-400" />
          )}
          <span className="truncate">
            {CITY_DISPLAY_NAMES[value] || value}
          </span>
          {isTwinSelected && (
            <span className="rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-teal-300">
              Twin
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-teal-400" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[350px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl shadow-black/80 backdrop-blur-md flex flex-col"
          >
            {/* Search Input */}
            <div className="relative border-b border-[var(--border)] p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg bg-[var(--input)] pl-9 pr-4 text-xs font-semibold text-[var(--foreground)] outline-none border border-transparent focus:border-teal-500/30"
                autoFocus
              />
            </div>

            {/* Grouped City List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
              {filteredGroups.length > 0 ? (
                filteredGroups.map((group) => (
                  <div key={group.id} className="space-y-1">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">
                      <span>{group.emoji}</span>
                      <span>{group.name}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-0.5">
                      {group.cities.map((city) => {
                        const isSelected = value === city;
                        const isTwin = group.id === "twins";
                        return (
                          <button
                            key={city}
                            type="button"
                            onClick={() => handleSelect(city)}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all ${
                              isSelected
                                ? "bg-teal-500/10 text-teal-200"
                                : isTwin
                                ? "hover:bg-gradient-to-r hover:from-teal-500/5 hover:to-cyan-500/5 text-[var(--foreground)]"
                                : "hover:bg-[var(--panel-soft)] text-[var(--foreground)]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold">
                                {CITY_DISPLAY_NAMES[city] || city}
                              </span>
                              {isTwin && (
                                <span className="rounded bg-teal-500/10 px-1 py-0.2 text-[8px] font-black uppercase text-teal-400">
                                  Twin
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check size={14} className="text-teal-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs font-medium text-[var(--muted)]">
                  No cities found for &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

