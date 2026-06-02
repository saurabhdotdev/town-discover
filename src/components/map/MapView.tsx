"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Place, UserLocation } from "@/types";
import { motion } from "framer-motion";
import { cn, formatDistance, getCategoryLabel, isOpenNow } from "@/lib/utils";
import { PUNE_CENTER } from "@/lib/pune-location";

interface MapProps {
  places: Place[];
  userLocation: UserLocation | null;
  selectedPlace?: Place | null;
  onMarkerClick?: (place: Place) => void;
  onCenterChange?: (center: { latitude: number; longitude: number }) => void;
  onBoundsChange?: (bounds: { south: number; west: number; north: number; east: number }) => void;
  className?: string;
  tripMode?: boolean;
  tripRoutePath?: { latitude: number; longitude: number }[] | null;
  simulationActive?: boolean;
  simulationCoord?: { latitude: number; longitude: number } | null;
}

const categoryColor: Record<string, string> = {
  cafe: "#f59e0b",
  restaurant: "#f43f5e",
  event: "#38bdf8",
  nightlife: "#d946ef",
  "food-stall": "#eab308",
  bar: "#fb7185",
  dessert: "#14b8a6",
  "ice-cream": "#e879f9",
  "street-food": "#f97316",
};

const categoryGlowColor: Record<string, string> = {
  cafe: "rgba(245, 158, 11, 0.5)",
  restaurant: "rgba(244, 63, 94, 0.5)",
  event: "rgba(56, 189, 248, 0.5)",
  nightlife: "rgba(217, 70, 239, 0.5)",
  "food-stall": "rgba(234, 179, 8, 0.5)",
  bar: "rgba(251, 113, 133, 0.5)",
  dessert: "rgba(20, 184, 166, 0.5)",
  "ice-cream": "rgba(232, 121, 249, 0.5)",
  "street-food": "rgba(249, 115, 22, 0.5)",
};

const categoryIconSVG: Record<string, string> = {
  cafe: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" x2="14" y1="2" y2="2"/>
    </svg>
  `,
  restaurant: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>
  `,
  event: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
      <path d="M8 14h.01"/>
      <path d="M12 14h.01"/>
      <path d="M16 14h.01"/>
    </svg>
  `,
  nightlife: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  `,
  "food-stall": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="6" x="3" y="3" rx="1"/>
      <path d="M12 9H3m9 0a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H3m9 9v9m-9-9v9"/>
    </svg>
  `,
  bar: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 22H2"/>
      <path d="M21 3L12 12L3 3"/>
      <path d="M12 12V22"/>
    </svg>
  `,
  dessert: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a2 2 0 0 0-2 2v4H8a2 2 0 0 0-2 2v6h12v-6a2 2 0 0 0-2-2h-2V4a2 2 0 0 0-2-2Z"/>
      <path d="M6 14h12"/>
    </svg>
  `,
  "street-food": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3h18v4H3z"/>
      <path d="M12 7v14"/>
      <path d="M7 11h10"/>
    </svg>
  `,
  "ice-cream": `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/>
      <path d="M17 7A5 5 0 0 0 7 7"/>
      <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>
    </svg>
  `,
  car: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
    </svg>
  `,
};

const tripIconSVG = {
  ev: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  `,
  toilet: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 22V10M15 22V10M12 2v4M12 22V10"/>
      <path d="M4 10h16v2a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-2z"/>
    </svg>
  `,
  viewpoint: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  `,
  hotel: `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 22V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v18"/>
      <path d="M6 12h4v2H6zM6 16h4v2H6zM14 12h4v2h-4zM14 16h4v2h-4zM6 8h4v2H6zM14 8h4v2h-4z"/>
    </svg>
  `
};

export const MapView: React.FC<MapProps> = ({
  places,
  userLocation,
  selectedPlace,
  onMarkerClick,
  onCenterChange,
  onBoundsChange,
  className,
  tripMode = false,
  tripRoutePath = null,
  simulationActive = false,
  simulationCoord = null,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Record<string, Leaflet.Marker>>({});
  const polylineRef = useRef<Leaflet.Polyline | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let cancelled = false;

    const initializeMap = async () => {
      const L = await import("leaflet");
      if (cancelled || !mapContainer.current || map.current) return;

      leaflet.current = L;

      const initialLat = userLocation?.latitude ?? PUNE_CENTER.latitude;
      const initialLng = userLocation?.longitude ?? PUNE_CENTER.longitude;

      const nextMap = L.map(mapContainer.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([initialLat, initialLng], 14);
      map.current = nextMap;

      // Notify initial center and bounds
      onCenterChange?.({ latitude: initialLat, longitude: initialLng });
      
      const initialBounds = nextMap.getBounds();
      onBoundsChange?.({
        south: initialBounds.getSouth(),
        west: initialBounds.getWest(),
        north: initialBounds.getNorth(),
        east: initialBounds.getEast(),
      });

      nextMap.on("move", () => {
        const center = nextMap.getCenter();
        onCenterChange?.({ latitude: center.lat, longitude: center.lng });
      });

      nextMap.on("moveend", () => {
        const bounds = nextMap.getBounds();
        onBoundsChange?.({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        });
      });

      L.control.zoom({ position: "bottomright" }).addTo(nextMap);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(nextMap);

      if (userLocation) {
        const userIcon = L.divIcon({
          html: `
            <div style="position:relative;width:28px;height:28px;display:grid;place-items:center;">
              <div style="position:absolute;width:28px;height:28px;border-radius:999px;background:rgba(56,189,248,.22);box-shadow:0 0 0 8px rgba(56,189,248,.08);"></div>
              <div style="width:12px;height:12px;border-radius:999px;background:#38bdf8;border:2px solid #fff;box-shadow:0 8px 20px rgba(0,0,0,.35);"></div>
            </div>
          `,
          iconSize: [28, 28],
          className: "",
        });

        L.marker([userLocation.latitude, userLocation.longitude], {
          icon: userIcon,
        })
          .addTo(nextMap)
          .bindPopup("<b>Your location</b>");
      }

      window.setTimeout(() => map.current?.invalidateSize(), 120);
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    };
  }, [userLocation]);

  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L) return;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    places.forEach((place) => {
      const isSelected = selectedPlace?.id === place.id;
      const isNightDrive = place.tags.includes("night-drive");
      
      let color = isNightDrive ? "#ec4899" : (categoryColor[place.category] ?? "#94a3b8");
      let glowColor = isNightDrive ? "rgba(236, 72, 153, 0.5)" : (categoryGlowColor[place.category] ?? "rgba(148, 163, 184, 0.4)");
      let iconHtml = isNightDrive ? categoryIconSVG["car"] : (categoryIconSVG[place.category] ?? place.category.slice(0, 1).toUpperCase());

      if (place.tags.includes("ev-station")) {
        color = "#10b981";
        glowColor = "rgba(16, 185, 129, 0.5)";
        iconHtml = tripIconSVG.ev;
      } else if (place.tags.includes("toilet") || place.tags.includes("restroom")) {
        color = "#f97316";
        glowColor = "rgba(249, 115, 22, 0.5)";
        iconHtml = tripIconSVG.toilet;
      } else if (place.tags.includes("viewpoint") || place.tags.includes("scenic")) {
        color = "#a855f7";
        glowColor = "rgba(168, 85, 247, 0.5)";
        iconHtml = tripIconSVG.viewpoint;
      } else if (place.tags.includes("hotel") || place.tags.includes("stay")) {
        color = "#3b82f6";
        glowColor = "rgba(59, 130, 246, 0.5)";
        iconHtml = tripIconSVG.hotel;
      }

      const open = isOpenNow(place.hours);
      const pulseActive = place.isTrending || open;

      const markerIcon = L.divIcon({
        html: `
          <div style="position:relative;display:grid;place-items:center;width:${isSelected ? "44px" : "36px"};height:${isSelected ? "44px" : "36px"};">
            ${pulseActive ? `
              <div class="marker-pulse-glow" style="position:absolute;width:100%;height:100%;border-radius:999px;--pulse-color-glow:${glowColor};"></div>
            ` : ""}
            <div style="display:grid;place-items:center;width:100%;height:100%;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.3);color:#fff;">
              ${iconHtml}
            </div>
          </div>
        `,
        iconSize: isSelected ? [44, 44] : [36, 36],
        iconAnchor: isSelected ? [22, 22] : [18, 18],
        className: "",
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon: markerIcon,
      })
        .addTo(map.current!)
        .bindPopup(`
          <div style="padding:6px 2px;min-width:160px;">
            <b>${place.title}</b><br/>
            ${getCategoryLabel(place.category, place.tags)} - ${formatDistance(place.distance)}
          </div>
        `);

      marker.on("click", () => {
        onMarkerClick?.(place);
      });

      markersRef.current[place.id] = marker;
    });
  }, [places, selectedPlace, onMarkerClick]);

  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L) return;

    let isCancelled = false;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!selectedPlace || tripMode) return;

    map.current.flyTo([selectedPlace.latitude, selectedPlace.longitude], Math.max(map.current.getZoom(), 15), {
      duration: 0.7,
    });

    if (selectedPlace.routeWaypoints && selectedPlace.routeWaypoints.length >= 2) {
      const getScenicRoute = async () => {
        try {
          const waypointStr = selectedPlace.routeWaypoints!.map(w => `${w.longitude},${w.latitude}`).join(";");
          const url = `https://router.project-osrm.org/route/v1/driving/${waypointStr}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("OSRM API error");
          const data = await res.json();
          if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
            throw new Error("Invalid OSRM geometry");
          }

          if (isCancelled || !map.current || !L) return;

          const coordinates = data.routes[0].geometry.coordinates;
          const pathPoints: [number, number][] = coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);

          const polyline = L.polyline(pathPoints, {
            color: "#ec4899",
            weight: 4.5,
            dashArray: "10, 5",
            className: "scenic-polyline",
          }).addTo(map.current);

          polylineRef.current = polyline;
        } catch (err) {
          console.warn("Failed to fetch scenic road route, falling back to straight waypoints:", err);
          if (isCancelled || !map.current || !L) return;

          const pathPoints: [number, number][] = selectedPlace.routeWaypoints!.map(w => [w.latitude, w.longitude]);
          const polyline = L.polyline(pathPoints, {
            color: "#ec4899",
            weight: 4,
            dashArray: "10, 5",
          }).addTo(map.current);

          polylineRef.current = polyline;
        }
      };

      getScenicRoute();
    } else if (userLocation) {
      const getRoadRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${selectedPlace.longitude},${selectedPlace.latitude}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("OSRM API error");
          const data = await res.json();
          if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates) {
            throw new Error("Invalid OSRM geometry");
          }

          if (isCancelled || !map.current || !L) return;

          const coordinates = data.routes[0].geometry.coordinates;
          const pathPoints: [number, number][] = coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);

          const polyline = L.polyline(pathPoints, {
            color: "#14b8a6",
            weight: 3.5,
            dashArray: "8, 8",
            className: "glowing-polyline",
          }).addTo(map.current);

          polylineRef.current = polyline;
        } catch (err) {
          console.warn("Failed to fetch road route, falling back to straight line:", err);
          if (isCancelled || !map.current || !L) return;

          const straightPoints: [number, number][] = [
            [userLocation.latitude, userLocation.longitude],
            [selectedPlace.latitude, selectedPlace.longitude],
          ];
          const polyline = L.polyline(straightPoints, {
            color: "#14b8a6",
            weight: 3,
            dashArray: "8, 8",
            className: "glowing-polyline",
          }).addTo(map.current);

          polylineRef.current = polyline;
        }
      };

      getRoadRoute();
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedPlace, userLocation, tripMode]);

  // Draw Trip Route Polyline
  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L) return;

    if (polylineRef.current && tripRoutePath) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!tripRoutePath || tripRoutePath.length === 0) return;

    const pathPoints: [number, number][] = tripRoutePath.map(c => [c.latitude, c.longitude]);
    const polyline = L.polyline(pathPoints, {
      color: "#38bdf8",
      weight: 5.5,
      className: "glowing-polyline",
      dashArray: "12, 6"
    }).addTo(map.current);

    polylineRef.current = polyline;

    try {
      const bounds = L.latLngBounds(pathPoints);
      map.current.fitBounds(bounds, { padding: [50, 50] });
    } catch (e) {
      console.warn("fitBounds failed:", e);
    }
  }, [tripRoutePath]);

  // Vehicle Simulation Marker tracking
  const simulationMarkerRef = useRef<Leaflet.Marker | null>(null);

  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L) return;

    if (simulationMarkerRef.current) {
      simulationMarkerRef.current.remove();
      simulationMarkerRef.current = null;
    }

    if (!simulationCoord) return;

    const carIcon = L.divIcon({
      html: `
        <div style="position:relative;width:38px;height:38px;display:grid;place-items:center;">
          <div style="position:absolute;width:38px;height:38px;border-radius:999px;background:rgba(6,182,212,0.3);box-shadow:0 0 0 8px rgba(6,182,212,0.15);" class="marker-pulse-glow"></div>
          <div style="width:24px;height:24px;border-radius:999px;background:#06b6d4;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:grid;place-items:center;color:#fff;">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      className: "",
    });

    const marker = L.marker([simulationCoord.latitude, simulationCoord.longitude], {
      icon: carIcon,
      zIndexOffset: 1000
    }).addTo(map.current);

    simulationMarkerRef.current = marker;

    if (simulationActive) {
      map.current.setView([simulationCoord.latitude, simulationCoord.longitude], Math.max(map.current.getZoom(), 15), {
        animate: true,
        duration: 0.2
      });
    }

    return () => {
      if (simulationMarkerRef.current) {
        simulationMarkerRef.current.remove();
        simulationMarkerRef.current = null;
      }
    };
  }, [simulationCoord, simulationActive]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42 }}
      ref={mapContainer}
      className={cn("h-96 min-h-[400px] w-full overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl", className)}
    />
  );
};

