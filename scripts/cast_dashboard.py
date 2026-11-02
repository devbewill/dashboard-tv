#!/usr/bin/env python3
"""Manda la dashboard sulla TV via Chromecast.

Il Chromecast non visualizza HTML: gli si passa l'URL del PNG generato da
`/api/render` della dashboard (1920×1080, già impaginato per il televisore).

Accensione della TV: con `Default Media Receiver` già attivo un `play_media` non
riarma il segnale HDMI-CEC, quindi la TV resta spenta. Sequenza che ha funzionato
sulla Philips 32PFS5803/12: quit_app → start_app(YouTube) → start_app(DMR) → media.

Uso:
    cast_dashboard.py                     # default: dashboard-tv su 192.168.1.90
    cast_dashboard.py --no-wake           # solo cast, senza ginnastica CEC
    cast_dashboard.py --url http://…/api/render --name "Camera da letto"
"""

from __future__ import annotations

import argparse
import sys
import time

import pychromecast

DEFAULT_HOST = "192.168.1.41"
DEFAULT_PORT = 8009
DEFAULT_UUID = "81fe44b3-92f2-f964-a7ca-8279698b19cd"
DEFAULT_NAME = "Camera da letto"
DEFAULT_MODEL = "Eureka Dongle"
DEFAULT_URL = "http://192.168.1.90:3310/api/render"

DMR = "CC1AD845"  # Default Media Receiver
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
    parser.add_argument("--url", default=DEFAULT_URL)
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
        except Exception as exc:  # l'app può non essere disponibile in certi firmware
            print(f"start_app YouTube fallito (non bloccante): {exc}")
        time.sleep(args.wait)

    cast.start_app(DMR)
    time.sleep(2)

    media = cast.media_controller
    media.play_media(args.url, "image/png", title="Dashboard")
    media.block_until_active(timeout=20)
    print(f"media: {media.status.player_state} content_id={media.status.content_id}")

    cast.disconnect()
    return 0


if __name__ == "__main__":
    sys.exit(main())
