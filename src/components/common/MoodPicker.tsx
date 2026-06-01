"use client";

import { Sparkles } from "lucide-react";
import { MOOD_OPTIONS, MoodAxis } from "@/lib/mood-recommendations";

interface MoodPickerProps {
  value: MoodAxis | null;
  onChange: (mood: MoodAxis | null) => void;
  className?: string;
}

export const MoodPicker: React.FC<MoodPickerProps> = ({ value, onChange, className = "" }) => {
  const activeOption = MOOD_OPTIONS.find((option) => option.id === value);

  return (
    <section className={`rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] p-3 md:p-4 ${className}`}>
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--fresh)]">
            <Sparkles size={14} />
            What&apos;s your mood?
          </p>
          <h2 className="mt-1 text-lg font-black text-[var(--foreground)] sm:text-xl">
            Tell us how you feel — we&apos;ll pick places for you
          </h2>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mt-1 text-xs font-bold text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline sm:mt-0"
          >
            Clear mood
          </button>
        )}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {MOOD_OPTIONS.map((mood) => {
          const active = value === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              onClick={() => onChange(active ? null : mood.id)}
              aria-pressed={active}
              className={`inline-flex shrink-0 flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition sm:min-w-[7.5rem] sm:px-4 ${active
                  ? "border-teal-300/60 bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg shadow-teal-900/20"
                  : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted-strong)] hover:border-teal-300/30 hover:bg-[var(--panel-soft)]"
                }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {mood.emoji}
              </span>
              <span className="text-xs font-black sm:text-sm">{mood.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted-strong)]">
        {activeOption
          ? activeOption.hint
          : "Choose a mood above to see personalized picks below."}
      </p>
    </section>
  );
};
