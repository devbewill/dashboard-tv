#!/usr/bin/env python3
"""Manda la dashboard sulla TV via Chromecast (DashCast web page + fallback PNG).

Con DashCast (`DashCastController`, App ID 84912283) e `force=True` il Chromecast
naviga direttamente con il suo browser Chromium interno a `http://192.168.1.90:3310/`,
mostrando la vera pagina web con orologio live e video YouTube in autoplay.

Accensione della TV: sequenza CEC verificata sulla Philips 32PFS5803/12:
quit_app → start_app(YouTube) → DashCast load_url(..., force=True).

Uso:
    cast_dashboard.py                     # default: pagina web su http://192.168.1.90:3310/
    cast_dashboard.py --png               # vecchio modo: PNG statico da /api/render
    cast_dashboard.py --no-wake           # solo cast, senza ginnastica CEC
"""

from __future__ import annotations

import argparse
import sys
import threading
import time

import pychromecast
from pychromecast.controllers.dashcast import DashCastController

DEFAULT_HOST = "192.168.1.41"
DEFAULT_PORT = 8009
DEFAULT_UUID = "81fe44b3-92f2-f964-a7ca-8279698b19cd"
DEFAULT_NAME = "Camera da letto"
DEFAULT_MODEL = "Eureka Dongle"
DEFAULT_WEB_URL = "http://192.168.1.90:3310/"
DEFAULT_PNG_URL = "http://192.168.1.90:3310/api/render"

DMR = "CC1AD845"  # Default Media Receiver (fallback PNG)
YT = "233637DE"   # YouTube: serve solo a forzare il cambio app per il CEC


def connect(args: argparse.Namespace) -> pychromecast.Chromecast:
    host = (args.host, args.port, args.uuid, args.model, args.name)
    cast = pychromecast.get_chromecast_from_host(host, timeout=15)
    cast.wait(timeout=15)
    return cast


def main() -> int:
    parser = argparse.ArgumentParser(description="Dashboard sulla TV via Chromecast")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--uuid", default=DEFAULT_UUID)
    parser.add_argument("--name", default=DEFAULT_NAME)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--url", default=None)
    parser.add_argument("--png", action="store_true", help="usa il PNG statico /api/render invece della pagina web")
    parser.add_argument("--no-wake", action="store_true", help="non forzare il ciclo CEC")
    parser.add_argument("--wait", type=int, default=8, help="secondi di attesa dopo il cambio app")
    args = parser.parse_args()

    cast = connect(args)
    print(f"chromecast: {cast.name} ({cast.model_name}) stand_by={cast.status.is_stand_by}")

    if not args.no_wake:
        cast.quit_app()
        time.sleep(2)
        try:
            cast.start_app(YT)
        except Exception as exc:
            print(f"start_app YouTube fallito (non bloccante): {exc}")
        time.sleep(args.wait)

    if args.png:
        url = args.url or DEFAULT_PNG_URL
        cast.start_app(DMR)
        time.sleep(2)
        media = cast.media_controller
        media.play_media(url, "image/png", title="Dashboard")
        media.block_until_active(timeout=20)
        print(f"media: {media.status.player_state} content_id={media.status.content_id}")
    else:
        base_url = args.url or DEFAULT_WEB_URL
        sep = "&" if "?" in base_url else "?"
        url = f"{base_url}{sep}t={int(time.time())}"
        dash = DashCastController()
        cast.register_handler(dash)
        done = threading.Event()

        def _cb(msg_sent: bool, response: dict | None) -> None:
            print(f"dashcast: msg_sent={msg_sent} url={url} response={response}")
            done.set()

        dash.load_url(url, force=True, callback_function=_cb)
        done.wait(timeout=20)
        time.sleep(5)
        print(f"status: app_id={cast.status.app_id} display_name={cast.status.display_name}")

    cast.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
