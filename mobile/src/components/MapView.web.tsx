import React from "react";
import { StyleSheet, View, Text } from "react-native";
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

export default function AppMapViewWeb({ places, style }: MapViewProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Visual SVG Map Fallback Mockup */}
      <View style={styles.webFallbackContainer}>
        <Text style={styles.webFallbackTitle}>🗺️ Walk Route Preview</Text>
        
        {places.length > 0 ? (
          <View style={styles.routeContainer}>
            {places.map((place, idx) => (
              <View key={`${place.id}-${idx}`} style={styles.stopRow}>
                <View style={[
                  styles.stopBadge,
                  idx === 0 && styles.startBadge,
                  idx === places.length - 1 && styles.endBadge
                ]}>
                  <Text style={styles.badgeText}>{idx + 1}</Text>
                </View>
                <View style={styles.stopInfo}>
                  <Text style={styles.stopName} numberOfLines={1}>{place.title}</Text>
                  <Text style={styles.stopLocality} numberOfLines={1}>{place.locality}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.webFallbackText}>
            Select a start spot and budget to preview the walk map route.
          </Text>
        )}

        <Text style={styles.mobileDisclaimer}>
          Interactive maps are powered by native Google/Apple Maps on iOS & Android apps.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#090d16",
    borderWidth: 1,
    borderColor: "rgba(45, 212, 191, 0.1)",
  },
  webFallbackContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  webFallbackTitle: {
    color: "#2dd4bf",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  webFallbackText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    marginVertical: 20,
    fontWeight: "500",
  },
  routeContainer: {
    flex: 1,
    gap: 8,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.03)",
  },
  stopBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#2dd4bf",
  },
  startBadge: {
    borderColor: "#f59e0b",
  },
  endBadge: {
    borderColor: "#ef4444",
  },
  badgeText: {
    color: "#f8fafc",
    fontSize: 9,
    fontWeight: "900",
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "800",
  },
  stopLocality: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "500",
  },
  mobileDisclaimer: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.2,
    marginTop: 10,
  },
});
