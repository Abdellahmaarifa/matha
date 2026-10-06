"""Best-effort IP-based geolocation fallback.

The subject requires that a user who declines to share their GPS position
still be locatable, without needing their explicit action -- this is that
fallback. It's applied at login time (see app/auth/service.py) only when the
user has no location on file yet, and never overrides a GPS/manual choice
they've already made.

Uses ip-api.com's free, keyless endpoint. Best-effort: any failure (private/
local IP in dev, network error, rate limit) just means no location gets set,
never an error surfaced to the user.
"""
import ipaddress

import requests

_TIMEOUT_SECONDS = 2


def locate_ip(ip: str) -> dict | None:
    try:
        addr = ipaddress.ip_address(ip)
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            return None
    except ValueError:
        return None

    try:
        resp = requests.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": "status,lat,lon,city,country"},
            timeout=_TIMEOUT_SECONDS,
        )
        data = resp.json()
    except (requests.RequestException, ValueError):
        return None

    if data.get("status") != "success" or data.get("lat") is None:
        return None

    label = ", ".join(part for part in (data.get("city"), data.get("country")) if part) or None
    return {"latitude": data["lat"], "longitude": data["lon"], "label": label}
