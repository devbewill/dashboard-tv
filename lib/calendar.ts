import { config } from "./config";

export type Appointment = {
  id: string;
  title: string;
  time: string;
  endTime: string;
  allDay: boolean;
  location?: string;
  calendar: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  location?: string;
  status?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
};

type GoogleEventsResponse = {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
};

const formatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: config.timezone,
});

const dayKey = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: config.timezone,
});

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`token: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }
  return data.access_token;
}

/**
 * Appuntamenti di oggi (fuso Europe/Rome) dal calendario Google indicato.
 * Restituisce [] se le credenziali non sono configurate: la dashboard deve
 * continuare a funzionare anche senza calendario.
 */
export async function getTodayAppointments(): Promise<Appointment[]> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  let token: string | null = null;

  try {
    token = await getAccessToken();
  } catch (error) {
    console.warn("[calendar] accesso negato:", (error as Error).message);
    return [];
  }
  if (!token) return [];

  const now = new Date();
  const dayStart = new Date(`${dayKey.format(now)}T00:00:00Z`);
  const timeMin = new Date(dayStart.getTime() - 12 * 3600_000);
  const timeMax = new Date(dayStart.getTime() + 36 * 3600_000);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    );
    if (!res.ok) {
      console.warn(`[calendar] HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as GoogleEventsResponse;
    const today = dayKey.format(now);

    return (data.items ?? [])
      .filter((event) => event.status !== "cancelled")
      .flatMap<Appointment>((event) => {
        const start = event.start;
        const end = event.end;
        if (!start) return [];

        // Evento "tutto il giorno": data senza orario.
        if (start.date) {
          if (start.date !== today) return [];
          return [{
            id: event.id,
            title: event.summary ?? "(senza titolo)",
            time: "",
            endTime: "",
            allDay: true,
            location: event.location,
            calendar: calendarId,
          }];
        }

        if (!start.dateTime) return [];
        const startDate = new Date(start.dateTime);
        if (dayKey.format(startDate) !== today) return [];

        return [{
          id: event.id,
          title: event.summary ?? "(senza titolo)",
          time: formatter.format(startDate),
          endTime: end?.dateTime ? formatter.format(new Date(end.dateTime)) : "",
          allDay: false,
          location: event.location,
          calendar: calendarId,
        }];
      });
  } catch (error) {
    console.warn("[calendar] lettura fallita:", (error as Error).message);
    return [];
  }
}
