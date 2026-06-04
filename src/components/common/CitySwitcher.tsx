"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { SUPPORTED_CITY_NAMES, SupportedCityName } from "@/lib/pune-location";

interface CitySwitcherProps {
  value: SupportedCityName;
  onChange: (city: SupportedCityName) => void;
}

export const CitySwitcher: React.FC<CitySwitcherProps> = ({ value, onChange }) => {
  return (
    <label className="relative mb-3 block w-full sm:max-w-xs" aria-label="Choose city">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fresh)]" size={17} />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SupportedCityName)}
        className="h-12 w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--input)] pl-10 pr-10 text-sm font-black text-[var(--foreground)] outline-none transition focus:border-teal-300"
      >
        {SUPPORTED_CITY_NAMES.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
    </label>
  );
};
