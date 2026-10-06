from flask import Blueprint, current_app, send_from_directory

bp = Blueprint("photos", __name__, url_prefix="/api/photos")


@bp.get("/<path:filename>")
def get_photo(filename: str):
    # werkzeug's send_from_directory rejects path traversal (e.g. "../") on its own.
    return send_from_directory(current_app.config["UPLOAD_DIR"], filename)
