import { getDashboardData } from "@/lib/dashboard";
import { renderPng } from "@/lib/render";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PNG 1920×1080 della dashboard, pronto per il cast sul Chromecast:
 *   http://192.168.1.90:3310/api/render
 */
export async function GET() {
  const data = await getDashboardData();
  const png = renderPng(data);

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.length),
      "Cache-Control": "no-store",
    },
  });
}
