from flask import Blueprint, g, jsonify, request

from app.common.errors import bad_request
from app.common.security import require_auth, require_complete_profile
from app.common.validation import GENDERS, NAME_RE, ORIENTATIONS, Validator
from app.profiles import service

bp = Blueprint("profiles", __name__, url_prefix="/api")


@bp.get("/me")
@require_auth
def get_me():
    return jsonify(service.get_own_profile(g.user_id))


@bp.patch("/me")
@require_auth
def patch_me():
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.optional_str("first_name", pattern=NAME_RE, max_len=60, label="First name")
    v.optional_str("last_name", pattern=NAME_RE, max_len=60, label="Last name")
    v.email("email", required=False)
    v.one_of("gender", GENDERS, required=False)
    v.one_of("sexual_pref", ORIENTATIONS, required=False)
    v.optional_str("biography", max_len=2000, label="Biography")
    v.raise_if_invalid()
    return jsonify(service.update_profile(g.user_id, v.clean))


@bp.post("/me/validate")
@require_auth
def validate_me():
    """Pre-check for the edit-profile form (see auth.validate): reports an
    email another account holds as a 200 instead of failing PATCH /me with 409."""
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.email("email", required=False)
    fields = dict(v.errors)
    if "email" in v.clean and service.email_taken(g.user_id, v.clean["email"]):
        fields["email"] = "An account with this email already exists"
    return jsonify({"fields": fields})


@bp.put("/me/tags")
@require_auth
def put_tags():
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.tag_list("tags")
    v.raise_if_invalid()
    return jsonify({"tags": service.update_tags(g.user_id, v.clean["tags"])})


@bp.put("/me/location")
@require_auth
def put_location():
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.number("latitude", minimum=-90, maximum=90)
    v.number("longitude", minimum=-180, maximum=180)
    v.one_of("source", {"gps", "manual"})
    v.optional_str("label", max_len=120)
    v.raise_if_invalid()
    service.update_location(g.user_id, v.clean["latitude"], v.clean["longitude"],
                             v.clean["source"], v.clean.get("label"))
    return jsonify({"status": "ok"})


@bp.post("/me/photos")
@require_auth
def post_photo():
    if "file" not in request.files:
        raise bad_request("No file provided")
    photo = service.save_photo(g.user_id, request.files["file"])
    return jsonify(photo), 201


@bp.delete("/me/photos/<int:photo_id>")
@require_auth
def delete_photo(photo_id: int):
    service.delete_photo(g.user_id, photo_id)
    return jsonify({"status": "ok"})


@bp.put("/me/photos/<int:photo_id>/profile-picture")
@require_auth
def put_profile_picture(photo_id: int):
    service.set_profile_photo(g.user_id, photo_id)
    return jsonify({"status": "ok"})


@bp.get("/me/visitors")
@require_auth
def get_visitors():
    return jsonify(service.list_visitors(g.user_id))


@bp.get("/me/likers")
@require_auth
def get_likers():
    return jsonify(service.list_likers(g.user_id))


@bp.get("/users/<int:user_id>")
@require_auth
@require_complete_profile
def get_user(user_id: int):
    return jsonify(service.get_public_profile(g.user_id, user_id))
