import os


class Config:
    SECRET_KEY = os.environ["JWT_SECRET"]
    DATABASE_URL = os.environ["DATABASE_URL"]

    JWT_ACCESS_TTL_MIN = int(os.environ.get("JWT_ACCESS_TTL_MIN", "15"))
    JWT_REFRESH_TTL_DAYS = int(os.environ.get("JWT_REFRESH_TTL_DAYS", "30"))

    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))
    MAX_PHOTO_BYTES = int(os.environ.get("MAX_PHOTO_BYTES", str(5 * 1024 * 1024)))
    ALLOWED_PHOTO_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")

    SMTP_HOST = os.environ.get("SMTP_HOST", "")
    SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
    SMTP_USER = os.environ.get("SMTP_USER", "")
    SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
    MAIL_FROM = os.environ.get("MAIL_FROM", "no-reply@matcha.local")
    MAIL_MODE = os.environ.get("MAIL_MODE", "console")  # "console" | "smtp"

    # OAuth (bonus feature): each provider is only offered to the frontend
    # (GET /api/auth/oauth/providers) if both its CLIENT_ID and CLIENT_SECRET
    # are set -- unconfigured providers are silently skipped, not errors.
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")
    FT_CLIENT_ID = os.environ.get("FT_CLIENT_ID", "")
    FT_CLIENT_SECRET = os.environ.get("FT_CLIENT_SECRET", "")
    OAUTH_SIGNUP_TTL_MIN = int(os.environ.get("OAUTH_SIGNUP_TTL_MIN", "15"))
