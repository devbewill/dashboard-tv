import { config } from "./config";

export type Weather = {
  temperature: number;
  apparent: number;
  humidity: number;
  wind: number;
  description: string;
  min: number;
  max: number;
  precipitationChance: number;
  sunrise: string;
  sunset: string;
  updatedAt: string;
};

// Codici WMO → italiano (Open-Meteo li usa così come sono).
const WEATHER_CODES: Record<number, string> = {
  0: "Sereno",
  1: "Prevalentemente sereno",
  2: "Parzialmente nuvoloso",
  3: "Nuvoloso",
  45: "Nebbia",
  48: "Nebbia con brina",
  51: "Pioviggine debole",
  53: "Pioviggine",
  55: "Pioviggine intensa",
  56: "Pioviggine gelata",
  57: "Pioviggine gelata intensa",
  61: "Pioggia debole",
  63: "Pioggia",
  65: "Pioggia forte",
  66: "Pioggia gelata",
  67: "Pioggia gelata forte",
  71: "Neve debole",
  73: "Neve",
  75: "Neve forte",
  77: "Granelli di neve",
  80: "Rovesci deboli",
  81: "Rovesci",
  82: "Rovesci violenti",
  85: "Rovesci di neve",
  86: "Rovesci di neve forti",
  95: "Temporale",
  96: "Temporale con grandine",
  99: "Temporale con grandine forte",
};

export function describeWeatherCode(code: number): string {
  return WEATHER_CODES[code] ?? "Condizioni variabili";
}

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    sunrise?: string[];
    sunset?: string[];
    weather_code?: number[];
  };
};

export async function getWeather(): Promise<Weather | null> {
  const params = new URLSearchParams({
    latitude: String(config.city.latitude),
    longitude: String(config.city.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: config.timezone,
    forecast_days: "1",
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: config.revalidateSeconds },
      headers: { "User-Agent": "dashboard-tv/0.1" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OpenMeteoResponse;
    const current = data.current ?? {};
    const daily = data.daily ?? {};

    const code = current.weather_code ?? daily.weather_code?.[0] ?? 0;
    const formatTime = (iso?: string) =>
      iso ? new Intl.DateTimeFormat("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: config.timezone,
      }).format(new Date(iso)) : "";

    return {
      temperature: Math.round(current.temperature_2m ?? 0),
      apparent: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      wind: Math.round(current.wind_speed_10m ?? 0),
      description: describeWeatherCode(code),
      min: Math.round(daily.temperature_2m_min?.[0] ?? 0),
      max: Math.round(daily.temperature_2m_max?.[0] ?? 0),
      precipitationChance: Math.round(daily.precipitation_probability_max?.[0] ?? 0),
      sunrise: formatTime(daily.sunrise?.[0]),
      sunset: formatTime(daily.sunset?.[0]),
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
