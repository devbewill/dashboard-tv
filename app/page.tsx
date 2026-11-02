import { getDashboardData } from "@/lib/dashboard";
import { config } from "@/lib/config";
import { weatherIcon } from "@/lib/icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  const { weather, appointments, news } = data;

  return (
    <>
      <header className="masthead">
        <div className="masthead__date">
          {data.dateLabel} · {config.city.name}
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
              <div className="weather">
              <div className="weather__now">
                <span className="weather__temp">{weather.temperature}</span>
                <span className="weather__unit">°</span>
              </div>
              <ul className="weather__parts">
                {weather.parts.map((part) => (
                  <li className="weather__part" key={part.label}>
                    <svg
                      className="weather__icon"
                      viewBox="0 0 64 64"
                      role="img"
                      aria-label={part.description}
                      dangerouslySetInnerHTML={{
                        __html: weatherIcon(part.sky, "currentColor", "var(--paper)"),
                      }}
                    />
                    <span className="weather__part-label">{part.label}</span>
                    <span className="weather__part-temp">{part.temperature}°</span>
                  </li>
                ))}
              </ul>
              </div>
            </>
          ) : (
            <p className="empty">Meteo non disponibile.</p>
          )}

          <h2 className="section__label" style={{ marginTop: "calc(var(--gap) * 0.8)" }}>
            Prossimi appuntamenti
          </h2>
          {appointments.length === 0 ? (
            <p className="empty">Nessun appuntamento in programma.</p>
          ) : (
            <ul className="agenda">
              {appointments.map((event) => (
                <li className="agenda__item" key={event.id}>
                  <p className="agenda__when">
                    <span className="agenda__day">{event.day}</span> ·{" "}
                    {event.allDay ? "tutto il giorno" : event.time}
                  </p>
                  <p className="agenda__title">{event.title}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
