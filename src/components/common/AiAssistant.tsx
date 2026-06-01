"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Loader2, Compass, MessageSquare } from "lucide-react";
import Image from "next/image";
import { useCitySelection } from "@/hooks/useCitySelection";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { DiscoveryCard } from "@/components/cards/DiscoveryCard";
import { PlaceDetailModal } from "@/components/cards/PlaceDetailModal";
import { Place } from "@/types";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  placeIds?: string[];
}

const suggestions = [
  { text: "☕ Chill cafes to work from", query: "What are some chill cafes here where I can sit with my laptop?" },
  { text: "🍔 Must-try street food trails", query: "Suggest a must-try local street food trail or market." },
  { text: "🚗 Late-night drives & viewpoints", query: "Where can I go for a scenic late-night drive or viewpoint?" },
  { text: "🏛️ Cultural & heritage hidden gems", query: "Tell me about some cultural sites or heritage hidden gems." },
];

export const AiAssistant: React.FC = () => {
  const { selectedCity } = useCitySelection();
  const { savedPlaceIds, toggleSave } = useSavedPlaces();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Cache for full place objects by ID to render place cards in chat
  const [placesCache, setPlacesCache] = useState<Record<string, Place>>({});
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "model",
          content: `Hey explorer! 🌃 I'm your **Sheher AI Guide** for **${selectedCity}**. Ask me for customized itineraries, work-friendly spots, late-night vibes, or whatever mood you are in!`,
        },
      ]);
    }
  }, [selectedCity, messages.length]);

  // Reset chat if city changes to update context
  useEffect(() => {
    setMessages([
      {
        id: `welcome-${selectedCity}`,
        role: "model",
        content: `Switched context to **${selectedCity}**! 🗺️ How can I help you explore this city today? Ask me about local experiences, hidden gems, or specific plans!`,
      },
    ]);
  }, [selectedCity]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Resolve place details from backend for list of placeIds
  const resolvePlaces = async (ids: string[]) => {
    const missingIds = ids.filter((id) => !placesCache[id]);
    if (missingIds.length === 0) return;

    try {
      const res = await fetch(`/api/places/resolve?ids=${encodeURIComponent(missingIds.join(","))}`);
      if (!res.ok) throw new Error("Failed to resolve places");
      const data = await res.json();
      
      if (data.places && Array.isArray(data.places)) {
        setPlacesCache((prev) => {
          const next = { ...prev };
          data.places.forEach((place: Place) => {
            next[place.id] = place;
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Error resolving place details in AI Chat:", err);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || loading) return;

    if (!textToSend) {
      setInput("");
    }

    const userMessage: ChatMessage = {
      id: Math.random().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Map message history to Gemini API route requirements
      const history = messages
        .filter((m) => m.id !== "welcome" && !m.id.startsWith("welcome-"))
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));
      
      const payload = {
        messages: [...history, { role: "user", content: text }],
        city: selectedCity,
      };

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Chat failed");
      }

      const data = await response.json();
      
      // If AI recommended places, trigger background resolution of full details
      if (data.placeIds && data.placeIds.length > 0) {
        await resolvePlaces(data.placeIds);
      }

      const aiMessage: ChatMessage = {
        id: Math.random().toString(),
        role: "model",
        content: data.text || "I was unable to find specific details, but feel free to search above!",
        placeIds: data.placeIds || [],
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error in AI chat handler:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "model",
          content: "Sorry, I ran into a connection glitch. Let me try again in a bit! 📡",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessageText = (text: string) => {
    if (!text) return "";
    
    // Bold syntax **text**
    let formatted = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Italic syntax *text*
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>");
    
    // Lists
    formatted = formatted.split("\n").map(line => {
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return `<li class="ml-4 list-disc my-1 text-slate-300">${line.trim().substring(2)}</li>`;
      }
      return line;
    }).join("\n");

    // Line breaks
    formatted = formatted.replace(/\n/g, "<br />");
    
    return <div dangerouslySetInnerHTML={{ __html: formatted }} className="text-xs sm:text-sm leading-relaxed space-y-1 font-medium" />;
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-20 right-4 z-[9980] flex h-14 w-14 items-center justify-center rounded-full bg-slate-950/90 border border-teal-500/30 text-slate-200 shadow-2xl shadow-teal-500/20 hover:shadow-teal-400/40 outline-none transition cursor-pointer md:bottom-6 md:right-6 overflow-hidden p-0.5"
        aria-label="Toggle AI Assistant"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center w-full h-full text-teal-400"
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="mascot"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full rounded-full overflow-hidden"
            >
              <Image
                src="/sheher_ai_mascot.png"
                alt="AI Mascot"
                fill
                sizes="56px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-teal-500/10 hover:bg-transparent transition-colors" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Immersive Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[9970] flex h-[calc(100dvh-4rem)] flex-col overflow-hidden rounded-t-lg border-t border-[var(--border)] bg-slate-950/90 shadow-2xl backdrop-blur-xl md:bottom-24 md:right-6 md:left-auto md:h-[580px] md:max-h-[calc(100vh-120px)] md:w-[420px] md:rounded-2xl md:border"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-slate-900/60 px-4 py-3 md:px-5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-8 w-8 shrink-0 rounded-full border border-teal-500/30 overflow-hidden shadow-inner">
                  <Image
                    src="/sheher_ai_mascot.png"
                    alt="AI Mascot"
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 border border-slate-950 animate-ping" />
                  <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-400 border border-slate-950" />
                </span>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-[0.16em] text-[var(--foreground)]">Sheher AI Guide</h2>
                  <p className="text-[10px] font-semibold text-teal-400">Local Expert Concierge</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Chat Area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar bg-gradient-to-b from-slate-950/10 to-slate-950/60"
            >
              {messages.map((message) => {
                const isModel = message.role === "model";
                
                // Collect place cards to show if AI returned places
                const resolvedPlaces = message.placeIds
                  ? message.placeIds.map((id) => placesCache[id]).filter(Boolean)
                  : [];

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col max-w-[85%] ${
                      isModel ? "self-start items-start" : "self-end items-end ml-auto"
                    }`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl px-4 py-3 shadow-md border ${
                        isModel
                          ? "bg-[var(--panel-soft)] border-[var(--border)] text-[var(--foreground)] rounded-tl-sm"
                          : "bg-[var(--primary)] border-teal-500/20 text-[var(--primary-foreground)] rounded-tr-sm"
                      }`}
                    >
                      {formatMessageText(message.content)}
                    </div>

                    {/* Interactive Place Card Carousel */}
                    {isModel && resolvedPlaces.length > 0 && (
                      <div className="mt-3 w-full overflow-hidden">
                        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-teal-400">
                          <Compass size={12} />
                          Explore Recommended Spots:
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-2 px-2 scroll-smooth">
                          {resolvedPlaces.map((place) => (
                            <div key={place.id} className="w-[260px] shrink-0 transform scale-98 hover:scale-100 transition duration-200">
                              <DiscoveryCard
                                place={place}
                                onClick={() => setSelectedPlace(place)}
                                onSave={toggleSave}
                                isSaved={savedPlaceIds.has(place.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Suggestions chips when history is empty or just welcome greeting */}
              {messages.length <= 1 && (
                <div className="pt-2 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">Suggested Vibe Queries</p>
                  <div className="flex flex-col gap-2">
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(s.query)}
                        className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/40 p-2.5 text-xs font-bold text-slate-300 hover:border-teal-400/40 hover:bg-slate-900 transition flex items-center gap-2 cursor-pointer"
                      >
                        <span className="shrink-0">✦</span>
                        <span>{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Typing Indicator */}
              {loading && (
                <div className="flex items-center gap-2 self-start rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-[var(--foreground)] rounded-tl-sm max-w-[85%]">
                  <Loader2 size={16} className="animate-spin text-teal-400" />
                  <span className="text-xs font-semibold text-[var(--muted-strong)]">Curating the pulse of the city...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="border-t border-[var(--border)] bg-slate-900/70 p-3 flex gap-2 items-center"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask about spots or vibes in ${selectedCity}...`}
                disabled={loading}
                className="flex-1 h-10 rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 text-xs font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-teal-400/60 disabled:opacity-60 transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-slate-950 transition hover:bg-teal-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-md"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Place Details Modal (handles detail opening from inside the chat) */}
      <AnimatePresence>
        {selectedPlace && (
          <PlaceDetailModal
            place={selectedPlace}
            onClose={() => setSelectedPlace(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
