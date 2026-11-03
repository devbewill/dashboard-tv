import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { DashboardData } from "./dashboard";
import { weatherIcon } from "./icons";

/**
 * Renderer PNG della dashboard per il Chromecast.
 * Il Chromecast non mostra HTML: si genera un SVG 1920×1080 e lo si rasterizza
 * con resvg (binario precompilato, nessun browser necessario).
 */

const W = 1920;
const H = 1080;
const M = 48;

/**
 * Pensata per un 32" visto da circa 4 metri: testi grandi, pesi pieni e grigi scuri.
 * Il "muted" resta sopra 10:1 di contrasto sul fondo, le linee sono da 2px.
 */
const COLORS = {
  paper: "#fbfaf6",
  ink: "#0f0f0d",
  muted: "#36342e",
  hairline: "#b4b1a6",
};

const SIZES = {
  date: 46,
  clock: 96,
  label: 28,
  newsIndex: 32,
  newsTitle: 40,
  newsMeta: 28,
  temp: 170,
  partLabel: 28,
  partTemp: 38,
  agendaTime: 30,
  agendaTitle: 36,
  empty: 34,
};

/** Peso unico per tutto il testo: Inter ExtraBold, il più leggibile da lontano. */
const WEIGHT = 800;

const LEFT_W = 1060;
const RIGHT_X = M + LEFT_W + 64;
const RIGHT_W = W - RIGHT_X - M;
const BOTTOM = H - M;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Larghezza stimata: Inter ExtraBold è mediamente ~0.53em per carattere. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.53;
}

function wrap(text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // Se il testo è stato troncato, aggiunge i puntini all'ultima riga.
  const consumed = lines.join(" ").length;
  if (consumed < text.replace(/\s+/g, " ").trim().length) {
    const last = lines.pop() ?? "";
    lines.push(`${last.replace(/[\s,;:.]+$/, "")}…`);
  }
  return lines;
}

function text(
  x: number,
  y: number,
  content: string,
  size: number,
  fill: string,
  extra = "",
): string {
  return `<text x="${x}" y="${y}" font-family="Inter" font-size="${size}" font-weight="${WEIGHT}" fill="${fill}" ${extra}>${escapeXml(content)}</text>`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS.hairline}" stroke-width="2"/>`;
}

/** Etichetta di sezione + linea sotto; restituisce la y da cui partire col contenuto. */
function sectionLabel(parts: string[], x: number, y: number, width: number, label: string): number {
  parts.push(text(x, y, label, SIZES.label, COLORS.ink, 'letter-spacing="3"'));
  parts.push(line(x, y + 16, x + width, y + 16));
  return y + 16;
}

export function buildSvg(data: DashboardData): string {
  const parts: string[] = [];

  // ---------- testata ----------
  const date = data.dateLabel.charAt(0).toUpperCase() + data.dateLabel.slice(1);
  parts.push(text(M, M + 66, `${date} · ${data.city}`, SIZES.date, COLORS.ink));
  parts.push(text(W - M, M + 78, data.timeLabel, SIZES.clock, COLORS.ink, 'text-anchor="end"'));
  const headerLineY = M + 108;
  parts.push(line(M, headerLineY, W - M, headerLineY));

  const top = headerLineY + 56;

  // ---------- colonna sinistra: notizie ----------
  let y = sectionLabel(parts, M, top, LEFT_W, "NOTIZIE");

  const items = data.news;
  if (items.length === 0) {
    parts.push(text(M, y + 60, "Nessuna notizia disponibile.", SIZES.empty, COLORS.muted));
  } else {
    // Solo titoli: niente numero, fonte o orario (più spazio utile). Il corpo si
    // riduce quanto basta perché entrino TUTTE le notizie, max 2 righe per titolo.
    const avail = BOTTOM - y - 6;
    const maxLines = 2;
    let size = SIZES.newsTitle;
    let lead = size + 8;
    let wrapped: string[][] = items.map((it) => wrap(it.title, size, LEFT_W, maxLines));
    for (let s = SIZES.newsTitle; s >= 24; s -= 2) {
      const lh = s + 8;
      const ls = items.map((it) => wrap(it.title, s, LEFT_W, maxLines));
      const titlesHeight = ls.reduce((sum, l) => sum + l.length * lh, 0);
      const minGaps = 6 * (items.length - 1);
      size = s;
      lead = lh;
      wrapped = ls;
      if (titlesHeight + minGaps <= avail) break;
    }
    const titlesHeight = wrapped.reduce((sum, l) => sum + l.length * lead, 0);
    const gap = Math.min(26, Math.max(6, (avail - titlesHeight) / Math.max(1, items.length - 1)));
    let cy = y;
    for (const [index, lines] of wrapped.entries()) {
      let ty = cy + size;
      for (const tl of lines) {
        parts.push(text(M, ty, tl, size, COLORS.ink));
        ty += lead;
      }
      cy += lines.length * lead;
      if (index < wrapped.length - 1) {
        cy += gap;
        parts.push(line(M, cy - gap / 2, M + LEFT_W, cy - gap / 2));
      }
    }
  }

  // ---------- colonna destra: meteo ----------
  let ry = sectionLabel(parts, RIGHT_X, top, RIGHT_W, "METEO");

  const weather = data.weather;
  if (weather) {
    // Una sola riga: temperatura attuale a sinistra, mattina/pomeriggio/sera a destra.
    const top = ry + 28;
    const tempBaseline = top + Math.round(SIZES.temp * 0.74);
    const temp = String(weather.temperature);
    parts.push(text(RIGHT_X - 6, tempBaseline, temp, SIZES.temp, COLORS.ink, 'letter-spacing="-4"'));
    parts.push(text(RIGHT_X + textWidth(temp, SIZES.temp) - 4, tempBaseline - 70, "°", 90, COLORS.ink));

    const partsX = RIGHT_X + 240;
    const colW = (RIGHT_X + RIGHT_W - partsX) / weather.parts.length;
    const iconSize = 96;
    weather.parts.forEach((part, i) => {
      const cx = partsX + colW * i + colW / 2;
      const scale = iconSize / 64;
      parts.push(
        `<g transform="translate(${cx - iconSize / 2} ${top - 8}) scale(${scale})">${weatherIcon(part.sky, COLORS.ink, COLORS.paper)}</g>`,
      );
      parts.push(
        text(cx, top + iconSize + 26, part.label, SIZES.partLabel, COLORS.muted, 'text-anchor="middle"'),
      );
      parts.push(
        text(cx, top + iconSize + 26 + 44, `${part.temperature}°`, SIZES.partTemp, COLORS.ink, 'text-anchor="middle"'),
      );
    });
    ry = top + iconSize + 26 + 44;
  } else {
    parts.push(text(RIGHT_X, ry + 60, "Meteo non disponibile.", SIZES.empty, COLORS.muted));
    ry += 70;
  }

  // ---------- colonna destra: prossimi appuntamenti ----------
  ry = sectionLabel(parts, RIGHT_X, ry + 72, RIGHT_W, "PROSSIMI APPUNTAMENTI");

  if (data.appointments.length === 0) {
    parts.push(text(RIGHT_X, ry + 58, "Nessun appuntamento in programma.", SIZES.empty, COLORS.muted));
  } else {
    const lead = SIZES.agendaTitle + 8;
    const shown = data.appointments;
    for (const [index, event] of shown.entries()) {
      const lines = wrap(event.title, SIZES.agendaTitle, RIGHT_W, 2);
      const height = 14 + SIZES.agendaTime + 10 + lines.length * lead + 4;
      const remaining = shown.length - index;
      if (ry + height > BOTTOM + 4) {
        parts.push(text(RIGHT_X, ry + 44, `+ altri ${remaining}`, SIZES.agendaTime, COLORS.muted));
        break;
      }
      // Riga 1: giorno (in nero) · ora; riga 2: titolo.
      const metaY = ry + 14 + SIZES.agendaTime;
      const when = event.allDay ? "tutto il giorno" : event.time;
      parts.push(
        `<text x="${RIGHT_X}" y="${metaY}" font-family="Inter" font-size="${SIZES.agendaTime}" font-weight="${WEIGHT}">` +
          `<tspan fill="${COLORS.ink}">${escapeXml(event.day)}</tspan>` +
          `<tspan fill="${COLORS.muted}"> · ${escapeXml(when)}</tspan></text>`,
      );
      let ty = metaY + 10 + SIZES.agendaTitle;
      for (const tl of lines) {
        parts.push(text(RIGHT_X, ty, tl, SIZES.agendaTitle, COLORS.ink));
        ty += lead;
      }
      ry += height;
      if (index < shown.length - 1) parts.push(line(RIGHT_X, ry, RIGHT_X + RIGHT_W, ry));
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${COLORS.paper}"/>
  ${parts.join("\n  ")}
</svg>`;
}

function fontFiles(): string[] {
  const dirs = [
    process.env.DASHBOARD_FONT_DIR,
    path.join(os.homedir(), ".local/share/fonts"),
    "/usr/share/fonts/truetype/inter",
  ].filter(Boolean) as string[];

  for (const dir of dirs) {
    try {
      const files = fs
        .readdirSync(dir)
        .filter((file) => /\.(otf|ttf)$/i.test(file))
        .map((file) => path.join(dir, file));
      if (files.length > 0) return files;
    } catch {
      // directory assente: prova la successiva
    }
  }
  return [];
}

export function renderPng(data: DashboardData): Buffer {
  const svg = buildSvg(data);
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: fontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: "Inter",
    },
    fitTo: { mode: "width", value: W },
  });
  return Buffer.from(resvg.render().asPng());
}
