import { SupportedCityName } from "@/lib/pune-location";
import { Place } from "@/types";

export type WeatherCondition = "Pleasant" | "Rainy" | "Hot" | "Cozy";

export interface WeatherData {
  condition: WeatherCondition;
  temp: number;
  humidity: number;
  windSpeed: number;
  label: string;
  poeticNote: string;
  iconName: string;
}

// Generate weather based on a deterministic logic (city + current date + hour)
// This ensures that the weather updates dynamically but is consistent on refresh for a given hour
export function getCityWeather(city: SupportedCityName, date = new Date()): WeatherData {
  const hour = date.getHours();
  const day = date.getDate();
  const month = date.getMonth(); // 0-11
  
  // Create a pseudo-random seed based on city, day, and hour
  const seed = (city.charCodeAt(0) + city.charCodeAt(city.length - 1) + day + hour + month) % 4;

  let condition: WeatherCondition = "Pleasant";
  let temp = 24;
  let humidity = 60;
  let windSpeed = 12;
  let poeticNote = "Pleasant weather to explore the town.";
  let label = "Pleasant";
  let iconName = "pleasant";

  // Season-based biases
  const isMonsoon = month >= 5 && month <= 8; // June - Sept
  const isSummer = month >= 2 && month <= 4; // March - May
  const isWinter = month >= 10 || month <= 1; // Nov - Feb

  if (isMonsoon) {
    if (seed % 2 === 0) {
      condition = "Rainy";
      temp = 23;
      humidity = 88;
      windSpeed = 18;
      label = "Heavy Drizzle";
      poeticNote = "Cozy rainy weather. Perfect for a hot cup of tea or reading inside a specialty cafe.";
      iconName = "rainy";
    } else {
      condition = "Pleasant";
      temp = 26;
      humidity = 70;
      windSpeed = 14;
      label = "Overcast & Cool";
      poeticNote = "Overcast skies and cool winds. Great for warm street food strolls.";
      iconName = "pleasant";
    }
  } else if (isSummer) {
    if (seed % 3 !== 0) {
      condition = "Hot";
      temp = 34;
      humidity = 40;
      windSpeed = 8;
      label = "Warm & Sunny";
      poeticNote = "The sun is out. Ideal time for cold gelato, air-conditioned lounges, or indoor cafes.";
      iconName = "hot";
    } else {
      condition = "Pleasant";
      temp = 28;
      humidity = 45;
      windSpeed = 10;
      label = "Breezy Evening";
      poeticNote = "A warm but breezy afternoon. Cozy corner cafes or juice runs are a must.";
      iconName = "pleasant";
    }
  } else if (isWinter) {
    if (hour >= 18 || hour < 9) {
      condition = "Cozy";
      temp = 16;
      humidity = 55;
      windSpeed = 9;
      label = "Chilly Chills";
      poeticNote = "A cozy, chilly vibe. Perfect for outdoor bonfire cafes or late-night dessert runs.";
      iconName = "cozy";
    } else {
      condition = "Pleasant";
      temp = 22;
      humidity = 50;
      windSpeed = 11;
      label = "Mild Sunshine";
      poeticNote = "Bright mild sun. Excellent for heritage walks and city explore trails.";
      iconName = "pleasant";
    }
  } else {
    condition = "Pleasant";
    temp = 25;
    humidity = 52;
    windSpeed = 13;
    label = "Breezy & Perfect";
    poeticNote = "Perfect clear weather. Ideal for scenic drives and open-air rooftop views.";
    iconName = "pleasant";
  }

  // Adjust values based on specific cities for realism
  if (city === "Bangalore") {
    temp = Math.max(18, temp - 3);
    if (condition === "Hot") {
      temp = 29;
      label = "Pleasant Sun";
    }
  } else if (city === "Mumbai" || city === "Chennai") {
    humidity = Math.min(95, humidity + 15);
    temp = Math.max(22, temp + 2);
  } else if (city === "Delhi") {
    if (isSummer) {
      temp = Math.min(44, temp + 6);
    } else if (isWinter) {
      temp = Math.max(8, temp - 6);
    }
  }

  return {
    condition,
    temp,
    humidity,
    windSpeed,
    label,
    poeticNote,
    iconName,
  };
}

export function filterPlacesByWeather(places: Place[], condition: WeatherCondition): Place[] {
  return places.filter((p) => {
    const tags = p.tags.map((t) => t.toLowerCase());
    const title = p.title.toLowerCase();
    const desc = p.description.toLowerCase();
    const cat = p.category;

    if (condition === "Rainy") {
      return (
        ["cafe", "restaurant", "dessert"].includes(cat) &&
        (tags.some((t) =>
          ["indoor", "quiet", "cozy", "comfort-food", "bakery", "hot-beverage", "books", "workspace"].includes(t)
        ) ||
          title.includes("cafe") ||
          desc.includes("cozy") ||
          desc.includes("warm"))
      );
    }

    if (condition === "Hot") {
      return (
        tags.some((t) =>
          ["air-conditioned", "ac", "indoor", "ice-cream", "gelato", "cold-brews", "pool", "beverages"].includes(t)
        ) ||
        cat === "ice-cream" ||
        cat === "dessert" ||
        desc.includes("ac") ||
        desc.includes("gelato") ||
        desc.includes("refreshing")
      );
    }

    if (condition === "Cozy") {
      return (
        tags.some((t) =>
          ["night-drive", "viewpoint", "heritage", "cozy", "late-night", "comfort-food", "fireplace"].includes(t)
        ) ||
        cat === "event" ||
        cat === "bar" ||
        desc.includes("historic")
      );
    }

    // Pleasant
    return (
      tags.some((t) =>
        ["sunset", "viewpoint", "rooftop", "scenic", "outdoor", "sea-face", "lake", "walk", "garden", "nature"].includes(t)
      ) ||
      cat === "event" ||
      desc.includes("scenic") ||
      desc.includes("view") ||
      desc.includes("garden")
    );
  });
}
