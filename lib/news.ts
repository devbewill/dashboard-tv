import { XMLParser } from "fast-xml-parser";
import { config } from "./config";

export type NewsItem = {
  title: string;
  source: string;
  link: string;
  publishedAt: string;
  time: string;
};

type FeedEntry = {
  title?: string | { "#text"?: string };
  link?: string | { "@_href"?: string } | Array<string | { "@_href"?: string }>;
  pubDate?: string;
  published?: string;
  updated?: string;
  description?: string;
};

type FeedDocument = {
  rss?: { channel?: { item?: FeedEntry | FeedEntry[] } };
  feed?: { entry?: FeedEntry | FeedEntry[] };
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

const timeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: config.timezone,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value: FeedEntry["title"]): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value["#text"] ?? "";
}

function linkOf(entry: FeedEntry): string {
  const link = entry.link;
  if (!link) return "";
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    for (const candidate of link) {
      if (typeof candidate === "string") return candidate;
      if (candidate?.["@_href"]) return candidate["@_href"];
    }
    return "";
  }
  return link["@_href"] ?? "";
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(name: string, url: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: config.revalidateSeconds },
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) dashboard-tv/0.1",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const parsed = parser.parse(xml) as FeedDocument;
    const entries = [
      ...asArray(parsed.rss?.channel?.item),
      ...asArray(parsed.feed?.entry),
    ];

    return entries.flatMap<NewsItem>((entry) => {
      const title = cleanText(textOf(entry.title));
      if (!title) return [];
      const rawDate = entry.pubDate ?? entry.published ?? entry.updated ?? "";
      const published = rawDate ? new Date(rawDate) : new Date();
      const valid = Number.isNaN(published.getTime()) ? new Date() : published;

      return [{
        title,
        source: name,
        link: linkOf(entry),
        publishedAt: valid.toISOString(),
        time: timeFormatter.format(valid),
      }];
    });
  } catch {
    return [];
  }
}

/** Le N news più recenti fra i feed configurati, senza duplicati di titolo. */
export async function getTopNews(limit = config.news.limit): Promise<NewsItem[]> {
  const feeds = await Promise.all(config.news.feeds.map((feed) => fetchFeed(feed.name, feed.url)));

  const seen = new Set<string>();
  const merged: NewsItem[] = [];

  for (const item of feeds.flat().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }

  return merged;
}
