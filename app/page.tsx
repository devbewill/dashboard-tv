import { getDashboardData } from "@/lib/dashboard";
import { config } from "@/lib/config";
import { weatherIcon } from "@/lib/icons";

export const dynamic = "force-dynamic";

const INLINE_TV_SCRIPT = `
(function() {
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tick() {
    var el = document.getElementById('live-clock');
    if (!el) return;
    try {
      var s = new Intl.DateTimeFormat('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Rome'
      }).format(new Date());
      el.textContent = s;
    } catch (e) {
      var d = new Date();
      el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
  }
  tick();
  setInterval(tick, 1000);
  setTimeout(function() { location.reload(); }, 300000);

  // YouTube IFrame API (ES5 compatible for older Chromecast Chromium)
  var vid = 'CwvHONO-XdE';
  window.onYouTubeIframeAPIReady = function() {
    try {
      new window.YT.Player('yt-player', {
        videoId: vid,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          rel: 0,
          playsinline: 1,
          loop: 1,
          playlist: vid,
          modestbranding: 1
        },
        events: {
          onReady: function(ev) {
            try {
              ev.target.mute();
              ev.target.playVideo();
              setTimeout(function() {
                try {
                  ev.target.unMute();
                  ev.target.setVolume(80);
                } catch (e2) {}
              }, 2000);
            } catch (e1) {}
          }
        }
      });
    } catch (e) {}
  };

  var tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();
`;

export default async function Home() {
  const data = await getDashboardData();
  const { weather, appointments } = data;
  const news = data.news.slice(0, 5);

  return (
    <>
      <header className="masthead">
        <div className="masthead__date">
          {data.dateLabel} · {config.city.name}
        </div>
        <div className="masthead__clock" id="live-clock">
          {data.timeLabel}
        </div>
      </header>

      <main className="layout">
        <section className="section section--left">
          <h2 className="section__label">Notizie</h2>
          {news.length === 0 ? (
            <p className="empty">Nessuna notizia disponibile.</p>
          ) : (
            <ol className="news">
              {news.map((item, index) => (
                <li className="news__item" key={`${item.link}-${index}`}>
                  <h3 className="news__title">{item.title}</h3>
                </li>
              ))}
            </ol>
          )}

          <h2 className="section__label" style={{ marginTop: "calc(var(--gap) * 0.4)" }}>
            Buongiorno · Natura
          </h2>
          <div className="video-box">
            <div className="video-box__frame">
              <div id="yt-player" />
            </div>
            <div className="video-box__caption">Canto degli uccellini nel bosco all’alba</div>
          </div>
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
      <script dangerouslySetInnerHTML={{ __html: INLINE_TV_SCRIPT }} />
    </>
  );
}
