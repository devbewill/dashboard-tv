export const config = {
  city: {
    name: "Milano",
    latitude: 45.4642,
    longitude: 9.19,
  },
  timezone: "Europe/Rome",
  news: {
    limit: 10,
    // Fonti locali: cronaca di Milano e Lombardia.
    feeds: [
      { name: "Il Giorno", url: "https://www.ilgiorno.it/milano/rss" },
      { name: "ANSA Lombardia", url: "https://www.ansa.it/lombardia/notizie/lombardia_rss.xml" },
    ],
  },
  revalidateSeconds: 300,
} as const;

export type CityConfig = typeof config.city;
