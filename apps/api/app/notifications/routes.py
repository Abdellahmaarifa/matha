from flask import Blueprint, g, jsonify

from app.common.security import require_auth
from app.notifications import service

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@bp.get("")
@require_auth
def list_notifications():
    return jsonify({
        "items": service.list_notifications(g.user_id),
        "unread_count": service.unread_count(g.user_id),
    })


@bp.post("/<int:notification_id>/read")
@require_auth
def mark_read(notification_id: int):
    service.mark_read(g.user_id, notification_id)
    return jsonify({"status": "ok"})


@bp.post("/read-all")
@require_auth
def mark_all_read():
    service.mark_all_read(g.user_id)
    return jsonify({"status": "ok"})
