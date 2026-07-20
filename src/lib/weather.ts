import { useState, useEffect } from "react";
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
  const isSummer = month >= 2 && month <= 4; // March - May
  const isMonsoon = month >= 5 && month <= 8; // June - Sept
  const isWinter = month >= 10 || month <= 1; // Nov - Feb

  if (city === "Srinagar") {
    if (isWinter) {
      condition = "Cozy";
      temp = seed % 2 === 0 ? 4 : 8;
      humidity = 85;
      windSpeed = 5;
      label = "Snowy & Cold";
      poeticNote = "Snow-covered peaks and chilly air. Perfect for Kahwa and cozy wood-fired lounges.";
    } else if (isSummer) {
      condition = "Pleasant";
      temp = seed % 2 === 0 ? 24 : 28;
      humidity = 50;
      windSpeed = 8;
      label = "Mild Cool Sun";
      poeticNote = "Warm sun and cool breezes. Excellent for Dal Lake shikara rides and Mughal gardens.";
    } else if (isMonsoon) {
      if (seed % 3 === 0) {
        condition = "Rainy";
        temp = 20;
        humidity = 80;
        windSpeed = 7;
        label = "Passing Showers";
        poeticNote = "Fresh rain showers washing the valley. Cozy up in a houseboat balcony.";
      } else {
        condition = "Pleasant";
        temp = 25;
        humidity = 60;
        windSpeed = 9;
        label = "Clear Sky";
        poeticNote = "Brilliant clear skies and crisp mountain air. Perfect for exploring town trails.";
      }
    } else {
      condition = "Cozy";
      temp = 14;
      humidity = 65;
      windSpeed = 6;
      label = "Chilly Autumn";
      poeticNote = "Golden chinar leaves and crisp chilly evenings. Perfect for outdoor walks.";
    }
  } else if (city === "Chennai") {
    const isChennaiMonsoon = month >= 9 && month <= 11; // Oct - Dec
    if (isChennaiMonsoon) {
      if (seed % 2 === 0) {
        condition = "Rainy";
        temp = 26;
        humidity = 90;
        windSpeed = 22;
        label = "Heavy Rain";
        poeticNote = "Heavy coastal monsoon showers. Cozy up inside a specialty south Indian coffee cafe.";
      } else {
        condition = "Pleasant";
        temp = 29;
        humidity = 80;
        windSpeed = 16;
        label = "Breezy Overcast";
        poeticNote = "Cool sea breeze and overcast skies. Great for warm filter coffee and chats.";
      }
    } else if (month >= 2 && month <= 5) {
      condition = "Hot";
      temp = seed % 2 === 0 ? 36 : 38;
      humidity = 75;
      windSpeed = 12;
      label = "Hot & Humid";
      poeticNote = "True Chennai summer heat. Cool down with tender coconut, fresh juices, or AC cafes.";
    } else {
      if (seed % 3 === 0) {
        condition = "Rainy";
        temp = 29;
        humidity = 85;
        windSpeed = 14;
        label = "Light Drizzle";
        poeticNote = "Refreshing evening drizzle cooling the city. Perfect for a walk around Mylapore.";
      } else {
        condition = "Hot";
        temp = seed % 2 === 0 ? 32 : 34;
        humidity = 70;
        windSpeed = 10;
        label = "Clear & Warm";
        poeticNote = "Warm clear day with a sea breeze. Best for indoor attractions or beach sunset walks.";
      }
    }
  } else if (city === "Bangalore") {
    if (isSummer) {
      condition = "Pleasant";
      temp = seed % 2 === 0 ? 28 : 31;
      humidity = 55;
      windSpeed = 14;
      label = "Pleasant Sun";
      poeticNote = "Sunny but comfortable. Excellent for microbreweries and open-air cafes.";
    } else if (isMonsoon) {
      condition = seed % 2 === 0 ? "Rainy" : "Pleasant";
      temp = seed % 2 === 0 ? 21 : 24;
      humidity = 85;
      windSpeed = 18;
      label = seed % 2 === 0 ? "Drizzling" : "Overcast & Cool";
      poeticNote = seed % 2 === 0
        ? "Classic Bangalore drizzle. Grab a hot filter coffee and enjoy the green canopy."
        : "Overcast skies and cool winds. Perfect for exploring bookstores and cafes.";
    } else {
      condition = "Cozy";
      temp = seed % 2 === 0 ? 17 : 20;
      humidity = 60;
      windSpeed = 12;
      label = "Chilly Breezes";
      poeticNote = "Crisp chilly mornings and evenings. Perfect for outdoor garden strolls.";
    }
  } else if (city === "Mumbai") {
    if (isMonsoon) {
      if (seed % 3 !== 0) {
        condition = "Rainy";
        temp = 27;
        humidity = 95;
        windSpeed = 25;
        label = "Heavy Rain";
        poeticNote = "Vigorous Mumbai monsoon rain. Watch the waves at Marine Drive from a window seat.";
      } else {
        condition = "Pleasant";
        temp = 29;
        humidity = 85;
        windSpeed = 18;
        label = "Overcast & Humid";
        poeticNote = "Overcast skies. Perfect for piping hot cutting chai and vada pav runs.";
      }
    } else if (isSummer) {
      condition = "Hot";
      temp = seed % 2 === 0 ? 33 : 35;
      humidity = 80;
      windSpeed = 12;
      label = "Warm & Humid";
      poeticNote = "Humid summer sun. Cool down with gelato or a seaside drive.";
    } else {
      condition = "Pleasant";
      temp = seed % 2 === 0 ? 25 : 28;
      humidity = 70;
      windSpeed = 15;
      label = "Breezy Evening";
      poeticNote = "Mild winter breeze from the sea. Perfect for late-night street food strolls.";
    }
  } else if (city === "Delhi") {
    if (isWinter) {
      condition = "Cozy";
      temp = seed % 2 === 0 ? 9 : 12;
      humidity = 85;
      windSpeed = 6;
      label = "Foggy & Cold";
      poeticNote = "Classic Delhi winter fog. Perfect for hot parathas in Old Delhi and bonfire evenings.";
    } else if (isSummer) {
      condition = "Hot";
      temp = seed % 2 === 0 ? 41 : 44;
      humidity = 30;
      windSpeed = 10;
      label = "Scorching Sun";
      poeticNote = "Extreme summer heat. Stay indoors in air-conditioned cafes or lounges.";
    } else if (isMonsoon) {
      condition = seed % 2 === 0 ? "Rainy" : "Hot";
      temp = seed % 2 === 0 ? 29 : 34;
      humidity = 85;
      windSpeed = 12;
      label = seed % 2 === 0 ? "Heavy Rain" : "Humid & Sunny";
      poeticNote = "Monsoon showers washing the streets. Great time for hot jalebis.";
    } else {
      condition = "Pleasant";
      temp = 24;
      humidity = 55;
      windSpeed = 9;
      label = "Breezy & Clear";
      poeticNote = "Beautiful clear autumn weather. Ideal for monument walks and picnics.";
    }
  } else {
    if (isMonsoon) {
      if (seed % 2 === 0) {
        condition = "Rainy";
        temp = 24;
        humidity = 85;
        windSpeed = 16;
        label = "Moderate Rain";
        poeticNote = "Cozy rainy vibes. Perfect for a warm beverage and nice view inside a cafe.";
      } else {
        condition = "Pleasant";
        temp = 27;
        humidity = 75;
        windSpeed = 14;
        label = "Overcast & Cool";
        poeticNote = "Overcast skies with a cool breeze. Great for exploring the local streets.";
      }
    } else if (isSummer) {
      condition = "Hot";
      temp = seed % 2 === 0 ? 33 : 36;
      humidity = 40;
      windSpeed = 10;
      label = "Warm & Sunny";
      poeticNote = "The sun is out. Grab some ice cream or visit a cool indoor place.";
    } else if (isWinter) {
      condition = "Cozy";
      temp = seed % 2 === 0 ? 15 : 18;
      humidity = 55;
      windSpeed = 8;
      label = "Chilly Evening";
      poeticNote = "A cozy chilly evening. Ideal for bonfire cafes or dessert runs.";
    } else {
      condition = "Pleasant";
      temp = 26;
      humidity = 50;
      windSpeed = 11;
      label = "Clear & Breezy";
      poeticNote = "Perfect clear weather. Ideal for scenic drives and open-air rooftop views.";
    }
  }

  iconName = condition.toLowerCase();

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

export interface LiveWeatherState extends WeatherData {
  current: WeatherData;
  hourly: WeatherData[];
  getWeatherForHour: (hour: number) => WeatherData;
  loading: boolean;
}

export function useCityLiveWeather(city: SupportedCityName): LiveWeatherState {
  const [weather, setWeather] = useState<LiveWeatherState>(() => {
    const fallback = getCityWeather(city);
    const hourlyFallback: WeatherData[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const targetDate = new Date(now.getTime() + i * 60 * 60 * 1000);
      hourlyFallback.push(getCityWeather(city, targetDate));
    }
    return {
      ...fallback,
      current: fallback,
      hourly: hourlyFallback,
      getWeatherForHour: () => fallback,
      loading: true,
    };
  });

  useEffect(() => {
    const fallback = getCityWeather(city);
    const hourlyFallback: WeatherData[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const targetDate = new Date(now.getTime() + i * 60 * 60 * 1000);
      hourlyFallback.push(getCityWeather(city, targetDate));
    }
    
    setWeather({
      ...fallback,
      current: fallback,
      hourly: hourlyFallback,
      getWeatherForHour: () => fallback,
      loading: true,
    });

    let active = true;
    fetch(`/api/weather?city=${encodeURIComponent(city)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && !data.error) {
          const liveCurrent = data.current;
          const liveHourly = data.hourly || [];
          
          setWeather({
            ...liveCurrent,
            current: liveCurrent,
            hourly: liveHourly,
            getWeatherForHour: (hour: number) => {
              const now = new Date();
              const currentHour = now.getHours();
              let diff = hour - currentHour;
              if (diff < 0) diff += 24;
              return liveHourly[diff] || liveCurrent;
            },
            loading: false,
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch live weather, utilizing fallback:", err);
      });

    return () => {
      active = false;
    };
  }, [city]);

  return weather;
}
