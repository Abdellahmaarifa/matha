"""Best-effort IP-based geolocation fallback.

The subject requires that a user who declines to share their GPS position
still be locatable, without needing their explicit action -- this is that
fallback. `locate_user_if_missing` runs at login and on GET /api/me, only
when the user has no location on file yet, and never overrides a GPS/manual
choice they've already made.

Uses ip-api.com's free, keyless endpoint. Best-effort: any failure (network
error, rate limit) just means no location gets set, never an error surfaced
to the user -- the profile-completeness gate then asks them to pick a city.
"""
import ipaddress
import time

import requests
from flask import request

from app.db import execute, query_one

_TIMEOUT_SECONDS = 2
_FAILURE_TTL_SECONDS = 10 * 60

# Per-worker memo of lookups that just failed, so a user without a location
# doesn't pay the lookup timeout on every /api/me while ip-api is unreachable.
_recent_failures: dict[str, float] = {}


def client_ip() -> str | None:
    # Prefer X-Forwarded-For (set by a reverse proxy in front of the API) over
    # the raw socket address, which behind such a proxy is just the proxy itself.
    forwarded = request.headers.get("X-Forwarded-For", "")
    return forwarded.split(",")[0].strip() or request.remote_addr


def locate_ip(ip: str) -> dict | None:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return None
    # A private/loopback address means the browser sits on the same machine or
    # network as the API (local dev, Docker, the Vite proxy): ip-api can't place
    # it, so locate this network's public IP instead -- an empty path makes
    # ip-api geolocate the caller, which is the same network in that case.
    is_local = addr.is_private or addr.is_loopback or addr.is_link_local
    target = "" if is_local else ip

    failed_at = _recent_failures.get(target)
    if failed_at and time.monotonic() - failed_at < _FAILURE_TTL_SECONDS:
        return None

    try:
        resp = requests.get(
            f"http://ip-api.com/json/{target}",
            params={"fields": "status,lat,lon,city,country"},
            timeout=_TIMEOUT_SECONDS,
        )
        data = resp.json()
    except (requests.RequestException, ValueError):
        data = {}

    if data.get("status") != "success" or data.get("lat") is None:
        _recent_failures[target] = time.monotonic()
        return None

    label = ", ".join(part for part in (data.get("city"), data.get("country")) if part) or None
    return {"latitude": data["lat"], "longitude": data["lon"], "label": label}


def locate_user_if_missing(user_id: int, ip: str | None) -> None:
    if not ip:
        return
    user = query_one("SELECT latitude FROM users WHERE id = %s", (user_id,))
    if not user or user["latitude"] is not None:
        return
    located = locate_ip(ip)
    if located:
        execute(
            "UPDATE users SET latitude = %s, longitude = %s, location_label = %s, "
            "location_source = 'ip', updated_at = now() WHERE id = %s AND latitude IS NULL",
            (located["latitude"], located["longitude"], located["label"], user_id),
        )
