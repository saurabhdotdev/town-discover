// src/app/api/weather/route.ts

import { NextRequest } from "next/server";
import { SupportedCityName, CITY_CENTERS } from "@/lib/pune-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WeatherData {
  condition: "Pleasant" | "Rainy" | "Hot" | "Cozy";
  temp: number;
  humidity: number;
  windSpeed: number;
  label: string;
  poeticNote: string;
  iconName: string;
}

function mapToWeatherData(temp: number, humidity: number, windSpeed: number, code: number): WeatherData {
  let condition: "Pleasant" | "Rainy" | "Hot" | "Cozy" = "Pleasant";
  let label = "Pleasant";
  let poeticNote = "Pleasant weather to explore the town.";

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) {
    condition = "Rainy";
    label = code >= 95 ? "Thunderstorm" : "Rainy";
    poeticNote = "Cozy rainy weather. Perfect for a hot cup of tea or reading inside a specialty cafe.";
  } else if (temp >= 32) {
    condition = "Hot";
    label = "Hot & Sunny";
    poeticNote = "The sun is out. Ideal time for cold gelato, air-conditioned lounges, or indoor cafes.";
  } else if (temp <= 18 || [45, 48, 71, 73, 75, 77, 85, 86].includes(code)) {
    condition = "Cozy";
    label = code >= 71 ? "Snowy / Cold" : "Chilly";
    poeticNote = "A cozy, chilly vibe. Perfect for outdoor bonfire cafes or late-night dessert runs.";
  } else {
    condition = "Pleasant";
    label = "Overcast & Cool";
    poeticNote = "Perfect clear weather. Ideal for scenic drives and open-air rooftop views.";
  }

  return {
    condition,
    temp,
    humidity,
    windSpeed,
    label,
    poeticNote,
    iconName: condition.toLowerCase(),
  };
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") as SupportedCityName;
  if (!city || !CITY_CENTERS[city]) {
    return Response.json({ error: "Unsupported or missing city." }, { status: 400 });
  }

  const { latitude, longitude } = CITY_CENTERS[city];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&forecast_days=2&timezone=Asia/Kolkata`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch from weather provider.");
    }

    const data = await response.json() as any;
    const current = data.current;
    const hourly = data.hourly;
    if (!current || !hourly) {
      throw new Error("Weather data not found in response.");
    }

    const currentData = mapToWeatherData(
      Number(current.temperature_2m),
      Number(current.relative_humidity_2m),
      Number(current.wind_speed_10m),
      Number(current.weather_code)
    );

    // Get current hour in local Indian timezone (IST) to match with the timezone=Asia/Kolkata response from Open-Meteo
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    let hour = getPart("hour");

    // Standard hours formatter can output 24 instead of 00 under some standard environments
    if (hour === "24") hour = "00";

    const currentHourISO = `${year}-${month}-${day}T${hour}:00`;
    
    let startIndex = hourly.time.findIndex((t: string) => t.startsWith(currentHourISO));
    if (startIndex === -1) {
      startIndex = 0; // fallback to start of array
    }

    const hourlyData: WeatherData[] = [];
    for (let i = 0; i < 24; i++) {
      const idx = startIndex + i;
      if (hourly.time[idx]) {
        hourlyData.push(
          mapToWeatherData(
            Number(hourly.temperature_2m[idx]),
            Number(hourly.relative_humidity_2m[idx]),
            Number(hourly.wind_speed_10m[idx]),
            Number(hourly.weather_code[idx])
          )
        );
      } else {
        hourlyData.push(currentData);
      }
    }

    return Response.json({
      current: currentData,
      hourly: hourlyData,
    });
  } catch (error: any) {
    console.error(`Error fetching weather for ${city}:`, error);
    return Response.json(
      { error: "Failed to fetch weather.", details: error.message },
      { status: 500 }
    );
  }
}
