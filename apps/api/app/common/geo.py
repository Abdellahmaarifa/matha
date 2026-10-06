"""Haversine distance, computed in raw SQL (no PostGIS dependency)."""

# Usage: SELECT ..., {HAVERSINE_KM} AS distance_km FROM users WHERE ...
# Bind params (in order): origin_lat, origin_lat, origin_lat... -> we use named
# params instead so callers can interpolate with %(origin_lat)s / %(origin_lng)s.
HAVERSINE_KM_SQL = """(
    6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
            cos(radians(%(origin_lat)s)) * cos(radians(u.latitude)) *
            cos(radians(u.longitude) - radians(%(origin_lng)s)) +
            sin(radians(%(origin_lat)s)) * sin(radians(u.latitude))
        ))
    )
)"""
