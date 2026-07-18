"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Place, UserLocation } from "@/types";
import { motion } from "framer-motion";
import { cn, formatDistance, getCategoryLabel, isOpenNow } from "@/lib/utils";
import { PUNE_CENTER } from "@/lib/pune-location";
import { calculateDistance } from "@/lib/geo";

interface MapProps {
  places: Place[];
  userLocation: UserLocation | null;
  selectedPlace?: Place | null;
  onMarkerClick?: (place: Place | null) => void;
  onCenterChange?: (center: { latitude: number; longitude: number }) => void;
  onBoundsChange?: (bounds: { south: number; west: number; north: number; east: number }) => void;
  className?: string;
  tripMode?: boolean;
  tripRoutePath?: { latitude: number; longitude: number }[] | null;
  simulationActive?: boolean;
  simulationCoord?: { latitude: number; longitude: number } | null;
  scrollWheelZoom?: boolean;
  tripItinerary?: Record<number, Place[]> | null;
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
  scrollWheelZoom = false,
  tripItinerary = null,
}) => {
  const [mapZoom, setMapZoom] = useState(14);
  const [mapStyle, setMapStyle] = useState<"classic" | "satellite">("classic");
  const mapContainer = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const tileLayerRef = useRef<Leaflet.TileLayer | null>(null);
  const markersRef = useRef<Record<string, Leaflet.Marker>>({});
  const polylineRef = useRef<Leaflet.Polyline | null>(null);
  const polylinesRef = useRef<Leaflet.Polyline[]>([]);
  const userLocationMarkerRef = useRef<Leaflet.Marker | null>(null);
  const lastFlownLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFlownSelectedPlaceRef = useRef<string | null>(null);
  // Use a ref so async init always reads the latest scrollWheelZoom value
  const scrollWheelZoomRef = useRef(scrollWheelZoom);
  scrollWheelZoomRef.current = scrollWheelZoom;

  const placesRef = useRef(places);
  placesRef.current = places;

  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  // Initialize Map exactly once on mount
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    let cancelled = false;

    const initializeMap = async () => {
      const L = await import("leaflet");
      if (cancelled || !mapContainer.current || map.current) return;

      leaflet.current = L;

      // Clean up container if it was previously used by Leaflet (avoids "Map container already initialized" crash)
      if (mapContainer.current) {
        const container = mapContainer.current as any;
        if (container._leaflet_id) {
          delete container._leaflet_id;
        }
        container.innerHTML = "";
      }

      const initialLat = userLocation?.latitude ?? PUNE_CENTER.latitude;
      const initialLng = userLocation?.longitude ?? PUNE_CENTER.longitude;

      const nextMap = L.map(mapContainer.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: scrollWheelZoomRef.current,
        dragging: true,
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

      nextMap.on("moveend", () => {
        const center = nextMap.getCenter();
        onCenterChange?.({ latitude: center.lat, longitude: center.lng });
        
        const bounds = nextMap.getBounds();
        onBoundsChange?.({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast(),
        });
      });

      nextMap.on("click", (e: any) => {
        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        
        let closestPlace: Place | null = null;
        let minDistance = 0.25; // 250 meters threshold
        
        for (const place of placesRef.current) {
          const dist = calculateDistance(clickLat, clickLng, place.latitude, place.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            closestPlace = place;
          }
        }
        
        if (closestPlace) {
          onMarkerClickRef.current?.(closestPlace);
        } else {
          onMarkerClickRef.current?.(null);
        }
      });

      nextMap.on("zoomend", () => {
        setMapZoom(nextMap.getZoom());
      });

      L.control.zoom({ position: "bottomright" }).addTo(nextMap);

      const baseLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(nextMap);
      tileLayerRef.current = baseLayer;

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

        userLocationMarkerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
          icon: userIcon,
        })
          .addTo(nextMap)
          .bindPopup("<b>Your location</b>");
      }

      // Call invalidateSize at multiple intervals to handle CSS transitions / flex layout settling
      window.setTimeout(() => map.current?.invalidateSize(), 120);
      window.setTimeout(() => map.current?.invalidateSize(), 400);
      window.setTimeout(() => map.current?.invalidateSize(), 800);

      // Watch container size changes (e.g. sidebar panel open/close)
      if (mapContainer.current && typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => {
          map.current?.invalidateSize();
        });
        ro.observe(mapContainer.current);
        (mapContainer.current as HTMLDivElement & { _ro?: ResizeObserver })._ro = ro;
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
       const container = mapContainer.current as (HTMLDivElement & { _ro?: ResizeObserver }) | null;
      if (container?._ro) {
        container._ro.disconnect();
        delete container._ro;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      if (polylinesRef.current) {
        polylinesRef.current.forEach(p => p.remove());
        polylinesRef.current = [];
      }
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
    };
  }, []);

  // Update user location marker and pan/fly to position on changes
  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L || !userLocation) return;

    if (userLocationMarkerRef.current) {
      userLocationMarkerRef.current.remove();
      userLocationMarkerRef.current = null;
    }

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

    userLocationMarkerRef.current = L.marker([userLocation.latitude, userLocation.longitude], {
      icon: userIcon,
    })
      .addTo(map.current)
      .bindPopup("<b>Your location</b>");

    const lastFlown = lastFlownLocationRef.current;
    const isSameLocation = lastFlown && 
      lastFlown.latitude === userLocation.latitude && 
      lastFlown.longitude === userLocation.longitude;

    if (!isSameLocation) {
      lastFlownLocationRef.current = { latitude: userLocation.latitude, longitude: userLocation.longitude };
      map.current.flyTo([userLocation.latitude, userLocation.longitude], Math.max(map.current.getZoom(), 13), {
        duration: 0.85,
      });
    }
  }, [userLocation]);


  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L) return;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    const renderSinglePlaceMarker = (place: Place, isSelected: boolean) => {
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

      // Check if we have day color-coding
      let dayNumber: number | null = null;
      if (tripItinerary) {
        for (const [day, dayPlaces] of Object.entries(tripItinerary)) {
          if (dayPlaces.some(p => p.id === place.id)) {
            dayNumber = parseInt(day);
            break;
          }
        }
      }

      const dayColors: Record<number, string> = {
        1: "#0d9488", // Teal
        2: "#db2777", // Pink/Rose
        3: "#0284c7", // Sky
        4: "#d97706", // Amber
      };

      const dayGlowColors: Record<number, string> = {
        1: "rgba(13, 148, 136, 0.5)",
        2: "rgba(219, 39, 119, 0.5)",
        3: "rgba(2, 132, 199, 0.5)",
        4: "rgba(217, 119, 6, 0.5)",
      };

      if (dayNumber !== null) {
        color = dayColors[dayNumber] || color;
        glowColor = dayGlowColors[dayNumber] || glowColor;
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
            ${dayNumber !== null ? `
              <div style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:999px;background:#0f172a;border:1.5px solid #fff;color:#fff;font-size:9px;font-weight:900;display:grid;place-items:center;z-index:10;box-shadow:0 2px 6px rgba(0,0,0,0.3);">
                D${dayNumber}
              </div>
            ` : ""}
          </div>
        `,
        iconSize: isSelected ? [44, 44] : [36, 36],
        iconAnchor: isSelected ? [22, 22] : [18, 18],
        className: "",
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon: markerIcon,
        bubblingMouseEvents: false,
      })
        .addTo(map.current!)
        .bindPopup(`
          <div style="padding:6px 2px;min-width:160px;">
            <b>${place.title}</b><br/>
            ${getCategoryLabel(place.category, place.tags)} - ${formatDistance(place.distance)}
          </div>
        `)
        .bindTooltip(`
          <div class="font-black text-[10px] leading-tight text-white flex items-center gap-1">
            <span>${place.title}</span>
            <span class="text-amber-400 font-bold shrink-0">★${place.rating}</span>
          </div>
        `, {
          direction: "top",
          offset: [0, -14],
          opacity: 0.96,
          className: "custom-map-tooltip",
        });

      marker.on("click", () => {
        onMarkerClick?.(place);
      });

      markersRef.current[place.id] = marker;
    };

    const renderClusterMarker = (cluster: { center: [number, number]; places: Place[] }, index: number) => {
      const count = cluster.places.length;
      
      const markerIcon = L.divIcon({
        html: `
          <div style="position:relative;display:grid;place-items:center;width:40px;height:40px;">
            <div class="marker-pulse-glow" style="position:absolute;width:100%;height:100%;border-radius:999px;--pulse-color-glow:rgba(45,212,191,0.45);"></div>
            <div style="display:grid;place-items:center;width:100%;height:100%;border-radius:999px;background:#0f172a;border:2.5px solid #2dd4bf;box-shadow:0 6px 16px rgba(0,0,0,.5);color:#2dd4bf;font-weight:900;font-size:13px;">
              ${count}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        className: "",
      });

      const clusterPopupHtml = `
        <div style="padding:8px 6px;min-width:190px;color:#f8fafc;font-family:inherit;background:#0f172a;border-radius:8px;">
          <b style="color:#2dd4bf;font-size:12px;display:block;margin-bottom:6px;border-bottom:1px solid rgba(45,212,191,0.2);padding-bottom:4px;">${count} Spots in this area</b>
          <div style="margin:4px 0 6px 0;max-height:140px;overflow-y:auto;padding-right:2px;">
            ${cluster.places.map((p) => `
              <div style="margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:4px;cursor:pointer;" onclick="window._onClusterItemClick?.('${p.id}')">
                <div style="font-weight:800;font-size:11px;color:#f1f5f9;">${p.title}</div>
                <div style="font-size:9px;color:#94a3b8;margin-top:1px;">${getCategoryLabel(p.category, p.tags)} · ${formatDistance(p.distance)}</div>
              </div>
            `).join("")}
          </div>
          <div style="font-size:9px;color:#94a3b8;font-weight:700;text-align:center;margin-top:4px;">Click marker to zoom in 🔍</div>
        </div>
      `;

      // Expose a global callback for cluster items selection if clicked in popup
      if (typeof window !== "undefined") {
        (window as any)._onClusterItemClick = (placeId: string) => {
          const matchedPlace = cluster.places.find(p => p.id === placeId);
          if (matchedPlace) {
            onMarkerClick?.(matchedPlace);
          }
        };
      }

      const marker = L.marker(cluster.center, {
        icon: markerIcon,
        bubblingMouseEvents: false,
      })
        .addTo(map.current!)
        .bindPopup(clusterPopupHtml, {
          className: "cluster-popup",
          maxWidth: 240,
        })
        .bindTooltip(`
          <div class="font-black text-[10px] leading-tight text-cyan-300">
            ${count} spots here
          </div>
        `, {
          direction: "top",
          offset: [0, -12],
          opacity: 0.96,
          className: "custom-map-tooltip",
        });

      marker.on("click", () => {
        map.current?.flyTo(cluster.center, Math.min(map.current.getZoom() + 2, 18), {
          duration: 0.5,
        });
      });

      markersRef.current[`cluster-${index}`] = marker;
    };

    // Calculate proximity clustering
    let clusterRadius = 0;
    if (mapZoom < 10) clusterRadius = 0.08;
    else if (mapZoom === 10) clusterRadius = 0.04;
    else if (mapZoom === 11) clusterRadius = 0.025;
    else if (mapZoom === 12) clusterRadius = 0.015;
    else if (mapZoom === 13) clusterRadius = 0.008;
    else if (mapZoom === 14) clusterRadius = 0.004;
    else if (mapZoom === 15) clusterRadius = 0.002;
    else if (mapZoom === 16) clusterRadius = 0.0008;
    else if (mapZoom >= 17) clusterRadius = 0.0002;

    const placesToCluster = selectedPlace
      ? places.filter((p) => p.id !== selectedPlace.id)
      : places;

    const clusters: { center: [number, number]; places: Place[] }[] = [];

    placesToCluster.forEach((place) => {
      let found = false;
      for (const cluster of clusters) {
        const [lat, lng] = cluster.center;
        const dx = place.longitude - lng;
        const dy = place.latitude - lat;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < clusterRadius) {
          cluster.places.push(place);
          const count = cluster.places.length;
          cluster.center = [
            (lat * (count - 1) + place.latitude) / count,
            (lng * (count - 1) + place.longitude) / count,
          ];
          found = true;
          break;
        }
      }

      if (!found) {
        clusters.push({
          center: [place.latitude, place.longitude],
          places: [place],
        });
      }
    });

    // Render clusters
    clusters.forEach((cluster, idx) => {
      if (cluster.places.length === 1) {
        renderSinglePlaceMarker(cluster.places[0], false);
      } else {
        renderClusterMarker(cluster, idx);
      }
    });

    // Render selected place individually if present
    if (selectedPlace) {
      const matched = places.find((p) => p.id === selectedPlace.id);
      if (matched) {
        renderSinglePlaceMarker(matched, true);
      }
    }
  }, [places, selectedPlace, onMarkerClick, mapZoom, tripItinerary]);

  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L) return;

    let isCancelled = false;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (!selectedPlace) {
      lastFlownSelectedPlaceRef.current = null;
      return;
    }

    if (tripMode) return;

    if (lastFlownSelectedPlaceRef.current !== selectedPlace.id) {
      lastFlownSelectedPlaceRef.current = selectedPlace.id;
      map.current.flyTo([selectedPlace.latitude, selectedPlace.longitude], Math.max(map.current.getZoom(), 15), {
        duration: 0.7,
      });
    }

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

    // Clear existing single polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Clear existing multi polylines
    if (polylinesRef.current) {
      polylinesRef.current.forEach(p => p.remove());
      polylinesRef.current = [];
    }

    // If tripItinerary is provided, draw color-coded paths for each day
    if (tripItinerary) {
      const dayColors: Record<number, string> = {
        1: "#0d9488", // Teal
        2: "#db2777", // Pink/Rose
        3: "#0284c7", // Sky
        4: "#d97706", // Amber
      };

      const allPoints: [number, number][] = [];

      Object.entries(tripItinerary).forEach(([day, dayPlaces]) => {
        if (!dayPlaces || dayPlaces.length < 2) return;
        const dayNum = parseInt(day);
        const color = dayColors[dayNum] || "#38bdf8";

        const points: [number, number][] = dayPlaces.map(p => {
          allPoints.push([p.latitude, p.longitude]);
          return [p.latitude, p.longitude];
        });

        const polyline = L.polyline(points, {
          color: color,
          weight: 5.5,
          className: "glowing-polyline",
          dashArray: "12, 6"
        }).addTo(map.current!);

        polylinesRef.current.push(polyline);
      });

      if (allPoints.length > 0) {
        try {
          const bounds = L.latLngBounds(allPoints);
          map.current.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) {
          console.warn("fitBounds failed:", e);
        }
      }
      return;
    }

    // Fallback to single path
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
  }, [tripRoutePath, tripItinerary]);

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

  // Swap map tiles when style is toggled
  useEffect(() => {
    if (!map.current || !leaflet.current || !tileLayerRef.current) return;
    const L = leaflet.current;
    
    // Remove current tile layer
    tileLayerRef.current.remove();
    
    // Create new tile layer based on mapStyle selection
    if (mapStyle === "satellite") {
      tileLayerRef.current = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        attribution: "&copy; Google Maps Satellite",
        maxZoom: 19,
      }).addTo(map.current);
    } else {
      tileLayerRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map.current);
    }
  }, [mapStyle]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl", className)}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42 }}
        ref={mapContainer}
        className="h-full w-full"
      />
      
      {/* Floating Style Toggle Overlay — positioned bottom-left to avoid clashing with page-level top-left buttons */}
      <div className="absolute left-4 bottom-8 z-[9999] flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-1 shadow-2xl select-none">
        <button
          type="button"
          onClick={() => setMapStyle("classic")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer",
            mapStyle === "classic"
              ? "bg-teal-400 text-slate-950 shadow-md font-black"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          🌌 Classic
        </button>
        <button
          type="button"
          onClick={() => setMapStyle("satellite")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer",
            mapStyle === "satellite"
              ? "bg-teal-400 text-slate-950 shadow-md font-black"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          )}
        >
          🌍 Satellite Earth
        </button>
      </div>
    </div>
  );
};

