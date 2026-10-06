"""OAuth provider registry (bonus feature: multi-provider / "OmniAuth-style" login).

Each provider is only registered -- and only offered to the frontend via
GET /api/auth/oauth/providers -- when both its CLIENT_ID and CLIENT_SECRET are
set. Missing credentials just mean that provider's button never shows up; the
app never fails to boot over it.
"""
from authlib.integrations.flask_client import OAuth
from flask import Flask

oauth = OAuth()
_configured: set[str] = set()

PROVIDER_LABELS = {"google": "Google", "github": "GitHub", "ft": "42"}


def init_oauth(app: Flask) -> None:
    oauth.init_app(app)
    _configured.clear()

    if app.config["GOOGLE_CLIENT_ID"] and app.config["GOOGLE_CLIENT_SECRET"]:
        oauth.register(
            name="google",
            client_id=app.config["GOOGLE_CLIENT_ID"],
            client_secret=app.config["GOOGLE_CLIENT_SECRET"],
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
        _configured.add("google")

    if app.config["GITHUB_CLIENT_ID"] and app.config["GITHUB_CLIENT_SECRET"]:
        oauth.register(
            name="github",
            client_id=app.config["GITHUB_CLIENT_ID"],
            client_secret=app.config["GITHUB_CLIENT_SECRET"],
            access_token_url="https://github.com/login/oauth/access_token",
            authorize_url="https://github.com/login/oauth/authorize",
            api_base_url="https://api.github.com/",
            client_kwargs={"scope": "read:user user:email"},
        )
        _configured.add("github")

    if app.config["FT_CLIENT_ID"] and app.config["FT_CLIENT_SECRET"]:
        oauth.register(
            name="ft",
            client_id=app.config["FT_CLIENT_ID"],
            client_secret=app.config["FT_CLIENT_SECRET"],
            access_token_url="https://api.intra.42.fr/oauth/token",
            authorize_url="https://api.intra.42.fr/oauth/authorize",
            api_base_url="https://api.intra.42.fr/",
            client_kwargs={"scope": "public"},
        )
        _configured.add("ft")


def configured_providers() -> list[str]:
    return [name for name in PROVIDER_LABELS if name in _configured]
