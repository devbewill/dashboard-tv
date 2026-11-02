import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { DashboardData } from "./dashboard";

/**
 * Renderer PNG della dashboard per il Chromecast.
 * Il Chromecast non mostra HTML: si genera un SVG 1920×1080 e lo si rasterizza
 * con resvg (binario precompilato, nessun browser necessario).
 */

const W = 1920;
const H = 1080;
const M = 56;

const COLORS = {
  paper: "#faf9f5",
  ink: "#1a1a17",
  muted: "#4c4a44",
  hairline: "#dedcd3",
};

const SIZES = {
  city: 20,
  date: 30,
  clock: 66,
  label: 18,
  newsIndex: 22,
  newsTitle: 30,
  newsMeta: 20,
  temp: 100,
  desc: 30,
  rowLabel: 24,
  rowValue: 24,
  agendaTime: 24,
  agendaTitle: 26,
  footer: 18,
};

const LEFT_W = 1000;
const RIGHT_X = M + LEFT_W + 56;
const RIGHT_W = W - RIGHT_X - M;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Larghezza stimata: Inter è mediamente ~0.52em per carattere. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.52;
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
  return `<text x="${x}" y="${y}" font-family="Inter" font-size="${size}" fill="${fill}" ${extra}>${escapeXml(content)}</text>`;
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS.hairline}" stroke-width="1"/>`;
}

export function buildSvg(data: DashboardData): string {
  const parts: string[] = [];
  const now = new Date(data.generatedAt);

  // ---------- testata ----------
  parts.push(text(M, M + 18, data.city.toUpperCase(), SIZES.city, COLORS.muted, 'letter-spacing="3.4"'));
  parts.push(text(M, M + 18 + SIZES.date + 12, data.dateLabel.charAt(0).toUpperCase() + data.dateLabel.slice(1), SIZES.date, COLORS.ink));
  parts.push(text(W - M, M + 52, data.timeLabel, SIZES.clock, COLORS.ink, 'text-anchor="end"'));
  parts.push(line(M, M + 96, W - M, M + 96));

  let y = M + 96 + 44;

  // ---------- colonna sinistra: notizie ----------
  parts.push(text(M, y, "NOTIZIE", SIZES.label, COLORS.muted, 'letter-spacing="3"'));
  y += 18;
  parts.push(line(M, y, M + LEFT_W, y));
  y += 22;

  // Altezza disponibile fra l'intestazione e la linea del piede.
  const footerLineY = H - M - 40;
  const limit = footerLineY - 12;
  const budget = limit - y;

  const blocks = data.news.map((item) => ({
    item,
    titleLines: wrap(item.title, SIZES.newsTitle, LEFT_W - 70, 2),
  }));

  const naturalHeights = blocks.map(
    (block) => block.titleLines.length * (SIZES.newsTitle + 10) + SIZES.newsMeta + 6,
  );
  const totalHeight = naturalHeights.reduce((sum, h) => sum + h, 0);
  const gap = Math.min(
    34,
    Math.max(6, Math.floor((budget - totalHeight) / Math.max(1, blocks.length))),
  );

  for (const [index, block] of blocks.entries()) {
    const rowHeight = naturalHeights[index];
    if (y + rowHeight > limit) break;

    parts.push(text(M, y + SIZES.newsIndex, String(index + 1).padStart(2, "0"), SIZES.newsIndex, COLORS.muted));
    let ty = y + SIZES.newsTitle;
    for (const tl of block.titleLines) {
      parts.push(text(M + 62, ty, tl, SIZES.newsTitle, COLORS.ink));
      ty += SIZES.newsTitle + 10;
    }
    parts.push(
      text(M + 62, ty + 4, `${block.item.source} · ${block.item.time}`, SIZES.newsMeta, COLORS.muted),
    );
    y += rowHeight;
    parts.push(line(M, y, M + LEFT_W, y));
    y += gap;
  }
  if (data.news.length === 0) {
    parts.push(text(M, y + 24, "Nessuna notizia disponibile.", SIZES.desc, COLORS.muted));
  }

  // ---------- colonna destra: meteo ----------
  let ry = M + 96 + 44;
  parts.push(text(RIGHT_X, ry, "METEO", SIZES.label, COLORS.muted, 'letter-spacing="3"'));
  ry += 18;
  parts.push(line(RIGHT_X, ry, RIGHT_X + RIGHT_W, ry));
  ry += 22;

  const weather = data.weather;
  if (weather) {
    parts.push(text(RIGHT_X, ry + SIZES.temp, String(weather.temperature), SIZES.temp, COLORS.ink));
    const tempWidth = textWidth(String(weather.temperature), SIZES.temp);
    parts.push(text(RIGHT_X + tempWidth + 10, ry + SIZES.temp - 34, "°C", SIZES.desc, COLORS.muted));
    ry += SIZES.temp + 34;
    parts.push(text(RIGHT_X, ry, weather.description, SIZES.desc, COLORS.ink));
    ry += 26;

    const rows: Array<[string, string]> = [
      ["Min / max", `${weather.min}° / ${weather.max}°`],
      ["Percepita", `${weather.apparent}°`],
      ["Pioggia", `${weather.precipitationChance}%`],
      ["Vento", `${weather.wind} km/h`],
      ["Alba / tramonto", `${weather.sunrise} / ${weather.sunset}`],
    ];
    for (const [label, value] of rows) {
      ry += 18;
      parts.push(line(RIGHT_X, ry, RIGHT_X + RIGHT_W, ry));
      ry += SIZES.rowLabel + 14;
      parts.push(text(RIGHT_X, ry, label, SIZES.rowLabel, COLORS.muted));
      parts.push(text(RIGHT_X + RIGHT_W, ry, value, SIZES.rowValue, COLORS.ink, 'text-anchor="end"'));
    }
  } else {
    parts.push(text(RIGHT_X, ry + 30, "Meteo non disponibile.", SIZES.desc, COLORS.muted));
    ry += 60;
  }

  // ---------- colonna destra: appuntamenti ----------
  ry += 64;
  parts.push(text(RIGHT_X, ry, "APPUNTAMENTI", SIZES.label, COLORS.muted, 'letter-spacing="3"'));
  ry += 18;
  parts.push(line(RIGHT_X, ry, RIGHT_X + RIGHT_W, ry));
  ry += 24;

  if (data.appointments.length === 0) {
    parts.push(text(RIGHT_X, ry + 20, "Nessun appuntamento oggi.", SIZES.desc, COLORS.muted));
  } else {
    for (const event of data.appointments.slice(0, 4)) {
      const when = event.allDay ? "tutto il giorno" : event.time;
      parts.push(text(RIGHT_X, ry + SIZES.agendaTime, when, SIZES.agendaTime, COLORS.muted));
      const lines = wrap(event.title, SIZES.agendaTitle, RIGHT_W - 150, 2);
      let ty = ry + SIZES.agendaTitle;
      for (const tl of lines) {
        parts.push(text(RIGHT_X + 140, ty, tl, SIZES.agendaTitle, COLORS.ink));
        ty += SIZES.agendaTitle + 8;
      }
      ry = ty + 14;
      parts.push(line(RIGHT_X, ry, RIGHT_X + RIGHT_W, ry));
      ry += 14;
    }
  }

  // ---------- piede ----------
  const footerY = H - M;
  parts.push(line(M, footerY - 40, W - M, footerY - 40));
  parts.push(text(M, footerY, `Aggiornato alle ${data.timeLabel}`, SIZES.footer, COLORS.muted));
  parts.push(text(W - M, footerY, `${data.city} · dashboard-tv`, SIZES.footer, COLORS.muted, 'text-anchor="end"'));

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
