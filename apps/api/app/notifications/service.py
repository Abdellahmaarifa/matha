from app.db import execute, query_all, query_one

VALID_TYPES = {
    "like", "unlike", "view", "message", "match",
    "date_proposed", "date_accepted", "date_declined", "date_cancelled",
}


def notify(user_id: int, type_: str, actor_id: int | None) -> None:
    if type_ not in VALID_TYPES:
        raise ValueError(f"Unknown notification type: {type_}")
    if actor_id == user_id:
        return
    execute(
        "INSERT INTO notifications (user_id, type, actor_id) VALUES (%s, %s, %s)",
        (user_id, type_, actor_id),
    )


# Notifications from someone either side has since blocked are hidden: their
# profile is no longer reachable, so the entry would only link to a 404.
_NOT_BLOCKED = (
    "NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = n.user_id AND b.blocked_id = n.actor_id) "
    "OR (b.blocker_id = n.actor_id AND b.blocked_id = n.user_id))"
)


def list_notifications(user_id: int, limit: int = 50) -> list[dict]:
    return query_all(
        f"""
        SELECT n.id, n.type, n.is_read, n.created_at, n.actor_id,
               u.username AS actor_username, u.first_name AS actor_first_name,
               (SELECT filename FROM photos WHERE user_id = u.id AND is_profile LIMIT 1) AS actor_photo
        FROM notifications n
        LEFT JOIN users u ON u.id = n.actor_id
        WHERE n.user_id = %s AND {_NOT_BLOCKED}
        ORDER BY n.created_at DESC
        LIMIT %s
        """,
        (user_id, limit),
    )


def unread_count(user_id: int) -> int:
    row = query_one(
        f"SELECT count(*) AS n FROM notifications n WHERE n.user_id = %s AND n.is_read = FALSE AND {_NOT_BLOCKED}",
        (user_id,),
    )
    return row["n"]


def mark_read(user_id: int, notification_id: int) -> None:
    execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
        (notification_id, user_id),
    )


def mark_all_read(user_id: int) -> None:
    execute("UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND is_read = FALSE", (user_id,))
