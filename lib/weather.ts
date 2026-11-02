import { config } from "./config";

/** Categoria visiva del tempo: decide quale icona disegnare. */
export type Sky = "sun" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export type DayPart = {
  label: string;
  sky: Sky;
  description: string;
  temperature: number;
};

export type Weather = {
  temperature: number;
  description: string;
  parts: DayPart[];
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

export function skyFromCode(code: number): Sky {
  if (code === 0 || code === 1) return "sun";
  if (code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}

// Fasce orarie (ora locale, estremi inclusi).
const DAY_PARTS = [
  { label: "Mattina", from: 7, to: 12 },
  { label: "Pomeriggio", from: 13, to: 18 },
  { label: "Sera", from: 19, to: 23 },
] as const;

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    weather_code?: number[];
  };
};

export async function getWeather(): Promise<Weather | null> {
  const params = new URLSearchParams({
    latitude: String(config.city.latitude),
    longitude: String(config.city.longitude),
    current: "temperature_2m,weather_code",
    hourly: "temperature_2m,weather_code",
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
    const hourly = data.hourly ?? {};
    const times = hourly.time ?? [];

    const parts: DayPart[] = DAY_PARTS.map(({ label, from, to }) => {
      const codes: number[] = [];
      const temps: number[] = [];
      times.forEach((iso, i) => {
        // Con `timezone` impostato, Open-Meteo restituisce "YYYY-MM-DDTHH:MM" in ora locale.
        const hour = Number(iso.slice(11, 13));
        if (hour < from || hour > to) return;
        const code = hourly.weather_code?.[i];
        const temp = hourly.temperature_2m?.[i];
        if (typeof code === "number") codes.push(code);
        if (typeof temp === "number") temps.push(temp);
      });
      // Il codice WMO più alto è il fenomeno più significativo della fascia
      // (es. un'ora di pioggia in un pomeriggio nuvoloso → pioggia).
      const code = codes.length > 0 ? Math.max(...codes) : 0;
      const temperature =
        temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : 0;
      return { label, sky: skyFromCode(code), description: describeWeatherCode(code), temperature };
    });

    return {
      temperature: Math.round(current.temperature_2m ?? 0),
      description: describeWeatherCode(current.weather_code ?? 0),
      parts,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
