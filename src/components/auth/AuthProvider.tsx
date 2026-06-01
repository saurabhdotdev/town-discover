"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthUser } from "@/types";
import { useBadges } from "@/hooks/useBadges";
import { BadgeToast } from "@/components/profile/BadgeToast";

type AuthMode = "login" | "signup";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authRequiredMessage: string;
  setAuthRequiredMessage: (message: string) => void;
  refreshUser: () => Promise<void>;
  submitAuth: (mode: AuthMode, email: string, password: string, fullName?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequiredMessage, setAuthRequiredMessage] = useState("");
  const { newBadgeId, dismissBadge } = useBadges(!!user);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => response.json())
      .then((data) => {
        if (!active) return;
        setUser(data.user ?? null);
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const submitAuth = useCallback(async (mode: AuthMode, email: string, password: string, fullName = "") => {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "signup" ? { email, password, fullName } : { email, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error ?? "Unable to continue." };
    }

    setUser(data.user ?? null);
    setAuthRequiredMessage("");
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authRequiredMessage,
      setAuthRequiredMessage,
      refreshUser,
      submitAuth,
      logout,
    }),
    [authRequiredMessage, loading, logout, refreshUser, submitAuth, user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <BadgeToast badgeId={newBadgeId} onDismiss={dismissBadge} />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
};
