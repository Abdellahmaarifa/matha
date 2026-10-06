from html import escape

import requests
from flask import current_app

from app.common.errors import ApiError

RESEND_URL = "https://api.resend.com/emails"


def send_mail(to: str, subject: str, text: str, html: str | None = None) -> None:
    cfg = current_app.config
    if not cfg["RESEND_API_KEY"]:
        current_app.logger.error("RESEND_API_KEY is not set; cannot send mail to %s", to)
        raise ApiError(503, "mail_unavailable", "Email service is not configured")

    payload = {"from": cfg["MAIL_FROM"], "to": [to], "subject": subject, "text": text}
    if html:
        payload["html"] = html

    try:
        res = requests.post(
            RESEND_URL,
            json=payload,
            headers={"Authorization": f"Bearer {cfg['RESEND_API_KEY']}"},
            timeout=10,
        )
    except requests.RequestException:
        current_app.logger.exception("Resend request failed (to=%s)", to)
        raise ApiError(502, "mail_failed", "Could not send email, please try again later")

    if res.status_code >= 400:
        current_app.logger.error("Resend rejected mail to %s: %s %s", to, res.status_code, res.text)
        raise ApiError(502, "mail_failed", "Could not send email, please try again later")


def _action_email(title: str, intro: str, cta: str, link: str) -> str:
    link = escape(link, quote=True)
    return f"""\
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#222">
  <h2 style="margin:0 0 16px">{escape(title)}</h2>
  <p style="margin:0 0 24px;line-height:1.5">{escape(intro)}</p>
  <a href="{link}" style="display:inline-block;padding:12px 20px;background:#e8466b;color:#fff;
     text-decoration:none;border-radius:8px;font-weight:bold">{escape(cta)}</a>
  <p style="margin:24px 0 0;font-size:12px;color:#888;line-height:1.5">
    If the button doesn't work, copy this link into your browser:<br>
    <a href="{link}" style="color:#888;word-break:break-all">{link}</a>
  </p>
</div>"""


def send_verification_email(to: str, token: str) -> None:
    link = f"{current_app.config['FRONTEND_URL']}/verify-email?token={token}"
    send_mail(
        to,
        "Confirm your Matcha account",
        f"Click to verify your account: {link}",
        _action_email(
            "Welcome to Matcha",
            "Confirm your email address to activate your account. This link expires in 24 hours.",
            "Verify my account",
            link,
        ),
    )


def send_reset_email(to: str, token: str) -> None:
    link = f"{current_app.config['FRONTEND_URL']}/reset-password?token={token}"
    send_mail(
        to,
        "Reset your Matcha password",
        f"Click to reset your password: {link}",
        _action_email(
            "Reset your password",
            "Someone requested a password reset for your Matcha account. "
            "This link expires in 1 hour. If it wasn't you, you can ignore this email.",
            "Reset my password",
            link,
        ),
    )
