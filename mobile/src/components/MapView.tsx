import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
export interface MapPlace {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  locality?: string;
  category?: string;
  description?: string;
}

interface MapViewProps {
  places: MapPlace[];
  userLocation?: { latitude: number; longitude: number } | null;
  routePath?: { latitude: number; longitude: number }[] | null;
  style?: any;
}

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0f172a" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#cbd5e1" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#2dd4bf" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#020617" }] }
];

export default function AppMapView({ places, userLocation, routePath, style }: MapViewProps) {
  const mapRef = useRef<MapView>(null);

  // Automatically center and fit map boundaries to show all markers/coordinates
  useEffect(() => {
    if (!mapRef.current || places.length === 0) return;

    const coords = places.map(p => ({
      latitude: p.latitude,
      longitude: p.longitude
    }));

    if (userLocation) {
      coords.push({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude
      });
    }

    if (routePath && routePath.length > 0) {
      coords.push(...routePath);
    }

    // Small delay to ensure layout is ready
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 200);
  }, [places, userLocation, routePath]);

  // Fallback initial region centering on first place or Pune
  const initialRegion = places[0]
    ? {
        latitude: places[0].latitude,
        longitude: places[0].longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : {
        latitude: 18.5204,
        longitude: 73.8567,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        customMapStyle={darkMapStyle}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={!!userLocation}
      >
        {/* Draw Path Polyline */}
        {routePath && routePath.length > 1 && (
          <Polyline
            coordinates={routePath}
            strokeColor="#2dd4bf"
            strokeWidth={3.5}
            lineDashPattern={[0]}
          />
        )}

        {/* Render Markers for Places */}
        {places.map((place, idx) => {
          const isStart = idx === 0 && places.length > 1;
          const isEnd = idx === places.length - 1 && places.length > 1;
          
          return (
            <Marker
              key={`${place.id}-${idx}`}
              coordinate={{ latitude: place.latitude, longitude: place.longitude }}
              title={place.title}
              description={place.locality}
            >
              {/* Sleek Custom Marker Pin */}
              <View style={[
                styles.markerCircle,
                isStart && styles.startMarker,
                isEnd && styles.endMarker
              ]}>
                <Text style={styles.markerText}>
                  {places.length > 1 ? idx + 1 : "📍"}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#020617",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  markerCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 2,
    borderColor: "#2dd4bf",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  startMarker: {
    borderColor: "#f59e0b", // Yellow for start
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  endMarker: {
    borderColor: "#ef4444", // Red for end
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  markerText: {
    color: "#f8fafc",
    fontSize: 10,
    fontWeight: "900",
  },
});
