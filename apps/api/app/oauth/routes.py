from urllib.parse import urlencode

from flask import Blueprint, current_app, jsonify, redirect, request

from app.common.errors import bad_request, not_found
from app.common.security import decode_token, issue_oauth_signup_token
from app.common.validation import NAME_RE, Validator
from app.oauth import service
from app.oauth.client import PROVIDER_LABELS, configured_providers, oauth

bp = Blueprint("oauth", __name__, url_prefix="/api/auth/oauth")


@bp.get("/providers")
def list_providers():
    return jsonify({"providers": [{"id": p, "label": PROVIDER_LABELS[p]} for p in configured_providers()]})


@bp.get("/<provider>")
def start(provider: str):
    if provider not in configured_providers():
        raise not_found("Unknown or unconfigured provider")
    client = oauth.create_client(provider)
    redirect_uri = f"{current_app.config['API_BASE_URL']}/api/auth/oauth/{provider}/callback"
    return client.authorize_redirect(redirect_uri)


@bp.get("/<provider>/callback")
def callback(provider: str):
    if provider not in configured_providers():
        raise not_found("Unknown or unconfigured provider")
    client = oauth.create_client(provider)
    token = client.authorize_access_token()
    profile = service.fetch_profile(provider, client, token)
    frontend = current_app.config["FRONTEND_URL"]

    linked = service.find_linked_user(provider, profile["provider_uid"])
    if linked:
        tokens = service.issue_login(linked["id"])
        return redirect(f"{frontend}/oauth/callback?{urlencode(tokens)}")

    existing = service.find_and_link_by_email(provider, profile["provider_uid"], profile.get("email") or "")
    if existing:
        tokens = service.issue_login(existing["id"])
        return redirect(f"{frontend}/oauth/callback?{urlencode(tokens)}")

    # Brand-new signup: none of these providers reliably give us a birth_date
    # (required, not-null in the schema), so we hand off to a frontend form to
    # collect what's missing -- carried in a short-lived signed token instead
    # of a server-side session, consistent with the rest of this API being stateless.
    signup_token = issue_oauth_signup_token(
        provider,
        profile["provider_uid"],
        profile.get("email") or "",
        profile.get("first_name") or "",
        profile.get("last_name") or "",
    )
    # first_name/last_name/email are also sent in the clear here purely so the
    # frontend can pre-fill the form -- the signed token is what's actually
    # trusted server-side when the form is submitted.
    query = urlencode({
        "token": signup_token,
        "first_name": profile.get("first_name") or "",
        "last_name": profile.get("last_name") or "",
        "email": profile.get("email") or "",
    })
    return redirect(f"{frontend}/oauth/complete-signup?{query}")


@bp.post("/complete")
def complete():
    body = request.get_json(silent=True) or {}
    payload = decode_token(body.get("token", ""))
    if payload.get("type") != "oauth_signup":
        raise bad_request("Invalid or expired signup link, please try signing in again")

    v = Validator(body)
    v.username()
    v.required_str("first_name", pattern=NAME_RE, max_len=60, label="First name")
    v.required_str("last_name", pattern=NAME_RE, max_len=60, label="Last name")
    v.birth_date()
    if not payload.get("email"):
        v.email()
    v.raise_if_invalid()

    email = payload.get("email") or v.clean["email"]
    result = service.complete_signup(
        payload["provider"], payload["provider_uid"], email,
        v.clean["first_name"], v.clean["last_name"], v.clean["username"], v.clean["birth_date"],
    )
    return jsonify(result), 201
