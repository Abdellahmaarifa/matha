from flask import jsonify


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields or {}


def bad_request(message: str, fields: dict | None = None) -> ApiError:
    return ApiError(400, "bad_request", message, fields)


def unauthorized(message: str = "Authentication required") -> ApiError:
    return ApiError(401, "unauthorized", message)


def forbidden(message: str = "Forbidden") -> ApiError:
    return ApiError(403, "forbidden", message)


def not_found(message: str = "Not found") -> ApiError:
    return ApiError(404, "not_found", message)


def conflict(message: str) -> ApiError:
    return ApiError(409, "conflict", message)


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _handle_api_error(err: ApiError):
        return jsonify({"error": err.code, "message": err.message, "fields": err.fields}), err.status

    @app.errorhandler(404)
    def _handle_404(_err):
        return jsonify({"error": "not_found", "message": "Resource not found", "fields": {}}), 404

    @app.errorhandler(405)
    def _handle_405(_err):
        return jsonify({"error": "method_not_allowed", "message": "Method not allowed", "fields": {}}), 405

    @app.errorhandler(Exception)
    def _handle_unexpected(err: Exception):
        app.logger.exception("Unhandled error: %s", err)
        return jsonify({"error": "internal_error", "message": "Something went wrong", "fields": {}}), 500
