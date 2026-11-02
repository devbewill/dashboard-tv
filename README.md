# dashboard-tv

Dashboard del giorno da mostrare sulla TV di casa: **meteo**, **appuntamenti** del calendario e
le **5 notizie** più recenti. Next.js 16 (App Router) + TypeScript, nessun database.

## Cosa mostra

- **Meteo di oggi** a Milano (Open-Meteo, nessuna API key): temperatura, percepita, min/max,
  probabilità di pioggia, vento, alba e tramonto.
- **Appuntamenti di oggi** dal calendario Google `calimeroh24@gmail.com` (Google Calendar API v3,
  refresh token). Se le credenziali mancano la sezione resta vuota e il resto funziona lo stesso.
- **5 notizie del giorno su Milano**: feed RSS di Il Giorno (Milano) e ANSA Lombardia,
  ordinate per ora, senza duplicati.

## Avvio

```bash
npm install
cp .env.example .env.local   # poi compila le variabili Google (opzionali)
npm run dev                  # http://localhost:3000
```

In produzione:

```bash
npm run build
npx next start -p 3310 -H 0.0.0.0
```

L'app ascolta su tutte le interfacce: sulla LAN è raggiungibile all'indirizzo del minipc,
per esempio `http://192.168.1.90:3310`.

## Variabili d'ambiente

Tutte opzionali tranne l'assenza delle quali si perde solo la sezione appuntamenti.

| Variabile | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` | client OAuth (Desktop) del progetto Google |
| `GOOGLE_CLIENT_SECRET` | secret dello stesso client |
| `GOOGLE_REFRESH_TOKEN` | refresh token con scope `calendar` |
| `GOOGLE_CALENDAR_ID` | calendario da leggere, default `primary` |

Il refresh token del progetto Google in uso scade circa ogni 7 giorni (app OAuth in stato
*Testing*): quando le news e il meteo funzionano ma gli appuntamenti spariscono, la causa è
quasi sempre quella. Il log del server stampa `[calendar] accesso negato: …`.

## Struttura

```
app/
  layout.tsx          # html/body, metadata
  page.tsx            # dashboard (server component, force-dynamic)
  globals.css         # stile "carta e inchiostro", niente ombre/gradienti
  api/dashboard/      # JSON con gli stessi dati, utile per debug e casting
lib/
  config.ts           # città, fusi, feed, limiti
  weather.ts          # Open-Meteo + codici WMO in italiano
  calendar.ts         # refresh token + eventi di oggi (Europe/Rome)
  news.ts             # parser RSS, dedup, ultime N
  dashboard.ts        # composizione dei dati
```

## Stile

Minimal "e-ink" come il progetto flatting: fondo carta, testo inchiostro, hairline da 1px come
unici separatori, nessuna ombra, nessun gradiente, nessuna icona. Palette e tipografia vivono
nelle variabili CSS di `app/globals.css`; i colori non vanno mai scritti dentro le classi.
I numeri usano `tabular-nums`.

## Mostrarla sulla TV

La TV è una **Philips 32PFS5803/12** con un **Chromecast** ("Camera da letto", 192.168.1.41).
Il Chromecast non visualizza HTML arbitrario con il receiver di default: per portare questa
pagina sul televisore bisogna renderla in un'immagine (PNG 1920×1080) e trasmettere quella.

Procedura verificata: si apre l'URL con Chrome headless sul PC fisso, si salva il PNG, lo si
serve da HTTP sul minipc e lo si invia con `pychromecast`. Per accendere la TV da spenta serve
forzare un cambio app sul Chromecast prima del cast (vedi skill `home-network-displays`).

## Verifica

```bash
npx tsc --noEmit
npm run build          # le route / e /api/dashboard devono essere ƒ (dinamiche)
curl -s localhost:3310/api/dashboard | python3 -m json.tool
```
