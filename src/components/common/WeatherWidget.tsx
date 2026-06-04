"use client";

import React from "react";
import { motion } from "framer-motion";
import { Cloud, CloudRain, Sun, Thermometer, Wind } from "lucide-react";
import { WeatherData } from "@/lib/weather";

interface WeatherWidgetProps {
  weather: WeatherData;
  city: string;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, city }) => {
  const getIcon = () => {
    const iconSize = 28;
    switch (weather.condition) {
      case "Rainy":
        return (
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="text-cyan-400"
          >
            <CloudRain size={iconSize} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
          </motion.div>
        );
      case "Hot":
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
            className="text-amber-400"
          >
            <Sun size={iconSize} className="drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
          </motion.div>
        );
      case "Cozy":
        return (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="text-purple-400"
          >
            <Cloud size={iconSize} className="drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
          </motion.div>
        );
      default:
        return (
          <motion.div
            animate={{ y: [0, -1, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-teal-300"
          >
            <Cloud size={iconSize} className="drop-shadow-[0_0_8px_rgba(45,212,191,0.4)]" />
          </motion.div>
        );
    }
  };

  const getBadgeColors = () => {
    switch (weather.condition) {
      case "Rainy":
        return "bg-cyan-500/10 text-cyan-200 border-cyan-500/20";
      case "Hot":
        return "bg-amber-500/10 text-amber-200 border-amber-500/20";
      case "Cozy":
        return "bg-purple-500/10 text-purple-200 border-purple-500/20";
      default:
        return "bg-teal-500/10 text-teal-200 border-teal-500/20";
    }
  };

  const getThemeGlow = () => {
    switch (weather.condition) {
      case "Rainy":
        return "from-cyan-950/20 to-slate-900/10 border-cyan-500/10";
      case "Hot":
        return "from-amber-950/15 to-slate-900/10 border-amber-500/10";
      case "Cozy":
        return "from-purple-950/20 to-slate-900/10 border-purple-500/10";
      default:
        return "from-teal-950/20 to-slate-900/10 border-teal-500/10";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${getThemeGlow()} p-4 shadow-xl backdrop-blur-md`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        
        {/* Left Section: Weather Icon & Core Metrics */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950/40 border border-slate-800/40">
            {getIcon()}
          </div>
          
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black text-slate-200">{city}</h4>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getBadgeColors()}`}>
                {weather.label}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1 font-bold text-slate-200">
                <Thermometer size={13} className="text-rose-400" />
                {weather.temp}°C
              </span>
              <span className="flex items-center gap-1">
                <Wind size={12} className="text-slate-500" />
                {weather.windSpeed} km/h wind
              </span>
              <span className="flex items-center gap-1">
                💧 {weather.humidity}% hum
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Poetic Vibe Note */}
        <div className="border-t border-slate-800/30 pt-3 md:border-t-0 md:pt-0 md:max-w-[320px] text-left">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            Today's Weather Vibe
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-300 leading-relaxed italic">
            &ldquo;{weather.poeticNote}&rdquo;
          </p>
        </div>

      </div>
    </motion.div>
  );
};
