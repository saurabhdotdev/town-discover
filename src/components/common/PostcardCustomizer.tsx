"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  ImageIcon,
  Loader2,
  Palette,
  Share2,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { Place } from "@/types";
import { formatDistance, getCategoryLabel } from "@/lib/utils";

type CardTheme = "cinematic" | "retro" | "cyberpunk" | "nature";

interface PostcardCustomizerProps {
  place: Place;
  imageSrc: string;
  open: boolean;
  onClose: () => void;
}

interface ThemeConfig {
  id: CardTheme;
  label: string;
  emoji: string;
  bg: string;
  gradient: string;
  accent: string;
  accentHex: string;
  textPrimary: string;
  textSecondary: string;
  tagBg: string;
  font: string;
  badge: string;
  badgeText: string;
  description: string;
}

const THEMES: ThemeConfig[] = [
  {
    id: "cinematic",
    label: "Cinematic",
    emoji: "🎬",
    bg: "#071013",
    gradient: "linear-gradient(to bottom, rgba(7,16,19,0.05), rgba(7,16,19,0.4), #071013)",
    accent: "rgba(45,212,191,0.85)",
    accentHex: "#2dd4bf",
    textPrimary: "#f4f7fb",
    textSecondary: "#c8f7ef",
    tagBg: "rgba(255,255,255,0.92)",
    font: "Arial Black",
    badge: "#071013",
    badgeText: "#ffffff",
    description: "Dark cinematic with teal accents",
  },
  {
    id: "retro",
    label: "Retro",
    emoji: "📷",
    bg: "#1a0f00",
    gradient: "linear-gradient(to bottom, rgba(26,15,0,0.05), rgba(26,15,0,0.45), #1a0f00)",
    accent: "rgba(234,179,8,0.9)",
    accentHex: "#eab308",
    textPrimary: "#fef3c7",
    textSecondary: "#fde68a",
    tagBg: "rgba(254,243,199,0.95)",
    font: "Georgia",
    badge: "#1a0f00",
    badgeText: "#fef3c7",
    description: "Warm vintage with golden tones",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    emoji: "🌆",
    bg: "#0d0118",
    gradient: "linear-gradient(to bottom, rgba(13,1,24,0.05), rgba(13,1,24,0.4), #0d0118)",
    accent: "rgba(168,85,247,0.85)",
    accentHex: "#a855f7",
    textPrimary: "#e9d5ff",
    textSecondary: "#c4b5fd",
    tagBg: "rgba(168,85,247,0.85)",
    font: "Arial",
    badge: "#0d0118",
    badgeText: "#e9d5ff",
    description: "Neon purple futuristic vibe",
  },
  {
    id: "nature",
    label: "Nature",
    emoji: "🌿",
    bg: "#021208",
    gradient: "linear-gradient(to bottom, rgba(2,18,8,0.05), rgba(2,18,8,0.4), #021208)",
    accent: "rgba(34,197,94,0.85)",
    accentHex: "#22c55e",
    textPrimary: "#dcfce7",
    textSecondary: "#bbf7d0",
    tagBg: "rgba(34,197,94,0.85)",
    font: "Arial",
    badge: "#021208",
    badgeText: "#dcfce7",
    description: "Fresh forest green palette",
  },
];

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number => {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY;
};

export function PostcardCustomizer({ place, imageSrc, open, onClose }: PostcardCustomizerProps) {
  const [activeTheme, setActiveTheme] = useState<CardTheme>("cinematic");
  const [customText, setCustomText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const theme = THEMES.find((t) => t.id === activeTheme)!;

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1350;

    try {
      const img = await loadImage(imageSrc || place.image);

      // Background
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, 1080, 1350);

      // Cover image
      const scale = Math.max(1080 / img.naturalWidth, 760 / img.naturalHeight);
      const sw = 1080 / scale;
      const sh = 760 / scale;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1080, 760);

      // Gradient overlay
      const grad = ctx.createLinearGradient(0, 200, 0, 870);
      grad.addColorStop(0, "rgba(0,0,0,0.08)");
      grad.addColorStop(0.55, "rgba(0,0,0,0.35)");
      grad.addColorStop(1, theme.bg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 870);

      // Theme accent border left strip
      ctx.fillStyle = theme.accentHex;
      ctx.fillRect(0, 0, 8, 760);

      // Badge pill
      ctx.beginPath();
      ctx.roundRect(64, 64, 300, 56, 28);
      ctx.fillStyle = theme.tagBg;
      ctx.fill();
      ctx.fillStyle = theme.badge;
      ctx.font = `900 22px ${theme.font}`;
      ctx.fillText("SHEHER PICK", 96, 100);

      // Category chip
      const catLabel = getCategoryLabel(place.category, place.tags).toUpperCase();
      const catWidth = ctx.measureText(catLabel).width + 40;
      ctx.beginPath();
      ctx.roundRect(64, 134, catWidth, 42, 21);
      ctx.fillStyle = theme.accent;
      ctx.fill();
      ctx.fillStyle = theme.badgeText;
      ctx.font = `800 18px ${theme.font}`;
      ctx.fillText(catLabel, 84, 162);

      // Title
      ctx.fillStyle = theme.textPrimary;
      ctx.font = `900 80px ${theme.font}`;
      const lastTitleY = wrapText(ctx, place.title, 72, 640, 900, 88);

      // Location
      ctx.fillStyle = theme.textSecondary;
      ctx.font = `800 32px ${theme.font}`;
      ctx.fillText(
        `${place.locality || ""}${place.locality && place.city ? ", " : ""}${place.city}`,
        72,
        lastTitleY + 60
      );

      // Metrics panel
      const panelY = lastTitleY + 100;
      ctx.beginPath();
      ctx.roundRect(72, panelY, 936, 160, 28);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();

      const metrics = [
        { label: "RATING", value: `${place.rating}/5` },
        { label: "DISTANCE", value: formatDistance(place.distance) },
        { label: "STATUS", value: place.isOpen ? "Open now" : "Closed" },
      ];
      metrics.forEach(({ label, value }, i) => {
        const mx = 112 + i * 300;
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `700 20px ${theme.font}`;
        ctx.fillText(label, mx, panelY + 48);
        ctx.fillStyle = theme.textPrimary;
        ctx.font = `900 36px ${theme.font}`;
        ctx.fillText(value, mx, panelY + 106);
      });

      // Description
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = `600 26px ${theme.font}`;
      wrapText(ctx, place.description.slice(0, 160), 72, panelY + 220, 700, 38);

      // Custom text overlay
      if (customText.trim()) {
        ctx.fillStyle = theme.accentHex;
        ctx.font = `900 30px ${theme.font}`;
        wrapText(ctx, customText, 72, panelY + 340, 900, 40);
      }

      // Footer URL
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `600 22px ${theme.font}`;
      ctx.fillText("sheher.app", 72, 1315);

      // Accent corner decoration
      ctx.fillStyle = theme.accentHex;
      ctx.beginPath();
      ctx.roundRect(1080 - 72, 1350 - 72, 54, 54, 8);
      ctx.fill();

    } catch {
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.fillStyle = theme.textPrimary;
      ctx.font = "bold 32px Arial";
      ctx.fillText("Preview unavailable", 100, 200);
    }

    // Generate preview URL
    const url = canvas.toDataURL("image/jpeg", 0.88);
    setPreviewUrl(url);
  }, [activeTheme, customText, imageSrc, place, theme]);

  useEffect(() => {
    if (open) {
      renderCanvas();
    }
  }, [open, renderCanvas]);

  const handleDownload = async () => {
    setGenerating(true);
    setShareMsg("");
    try {
      await renderCanvas();
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${place.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-sheher-${activeTheme}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setShareMsg("Postcard downloaded!");
      }, "image/png");
    } catch (e) {
      setShareMsg("Download failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    setGenerating(true);
    setShareMsg("");
    try {
      await renderCanvas();
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `${place.title}-sheher.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: place.title, files: [file] });
          setShareMsg("Shared successfully!");
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
          setShareMsg("Postcard downloaded (sharing not supported).");
        }
      }, "image/png");
    } catch {
      setShareMsg("Share failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md md:items-center md:p-4"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-2xl md:max-h-[92vh] md:max-w-3xl md:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/15 text-teal-400">
                  <ImageIcon size={15} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-[var(--foreground)]">Postcard Customizer</h2>
                  <p className="text-[10px] text-[var(--muted)]">{place.title}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--panel-soft)] text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-[1fr_280px]">
              {/* Canvas Preview */}
              <div className="order-2 md:order-1">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                  <Sparkles size={10} className="inline mr-1 text-teal-400" />
                  Live Preview
                </p>
                <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-slate-950 aspect-[4/5]">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Postcard preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--muted)]">
                      <Loader2 size={24} className="animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="order-1 md:order-2 space-y-5">
                {/* Theme picker */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                    <Palette size={10} />
                    Theme
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveTheme(t.id)}
                        className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-all ${
                          activeTheme === t.id
                            ? "border-teal-400/60 bg-teal-500/10 shadow-[0_0_12px_rgba(45,212,191,0.15)]"
                            : "border-[var(--border)] bg-[var(--panel-soft)] hover:bg-[var(--panel)]"
                        }`}
                      >
                        <span className="text-lg">{t.emoji}</span>
                        <div>
                          <p className="text-xs font-black text-[var(--foreground)]">{t.label}</p>
                          <p className="text-[9px] text-[var(--muted)] leading-tight">{t.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom text */}
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">
                    <Type size={10} />
                    Custom Caption (optional)
                  </p>
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="Add your own message..."
                    rows={2}
                    maxLength={120}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--input)] p-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-teal-400/70 resize-none"
                  />
                  <p className="mt-1 text-right text-[10px] text-[var(--muted)]">{customText.length}/120</p>
                </div>

                {/* Re-render button */}
                <button
                  onClick={renderCanvas}
                  disabled={generating}
                  className="w-full rounded-xl border border-teal-500/40 bg-teal-500/10 px-4 py-2.5 text-sm font-black text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
                >
                  <Sparkles size={13} className="inline mr-1.5" />
                  Update Preview
                </button>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownload}
                    disabled={generating}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 py-3 text-xs font-black text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    Download
                  </button>
                  <button
                    onClick={handleShare}
                    disabled={generating}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-3 text-xs font-black text-[var(--foreground)] transition hover:bg-[var(--panel)] disabled:opacity-50"
                  >
                    <Share2 size={13} />
                    Share
                  </button>
                </div>

                {shareMsg && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-xs font-semibold ${shareMsg.includes("fail") ? "text-rose-400" : "text-emerald-400"}`}
                  >
                    {shareMsg}
                  </motion.p>
                )}
              </div>
            </div>

            {/* Hidden canvas */}
            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
