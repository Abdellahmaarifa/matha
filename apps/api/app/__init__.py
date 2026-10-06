import logging

from flask import Flask, jsonify, request

from app.config import Config
from app.common.errors import register_error_handlers
from app.db import init_pool


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    # Flask's logger defaults to WARNING outside debug mode, which silently drops
    # the app.logger.info(...) calls mail.py uses to print dev-mode "emails" --
    # without this, MAIL_MODE=console produces no output at all.
    app.logger.setLevel(logging.INFO)

    init_pool(app)
    register_error_handlers(app)
    _register_cors(app)
    _register_blueprints(app)

    from app.oauth.client import init_oauth

    init_oauth(app)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    return app


def _register_cors(app: Flask) -> None:
    allowed_origin = app.config["FRONTEND_URL"]

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin == allowed_origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
        return response

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            return "", 204


def _register_blueprints(app: Flask) -> None:
    from app.auth.routes import bp as auth_bp
    from app.chat.routes import bp as chat_bp
    from app.dates.routes import bp as dates_bp
    from app.matching.routes import bp as matching_bp
    from app.notifications.routes import bp as notifications_bp
    from app.oauth.routes import bp as oauth_bp
    from app.photos.routes import bp as photos_bp
    from app.profiles.routes import bp as profiles_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(oauth_bp)
    app.register_blueprint(profiles_bp)
    app.register_blueprint(matching_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(dates_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(photos_bp)
