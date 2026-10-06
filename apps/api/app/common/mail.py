import smtplib
from email.mime.text import MIMEText

from flask import current_app


def send_mail(to: str, subject: str, body: str) -> None:
    cfg = current_app.config
    if cfg["MAIL_MODE"] != "smtp":
        current_app.logger.info("---- [dev mail] to=%s subject=%s ----\n%s", to, subject, body)
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = cfg["MAIL_FROM"]
    msg["To"] = to
    with smtplib.SMTP(cfg["SMTP_HOST"], cfg["SMTP_PORT"]) as server:
        server.starttls()
        server.login(cfg["SMTP_USER"], cfg["SMTP_PASSWORD"])
        server.sendmail(cfg["MAIL_FROM"], [to], msg.as_string())


def send_verification_email(to: str, token: str) -> None:
    link = f"{current_app.config['FRONTEND_URL']}/verify-email?token={token}"
    send_mail(to, "Confirm your Matcha account", f"Click to verify your account: {link}")


def send_reset_email(to: str, token: str) -> None:
    link = f"{current_app.config['FRONTEND_URL']}/reset-password?token={token}"
    send_mail(to, "Reset your Matcha password", f"Click to reset your password: {link}")
