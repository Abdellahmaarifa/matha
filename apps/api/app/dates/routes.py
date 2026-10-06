from flask import Blueprint, g, jsonify, request

from app.common.security import require_auth, require_complete_profile
from app.common.validation import Validator
from app.dates import service

bp = Blueprint("dates", __name__, url_prefix="/api")


@bp.get("/dates/<int:peer_id>")
@require_auth
@require_complete_profile
def get_dates(peer_id: int):
    return jsonify(service.list_dates_with(g.user_id, peer_id))


@bp.post("/dates/<int:peer_id>")
@require_auth
@require_complete_profile
def post_date(peer_id: int):
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.required_str("title", max_len=120, label="Title")
    v.required_str("location_label", max_len=120, label="Location")
    v.number("latitude", minimum=-90, maximum=90, required=False)
    v.number("longitude", minimum=-180, maximum=180, required=False)
    v.datetime_iso("scheduled_at", label="Date and time")
    v.optional_str("note", max_len=500, label="Note")
    v.raise_if_invalid()

    date = service.propose_date(
        g.user_id, peer_id, v.clean["title"], v.clean["location_label"],
        v.clean.get("latitude"), v.clean.get("longitude"), v.clean["scheduled_at"], v.clean.get("note", ""),
    )
    return jsonify(date), 201


@bp.post("/dates/<int:date_id>/respond")
@require_auth
@require_complete_profile
def respond_date(date_id: int):
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.one_of("status", {"accepted", "declined"})
    v.raise_if_invalid()
    date = service.respond_to_date(g.user_id, date_id, v.clean["status"])
    return jsonify(date)


@bp.delete("/dates/<int:date_id>")
@require_auth
@require_complete_profile
def delete_date(date_id: int):
    service.cancel_date(g.user_id, date_id)
    return jsonify({"status": "ok"})
