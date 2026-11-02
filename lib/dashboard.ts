import { getTodayAppointments, type Appointment } from "@/lib/calendar";
import { getTopNews, type NewsItem } from "@/lib/news";
import { getWeather, type Weather } from "@/lib/weather";
import { config } from "@/lib/config";

export type DashboardData = {
  generatedAt: string;
  dateLabel: string;
  timeLabel: string;
  weather: Weather | null;
  appointments: Appointment[];
  news: NewsItem[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const [weather, appointments, news] = await Promise.all([
    getWeather(),
    getTodayAppointments(),
    getTopNews(),
  ]);

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: config.timezone,
  }).format(now);

  const timeLabel = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: config.timezone,
  }).format(now);

  return {
    generatedAt: now.toISOString(),
    dateLabel,
    timeLabel,
    weather,
    appointments,
    news,
  };
}
