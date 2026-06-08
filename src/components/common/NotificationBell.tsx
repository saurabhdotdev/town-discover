"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, ExternalLink, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const formatNotificationTime = (value: string) => {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const NotificationBell: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to load notifications.");
      setNotifications(data.notifications ?? []);
      if (data.warning) setError(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markRead = async (id?: string) => {
    if (!user) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      if (!response.ok) throw new Error("Unable to mark notification as read.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update notifications.");
      return;
    }

    setNotifications((current) =>
      current.map((item) => (id && item.id !== id ? item : { ...item, isRead: true }))
    );
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete notification.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete notification.");
      return;
    }

    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) loadNotifications();
        }}
        className={cn(
          "relative grid place-items-center rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--foreground)] transition hover:bg-[var(--panel)]",
          compact ? "h-10 w-10" : "h-10 w-10"
        )}
        aria-label="Open notifications"
      >
        <Bell size={compact ? 18 : 19} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9975] bg-black/20 md:hidden"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: compact ? -8 : 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: compact ? -8 : 8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-x-3 top-16 z-[9980] max-h-[72dvh] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl backdrop-blur-xl md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-96"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div>
                  <p className="text-sm font-black text-[var(--foreground)]">Notifications</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => markRead()}
                      className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
                      aria-label="Mark all notifications as read"
                    >
                      <CheckCheck size={17} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
                    aria-label="Close notifications"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              <div className="max-h-[58dvh] overflow-y-auto p-2">
                {error && (
                  <div className="mb-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
                    {error}
                  </div>
                )}
                {loading && notifications.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm font-semibold text-[var(--muted)]">Loading updates...</p>
                ) : notifications.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm font-semibold text-[var(--muted)]">
                    No updates yet. Saved trips, hangouts, and moderation updates will appear here.
                  </p>
                ) : (
                  notifications.map((item) => {
                    const content = (
                      <div
                        className={cn(
                          "group flex gap-3 rounded-lg border p-3 text-left transition hover:bg-[var(--panel)]",
                          item.isRead
                            ? "border-transparent bg-transparent"
                            : "border-teal-300/20 bg-teal-300/8"
                        )}
                      >
                        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", item.isRead ? "bg-[var(--border)]" : "bg-teal-300")} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-1 text-sm font-black text-[var(--foreground)]">{item.title}</p>
                            <span className="shrink-0 text-[10px] font-bold text-[var(--muted)]">
                              {formatNotificationTime(item.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[var(--muted-strong)]">
                            {item.message}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {!item.isRead && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  markRead(item.id);
                                }}
                                className="text-[10px] font-black uppercase tracking-[0.12em] text-teal-300"
                              >
                                Mark read
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault();
                                deleteNotification(item.id);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--muted)] hover:text-rose-300"
                            >
                              <Trash2 size={11} />
                              Delete
                            </button>
                          </div>
                        </div>
                        {item.link && <ExternalLink size={14} className="mt-1 shrink-0 text-[var(--muted)]" />}
                      </div>
                    );

                    return item.link ? (
                      <Link
                        key={item.id}
                        href={item.link}
                        onClick={() => {
                          markRead(item.id);
                          setOpen(false);
                        }}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={item.id}>{content}</div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
