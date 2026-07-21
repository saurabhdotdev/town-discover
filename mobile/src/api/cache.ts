import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEYS = {
  PLACES: "@sheher:cached_places",
  TRIPS: "@sheher:cached_trips",
  EVENTS: "@sheher:cached_events",
  HANGOUTS: "@sheher:cached_hangouts"
};

export async function saveCache(key: string, data: any): Promise<void> {
  try {
    if (data === null || data === undefined) return;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn("⚠️ Failed to save cache for key:", key, error);
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn("⚠️ Failed to read cache for key:", key, error);
    return null;
  }
}

// Named helpers
export const cachePlaces = (data: any) => saveCache(CACHE_KEYS.PLACES, data);
export const getCachedPlaces = () => getCache<any[]>(CACHE_KEYS.PLACES);

export const cacheTrips = (data: any) => saveCache(CACHE_KEYS.TRIPS, data);
export const getCachedTrips = () => getCache<any[]>(CACHE_KEYS.TRIPS);

export const cacheHangouts = (data: any) => saveCache(CACHE_KEYS.HANGOUTS, data);
export const getCachedHangouts = () => getCache<any[]>(CACHE_KEYS.HANGOUTS);
