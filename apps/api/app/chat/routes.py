from flask import Blueprint, g, jsonify, request

from app.chat import service
from app.common.security import require_auth, require_complete_profile
from app.common.validation import Validator

bp = Blueprint("chat", __name__, url_prefix="/api")


@bp.get("/conversations")
@require_auth
def get_conversations():
    return jsonify(service.list_conversations(g.user_id))


@bp.get("/conversations/<int:peer_id>/messages")
@require_auth
def get_messages(peer_id: int):
    return jsonify(service.list_messages(g.user_id, peer_id))


@bp.post("/conversations/<int:peer_id>/messages")
@require_auth
@require_complete_profile
def post_message(peer_id: int):
    body = request.get_json(silent=True) or {}
    v = Validator(body)
    v.required_str("body", max_len=2000, label="Message")
    v.raise_if_invalid()
    message = service.send_message(g.user_id, peer_id, v.clean["body"])
    return jsonify(message), 201


@bp.delete("/messages/<int:message_id>")
@require_auth
def delete_message(message_id: int):
    service.delete_message(g.user_id, message_id)
    return jsonify({"status": "ok"})
