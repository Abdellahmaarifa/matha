"""Dependency-free sliding-window rate limiter, backed by Postgres.

No validation/ORM-style library is used elsewhere in this codebase on
purpose (see app/common/validation.py), and the same "write it yourself"
spirit applies here: no new pip dependency (no Redis) -- just a small table
of hit timestamps keyed by client IP + route, pruned lazily on access.

The counter lives in Postgres rather than an in-process dict because
gunicorn runs multiple worker processes (`-w N`): an in-memory dict would
give each worker its own independent counter, making the effective limit
N times looser than configured. A shared table keeps it accurate regardless
of which worker handles a given request.
"""
from functools import wraps

from flask import jsonify, request

from app.db import execute, query_one


def _client_ip() -> str:
    # Same precedence as auth/routes.py's login(): prefer the reverse proxy's
    # X-Forwarded-For over the raw socket address.
    forwarded = request.headers.get("X-Forwarded-For", "")
    return forwarded.split(",")[0].strip() or request.remote_addr or "unknown"


def rate_limit(max_attempts: int, window_seconds: int):
    """Reject with 429 once `max_attempts` requests from the same client IP
    hit this route within a `window_seconds` sliding window."""

    def decorator(fn):
        key_prefix = fn.__name__

        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = f"{key_prefix}:{_client_ip()}"

            # Prune this key's old rows opportunistically so the table stays
            # small, then count what's left in the current window.
            execute(
                "DELETE FROM rate_limit_hits WHERE key = %s AND hit_at <= now() - make_interval(secs => %s)",
                (key, window_seconds),
            )
            count = query_one(
                "SELECT count(*) AS n FROM rate_limit_hits WHERE key = %s", (key,)
            )["n"]
            if count >= max_attempts:
                response = jsonify({
                    "error": "rate_limited",
                    "message": "Too many attempts, please try again later",
                    "fields": {},
                })
                return response, 429

            execute("INSERT INTO rate_limit_hits (key) VALUES (%s)", (key,))
            return fn(*args, **kwargs)

        return wrapper

    return decorator
