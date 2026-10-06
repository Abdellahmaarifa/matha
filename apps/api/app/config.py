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

    # All outgoing mail goes through Resend (https://resend.com). MAIL_FROM must
    # use a domain verified in Resend, or "onboarding@resend.dev" for testing.
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    MAIL_FROM = os.environ.get("MAIL_FROM", "Matcha <onboarding@resend.dev>")
