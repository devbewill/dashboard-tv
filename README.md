# dashboard-tv

Dashboard del giorno da mostrare sulla TV di casa: **meteo**, **appuntamenti** del calendario e
le **5 notizie** più recenti. Next.js 16 (App Router) + TypeScript, nessun database.

## Cosa mostra

- **Meteo di oggi** a Milano (Open-Meteo, nessuna API key): temperatura attuale e un'icona per
  mattina (7–12), pomeriggio (13–18) e sera (19–23) con la temperatura media della fascia.
  L'icona rappresenta il fenomeno più significativo della fascia (codice WMO più alto).
- **Prossimi appuntamenti** (in corso e futuri, entro 30 giorni, max 8) dal calendario Google `calimeroh24@gmail.com` (Google Calendar API v3,
  service account). Se le credenziali mancano la sezione resta vuota e il resto funziona lo stesso.
- **5 notizie del giorno su Milano**: feed RSS di Il Giorno (Milano) e ANSA Lombardia,
  ordinate per ora, senza duplicati.

## Avvio

```bash
npm install
cp .env.example .env.local   # poi compila le variabili Google (opzionali)
# e copia la chiave del service account in .secrets/google-service-account.json
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
| `GOOGLE_SERVICE_ACCOUNT_FILE` | percorso della chiave JSON del service account, es. `.secrets/google-service-account.json` |
| `GOOGLE_CALENDAR_ID` | email del calendario da leggere, es. `calimeroh24@gmail.com` (non `primary`) |

Il calendario si legge con il service account
`dashboard-tv@charged-epsilon-510314-s8.iam.gserviceaccount.com` (progetto Google Cloud
"minipc" dell'account calimeroh24). Non c'è consenso OAuth né refresh token: l'accesso non
scade. Funziona perché il calendario è **condiviso in sola lettura** con quell'email
(Google Calendar → Impostazioni del calendario → Condividi con persone specifiche).
La chiave sta in `.secrets/` (ignorata da git): sul minipc va copiata a mano.
Se gli appuntamenti spariscono, il log del server stampa `[calendar] …`; un `HTTP 404`
significa che la condivisione è stata rimossa.

## Struttura

```
app/
  layout.tsx          # html/body, metadata
  page.tsx            # dashboard (server component, force-dynamic)
  globals.css         # stile "carta e inchiostro", niente ombre/gradienti
  api/dashboard/      # JSON con gli stessi dati, utile per debug e casting
lib/
  config.ts           # città, fusi, feed, limiti
  weather.ts          # Open-Meteo + codici WMO in italiano + fasce della giornata
  icons.ts            # icone meteo SVG (sole, nuvole, pioggia, neve, …) per pagina e PNG
  calendar.ts         # service account (JWT) + prossimi eventi con "Oggi"/"Domani"/"Gio 5"
  news.ts             # parser RSS, dedup, ultime N
  dashboard.ts        # composizione dei dati
```

## Stile

Minimal "e-ink" come il progetto flatting: fondo carta, testo inchiostro, linee da 2px come
unici separatori, nessuna ombra, nessun gradiente; le uniche icone sono quelle meteo,
monocromatiche. Dimensionata per un 32" visto da ~4 m: titoli notizie 40px, temperatura 170px,
grigi scuri (contrasto > 10:1). Palette e tipografia vivono
nelle variabili CSS di `app/globals.css`; i colori non vanno mai scritti dentro le classi.
I numeri usano `tabular-nums`.

## Mostrarla sulla TV

La TV è una **Philips 32PFS5803/12** con un **Chromecast** ("Camera da letto", 192.168.1.41).
Il Chromecast non visualizza HTML arbitrario con il receiver di default: per portare questa
pagina sul televisore bisogna renderla in un'immagine (PNG 1920×1080) e trasmettere quella.

Procedura verificata: si apre l'URL con Chrome headless sul PC fisso, si salva il PNG, lo si
serve da HTTP sul minipc e lo si invia con `pychromecast`. Per accendere la TV da spenta serve
forzare un cambio app sul Chromecast prima del cast (vedi skill `home-network-displays`).

## Schedulazione sul minipc

Tre unit systemd utente (`~/.config/systemd/user/`):

| unit | cosa fa |
|---|---|
| `dashboard-tv.service` | serve l'app su `:3310`, `Restart=always` |
| `dashboard-tv-cast.service` | oneshot: pre-riscalda la PNG, poi lancia `scripts/cast_dashboard.py` |
| `dashboard-tv-cast.timer` | Lun-Ven 08:10, Sab-Dom 09:00 (ora italiana) |

```bash
systemctl --user list-timers dashboard-tv-cast.timer
systemctl --user start dashboard-tv-cast.service   # prova subito
journalctl --user -u dashboard-tv-cast.service -n 20
```

Il fuso è dichiarato dentro la regola (`Europe/Rome`) perché l'orologio del sistema è UTC:
così gli orari italiani restano corretti anche con l'ora legale. `Persistent=false`: se il
minipc era spento all'orario previsto, il cast non parte in ritardo.

## Verifica

```bash
npx tsc --noEmit
npm run build          # le route / e /api/dashboard devono essere ƒ (dinamiche)
curl -s localhost:3310/api/dashboard | python3 -m json.tool
```
