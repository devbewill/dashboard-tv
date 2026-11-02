import { getDashboardData } from "@/lib/dashboard";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  const { weather, appointments, news } = data;

  return (
    <>
      <header className="masthead">
        <div>
          <div className="masthead__city">{config.city.name}</div>
          <div className="masthead__date">{data.dateLabel}</div>
        </div>
        <div className="masthead__clock">{data.timeLabel}</div>
      </header>

      <main className="layout">
        <section className="section">
          <h2 className="section__label">Notizie</h2>
          {news.length === 0 ? (
            <p className="empty">Nessuna notizia disponibile.</p>
          ) : (
            <ol className="news">
              {news.map((item, index) => (
                <li className="news__item" key={`${item.link}-${index}`}>
                  <span className="news__index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="news__title">{item.title}</h3>
                    <p className="news__meta">
                      {item.source} · {item.time}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="section">
          <h2 className="section__label">Meteo</h2>
          {weather ? (
            <>
              <div>
                <div className="weather__now">
                  <span className="weather__temp">{weather.temperature}</span>
                  <span className="weather__unit">°C</span>
                </div>
                <p className="weather__desc">{weather.description}</p>
              </div>
              <dl className="weather__rows">
                <div className="weather__row">
                  <dt>Min / max</dt>
                  <dd>
                    {weather.min}° / {weather.max}°
                  </dd>
                </div>
                <div className="weather__row">
                  <dt>Percepita</dt>
                  <dd>{weather.apparent}°</dd>
                </div>
                <div className="weather__row">
                  <dt>Pioggia</dt>
                  <dd>{weather.precipitationChance}%</dd>
                </div>
                <div className="weather__row">
                  <dt>Vento</dt>
                  <dd>{weather.wind} km/h</dd>
                </div>
                <div className="weather__row">
                  <dt>Alba / tramonto</dt>
                  <dd>
                    {weather.sunrise} / {weather.sunset}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="empty">Meteo non disponibile.</p>
          )}

          <h2 className="section__label" style={{ marginTop: "calc(var(--gap) * 0.6)" }}>
            Appuntamenti
          </h2>
          {appointments.length === 0 ? (
            <p className="empty">Nessun appuntamento oggi.</p>
          ) : (
            <ul className="agenda">
              {appointments.map((event) => (
                <li className="agenda__item" key={event.id}>
                  <span className="agenda__time">
                    {event.allDay ? "tutto il giorno" : event.time}
                  </span>
                  <div>
                    <p className="agenda__title">{event.title}</p>
                    {event.location ? <p className="agenda__where">{event.location}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>Aggiornato alle {data.timeLabel}</span>
        <span>dashboard-tv</span>
      </footer>
    </>
  );
}
