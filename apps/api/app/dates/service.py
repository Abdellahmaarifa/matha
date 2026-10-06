import datetime as dt

from app.common.errors import bad_request, forbidden, not_found
from app.common.relationships import is_blocked, is_connected
from app.db import execute, execute_returning, query_all, query_one
from app.notifications.service import notify

_COLUMNS = (
    "id, proposer_id, recipient_id, title, location_label, latitude, longitude, "
    "scheduled_at, note, status, created_at"
)


def _require_connected(a: int, b: int) -> None:
    if a == b:
        raise bad_request("You cannot plan a date with yourself")
    if not query_one("SELECT id FROM users WHERE id = %s", (b,)):
        raise not_found("User not found")
    if is_blocked(a, b):
        raise forbidden("You cannot plan a date with this user")
    if not is_connected(a, b):
        raise forbidden("You can only plan dates with users you're connected with")


def propose_date(
    proposer_id: int, recipient_id: int, title: str, location_label: str,
    latitude: float | None, longitude: float | None, scheduled_at: dt.datetime, note: str,
) -> dict:
    _require_connected(proposer_id, recipient_id)
    if scheduled_at <= dt.datetime.now(dt.timezone.utc):
        raise bad_request("Pick a date and time in the future")

    date = execute_returning(
        f"""
        INSERT INTO dates (proposer_id, recipient_id, title, location_label, latitude, longitude,
                            scheduled_at, note)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING {_COLUMNS}
        """,
        (proposer_id, recipient_id, title, location_label, latitude, longitude, scheduled_at, note),
    )
    notify(recipient_id, "date_proposed", proposer_id)
    return date


def list_dates_with(user_id: int, peer_id: int) -> list[dict]:
    return query_all(
        f"""
        SELECT {_COLUMNS} FROM dates
        WHERE (proposer_id = %s AND recipient_id = %s) OR (proposer_id = %s AND recipient_id = %s)
        ORDER BY scheduled_at ASC
        """,
        (user_id, peer_id, peer_id, user_id),
    )


def _get_participant_date(user_id: int, date_id: int) -> dict:
    date = query_one(
        f"SELECT {_COLUMNS} FROM dates WHERE id = %s AND (proposer_id = %s OR recipient_id = %s)",
        (date_id, user_id, user_id),
    )
    if not date:
        raise not_found("Date not found")
    return date


def respond_to_date(user_id: int, date_id: int, status: str) -> dict:
    date = _get_participant_date(user_id, date_id)
    if date["recipient_id"] != user_id:
        raise forbidden("Only the person invited can respond to this date")
    if date["status"] != "pending":
        raise bad_request("This date has already been responded to")

    updated = execute_returning(
        f"UPDATE dates SET status = %s, updated_at = now() WHERE id = %s RETURNING {_COLUMNS}",
        (status, date_id),
    )
    notify(date["proposer_id"], "date_accepted" if status == "accepted" else "date_declined", user_id)
    return updated


def cancel_date(user_id: int, date_id: int) -> None:
    date = _get_participant_date(user_id, date_id)
    if date["status"] == "cancelled":
        return
    execute("UPDATE dates SET status = 'cancelled', updated_at = now() WHERE id = %s", (date_id,))
    other_id = date["recipient_id"] if date["proposer_id"] == user_id else date["proposer_id"]
    notify(other_id, "date_cancelled", user_id)
