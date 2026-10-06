from app.common.errors import bad_request, forbidden, not_found
from app.common.relationships import is_blocked, is_connected
from app.db import execute, execute_returning, query_all, query_one
from app.notifications.service import notify


def list_conversations(user_id: int) -> list[dict]:
    return query_all(
        """
        WITH connections AS (
            SELECT x.liked_id AS peer_id FROM likes x
            JOIN likes y ON x.liker_id = y.liked_id AND x.liked_id = y.liker_id
            WHERE x.liker_id = %(uid)s
        )
        SELECT u.id, u.username, u.first_name,
               COALESCE(u.last_seen_at > now() - interval '90 seconds', FALSE) AS is_online,
               u.last_seen_at,
               (SELECT filename FROM photos WHERE user_id = u.id AND is_profile LIMIT 1) AS photo,
               (SELECT body FROM messages m
                WHERE (m.sender_id = u.id AND m.recipient_id = %(uid)s)
                   OR (m.sender_id = %(uid)s AND m.recipient_id = u.id)
                ORDER BY m.created_at DESC LIMIT 1) AS last_message,
               (SELECT created_at FROM messages m
                WHERE (m.sender_id = u.id AND m.recipient_id = %(uid)s)
                   OR (m.sender_id = %(uid)s AND m.recipient_id = u.id)
                ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
               (SELECT count(*) FROM messages m
                WHERE m.sender_id = u.id AND m.recipient_id = %(uid)s AND m.read_at IS NULL) AS unread_count
        FROM connections c
        JOIN users u ON u.id = c.peer_id
        WHERE NOT EXISTS (
            SELECT 1 FROM blocks b WHERE (b.blocker_id = %(uid)s AND b.blocked_id = u.id)
                                       OR (b.blocker_id = u.id AND b.blocked_id = %(uid)s)
        )
        ORDER BY last_message_at DESC NULLS LAST
        """,
        {"uid": user_id},
    )


def list_messages(user_id: int, peer_id: int, limit: int = 100) -> list[dict]:
    if not query_one("SELECT id FROM users WHERE id = %s", (peer_id,)):
        raise not_found("User not found")
    if is_blocked(user_id, peer_id):
        raise not_found("User not found")
    execute(
        "UPDATE messages SET read_at = now() WHERE sender_id = %s AND recipient_id = %s AND read_at IS NULL",
        (peer_id, user_id),
    )
    # Keep the "you have a new message" bell badge (visible from any page, per
    # the subject) in sync with what the user actually read -- without this,
    # reading every message in a thread never clears its own notifications.
    execute(
        "UPDATE notifications SET is_read = TRUE "
        "WHERE user_id = %s AND actor_id = %s AND type = 'message' AND is_read = FALSE",
        (user_id, peer_id),
    )
    rows = query_all(
        """
        SELECT id, sender_id, recipient_id, body, created_at, read_at
        FROM messages
        WHERE (sender_id = %s AND recipient_id = %s) OR (sender_id = %s AND recipient_id = %s)
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (user_id, peer_id, peer_id, user_id, limit),
    )
    return list(reversed(rows))


def send_message(sender_id: int, recipient_id: int, body: str) -> dict:
    if sender_id == recipient_id:
        raise bad_request("You cannot message yourself")
    if not query_one("SELECT id FROM users WHERE id = %s", (recipient_id,)):
        raise not_found("User not found")
    if is_blocked(sender_id, recipient_id):
        raise forbidden("You cannot message this user")
    if not is_connected(sender_id, recipient_id):
        raise forbidden("You can only message users you're connected with")

    message = execute_returning(
        "INSERT INTO messages (sender_id, recipient_id, body) VALUES (%s, %s, %s) "
        "RETURNING id, sender_id, recipient_id, body, created_at, read_at",
        (sender_id, recipient_id, body),
    )
    notify(recipient_id, "message", sender_id)
    return message


def delete_message(user_id: int, message_id: int) -> None:
    message = query_one("SELECT id FROM messages WHERE id = %s AND sender_id = %s", (message_id, user_id))
    if not message:
        raise not_found("Message not found")
    execute("DELETE FROM messages WHERE id = %s", (message_id,))
