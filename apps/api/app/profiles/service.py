import os
import uuid

from flask import current_app

from app.common.errors import bad_request, conflict, forbidden, not_found
from app.common.fame import refresh_fame_rating
from app.common.relationships import is_blocked
from app.db import cursor as db_cursor
from app.db import execute, execute_returning, query_all, query_one

PUBLIC_USER_COLUMNS = """
    id, username, first_name, last_name, gender, sexual_pref, biography,
    latitude, longitude, location_label, fame_rating,
    COALESCE(last_seen_at > now() - interval '90 seconds', FALSE) AS is_online,
    last_seen_at, created_at,
    date_part('year', age(birth_date))::int AS age
"""


def get_own_profile(user_id: int) -> dict:
    user = query_one(
        f"SELECT {PUBLIC_USER_COLUMNS}, email, location_source FROM users WHERE id = %s",
        (user_id,),
    )
    if not user:
        raise not_found("User not found")
    user["tags"] = _tags_for(user_id)
    user["photos"] = _photos_for(user_id)
    user["profile_complete"] = _is_profile_complete(user)
    return user


def _is_profile_complete(user: dict) -> bool:
    """Subject requirement (IV.2): 'Once his profile is complete, he can
    access the website.' A profile counts as complete once every field it
    asks the user to fill in during onboarding actually has a value --
    gender is the only one of those columns without a DB default, so it
    doubles as the signal that this user has never gone through the form."""
    return (
        user.get("gender") is not None
        and bool((user.get("biography") or "").strip())
        and len(user.get("tags") or []) > 0
        and len(user.get("photos") or []) > 0
    )


def is_profile_complete(user_id: int) -> bool:
    """Same completeness check as `_is_profile_complete`, but fetching just
    enough columns to answer for an arbitrary user id -- used by
    `require_complete_profile` so the server-side gate and the `/api/me`
    response stay backed by one definition."""
    user = query_one("SELECT gender, biography FROM users WHERE id = %s", (user_id,))
    if not user:
        return False
    user["tags"] = _tags_for(user_id)
    user["photos"] = _photos_for(user_id)
    return _is_profile_complete(user)


def _tags_for(user_id: int) -> list[str]:
    rows = query_all(
        "SELECT t.name FROM tags t JOIN user_tags ut ON ut.tag_id = t.id "
        "WHERE ut.user_id = %s ORDER BY t.name",
        (user_id,),
    )
    return [r["name"] for r in rows]


def _photos_for(user_id: int) -> list[dict]:
    return query_all(
        "SELECT id, filename, is_profile, position FROM photos "
        "WHERE user_id = %s ORDER BY position",
        (user_id,),
    )


def email_taken(user_id: int, email: str) -> bool:
    return query_one("SELECT id FROM users WHERE email = %s AND id != %s", (email, user_id)) is not None


def update_profile(user_id: int, fields: dict) -> dict:
    allowed = {"first_name", "last_name", "email", "gender", "sexual_pref", "biography"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_own_profile(user_id)
    if "email" in updates and email_taken(user_id, updates["email"]):
        raise conflict("An account with this email already exists")
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    execute(
        f"UPDATE users SET {set_clause}, updated_at = now() WHERE id = %s",
        (*updates.values(), user_id),
    )
    return get_own_profile(user_id)


def update_tags(user_id: int, tags: list[str]) -> list[str]:
    execute("DELETE FROM user_tags WHERE user_id = %s", (user_id,))
    for name in tags:
        tag = query_one("SELECT id FROM tags WHERE name = %s", (name,))
        if not tag:
            tag = execute_returning("INSERT INTO tags (name) VALUES (%s) RETURNING id", (name,))
        execute(
            "INSERT INTO user_tags (user_id, tag_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (user_id, tag["id"]),
        )
    return tags


def update_location(user_id: int, latitude: float, longitude: float, source: str, label: str | None) -> None:
    execute(
        "UPDATE users SET latitude = %s, longitude = %s, location_source = %s, "
        "location_label = %s, updated_at = now() WHERE id = %s",
        (latitude, longitude, source, label, user_id),
    )


def save_photo(user_id: int, file_storage) -> dict:
    # Cheap, non-authoritative fast path: reject an already-full profile
    # before spending time decoding/writing the file. The real check that
    # actually prevents a race is the re-check inside the locked transaction
    # below -- this is just to avoid an unreferenced orphan file on disk in
    # the common (non-racing) case of a profile that's already at the cap.
    count = query_one("SELECT count(*) AS n FROM photos WHERE user_id = %s", (user_id,))["n"]
    if count >= 5:
        raise conflict("You can only have up to 5 photos")

    mimetype = file_storage.mimetype
    allowed = current_app.config["ALLOWED_PHOTO_TYPES"]
    if mimetype not in allowed:
        raise bad_request("Only JPEG, PNG or WEBP images are allowed")

    file_storage.stream.seek(0, os.SEEK_END)
    size = file_storage.stream.tell()
    file_storage.stream.seek(0)
    if size > current_app.config["MAX_PHOTO_BYTES"]:
        raise bad_request("Image is too large (max 5MB)")

    # Don't trust the client-supplied Content-Type: decode the actual bytes so
    # a renamed script or other payload can't ride in as a fake ".jpg".
    try:
        from PIL import Image

        with Image.open(file_storage.stream) as image:
            image.verify()
    except Exception as exc:
        raise bad_request("This file is not a valid image") from exc
    finally:
        file_storage.stream.seek(0)

    extension = allowed[mimetype]
    filename = f"{uuid.uuid4().hex}{extension}"
    os.makedirs(current_app.config["UPLOAD_DIR"], exist_ok=True)
    file_storage.save(os.path.join(current_app.config["UPLOAD_DIR"], filename))

    # Lock the user row for the duration of the count-check-and-insert so two
    # concurrent uploads can't both read the same stale count: the second
    # waits here until the first transaction commits, then sees the
    # up-to-date count. This guards both the "up to 5 photos" cap and the
    # "first photo becomes the profile picture" invariant -- checking the cap
    # before taking the lock (as opposed to inside it) would let two
    # concurrent uploads at count=4 both pass and both insert, silently
    # exceeding 5.
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s FOR UPDATE", (user_id,))
        cur.execute("SELECT count(*) AS n FROM photos WHERE user_id = %s", (user_id,))
        current_count = cur.fetchone()["n"]
        if current_count >= 5:
            raise conflict("You can only have up to 5 photos")
        is_first = current_count == 0
        cur.execute(
            "INSERT INTO photos (user_id, filename, position, is_profile) VALUES (%s, %s, %s, %s) "
            "RETURNING id, filename, is_profile, position",
            (user_id, filename, current_count, is_first),
        )
        return dict(cur.fetchone())


def delete_photo(user_id: int, photo_id: int) -> None:
    photo = query_one("SELECT id, filename, is_profile FROM photos WHERE id = %s AND user_id = %s",
                       (photo_id, user_id))
    if not photo:
        raise not_found("Photo not found")
    execute("DELETE FROM photos WHERE id = %s", (photo_id,))
    path = os.path.join(current_app.config["UPLOAD_DIR"], photo["filename"])
    if os.path.exists(path):
        os.remove(path)
    if photo["is_profile"]:
        next_photo = query_one("SELECT id FROM photos WHERE user_id = %s ORDER BY position LIMIT 1", (user_id,))
        if next_photo:
            execute("UPDATE photos SET is_profile = TRUE WHERE id = %s", (next_photo["id"],))


def set_profile_photo(user_id: int, photo_id: int) -> None:
    # Same user-row lock as save_photo(): the clear-then-set pair below isn't
    # atomic on its own, so without serializing concurrent calls two
    # simultaneous "set profile picture" requests could each clear then set a
    # different photo, leaving two rows is_profile=TRUE (which the
    # idx_photos_one_profile_per_user partial unique index would then reject
    # with an unhandled UniqueViolation).
    with db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE id = %s FOR UPDATE", (user_id,))
        cur.execute("SELECT id FROM photos WHERE id = %s AND user_id = %s", (photo_id, user_id))
        if not cur.fetchone():
            raise not_found("Photo not found")
        cur.execute("UPDATE photos SET is_profile = FALSE WHERE user_id = %s", (user_id,))
        cur.execute("UPDATE photos SET is_profile = TRUE WHERE id = %s", (photo_id,))


def get_public_profile(viewer_id: int, target_id: int) -> dict:
    if viewer_id != target_id and is_blocked(viewer_id, target_id):
        raise not_found("User not found")

    user = query_one(f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = %s", (target_id,))
    if not user:
        raise not_found("User not found")
    user["tags"] = _tags_for(target_id)
    user["photos"] = _photos_for(target_id)
    user["profile_complete"] = _is_profile_complete(user)

    if viewer_id != target_id:
        execute("INSERT INTO visits (visitor_id, visited_id) VALUES (%s, %s)", (viewer_id, target_id))
        refresh_fame_rating(target_id)
        from app.notifications.service import notify
        notify(target_id, "view", viewer_id)

    liked_by_me = query_one("SELECT 1 FROM likes WHERE liker_id = %s AND liked_id = %s",
                             (viewer_id, target_id)) is not None
    likes_me = query_one("SELECT 1 FROM likes WHERE liker_id = %s AND liked_id = %s",
                          (target_id, viewer_id)) is not None
    user["liked_by_me"] = liked_by_me
    user["likes_me"] = likes_me
    user["connected"] = liked_by_me and likes_me
    return user


def list_visitors(user_id: int) -> list[dict]:
    # One row per visitor (most recent visit), but `visit_count` surfaces the
    # full repeat-visit history instead of silently collapsing it away --
    # the subject requires "a history of visits", not just a yes/no list.
    return query_all(
        """
        SELECT DISTINCT ON (v.visitor_id) v.visitor_id AS id, u.username, u.first_name,
               u.fame_rating, v.created_at AS visited_at,
               (SELECT count(*) FROM visits v2
                WHERE v2.visitor_id = v.visitor_id AND v2.visited_id = %(uid)s) AS visit_count,
               (SELECT filename FROM photos WHERE user_id = u.id AND is_profile LIMIT 1) AS photo
        FROM visits v JOIN users u ON u.id = v.visitor_id
        WHERE v.visited_id = %(uid)s
          AND NOT EXISTS (
              SELECT 1 FROM blocks b WHERE (b.blocker_id = %(uid)s AND b.blocked_id = v.visitor_id)
                                         OR (b.blocker_id = v.visitor_id AND b.blocked_id = %(uid)s)
          )
        ORDER BY v.visitor_id, v.created_at DESC
        """,
        {"uid": user_id},
    )


def list_likers(user_id: int) -> list[dict]:
    return query_all(
        """
        SELECT l.liker_id AS id, u.username, u.first_name, u.fame_rating, l.created_at AS liked_at,
               (SELECT filename FROM photos WHERE user_id = u.id AND is_profile LIMIT 1) AS photo
        FROM likes l JOIN users u ON u.id = l.liker_id
        WHERE l.liked_id = %(uid)s
          AND NOT EXISTS (
              SELECT 1 FROM blocks b WHERE (b.blocker_id = %(uid)s AND b.blocked_id = l.liker_id)
                                         OR (b.blocker_id = l.liker_id AND b.blocked_id = %(uid)s)
          )
        ORDER BY l.created_at DESC
        """,
        {"uid": user_id},
    )
