export const config = {
  city: {
    name: "Milano",
    latitude: 45.4642,
    longitude: 9.19,
  },
  timezone: "Europe/Rome",
  news: {
    limit: 5,
    feeds: [
      { name: "ANSA", url: "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml" },
      { name: "Repubblica", url: "https://www.repubblica.it/rss/homepage/rss2.0.xml" },
    ],
  },
  revalidateSeconds: 300,
} as const;

export type CityConfig = typeof config.city;
