import { UserLocation } from "@/types";

export type SupportedCityName =
  | "Pune"
  | "Mumbai"
  | "Kolhapur"
  | "Nashik"
  | "Bangalore"
  | "Chennai"
  | "Delhi"
  | "CherryHill"
  | "Hyderabad"
  | "Kolkata"
  | "Ahmedabad"
  | "Jaipur"
  | "Lucknow"
  | "Kochi"
  | "Panaji"
  | "Chandigarh"
  | "Udaipur"
  | "Agra"
  | "Varanasi"
  | "Amritsar"
  | "Surat"
  | "Patna"
  | "Bhubaneswar"
  | "Visakhapatnam"
  | "Indore"
  | "Nagpur"
  | "Guwahati"
  | "Coimbatore"
  | "Mysore"
  | "Dehradun"
  | "Shimla"
  | "Srinagar"
  | "Pondicherry"
  | "HubliDharwad"
  | "PunePCMC"
  | "BangaloreMysore"
  | "IndoreUjjain"
  | "HyderabadSecunderabad";

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
  Bangalore: { latitude: 12.9716, longitude: 77.5946, accuracy: 50 },
  Chennai: { latitude: 13.0827, longitude: 80.2707, accuracy: 50 },
  CherryHill: { latitude: 40.0155, longitude: -74.9310, accuracy: 50 },
  Delhi: { latitude: 28.6139, longitude: 77.2090, accuracy: 50 },
  Hyderabad: { latitude: 17.3850, longitude: 78.4867, accuracy: 50 },
  Kolkata: { latitude: 22.5726, longitude: 88.3639, accuracy: 50 },
  Ahmedabad: { latitude: 23.0225, longitude: 72.5714, accuracy: 50 },
  Jaipur: { latitude: 26.9124, longitude: 75.7873, accuracy: 50 },
  Lucknow: { latitude: 26.8467, longitude: 80.9462, accuracy: 50 },
  Kochi: { latitude: 9.9312, longitude: 76.2673, accuracy: 50 },
  Panaji: { latitude: 15.4909, longitude: 73.8278, accuracy: 50 },
  Chandigarh: { latitude: 30.7333, longitude: 76.7794, accuracy: 50 },
  Udaipur: { latitude: 24.5854, longitude: 73.7125, accuracy: 50 },
  Agra: { latitude: 27.1767, longitude: 78.0081, accuracy: 50 },
  Varanasi: { latitude: 25.3176, longitude: 82.9739, accuracy: 50 },
  Amritsar: { latitude: 31.6340, longitude: 74.8723, accuracy: 50 },
  Surat: { latitude: 21.1702, longitude: 72.8311, accuracy: 50 },
  Patna: { latitude: 25.5941, longitude: 85.1376, accuracy: 50 },
  Bhubaneswar: { latitude: 20.2961, longitude: 85.8245, accuracy: 50 },
  Visakhapatnam: { latitude: 17.6868, longitude: 83.2185, accuracy: 50 },
  Indore: { latitude: 22.7196, longitude: 75.8577, accuracy: 50 },
  Nagpur: { latitude: 21.1458, longitude: 79.0882, accuracy: 50 },
  Guwahati: { latitude: 26.1445, longitude: 91.7362, accuracy: 50 },
  Coimbatore: { latitude: 11.0168, longitude: 76.9558, accuracy: 50 },
  Mysore: { latitude: 12.2958, longitude: 76.6394, accuracy: 50 },
  Dehradun: { latitude: 30.3165, longitude: 78.0322, accuracy: 50 },
  Shimla: { latitude: 31.1048, longitude: 77.1734, accuracy: 50 },
  Srinagar: { latitude: 34.0837, longitude: 74.7973, accuracy: 50 },
  Pondicherry: { latitude: 11.9416, longitude: 79.8083, accuracy: 50 },
  // Twin Cities (centroids)
  HubliDharwad: { latitude: 15.4118, longitude: 75.0659, accuracy: 50 },
  PunePCMC: { latitude: 18.5751, longitude: 73.8282, accuracy: 50 },
  BangaloreMysore: { latitude: 12.6337, longitude: 77.1170, accuracy: 50 },
  IndoreUjjain: { latitude: 22.9478, longitude: 75.8231, accuracy: 50 },
  HyderabadSecunderabad: { latitude: 17.4125, longitude: 78.4925, accuracy: 50 },
};

export const CITY_BOUNDS: Record<
  SupportedCityName,
  {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  }
> = {
  Pune: { minLatitude: 18.40, maxLatitude: 18.68, minLongitude: 73.68, maxLongitude: 74.05 },
  Mumbai: { minLatitude: 18.88, maxLatitude: 19.32, minLongitude: 72.75, maxLongitude: 73.10 },
  Kolhapur: { minLatitude: 16.58, maxLatitude: 16.82, minLongitude: 74.12, maxLongitude: 74.36 },
  Nashik: { minLatitude: 19.86, maxLatitude: 20.12, minLongitude: 73.66, maxLongitude: 73.92 },
  Bangalore: { minLatitude: 12.75, maxLatitude: 13.20, minLongitude: 77.35, maxLongitude: 77.85 },
  Chennai: { minLatitude: 12.85, maxLatitude: 13.30, minLongitude: 80.05, maxLongitude: 80.40 },
  CherryHill: { minLatitude: 39.90, maxLatitude: 40.15, minLongitude: -75.10, maxLongitude: -74.80 },
  Delhi: { minLatitude: 28.35, maxLatitude: 28.90, minLongitude: 76.80, maxLongitude: 77.55 },
  Hyderabad: { minLatitude: 17.18, maxLatitude: 17.58, minLongitude: 78.28, maxLongitude: 78.68 },
  Kolkata: { minLatitude: 22.37, maxLatitude: 22.77, minLongitude: 88.16, maxLongitude: 88.56 },
  Ahmedabad: { minLatitude: 22.82, maxLatitude: 23.22, minLongitude: 72.37, maxLongitude: 72.77 },
  Jaipur: { minLatitude: 26.71, maxLatitude: 27.11, minLongitude: 75.58, maxLongitude: 75.98 },
  Lucknow: { minLatitude: 26.64, maxLatitude: 27.04, minLongitude: 80.74, maxLongitude: 81.14 },
  Kochi: { minLatitude: 9.73, maxLatitude: 10.13, minLongitude: 76.06, maxLongitude: 76.46 },
  Panaji: { minLatitude: 15.29, maxLatitude: 15.69, minLongitude: 73.62, maxLongitude: 74.02 },
  Chandigarh: { minLatitude: 30.53, maxLatitude: 30.93, minLongitude: 76.57, maxLongitude: 76.97 },
  Udaipur: { minLatitude: 24.38, maxLatitude: 24.78, minLongitude: 73.51, maxLongitude: 73.91 },
  Agra: { minLatitude: 26.97, maxLatitude: 27.37, minLongitude: 77.80, maxLongitude: 78.20 },
  Varanasi: { minLatitude: 25.11, maxLatitude: 25.51, minLongitude: 82.77, maxLongitude: 83.17 },
  Amritsar: { minLatitude: 31.43, maxLatitude: 31.83, minLongitude: 74.67, maxLongitude: 75.07 },
  Surat: { minLatitude: 20.97, maxLatitude: 21.37, minLongitude: 72.63, maxLongitude: 73.03 },
  Patna: { minLatitude: 25.39, maxLatitude: 25.79, minLongitude: 84.93, maxLongitude: 85.33 },
  Bhubaneswar: { minLatitude: 20.09, maxLatitude: 20.49, minLongitude: 85.62, maxLongitude: 86.02 },
  Visakhapatnam: { minLatitude: 17.48, maxLatitude: 17.88, minLongitude: 83.01, maxLongitude: 83.41 },
  Indore: { minLatitude: 22.51, maxLatitude: 22.91, minLongitude: 75.65, maxLongitude: 76.05 },
  Nagpur: { minLatitude: 20.94, maxLatitude: 21.34, minLongitude: 78.88, maxLongitude: 79.28 },
  Guwahati: { minLatitude: 25.94, maxLatitude: 26.34, minLongitude: 91.53, maxLongitude: 91.93 },
  Coimbatore: { minLatitude: 10.81, maxLatitude: 11.21, minLongitude: 76.75, maxLongitude: 77.15 },
  Mysore: { minLatitude: 12.09, maxLatitude: 12.49, minLongitude: 76.43, maxLongitude: 76.83 },
  Dehradun: { minLatitude: 30.11, maxLatitude: 30.51, minLongitude: 77.83, maxLongitude: 78.23 },
  Shimla: { minLatitude: 30.90, maxLatitude: 31.30, minLongitude: 76.97, maxLongitude: 77.37 },
  Srinagar: { minLatitude: 33.88, maxLatitude: 34.28, minLongitude: 74.59, maxLongitude: 74.99 },
  Pondicherry: { minLatitude: 11.74, maxLatitude: 12.14, minLongitude: 79.60, maxLongitude: 80.00 },
  // Twin Cities (merged bounds)
  HubliDharwad: { minLatitude: 15.30, maxLatitude: 15.52, minLongitude: 74.95, maxLongitude: 75.20 },
  PunePCMC: { minLatitude: 18.40, maxLatitude: 18.72, minLongitude: 73.65, maxLongitude: 74.05 },
  BangaloreMysore: { minLatitude: 12.09, maxLatitude: 13.20, minLongitude: 76.43, maxLongitude: 77.85 },
  IndoreUjjain: { minLatitude: 22.50, maxLatitude: 23.30, minLongitude: 75.60, maxLongitude: 76.10 },
  HyderabadSecunderabad: { minLatitude: 17.18, maxLatitude: 17.60, minLongitude: 78.28, maxLongitude: 78.70 },
};

export const SUPPORTED_CITY_NAMES = Object.keys(CITY_CENTERS) as SupportedCityName[];

export const CITY_DISPLAY_NAMES: Record<SupportedCityName, string> = {
  Pune: "Pune",
  Mumbai: "Mumbai",
  Kolhapur: "Kolhapur",
  Nashik: "Nashik",
  Bangalore: "Bangalore",
  Chennai: "Chennai",
  CherryHill: "Cherry Hill",
  Delhi: "Delhi",
  Hyderabad: "Hyderabad",
  Kolkata: "Kolkata",
  Ahmedabad: "Ahmedabad",
  Jaipur: "Jaipur",
  Lucknow: "Lucknow",
  Kochi: "Kochi",
  Panaji: "Panaji",
  Chandigarh: "Chandigarh",
  Udaipur: "Udaipur",
  Agra: "Agra",
  Varanasi: "Varanasi",
  Amritsar: "Amritsar",
  Surat: "Surat",
  Patna: "Patna",
  Bhubaneswar: "Bhubaneswar",
  Visakhapatnam: "Visakhapatnam",
  Indore: "Indore",
  Nagpur: "Nagpur",
  Guwahati: "Guwahati",
  Coimbatore: "Coimbatore",
  Mysore: "Mysore",
  Dehradun: "Dehradun",
  Shimla: "Shimla",
  Srinagar: "Srinagar",
  Pondicherry: "Pondicherry",
  HubliDharwad: "Hubli · Dharwad",
  PunePCMC: "Pune · PCMC",
  BangaloreMysore: "Bangalore · Mysore",
  IndoreUjjain: "Indore · Ujjain",
  HyderabadSecunderabad: "Hyderabad · Secunderabad",
};

export interface CityGroup {
  id: string;
  name: string;
  emoji: string;
  cities: SupportedCityName[];
}

export const CITY_GROUPS: CityGroup[] = [
  {
    id: "twins",
    name: "Twin & Satellite Cities",
    emoji: "🔀",
    cities: ["HubliDharwad", "PunePCMC", "BangaloreMysore", "IndoreUjjain", "HyderabadSecunderabad"]
  },
  {
    id: "metros",
    name: "Metros",
    emoji: "🏙️",
    cities: ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune"]
  },
  {
    id: "heritage",
    name: "Heritage & Cultural",
    emoji: "🏰",
    cities: ["Jaipur", "Udaipur", "Agra", "Varanasi", "Amritsar", "Lucknow", "Kolhapur", "Patna"]
  },
  {
    id: "coastal",
    name: "Coastal & Escapes",
    emoji: "🏖️",
    cities: ["Panaji", "Kochi", "Pondicherry", "Visakhapatnam"]
  },
  {
    id: "others",
    name: "Other Major Towns",
    emoji: "🏢",
    cities: [
      "Ahmedabad",
      "Nashik",
      "Chandigarh",
      "Surat",
      "Bhubaneswar",
      "Indore",
      "Nagpur",
      "Guwahati",
      "Coimbatore",
      "Mysore",
      "Dehradun",
      "Shimla",
      "Srinagar",
      "CherryHill"
    ]
  }
];

const CITY_ALIASES: Record<SupportedCityName, string[]> = {
  Pune: ["pune"],
  Mumbai: ["mumbai", "bombay"],
  Kolhapur: ["kolhapur"],
  Nashik: ["nashik", "nasik"],
  Bangalore: ["bangalore", "bengaluru", "blr"],
  Chennai: ["chennai", "madras"],
  CherryHill: ["cherryhill", "cherry hill"],
  Delhi: ["delhi", "new delhi", "ncr", "noida", "gurgaon"],
  Hyderabad: ["hyderabad", "hyd"],
  Kolkata: ["kolkata", "calcutta", "ccu"],
  Ahmedabad: ["ahmedabad", "amd"],
  Jaipur: ["jaipur", "jai"],
  Lucknow: ["lucknow", "lko"],
  Kochi: ["kochi", "cochin", "cok"],
  Panaji: ["panaji", "goa", "panjim"],
  Chandigarh: ["chandigarh", "ixc"],
  Udaipur: ["udaipur", "udr"],
  Agra: ["agra", "agr"],
  Varanasi: ["varanasi", "kashi", "banaras", "vns"],
  Amritsar: ["amritsar", "atq"],
  Surat: ["surat", "stv"],
  Patna: ["patna", "pat"],
  Bhubaneswar: ["bhubaneswar", "bbi"],
  Visakhapatnam: ["visakhapatnam", "vizag", "vtz"],
  Indore: ["indore", "idr"],
  Nagpur: ["nagpur", "nag"],
  Guwahati: ["guwahati", "gau"],
  Coimbatore: ["coimbatore", "cjb"],
  Mysore: ["mysore", "mysuru", "myq"],
  Dehradun: ["dehradun", "ded"],
  Shimla: ["shimla", "slm"],
  Srinagar: ["srinagar", "sxr"],
  Pondicherry: ["pondicherry", "puducherry", "pny"],
  HubliDharwad: ["hubli", "dharwad", "hubli dharwad", "hubli-dharwad", "hubli dharwar", "hbl"],
  PunePCMC: ["pcmc", "pimpri", "chinchwad", "pune pcmc", "pune-pcmc"],
  BangaloreMysore: ["bangalore mysore", "bangalore-mysore", "mysuru corridor"],
  IndoreUjjain: ["indore ujjain", "indore-ujjain", "ujjain"],
  HyderabadSecunderabad: ["secunderabad", "hyderabad secunderabad", "hyderabad-secunderabad"],
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

