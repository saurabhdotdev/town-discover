"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { Place, UserLocation } from "@/types";
import { motion } from "framer-motion";
import { cn, formatDistance, getCategoryLabel } from "@/lib/utils";
import { PUNE_CENTER } from "@/lib/pune-location";

interface MapProps {
  places: Place[];
  userLocation: UserLocation | null;
  selectedPlace?: Place | null;
  onMarkerClick?: (place: Place) => void;
  className?: string;
}

const categoryColor: Record<string, string> = {
  cafe: "#f59e0b",
  restaurant: "#f43f5e",
  event: "#38bdf8",
  nightlife: "#d946ef",
  "food-stall": "#eab308",
  bar: "#fb7185",
  dessert: "#14b8a6",
  "street-food": "#f97316",
};

export const MapView: React.FC<MapProps> = ({
  places,
  userLocation,
  selectedPlace,
  onMarkerClick,
  className,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef<Record<string, Leaflet.Marker>>({});

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
    };
  }, [userLocation]);

  useEffect(() => {
    const L = leaflet.current;
    if (!map.current || !L) return;

    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    places.forEach((place) => {
      const isSelected = selectedPlace?.id === place.id;
      const color = categoryColor[place.category] ?? "#94a3b8";
      const markerIcon = L.divIcon({
        html: `
          <div style="display:grid;place-items:center;width:${isSelected ? "42px" : "34px"};height:${isSelected ? "42px" : "34px"};border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 14px 28px rgba(0,0,0,.38);color:#111827;font-weight:900;font-size:13px;">
            ${place.category.slice(0, 1).toUpperCase()}
          </div>
        `,
        iconSize: isSelected ? [42, 42] : [34, 34],
        iconAnchor: isSelected ? [21, 21] : [17, 17],
        className: "",
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon: markerIcon,
      })
        .addTo(map.current!)
        .bindPopup(`
          <div style="padding:6px 2px;min-width:160px;">
            <b>${place.title}</b><br/>
            ${getCategoryLabel(place.category)} - ${formatDistance(place.distance)}
          </div>
        `);

      marker.on("click", () => {
        onMarkerClick?.(place);
      });

      markersRef.current[place.id] = marker;
    });
  }, [places, selectedPlace, onMarkerClick]);

  useEffect(() => {
    if (!selectedPlace || !map.current) return;
    map.current.flyTo([selectedPlace.latitude, selectedPlace.longitude], Math.max(map.current.getZoom(), 15), {
      duration: 0.7,
    });
  }, [selectedPlace]);

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
