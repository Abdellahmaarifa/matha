from app.common.errors import bad_request, conflict, forbidden, not_found
from app.common.fame import refresh_fame_rating
from app.common.geo import HAVERSINE_KM_SQL
from app.common.relationships import is_blocked
from app.db import execute, execute_returning, query_all, query_one
from app.notifications.service import notify


def _allowed_genders_for(gender: str | None, pref: str | None) -> set[str] | None:
    """None means 'no gender filter' (bisexual, unspecified, or non-binary self)."""
    pref = pref or "bisexual"
    if pref == "bisexual":
        return None
    if pref == "heterosexual":
        return {"woman"} if gender == "man" else {"man"} if gender == "woman" else None
    if pref == "homosexual":
        return {gender} if gender in ("man", "woman") else None
    return None


def like_user(liker_id: int, liked_id: int) -> dict:
    if liker_id == liked_id:
        raise bad_request("You cannot like yourself")
    target = query_one("SELECT id FROM users WHERE id = %s", (liked_id,))
    if not target:
        raise not_found("User not found")
    if is_blocked(liker_id, liked_id):
        raise not_found("User not found")

    has_picture = query_one("SELECT 1 FROM photos WHERE user_id = %s AND is_profile", (liker_id,))
    if not has_picture:
        raise forbidden("Add a profile picture before liking someone")

    # Idempotent insert: two near-simultaneous clicks (or a double-click before the
    # UI re-renders as pending) can both pass a prior "already liked?" check and
    # both try to insert, so rely on the DB's UNIQUE (liker_id, liked_id) constraint
    # via ON CONFLICT DO NOTHING instead of a separate SELECT-then-INSERT.
    inserted = execute_returning(
        "INSERT INTO likes (liker_id, liked_id) VALUES (%s, %s) "
        "ON CONFLICT (liker_id, liked_id) DO NOTHING RETURNING liker_id",
        (liker_id, liked_id),
    )
    if not inserted:
        return {"connected": _mutual(liker_id, liked_id)}

    refresh_fame_rating(liked_id)
    refresh_fame_rating(liker_id)

    if _mutual(liker_id, liked_id):
        notify(liked_id, "match", liker_id)
        notify(liker_id, "match", liked_id)
        return {"connected": True}

    notify(liked_id, "like", liker_id)
    return {"connected": False}


def _mutual(a: int, b: int) -> bool:
    return query_one(
        "SELECT 1 FROM likes WHERE liker_id = %s AND liked_id = %s",
        (b, a),
    ) is not None


def unlike_user(liker_id: int, liked_id: int) -> None:
    was_mutual = _mutual(liker_id, liked_id)
    execute("DELETE FROM likes WHERE liker_id = %s AND liked_id = %s", (liker_id, liked_id))
    refresh_fame_rating(liked_id)
    refresh_fame_rating(liker_id)
    if was_mutual:
        notify(liked_id, "unlike", liker_id)


def block_user(blocker_id: int, blocked_id: int) -> None:
    if blocker_id == blocked_id:
        raise bad_request("You cannot block yourself")
    if not query_one("SELECT id FROM users WHERE id = %s", (blocked_id,)):
        raise not_found("User not found")
    execute(
        "INSERT INTO blocks (blocker_id, blocked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (blocker_id, blocked_id),
    )


def report_user(reporter_id: int, reported_id: int, reason: str) -> None:
    if reporter_id == reported_id:
        raise bad_request("You cannot report yourself")
    if not query_one("SELECT id FROM users WHERE id = %s", (reported_id,)):
        raise not_found("User not found")
    execute(
        "INSERT INTO reports (reporter_id, reported_id, reason) VALUES (%s, %s, %s) "
        "ON CONFLICT (reporter_id, reported_id) DO UPDATE SET reason = EXCLUDED.reason",
        (reporter_id, reported_id, reason),
    )


_SORT_COLUMNS = {
    "age": "age",
    "location": "distance_km",
    "fame_rating": "fame_rating",
    "tags": "shared_tags",
}


def _base_candidates_sql(viewer_id: int, viewer: dict, filters: dict) -> tuple[str, dict]:
    allowed_genders = _allowed_genders_for(viewer["gender"], viewer["sexual_pref"])
    has_viewer_location = viewer["latitude"] is not None and viewer["longitude"] is not None
    distance_expr = HAVERSINE_KM_SQL if has_viewer_location else "NULL"

    conditions = [
        "u.id <> %(viewer_id)s",
        "u.is_verified = TRUE",
        "NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = %(viewer_id)s AND b.blocked_id = u.id) "
        "OR (b.blocker_id = u.id AND b.blocked_id = %(viewer_id)s))",
    ]
    params: dict = {"viewer_id": viewer_id}
    if has_viewer_location:
        params["origin_lat"] = viewer["latitude"]
        params["origin_lng"] = viewer["longitude"]

    if allowed_genders:
        conditions.append("u.gender = ANY(%(genders)s)")
        params["genders"] = list(allowed_genders)

    if filters.get("min_age") is not None:
        conditions.append("date_part('year', age(u.birth_date)) >= %(min_age)s")
        params["min_age"] = filters["min_age"]
    if filters.get("max_age") is not None:
        conditions.append("date_part('year', age(u.birth_date)) <= %(max_age)s")
        params["max_age"] = filters["max_age"]
    if filters.get("min_fame") is not None:
        conditions.append("u.fame_rating >= %(min_fame)s")
        params["min_fame"] = filters["min_fame"]
    if filters.get("max_fame") is not None:
        conditions.append("u.fame_rating <= %(max_fame)s")
        params["max_fame"] = filters["max_fame"]
    if filters.get("location"):
        conditions.append("u.location_label ILIKE %(location)s")
        params["location"] = f"%{filters['location']}%"
    if filters.get("tags"):
        conditions.append(
            "u.id IN (SELECT ut.user_id FROM user_tags ut JOIN tags t ON t.id = ut.tag_id "
            "WHERE t.name = ANY(%(tags)s))"
        )
        params["tags"] = filters["tags"]

    sql = f"""
        SELECT u.id, u.username, u.first_name, u.gender, u.sexual_pref, u.fame_rating,
               u.location_label,
               COALESCE(u.last_seen_at > now() - interval '90 seconds', FALSE) AS is_online,
               date_part('year', age(u.birth_date))::int AS age,
               {distance_expr} AS distance_km,
               (SELECT filename FROM photos WHERE user_id = u.id AND is_profile LIMIT 1) AS photo,
               COALESCE((SELECT count(*) FROM user_tags ut1 JOIN user_tags ut2
                         ON ut1.tag_id = ut2.tag_id
                         WHERE ut1.user_id = u.id AND ut2.user_id = %(viewer_id)s), 0) AS shared_tags,
               -- Randomly jittered by up to ~1km so the map (bonus feature) shows other
               -- users' whereabouts at neighborhood precision, never their exact address.
               CASE WHEN u.latitude IS NULL THEN NULL ELSE u.latitude + (random() - 0.5) * 0.018 END AS latitude,
               CASE WHEN u.longitude IS NULL THEN NULL ELSE u.longitude + (random() - 0.5) * 0.018 END AS longitude
        FROM users u
        WHERE {' AND '.join(conditions)}
    """
    return sql, params


PAGE_SIZE = 60


def browse(viewer_id: int, filters: dict, sort: str | None, offset: int = 0) -> list[dict]:
    viewer = query_one("SELECT gender, sexual_pref, latitude, longitude FROM users WHERE id = %s", (viewer_id,))
    if not viewer:
        raise not_found("User not found")

    base_sql, params = _base_candidates_sql(viewer_id, viewer, filters)
    order_col = _SORT_COLUMNS.get(sort)
    if order_col:
        direction = "DESC" if order_col in ("fame_rating", "shared_tags") else "ASC"
        order_by = f"{order_col} {direction} NULLS LAST"
    else:
        # Default suggestion ranking: one weighted score, so all three criteria
        # actually move the order (a plain "distance, then tags, then fame" ORDER BY
        # almost never reaches the tie-breakers, since distances are never equal).
        # Each part is normalized to 0..1 before weighting:
        #   proximity   = 1 / (1 + km/10)   -> 1 at 0 km, 0.5 at 10 km, 0 if unknown
        #   tag_overlap = shared / viewer's tag count
        #   fame        = fame_rating / 100
        order_by = (
            "(0.5 * COALESCE(1.0 / (1.0 + distance_km / 10.0), 0)"
            " + 0.3 * shared_tags::float / GREATEST(1, %(viewer_tag_count)s)"
            " + 0.2 * fame_rating / 100.0) DESC, distance_km ASC NULLS LAST"
        )
        params["viewer_tag_count"] = query_one(
            "SELECT count(*) AS n FROM user_tags WHERE user_id = %s", (viewer_id,)
        )["n"]

    # ORDER BY must run against the materialized column list (not just an aliased
    # expression in the SELECT list), so wrap in a subquery: Postgres only resolves
    # a SELECT-list alias in ORDER BY when it's a bare item, not inside an expression
    # like the weighted score above.
    sql = f"SELECT * FROM ({base_sql}) AS candidates ORDER BY {order_by} LIMIT %(limit)s OFFSET %(offset)s"
    params["limit"] = PAGE_SIZE
    params["offset"] = offset
    return query_all(sql, params)


def search(viewer_id: int, filters: dict, sort: str | None, offset: int = 0) -> list[dict]:
    return browse(viewer_id, filters, sort, offset)
