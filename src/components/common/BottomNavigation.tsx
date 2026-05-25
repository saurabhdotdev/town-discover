"use client";

import { motion } from "framer-motion";
import { Compass, Home, Map, Search, Sparkles, User } from "lucide-react";
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
  { href: "/map", label: "Map", icon: <Map size={21} /> },
  { href: "/profile", label: "Profile", icon: <User size={21} /> },
];

export const BottomNavigation = () => {
  const pathname = usePathname();

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
            <span className="text-sm font-black uppercase tracking-[0.18em]">Town Discover</span>
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

      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--nav)] backdrop-blur-xl md:hidden"
        aria-label="Primary mobile"
      >
        <div className="mx-auto grid max-w-screen-sm grid-cols-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[68px] flex-col items-center justify-center gap-1 px-2 text-xs font-semibold",
                  isActive ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobileActiveNav"
                    className="absolute inset-x-5 top-2 h-1 rounded-full bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <motion.span animate={isActive ? { y: -1, scale: 1.06 } : { y: 0, scale: 1 }}>
                  {item.icon}
                </motion.span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </motion.nav>

      <div className="fixed right-3 top-3 z-50 md:hidden">
        <ThemeToggle compact />
      </div>
    </>
  );
};
