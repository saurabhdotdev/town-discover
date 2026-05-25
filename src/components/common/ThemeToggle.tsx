"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const storageKey = "town-discover-theme";
const themeChangeEvent = "town-discover-theme-change";

const getTheme = (): Theme => {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

const subscribe = (callback: () => void) => {
  window.addEventListener(themeChangeEvent, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(themeChangeEvent, callback);
    window.removeEventListener("storage", callback);
  };
};

export const ThemeToggle = ({ compact = false }: { compact?: boolean }) => {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark");

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={
        compact
          ? "grid h-11 w-11 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5"
          : "inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--panel)]"
      }
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
      {!compact && <span>{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
};
