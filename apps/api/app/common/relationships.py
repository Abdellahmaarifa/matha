"""Shared "are these two users connected / blocked" checks -- used by chat and
the dates feature, both of which only work between mutually-liked users."""
from app.db import query_one


def is_connected(a: int, b: int) -> bool:
    return query_one(
        "SELECT 1 FROM likes x JOIN likes y ON x.liker_id = y.liked_id AND x.liked_id = y.liker_id "
        "WHERE x.liker_id = %s AND x.liked_id = %s",
        (a, b),
    ) is not None


def is_blocked(a: int, b: int) -> bool:
    return query_one(
        "SELECT 1 FROM blocks WHERE (blocker_id = %s AND blocked_id = %s) "
        "OR (blocker_id = %s AND blocked_id = %s)",
        (a, b, b, a),
    ) is not None
