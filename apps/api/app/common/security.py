import datetime as dt
from functools import wraps

import bcrypt
import jwt
from flask import current_app, g, request

from app.common.errors import forbidden, unauthorized
from app.db import execute


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))


def _encode(user_id: int, token_type: str, ttl: dt.timedelta) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def issue_access_token(user_id: int) -> str:
    ttl = dt.timedelta(minutes=current_app.config["JWT_ACCESS_TTL_MIN"])
    return _encode(user_id, "access", ttl)


def issue_refresh_token(user_id: int) -> str:
    ttl = dt.timedelta(days=current_app.config["JWT_REFRESH_TTL_DAYS"])
    return _encode(user_id, "refresh", ttl)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise unauthorized("Invalid or expired token") from exc


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise unauthorized()
        payload = decode_token(header.removeprefix("Bearer ").strip())
        if payload.get("type") != "access":
            raise unauthorized()
        g.user_id = int(payload["sub"])
        # Cheap heartbeat: the frontend already polls several endpoints every
        # 3-5s while a tab is open (see TanStack Query refetchInterval), so
        # this keeps last_seen_at fresh for free while active and lets it go
        # stale within seconds of the tab closing -- read paths derive
        # "online now" from this instead of trusting the sticky is_online
        # column, which login()/logout() still set but nothing else reads.
        execute("UPDATE users SET last_seen_at = now() WHERE id = %s", (g.user_id,))
        return fn(*args, **kwargs)

    return wrapper


def require_complete_profile(fn):
    """Subject requirement (IV.2): 'Once his profile is complete, he can
    access the website' -- this was previously only enforced by a client-side
    redirect, so hitting the API directly (curl, devtools) bypassed it
    entirely. Must sit below @require_auth so g.user_id is already set.
    Lazy-imports profiles.service to avoid a module-level import cycle."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        from app.profiles.service import is_profile_complete

        if not is_profile_complete(g.user_id):
            raise forbidden("Complete your profile before using this feature")
        return fn(*args, **kwargs)

    return wrapper


def current_user_id() -> int:
    return g.user_id
