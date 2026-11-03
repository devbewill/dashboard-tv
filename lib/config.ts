export const config = {
  city: {
    name: "Milano",
    latitude: 45.4642,
    longitude: 9.19,
  },
  timezone: "Europe/Rome",
  news: {
    limit: 10,
    // Una sola fonte: due feed producevano titoli doppi sulla stessa notizia.
    // Corriere della Sera, feed home (il feed della cronaca di Milano è morto: fermo al 2012).
    feeds: [
      { name: "Corriere della Sera", url: "https://www.corriere.it/rss/homepage.xml" },
    ],
  },
  revalidateSeconds: 300,
} as const;

export type CityConfig = typeof config.city;
