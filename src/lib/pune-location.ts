import { UserLocation } from "@/types";

export type SupportedCityName = "Pune" | "Mumbai" | "Kolhapur" | "Nashik";

export const PUNE_CENTER: UserLocation = {
  latitude: 18.5204,
  longitude: 73.8567,
  accuracy: 50,
};

export const CITY_CENTERS: Record<SupportedCityName, UserLocation> = {
  Pune: PUNE_CENTER,
  Mumbai: { latitude: 19.076, longitude: 72.8777, accuracy: 50 },
  Kolhapur: { latitude: 16.705, longitude: 74.2433, accuracy: 50 },
  Nashik: { latitude: 19.9975, longitude: 73.7898, accuracy: 50 },
};

const CITY_BOUNDS: Record<
  SupportedCityName,
  {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  }
> = {
  Pune: {
    minLatitude: 18.40,
    maxLatitude: 18.68,
    minLongitude: 73.68,
    maxLongitude: 74.05,
  },
  Mumbai: {
    minLatitude: 18.88,
    maxLatitude: 19.32,
    minLongitude: 72.75,
    maxLongitude: 73.10,
  },
  Kolhapur: {
    minLatitude: 16.58,
    maxLatitude: 16.82,
    minLongitude: 74.12,
    maxLongitude: 74.36,
  },
  Nashik: {
    minLatitude: 19.86,
    maxLatitude: 20.12,
    minLongitude: 73.66,
    maxLongitude: 73.92,
  },
};

export const SUPPORTED_CITY_NAMES = Object.keys(CITY_CENTERS) as SupportedCityName[];

const CITY_ALIASES: Record<SupportedCityName, string[]> = {
  Pune: ["pune"],
  Mumbai: ["mumbai", "bombay"],
  Kolhapur: ["kolhapur"],
  Nashik: ["nashik", "nasik"],
};

export const getCityFromQuery = (query: string): SupportedCityName | null => {
  const normalized = query.toLowerCase();

  return (
    SUPPORTED_CITY_NAMES.find((city) =>
      CITY_ALIASES[city].some((alias) => new RegExp(`\\b${alias}\\b`, "i").test(normalized))
    ) ?? null
  );
};

export const stripCityFromQuery = (query: string): string => {
  const withoutCity = SUPPORTED_CITY_NAMES.reduce((current, city) => {
    return CITY_ALIASES[city].reduce(
      (next, alias) => next.replace(new RegExp(`\\b${alias}\\b`, "gi"), " "),
      current
    );
  }, query);

  return withoutCity.replace(/\b(in|near|around|at|city|places|place)\b/gi, " ").replace(/\s+/g, " ").trim();
};

export const isWithinPune = (location: Pick<UserLocation, "latitude" | "longitude">): boolean => {
  return getSupportedCity(location) === "Pune";
};

export const getPuneLocation = (location: UserLocation | null | undefined): UserLocation => {
  if (location && isWithinPune(location)) {
    return location;
  }

  return PUNE_CENTER;
};

export const getSupportedCity = (
  location: Pick<UserLocation, "latitude" | "longitude">
): SupportedCityName | null => {
  return (
    SUPPORTED_CITY_NAMES.find((city) => {
      const bounds = CITY_BOUNDS[city];
      return (
        location.latitude >= bounds.minLatitude &&
        location.latitude <= bounds.maxLatitude &&
        location.longitude >= bounds.minLongitude &&
        location.longitude <= bounds.maxLongitude
      );
    }) ?? null
  );
};

export const isWithinSupportedCity = (location: Pick<UserLocation, "latitude" | "longitude">): boolean => {
  return Boolean(getSupportedCity(location));
};

export const getSupportedCityLocation = (location: UserLocation | null | undefined): UserLocation => {
  if (location && isWithinSupportedCity(location)) {
    return location;
  }

  return PUNE_CENTER;
};

export const getNearestSupportedCity = (
  location: Pick<UserLocation, "latitude" | "longitude"> | null | undefined
): SupportedCityName => {
  if (!location) return "Pune";

  const exactCity = getSupportedCity(location);
  if (exactCity) return exactCity;

  return SUPPORTED_CITY_NAMES.reduce((nearest, city) => {
    const current = CITY_CENTERS[city];
    const best = CITY_CENTERS[nearest];
    const currentDistance = Math.hypot(location.latitude - current.latitude, location.longitude - current.longitude);
    const bestDistance = Math.hypot(location.latitude - best.latitude, location.longitude - best.longitude);

    return currentDistance < bestDistance ? city : nearest;
  }, "Pune" as SupportedCityName);
};
