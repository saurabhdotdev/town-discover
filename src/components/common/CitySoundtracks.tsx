"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Music, Volume2, X, Sun, CloudRain, Wind, Flame, Compass } from "lucide-react";

interface SoundscapePreset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  bgGradient: string;
  weatherNoise: "rain" | "wind" | "crackle" | "none";
  chords: number[][]; // Frequencies in Hz
}

const PRESETS: SoundscapePreset[] = [
  {
    id: "rainy-cafe",
    name: "Cozy Rain Cafe",
    description: "Relaxing minor 7th chords mixed with pitter-patter rain.",
    icon: <CloudRain className="text-cyan-400" size={16} />,
    bgGradient: "from-cyan-900/60 via-[#0a1118]/80 to-slate-950/90",
    weatherNoise: "rain",
    chords: [
      [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3 (Cmaj7)
      [110.00, 138.61, 164.81, 207.65], // A2, C#3, E3, G#3 (Amaj7)
      [87.31, 110.00, 130.81, 164.81],  // F2, A2, C3, E3 (Fmaj7)
      [98.00, 123.47, 146.83, 185.00],  // G2, B2, D3, F#3 (Gmaj7)
    ],
  },
  {
    id: "midnight-drive",
    name: "Midnight Synth Drive",
    description: "Soothing major 7th swells with slow highway wind sweeps.",
    icon: <Wind className="text-teal-400" size={16} />,
    bgGradient: "from-teal-950/60 via-[#071013]/80 to-slate-950/90",
    weatherNoise: "wind",
    chords: [
      [82.41, 123.47, 146.83, 164.81],  // E2, B2, D3, G3 (Em7)
      [130.81, 164.81, 196.00, 220.00], // C3, E3, G3, A3 (C6)
      [146.83, 185.00, 220.00, 261.63], // D3, F#3, A3, C4 (D7)
      [110.00, 146.83, 164.81, 196.00], // A2, D3, E3, G3 (Asus4)
    ],
  },
  {
    id: "heritage-fireplace",
    name: "Heritage Bonfire",
    description: "Deep warm chord sweeps and crackling fireplace embers.",
    icon: <Flame className="text-amber-400" size={16} />,
    bgGradient: "from-amber-950/60 via-[#0e0c0a]/80 to-slate-950/90",
    weatherNoise: "crackle",
    chords: [
      [110.00, 130.81, 164.81, 196.00], // A2, C3, E3, G3 (Am7)
      [146.83, 174.61, 220.00, 261.63], // D3, F3, A3, C4 (Dm7)
      [98.00, 123.47, 146.83, 196.00],  // G2, B2, D3, G3 (G)
      [130.81, 164.81, 196.00, 246.94], // C3, E3, G3, B3 (Cmaj7)
    ],
  },
  {
    id: "sunny-gelato",
    name: "Sunny Chimes",
    description: "Bright ambient chime sounds for clear summer days.",
    icon: <Sun className="text-yellow-400" size={16} />,
    bgGradient: "from-yellow-950/40 via-[#0f0e0b]/80 to-slate-950/90",
    weatherNoise: "none",
    chords: [
      [130.81, 164.81, 196.00, 261.63], // C3, E3, G3, C4
      [146.83, 174.61, 220.00, 293.66], // D3, F3, A3, D4
      [164.81, 196.00, 246.94, 329.63], // E3, G3, B3, E4
      [174.61, 220.00, 261.63, 349.23], // F3, A3, C4, F4
    ],
  },
];

export const CitySoundtracks = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPresetIndex, setCurrentPresetIndex] = useState(0);
  const [volume, setVolume] = useState(0.4);

  // Audio Context Ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Audio Nodes Refs
  const masterGainRef = useRef<GainNode | null>(null);
  const weatherNoiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const weatherNoiseGainRef = useRef<GainNode | null>(null);
  
  // Intervals / Schedulers
  const chordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeOscillatorsRef = useRef<OscillatorNode[]>([]);
  const crackleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activePreset = PRESETS[currentPresetIndex];

  // Initialize Audio Context and permanent master gain
  const initAudio = () => {
    if (audioCtxRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // Start background weather noise loop
    setupWeatherNoise(ctx, masterGain);
  };

  // Setup noise buffers for weather simulation
  const setupWeatherNoise = (ctx: AudioContext, destination: AudioNode) => {
    // Stop previous if active
    if (weatherNoiseSourceRef.current) {
      try {
        weatherNoiseSourceRef.current.stop();
      } catch {}
      weatherNoiseSourceRef.current = null;
    }

    // Create weather noise gain node
    const weatherGain = ctx.createGain();
    weatherGain.gain.setValueAtTime(0, ctx.currentTime);
    weatherGain.connect(destination);
    weatherNoiseGainRef.current = weatherGain;

    // Generate White Noise Buffer
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    // Loop buffer source
    const whiteNoiseSource = ctx.createBufferSource();
    whiteNoiseSource.buffer = noiseBuffer;
    whiteNoiseSource.loop = true;

    // Filter node for shaping noise
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.Q.setValueAtTime(1.2, ctx.currentTime);

    whiteNoiseSource.connect(filter);
    filter.connect(weatherGain);
    whiteNoiseSource.start();
    weatherNoiseSourceRef.current = whiteNoiseSource;

    // Set weather audio parameters based on active preset
    updateWeatherEngine(ctx);
  };

  // Update weather volume and noise parameters
  const updateWeatherEngine = (ctx: AudioContext) => {
    const weatherGain = weatherNoiseGainRef.current;
    if (!weatherGain) return;

    // Clear fireplace crackle intervals
    if (crackleTimerRef.current) {
      clearInterval(crackleTimerRef.current);
      crackleTimerRef.current = null;
    }

    if (!isPlaying) {
      weatherGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
      return;
    }

    const mode = activePreset.weatherNoise;
    if (mode === "rain") {
      weatherGain.gain.setTargetAtTime(0.06, ctx.currentTime, 1.0);
    } else if (mode === "wind") {
      weatherGain.gain.setTargetAtTime(0.04, ctx.currentTime, 1.0);
      // Simulate wind gusts via gain LFO automation
      let windTime = ctx.currentTime;
      const intervalWind = setInterval(() => {
        if (!audioCtxRef.current || !isPlaying || activePreset.weatherNoise !== "wind") {
          clearInterval(intervalWind);
          return;
        }
        const windCtx = audioCtxRef.current;
        const targetGain = 0.02 + Math.random() * 0.04;
        weatherGain.gain.linearRampToValueAtTime(targetGain, windCtx.currentTime + 3.0);
      }, 4000);
    } else if (mode === "crackle") {
      // Very low constant crackle hum
      weatherGain.gain.setTargetAtTime(0.015, ctx.currentTime, 1.0);
      // Periodic snap pops
      crackleTimerRef.current = setInterval(() => {
        if (!audioCtxRef.current || !isPlaying || activePreset.weatherNoise !== "crackle") return;
        playCracklePop(audioCtxRef.current, masterGainRef.current!);
      }, 350);
    } else {
      weatherGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    }
  };

  // Synthesize single fireplace pop crackle
  const playCracklePop = (ctx: AudioContext, destination: AudioNode) => {
    if (Math.random() > 0.45) return; // Random probability

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(100 + Math.random() * 800, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.03 * Math.random(), ctx.currentTime + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.025);

    osc.connect(gainNode);
    gainNode.connect(destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.03);
  };

  // Play a soft ambient chord progression chord
  const playChordSwell = () => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master || !isPlaying) return;

    // Select random chord from preset list
    const chordFrequencies = activePreset.chords[Math.floor(Math.random() * activePreset.chords.length)];

    // Create delay node for echoing atmosphere
    const delay = ctx.createDelay();
    delay.delayTime.setValueAtTime(0.45, ctx.currentTime);

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.42, ctx.currentTime);

    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    const swellGain = ctx.createGain();
    swellGain.gain.setValueAtTime(0, ctx.currentTime);
    // Smooth attack and decay envelope
    swellGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.8);
    swellGain.gain.setTargetAtTime(0, ctx.currentTime + 2.2, 1.2);

    swellGain.connect(filter);
    filter.connect(master);
    filter.connect(delay);

    const oscillators: OscillatorNode[] = [];

    chordFrequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      // Triangle waves sound like a soft vintage rhodes/pad
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Micro-detuning for chorus effect
      osc.detune.setValueAtTime((index - 1.5) * 5, ctx.currentTime);

      osc.connect(swellGain);
      osc.start();
      oscillators.push(osc);
    });

    // Save active oscillator node refs to clear if paused
    activeOscillatorsRef.current = oscillators;

    // Clean up nodes after chord finishes
    setTimeout(() => {
      oscillators.forEach((osc) => {
        try {
          osc.stop();
        } catch {}
      });
    }, 5500);
  };

  // Handle Play/Pause
  const handleTogglePlay = () => {
    initAudio();

    if (audioCtxRef.current?.state === "suspended") {
      audioCtxRef.current.resume();
    }

    if (isPlaying) {
      // Pause
      setIsPlaying(false);
      // Clean up current chords
      activeOscillatorsRef.current.forEach((o) => {
        try {
          o.stop();
        } catch {}
      });
      activeOscillatorsRef.current = [];
      if (chordTimerRef.current) {
        clearInterval(chordTimerRef.current);
        chordTimerRef.current = null;
      }
      if (audioCtxRef.current) {
        updateWeatherEngine(audioCtxRef.current);
      }
    } else {
      // Play
      setIsPlaying(true);
    }
  };

  // Sync isPlaying state to scheduling loop
  useEffect(() => {
    if (isPlaying && audioCtxRef.current) {
      updateWeatherEngine(audioCtxRef.current);
      
      // Play initial swell
      playChordSwell();
      
      // Schedule chords every 5 seconds
      chordTimerRef.current = setInterval(() => {
        playChordSwell();
      }, 5000);
    } else {
      if (chordTimerRef.current) {
        clearInterval(chordTimerRef.current);
        chordTimerRef.current = null;
      }
    }
    return () => {
      if (chordTimerRef.current) clearInterval(chordTimerRef.current);
    };
  }, [isPlaying, currentPresetIndex]);

  // Sync volume slider modifications
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(volume, audioCtxRef.current.currentTime, 0.1);
    }
  }, [volume]);

  // Handle Preset Change
  const handlePresetSelect = (index: number) => {
    setCurrentPresetIndex(index);
    // Cut current playing oscillators to start fresh swell
    activeOscillatorsRef.current.forEach((o) => {
      try {
        o.stop();
      } catch {}
    });
    activeOscillatorsRef.current = [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chordTimerRef.current) clearInterval(chordTimerRef.current);
      if (crackleTimerRef.current) clearInterval(crackleTimerRef.current);
      activeOscillatorsRef.current.forEach((o) => {
        try {
          o.stop();
        } catch {}
      });
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
    };
  }, []);

  return (
    <div className="fixed top-24 right-4 z-[999] select-none">
      <AnimatePresence>
        {isExpanded ? (
          /* EXPANDED PLAYER PANEL */
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            className={`w-72 rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl bg-gradient-to-br ${activePreset.bgGradient} relative overflow-hidden`}
          >
            {/* Background elements */}
            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
            
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-white/5 mb-3 relative z-10">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-teal-400">
                <Music size={12} className={isPlaying ? "animate-pulse text-teal-400" : "text-slate-400"} /> City Ambient Synth
              </span>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Rotating Vinyl Cover Art */}
            <div className="flex flex-col items-center gap-3 relative z-10 py-2">
              <div className="relative">
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className={`h-24 w-24 rounded-full border border-white/10 bg-slate-950 flex items-center justify-center shadow-lg relative ${
                    isPlaying ? "shadow-teal-500/15" : ""
                  }`}
                >
                  {/* Vinyl grooves */}
                  <div className="absolute inset-1 rounded-full border border-white/5 pointer-events-none" />
                  <div className="absolute inset-3 rounded-full border border-white/5 pointer-events-none" />
                  <div className="absolute inset-5 rounded-full border border-white/5 pointer-events-none" />
                  {/* Center Sticker */}
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/30 border border-teal-500/40 flex items-center justify-center shadow-inner">
                    <Compass size={16} className={`text-teal-300 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "10s" }} />
                  </div>
                </motion.div>
                {/* Visualizer bars */}
                {isPlaying && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-end gap-[2px] h-3">
                    {[3, 7, 5, 8, 4].map((h, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ["4px", `${h * 1.5}px`, "4px"] }}
                        transition={{ duration: 0.6 + i * 0.1, repeat: Infinity, ease: "easeInOut" }}
                        className="w-[2px] bg-teal-400 rounded-full"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="text-center w-full px-2 mt-1">
                <h4 className="text-xs font-black text-slate-100 truncate">{activePreset.name}</h4>
                <p className="text-[9px] text-slate-400 font-semibold leading-tight mt-0.5 min-h-[22px]">
                  {activePreset.description}
                </p>
              </div>
            </div>

            {/* Main Controls */}
            <div className="space-y-3 pt-2 relative z-10">
              <div className="flex items-center justify-between gap-4">
                {/* Play/Pause Button */}
                <button
                  onClick={handleTogglePlay}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition cursor-pointer shadow-lg ${
                    isPlaying
                      ? "bg-rose-500 text-white hover:bg-rose-400 shadow-rose-500/20"
                      : "bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-teal-500/20"
                  }`}
                >
                  {isPlaying ? <Pause size={16} className="fill-white" /> : <Play size={16} className="fill-slate-950 ml-0.5" />}
                </button>

                {/* Volume Slider */}
                <div className="flex-1 flex items-center gap-1.5 bg-slate-950/40 border border-white/5 px-2.5 py-2 rounded-xl">
                  <Volume2 size={13} className="text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>
              </div>

              {/* Soundscapes Selector Grid */}
              <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-white/5">
                {PRESETS.map((p, index) => {
                  const isSel = index === currentPresetIndex;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePresetSelect(index)}
                      title={p.name}
                      className={`py-2 flex flex-col items-center justify-center rounded-lg border text-center transition cursor-pointer ${
                        isSel
                          ? "bg-slate-950/60 border-teal-500/40 shadow shadow-teal-500/5"
                          : "bg-slate-950/20 border-white/5 hover:bg-slate-950/40 hover:border-white/10"
                      }`}
                    >
                      {p.icon}
                      <span className="text-[7px] font-black text-slate-400 uppercase mt-1 truncate max-w-full px-1">
                        {p.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          /* COLLAPSED VINYL RECORD WIDGET */
          <motion.div
            key="collapsed"
            layoutId="collapsedVinyl"
            onClick={() => setIsExpanded(true)}
            whileHover={{ scale: 1.05 }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 border border-white/15 shadow-2xl cursor-pointer relative"
          >
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0.5 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-500/30 flex items-center justify-center border border-teal-500/30"
            >
              <Music size={14} className={`text-teal-300 ${isPlaying ? "animate-pulse" : ""}`} />
            </motion.div>
            
            {/* Small active wave dot indicators */}
            {isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
