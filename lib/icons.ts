import type { Sky } from "./weather";

/**
 * Icone meteo monocromatiche in un viewBox 64×64, tratto spesso per essere leggibili
 * da lontano. Restituiscono markup SVG "interno" (senza <svg>), usato sia dalla pagina
 * HTML sia dal renderer PNG. `paper` riempie la nuvola, così copre il sole dietro.
 */

const CLOUD = "M20 44 H46 A9 9 0 0 0 46 26 A13 13 0 0 0 21 24 A10 10 0 0 0 20 44 Z";

function sun(ink: string, cx: number, cy: number, r: number, rayFrom: number, rayTo: number): string {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = (cx + Math.cos(a) * rayFrom).toFixed(1);
    const y1 = (cy + Math.sin(a) * rayFrom).toFixed(1);
    const x2 = (cx + Math.cos(a) * rayTo).toFixed(1);
    const y2 = (cy + Math.sin(a) * rayTo).toFixed(1);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}"/>${rays}`;
}

function cloud(paper: string, dx = 0, dy = 0): string {
  return `<path d="${CLOUD}" transform="translate(${dx} ${dy})" style="fill:${paper}"/>`;
}

export function weatherIcon(sky: Sky, ink: string, paper: string): string {
  let body: string;
  switch (sky) {
    case "sun":
      body = sun(ink, 32, 32, 11, 18, 26);
      break;
    case "partly":
      body = sun(ink, 22, 22, 8, 13, 19) + cloud(paper, 6, 8);
      break;
    case "cloud":
      body = cloud(paper, 0, 0);
      break;
    case "fog":
      body = cloud(paper, 0, -8) + `<line x1="14" y1="46" x2="50" y2="46"/><line x1="20" y1="55" x2="44" y2="55"/>`;
      break;
    case "drizzle":
      body =
        cloud(paper, 0, -8) +
        `<line x1="24" y1="46" x2="23" y2="50"/><line x1="34" y1="46" x2="33" y2="50"/><line x1="44" y1="46" x2="43" y2="50"/>` +
        `<line x1="29" y1="55" x2="28" y2="59"/><line x1="39" y1="55" x2="38" y2="59"/>`;
      break;
    case "rain":
      body =
        cloud(paper, 0, -8) +
        `<line x1="24" y1="44" x2="20" y2="56"/><line x1="34" y1="44" x2="30" y2="56"/><line x1="44" y1="44" x2="40" y2="56"/>`;
      break;
    case "snow":
      body =
        cloud(paper, 0, -8) +
        [
          [22, 47], [33, 47], [44, 47], [27.5, 56], [38.5, 56],
        ]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${ink}" stroke="none"/>`)
          .join("");
      break;
    case "storm":
      body =
        cloud(paper, 0, -8) +
        `<path d="M35 40 L26 53 H33 L29 62 L41 48 H34 L38 40 Z" fill="${ink}" stroke-width="2"/>`;
      break;
  }
  return `<g fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
}
