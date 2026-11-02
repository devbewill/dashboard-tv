import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";

export type Appointment = {
  id: string;
  title: string;
  /** "Oggi", "Domani" o "Gio 5". */
  day: string;
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

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
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

const shortDay = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  timeZone: config.timezone,
});

/** Etichetta del giorno rispetto a oggi, a partire da una chiave YYYY-MM-DD. */
function dayLabel(key: string, now: Date): string {
  const today = dayKey.format(now);
  const tomorrow = dayKey.format(new Date(now.getTime() + 86_400_000));
  if (key === today) return "Oggi";
  if (key === tomorrow) return "Domani";
  // Mezzogiorno UTC: resta nello stesso giorno in Europe/Rome.
  const label = shortDay.format(new Date(`${key}T12:00:00Z`)).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const UPCOMING_DAYS = 30;
const UPCOMING_LIMIT = 8;

const dayKey = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: config.timezone,
});

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

let cachedToken: { value: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccountKey | null {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (!file) return null;
  const key = JSON.parse(fs.readFileSync(path.resolve(file), "utf8")) as ServiceAccountKey;
  if (!key.client_email || !key.private_key) throw new Error(`chiave non valida in ${file}`);
  return key;
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/**
 * Access token del service account (JWT bearer grant, RFC 7523).
 * Il service account legge il calendario perché questo è condiviso con la sua email:
 * nessun consenso OAuth, nessun refresh token che scade.
 */
async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const key = loadServiceAccount();
  if (!key) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), key.private_key);
  const assertion = `${header}.${claims}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`token: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

/**
 * Prossimi appuntamenti dal calendario Google indicato: quelli in corso e quelli futuri,
 * entro 30 giorni, in ordine cronologico. Restituisce [] se le credenziali non sono
 * configurate: la dashboard deve continuare a funzionare anche senza calendario.
 */
export async function getUpcomingAppointments(): Promise<Appointment[]> {
  // Con un service account "primary" sarebbe il suo calendario (vuoto): serve l'ID esplicito.
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) return [];

  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch (error) {
    console.warn("[calendar] accesso negato:", (error as Error).message);
    return [];
  }
  if (!token) return [];

  const now = new Date();
  const today = dayKey.format(now);
  // timeMin filtra sulla fine dell'evento: sono inclusi anche quelli in corso.
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + UPCOMING_DAYS * 86_400_000).toISOString(),
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
      // 404 = calendario non condiviso con l'email del service account.
      console.warn(`[calendar] HTTP ${res.status} su ${calendarId}`);
      return [];
    }
    const data = (await res.json()) as GoogleEventsResponse;

    return (data.items ?? [])
      .filter((event) => event.status !== "cancelled")
      .flatMap<Appointment>((event) => {
        const start = event.start;
        const end = event.end;
        if (!start) return [];
        const base = {
          id: event.id,
          title: event.summary ?? "(senza titolo)",
          location: event.location,
          calendar: calendarId,
        };

        // Evento "tutto il giorno": data senza orario. Se è iniziato nei giorni
        // scorsi ed è ancora in corso, lo si mostra come "Oggi".
        if (start.date) {
          const key = start.date < today ? today : start.date;
          return [{ ...base, day: dayLabel(key, now), time: "", endTime: "", allDay: true }];
        }

        if (!start.dateTime) return [];
        const startDate = new Date(start.dateTime);
        return [{
          ...base,
          day: dayLabel(dayKey.format(startDate), now),
          time: formatter.format(startDate),
          endTime: end?.dateTime ? formatter.format(new Date(end.dateTime)) : "",
          allDay: false,
        }];
      })
      .slice(0, UPCOMING_LIMIT);
  } catch (error) {
    console.warn("[calendar] lettura fallita:", (error as Error).message);
    return [];
  }
}
