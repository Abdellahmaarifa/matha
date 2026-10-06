from flask import Blueprint, g, jsonify, request

from app.common.security import require_auth, require_complete_profile
from app.common.validation import REPORT_REASONS, Validator
from app.matching import service

bp = Blueprint("matching", __name__, url_prefix="/api")


def _parse_filters() -> dict:
    args = request.args
    v = Validator(args)
    v.number("min_age", integer=True, required=False)
    v.number("max_age", integer=True, required=False)
    v.number("min_fame", integer=True, required=False)
    v.number("max_fame", integer=True, required=False)
    v.raise_if_invalid()

    filters: dict = dict(v.clean)
    if args.get("location"):
        filters["location"] = args["location"]
    if args.get("tags"):
        filters["tags"] = [t.strip().lower() for t in args["tags"].split(",") if t.strip()]
    return filters


def _parse_offset() -> int:
    v = Validator(request.args)
    v.number("offset", integer=True, minimum=0, required=False)
    v.raise_if_invalid()
    return v.clean.get("offset", 0)


@bp.get("/browse")
@require_auth
@require_complete_profile
def get_browse():
    sort = request.args.get("sort")
    return jsonify(service.browse(g.user_id, _parse_filters(), sort, _parse_offset()))


@bp.get("/search")
@require_auth
@require_complete_profile
def get_search():
    sort = request.args.get("sort")
    return jsonify(service.search(g.user_id, _parse_filters(), sort, _parse_offset()))


@bp.post("/users/<int:user_id>/like")
@require_auth
@require_complete_profile
def post_like(user_id: int):
    return jsonify(service.like_user(g.user_id, user_id))


@bp.delete("/users/<int:user_id>/like")
@require_auth
@require_complete_profile
def delete_like(user_id: int):
    service.unlike_user(g.user_id, user_id)
    return jsonify({"status": "ok"})


@bp.post("/users/<int:user_id>/block")
@require_auth
def post_block(user_id: int):
    service.block_user(g.user_id, user_id)
    return jsonify({"status": "ok"})


@bp.post("/users/<int:user_id>/report")
@require_auth
def post_report(user_id: int):
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.one_of("reason", REPORT_REASONS, required=False)
    v.raise_if_invalid()
    service.report_user(g.user_id, user_id, v.clean.get("reason", "fake_account"))
    return jsonify({"status": "ok"})
