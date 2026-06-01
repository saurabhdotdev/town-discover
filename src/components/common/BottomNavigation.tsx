"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Compass, Home, Map, Menu, Search, Sparkles, Trophy, User, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: <Home size={21} /> },
  { href: "/discover", label: "Discover", icon: <Compass size={21} /> },
  { href: "/events", label: "Events", icon: <CalendarDays size={21} /> },
  { href: "/map", label: "Map", icon: <Map size={21} /> },
  { href: "/hangouts", label: "Hangouts", icon: <Users size={21} /> },
  { href: "/leaderboard", label: "Ranks", icon: <Trophy size={21} /> },
  { href: "/profile", label: "Profile", icon: <User size={21} /> },
];

const mobileTabItems = navItems.filter((item) =>
  ["/", "/discover", "/events", "/map", "/profile"].includes(item.href)
);

export const BottomNavigation = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <motion.nav
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="fixed inset-x-0 top-0 z-50 hidden h-16 border-b border-[var(--border)] bg-[var(--nav)] backdrop-blur-xl md:block"
        aria-label="Primary"
      >
        <div className="mx-auto flex h-full max-w-screen-xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 text-[var(--foreground)]">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-teal-400 to-amber-300 text-slate-950 shadow-lg shadow-cyan-500/20">
              <Sparkles size={18} />
            </span>
            <span className="text-sm font-black uppercase tracking-[0.18em]">Sheher</span>
          </Link>

          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] p-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    isActive ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="desktopActiveNav"
                      className="absolute inset-0 rounded-full bg-[var(--panel)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{item.icon}</span>
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--primary-foreground)] transition-transform hover:-translate-y-0.5"
            >
              <Search size={16} />
              Find Places
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Top App Bar */}
      <div
        className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--nav)] px-4 backdrop-blur-xl md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--foreground)]"
          aria-label="Open navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <Menu size={20} />
        </button>

        <Link href="/" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-[var(--foreground)]">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-teal-400 to-amber-300 text-slate-950 shadow-md shadow-cyan-500/20">
            <Sparkles size={16} />
          </span>
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[var(--foreground)]">Sheher</span>
        </Link>

        <div className="flex items-center">
          <ThemeToggle compact />
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[9985] bg-black/55 backdrop-blur-sm md:hidden"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="fixed inset-y-0 left-0 z-[9990] flex w-[min(86vw,320px)] flex-col border-r border-[var(--border)] bg-[var(--nav)] px-4 py-4 shadow-2xl backdrop-blur-xl md:hidden"
              style={{
                paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
              }}
              aria-label="Mobile navigation"
            >
              <div className="flex items-center justify-between gap-3">
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex min-w-0 items-center gap-3 text-[var(--foreground)]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 via-teal-400 to-amber-300 text-slate-950 shadow-lg shadow-cyan-500/20">
                    <Sparkles size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black uppercase tracking-[0.18em]">Sheher</p>
                    <p className="truncate text-xs font-semibold text-[var(--muted)]">City discovery</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--foreground)]"
                  aria-label="Close navigation menu"
                >
                  <X size={19} />
                </button>
              </div>

              <Link
                href="/discover"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-black text-[var(--primary-foreground)]"
              >
                <Search size={17} />
                Find Places
              </Link>

              <nav className="mt-5 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Primary mobile">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition-colors",
                        isActive
                          ? "bg-[var(--panel)] text-[var(--foreground)]"
                          : "text-[var(--muted-strong)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="mobileSideActiveNav"
                          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 via-teal-300 to-amber-300"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--panel-soft)] text-[var(--foreground)]">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--nav)] px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-1.5 backdrop-blur-xl md:hidden"
        aria-label="Primary tabs"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileTabItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-black transition",
                  isActive ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobileBottomActiveNav"
                    className="absolute inset-0 rounded-lg bg-[var(--panel-soft)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{item.icon}</span>
                <span className="relative truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};
