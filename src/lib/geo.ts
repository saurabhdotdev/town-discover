export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface MetroStation {
  name: string;
  latitude: number;
  longitude: number;
}

const METRO_STATIONS: Record<string, MetroStation[]> = {
  Pune: [
    { name: "Deccan Gymkhana Metro", latitude: 18.5190, longitude: 73.8415 },
    { name: "PMC Metro Station", latitude: 18.5244, longitude: 73.8500 },
    { name: "Pune Railway Station Metro", latitude: 18.5289, longitude: 73.8744 },
    { name: "Garware College Metro", latitude: 18.5144, longitude: 73.8345 },
    { name: "Vanaz Metro Station", latitude: 18.5085, longitude: 73.8078 },
    { name: "Kalyani Nagar Metro", latitude: 18.5460, longitude: 73.9038 },
    { name: "Ramwadi Metro Station", latitude: 18.5532, longitude: 73.9142 },
    { name: "Civil Court Hub Metro", latitude: 18.5278, longitude: 73.8565 },
  ],
  Mumbai: [
    { name: "Ghatkopar Metro (L1)", latitude: 19.0863, longitude: 72.9080 },
    { name: "Andheri Metro Station (L1)", latitude: 19.1202, longitude: 72.8468 },
    { name: "Versova Metro Station (L1)", latitude: 19.1314, longitude: 72.8162 },
    { name: "Marol Naka Metro (L1)", latitude: 19.1118, longitude: 72.8752 },
    { name: "Saki Naka Metro Station (L1)", latitude: 19.1027, longitude: 72.8878 },
    { name: "Gundavali Metro Station (L7)", latitude: 19.1192, longitude: 72.8472 },
    { name: "CSMT Local Station", latitude: 18.9400, longitude: 72.8354 },
    { name: "Bandra Local Station", latitude: 19.0550, longitude: 72.8402 },
  ],
  Bangalore: [
    { name: "Indiranagar Metro (Purple)", latitude: 12.9784, longitude: 77.6408 },
    { name: "Halasuru Metro Station", latitude: 12.9754, longitude: 77.6272 },
    { name: "Trinity Metro Station", latitude: 12.9731, longitude: 77.6172 },
    { name: "Mahatma Gandhi Road Metro", latitude: 12.9754, longitude: 77.6067 },
    { name: "Cubbon Park Metro", latitude: 12.9794, longitude: 77.5997 },
    { name: "Majestic Interchange Metro", latitude: 12.9734, longitude: 77.5726 },
    { name: "JP Nagar Metro Station (Green)", latitude: 12.9079, longitude: 77.5746 },
    { name: "Jayanagar Metro Station", latitude: 12.9292, longitude: 77.5801 },
  ],
  Delhi: [
    { name: "Rajiv Chowk Metro (Blue/Yellow)", latitude: 28.6304, longitude: 77.2177 },
    { name: "Chandni Chowk Metro (Yellow)", latitude: 28.6578, longitude: 77.2300 },
    { name: "Central Secretariat Metro", latitude: 28.6149, longitude: 77.2114 },
    { name: "Hauz Khas Metro (Yellow/Magenta)", latitude: 28.5434, longitude: 77.2064 },
    { name: "Barakhamba Road Metro", latitude: 28.6294, longitude: 77.2238 },
    { name: "Dilli Haat INA Metro (Yellow/Pink)", latitude: 28.5744, longitude: 77.2100 },
    { name: "JLN Stadium Metro (Violet)", latitude: 28.5878, longitude: 77.2345 },
    { name: "Hazrat Nizamuddin RRTS/Metro", latitude: 28.5888, longitude: 77.2530 },
  ],
  Chennai: [
    { name: "Puratchi Thalaivar Dr. M.G. Ramachandran Central Metro", latitude: 13.0818, longitude: 80.2721 },
    { name: "Thousand Lights Metro (Blue)", latitude: 13.0612, longitude: 80.2520 },
    { name: "Egmore Metro Station", latitude: 13.0784, longitude: 80.2590 },
    { name: "Thirumayilai MRTS Station", latitude: 13.0334, longitude: 80.2701 },
    { name: "AG-DMS Metro Station", latitude: 13.0425, longitude: 80.2445 },
    { name: "Kasturba Nagar MRTS Station", latitude: 12.9978, longitude: 80.2520 },
  ],
};

export interface MetroAccessInfo {
  stationName: string;
  distanceKm: number;
  label: string;
  isWalkable: boolean;
}

export const getMetroAccess = (
  latitude: number,
  longitude: number,
  city: string
): MetroAccessInfo | null => {
  const stations = METRO_STATIONS[city];
  if (!stations || stations.length === 0) return null;

  let nearestStation: MetroStation | null = null;
  let minDistance = Number.MAX_VALUE;

  for (const station of stations) {
    const dist = calculateDistance(latitude, longitude, station.latitude, station.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestStation = station;
    }
  }

  if (!nearestStation || minDistance > 4.5) return null; // If more than 4.5km away, don't show metro info

  const roundedDistance = Math.round(minDistance * 10) / 10;
  const isWalkable = roundedDistance <= 1.0;
  const meterText = isWalkable ? `${Math.round(roundedDistance * 1000)}m` : `${roundedDistance} km`;
  const label = isWalkable
    ? `🚶 Walkable from ${nearestStation.name} (~${meterText})`
    : `🚇 Nearest transit: ${nearestStation.name} (~${meterText})`;

  return {
    stationName: nearestStation.name,
    distanceKm: roundedDistance,
    label,
    isWalkable,
  };
};
