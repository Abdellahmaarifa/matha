from flask import Blueprint, g, jsonify, request

from app.auth import service
from app.common.ip_geo import client_ip
from app.common.rate_limit import rate_limit
from app.common.security import decode_token, require_auth
from app.common.validation import NAME_RE, Validator

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/register")
def register():
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.email()
    v.username()
    v.required_str("first_name", pattern=NAME_RE, max_len=60, label="First name")
    v.required_str("last_name", pattern=NAME_RE, max_len=60, label="Last name")
    v.birth_date()
    v.password()
    v.raise_if_invalid()

    user = service.register(**v.clean)
    return jsonify(user), 201


@bp.post("/validate")
def validate():
    """Pre-checks any subset of the signup fields (format, password strength,
    email/username availability) and reports problems in a 200 response, so
    forms can show them before submitting. The real endpoints still enforce
    every rule and answer 400/409 when called with bad data."""
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    if "email" in body:
        v.email()
    if "username" in body:
        v.username()
    if "first_name" in body:
        v.required_str("first_name", pattern=NAME_RE, max_len=60, label="First name")
    if "last_name" in body:
        v.required_str("last_name", pattern=NAME_RE, max_len=60, label="Last name")
    if "birth_date" in body:
        v.birth_date()
    if "password" in body:
        v.password()
    conflicts = service.signup_conflicts(v.clean.get("email"), v.clean.get("username"))
    return jsonify({"fields": {**conflicts, **v.errors}})


@bp.get("/verify-email")
def verify_email():
    token = request.args.get("token", "")
    if not token:
        return jsonify({"error": "bad_request", "message": "Missing token", "fields": {}}), 400
    service.verify_email(token)
    return jsonify({"status": "verified"})


@bp.post("/login")
@rate_limit(max_attempts=10, window_seconds=5 * 60)
def login():
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.required_str("identifier", max_len=120, label="Username or email")
    v.required_str("password", max_len=128, label="Password")
    v.raise_if_invalid()

    result = service.login(v.clean["identifier"], v.clean["password"], client_ip())
    return jsonify(result)


@bp.post("/refresh")
def refresh():
    body = request.get_json(silent=True) or {}
    token = body.get("refresh_token", "")
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        return jsonify({"error": "unauthorized", "message": "Invalid refresh token", "fields": {}}), 401
    result = service.refresh(int(payload["sub"]))
    return jsonify(result)


@bp.post("/logout")
@require_auth
def logout():
    service.logout(g.user_id)
    return jsonify({"status": "ok"})


@bp.post("/forgot-password")
@rate_limit(max_attempts=5, window_seconds=60 * 60)
def forgot_password():
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.email()
    v.raise_if_invalid()
    service.forgot_password(v.clean["email"])
    return jsonify({"status": "ok"})


@bp.get("/reset-password/status")
def reset_password_status():
    return jsonify({"valid": service.reset_token_valid(request.args.get("token", ""))})


@bp.post("/reset-password")
def reset_password():
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.required_str("token", max_len=200)
    v.password()
    v.raise_if_invalid()
    service.reset_password(v.clean["token"], v.clean["password"])
    return jsonify({"status": "ok"})
