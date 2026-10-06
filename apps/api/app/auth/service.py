import datetime as dt
import secrets

from app.common.errors import bad_request, conflict, not_found, unauthorized
from app.common.ip_geo import locate_ip
from app.common.mail import send_reset_email, send_verification_email
from app.common.security import hash_password, issue_access_token, issue_refresh_token, verify_password
from app.db import execute, execute_returning, query_one

VERIFICATION_TTL = dt.timedelta(hours=24)
RESET_TTL = dt.timedelta(hours=1)


def signup_conflicts(email: str | None, username: str | None) -> dict[str, str]:
    """Field -> message for an email/username another account already holds.
    Shared by register() and the /validate pre-check so the form can show
    these before submitting instead of the submit failing with a 409."""
    conflicts: dict[str, str] = {}
    existing = query_one("SELECT id, is_verified FROM users WHERE email = %s", (email,)) if email else None
    if existing and existing["is_verified"]:
        conflicts["email"] = "An account with this email already exists"
    if username and query_one(
        "SELECT id FROM users WHERE username = %s AND id != %s",
        (username, existing["id"] if existing else -1),
    ):
        conflicts["username"] = "This username is already taken"
    return conflicts


def register(email: str, username: str, first_name: str, last_name: str, birth_date, password: str) -> dict:
    conflicts = signup_conflicts(email, username)
    if conflicts:
        raise conflict(next(iter(conflicts.values())))
    existing = query_one("SELECT id FROM users WHERE email = %s", (email,))

    token = secrets.token_urlsafe(32)
    expires = dt.datetime.now(dt.timezone.utc) + VERIFICATION_TTL

    if existing:
        # Same email signed up before but never verified (e.g. they lost the
        # original link) -- update their details and send a fresh token
        # instead of permanently locking the email out with a conflict.
        user = execute_returning(
            """
            UPDATE users
            SET username = %s, first_name = %s, last_name = %s, birth_date = %s,
                password_hash = %s, verification_token = %s, verification_expires = %s
            WHERE id = %s
            RETURNING id, email, username
            """,
            (username, first_name, last_name, birth_date, hash_password(password), token, expires, existing["id"]),
        )
    else:
        user = execute_returning(
            """
            INSERT INTO users (email, username, first_name, last_name, birth_date, password_hash,
                                verification_token, verification_expires)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, email, username
            """,
            (email, username, first_name, last_name, birth_date, hash_password(password), token, expires),
        )
    send_verification_email(email, token)
    return user


def verify_email(token: str) -> None:
    user = query_one(
        "SELECT id, is_verified, verification_expires FROM users WHERE verification_token = %s",
        (token,),
    )
    if not user:
        raise bad_request("Invalid verification link")
    # The token is kept after use so opening the link a second time (mail
    # clients prefetching it, a double click) reports success instead of an error.
    if user["is_verified"]:
        return
    if user["verification_expires"] < dt.datetime.now(dt.timezone.utc):
        raise bad_request("Verification link has expired")
    execute(
        "UPDATE users SET is_verified = TRUE, verification_expires = NULL WHERE id = %s",
        (user["id"],),
    )


def login(identifier: str, password: str, client_ip: str | None = None) -> dict:
    user = query_one(
        "SELECT id, password_hash, is_verified, latitude, longitude FROM users WHERE email = %s OR username = %s",
        (identifier.lower(), identifier),
    )
    if not user or not verify_password(password, user["password_hash"]):
        raise unauthorized("Incorrect username/email or password")
    if not user["is_verified"]:
        raise unauthorized("Please verify your email before logging in")

    execute("UPDATE users SET is_online = TRUE, last_seen_at = now() WHERE id = %s", (user["id"],))

    # Subject requirement: a user who never grants GPS and never picks a city
    # manually must still end up locatable -- fall back to IP geolocation,
    # silently, without asking. Never runs again once *any* location is set.
    if user["latitude"] is None and client_ip:
        located = locate_ip(client_ip)
        if located:
            execute(
                "UPDATE users SET latitude = %s, longitude = %s, location_label = %s, "
                "location_source = 'ip', updated_at = now() WHERE id = %s",
                (located["latitude"], located["longitude"], located["label"], user["id"]),
            )

    return {
        "access_token": issue_access_token(user["id"]),
        "refresh_token": issue_refresh_token(user["id"]),
        "user_id": user["id"],
    }


def logout(user_id: int) -> None:
    execute("UPDATE users SET is_online = FALSE, last_seen_at = now() WHERE id = %s", (user_id,))


def refresh(user_id: int) -> dict:
    if not query_one("SELECT id FROM users WHERE id = %s", (user_id,)):
        raise not_found("User not found")
    return {"access_token": issue_access_token(user_id)}


def forgot_password(email: str) -> None:
    user = query_one("SELECT id FROM users WHERE email = %s", (email,))
    if not user:
        return  # don't leak whether the email exists
    token = secrets.token_urlsafe(32)
    expires = dt.datetime.now(dt.timezone.utc) + RESET_TTL
    execute(
        "UPDATE users SET reset_token = %s, reset_expires = %s WHERE id = %s",
        (token, expires, user["id"]),
    )
    send_reset_email(email, token)


def _valid_reset_user(token: str) -> dict | None:
    user = query_one("SELECT id, reset_expires FROM users WHERE reset_token = %s", (token,))
    if not user or user["reset_expires"] < dt.datetime.now(dt.timezone.utc):
        return None
    return user


def reset_token_valid(token: str) -> bool:
    return _valid_reset_user(token) is not None


def reset_password(token: str, new_password: str) -> None:
    user = _valid_reset_user(token)
    if not user:
        raise bad_request("Invalid or expired reset link")
    execute(
        "UPDATE users SET password_hash = %s, reset_token = NULL, reset_expires = NULL WHERE id = %s",
        (hash_password(new_password), user["id"]),
    )
