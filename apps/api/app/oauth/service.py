import secrets

from app.common.errors import bad_request, conflict
from app.common.security import hash_password, issue_access_token, issue_refresh_token
from app.db import execute, execute_returning, query_one


def fetch_profile(provider: str, client, token: dict) -> dict:
    """Normalizes each provider's own user-info shape into a common
    {provider_uid, email, first_name, last_name} dict."""
    if provider == "google":
        info = client.userinfo(token=token)
        name = info.get("name") or "Matcha"
        # Only trust the email for auto-linking/login when Google itself says
        # it's verified -- otherwise anyone who controls an unverified address
        # could sign in as whoever already owns that email in our system.
        email = info.get("email") if info.get("email_verified") else None
        return {
            "provider_uid": info["sub"],
            "email": email,
            "first_name": info.get("given_name") or name.split(" ")[0],
            "last_name": info.get("family_name") or "",
        }

    if provider == "github":
        info = client.get("user", token=token).json()
        # GitHub's /user "email" field carries no verification flag of its own
        # (and isn't guaranteed to be verified), so always resolve the email
        # through /user/emails instead and require the same primary+verified
        # signal on every path -- rather than trusting /user's field on some
        # requests and only checking verification on others.
        email = None
        for entry in client.get("user/emails", token=token).json():
            if entry.get("primary") and entry.get("verified"):
                email = entry.get("email")
                break
        name = (info.get("name") or info.get("login") or "Matcha").split(" ", 1)
        return {
            "provider_uid": str(info["id"]),
            "email": email,
            "first_name": name[0],
            "last_name": name[1] if len(name) > 1 else "",
        }

    if provider == "ft":
        info = client.get("v2/me", token=token).json()
        return {
            "provider_uid": str(info["id"]),
            "email": info.get("email"),
            "first_name": info.get("first_name") or info.get("login") or "Matcha",
            "last_name": info.get("last_name") or "",
        }

    raise bad_request("Unknown OAuth provider")


def find_linked_user(provider: str, provider_uid: str) -> dict | None:
    return query_one(
        "SELECT user_id AS id FROM oauth_accounts WHERE provider = %s AND provider_uid = %s",
        (provider, provider_uid),
    )


def find_and_link_by_email(provider: str, provider_uid: str, email: str) -> dict | None:
    """If an account with this email already exists (e.g. they registered with a
    password before), link this provider to it instead of erroring on the
    email's UNIQUE constraint or creating a confusing duplicate account."""
    if not email:
        return None
    user = query_one("SELECT id FROM users WHERE email = %s", (email.lower(),))
    if not user:
        return None
    execute(
        "INSERT INTO oauth_accounts (user_id, provider, provider_uid) VALUES (%s, %s, %s) "
        "ON CONFLICT (provider, provider_uid) DO NOTHING",
        (user["id"], provider, provider_uid),
    )
    return user


def issue_login(user_id: int) -> dict:
    execute("UPDATE users SET is_online = TRUE, last_seen_at = now() WHERE id = %s", (user_id,))
    return {"access_token": issue_access_token(user_id), "refresh_token": issue_refresh_token(user_id)}


def complete_signup(
    provider: str, provider_uid: str, email: str, first_name: str, last_name: str,
    username: str, birth_date,
) -> dict:
    existing = find_and_link_by_email(provider, provider_uid, email)
    if existing:
        return issue_login(existing["id"])

    if query_one("SELECT 1 FROM users WHERE username = %s", (username,)):
        raise conflict("This username is already taken")

    # Random, never-disclosed password: OAuth accounts only ever authenticate
    # through the provider, but password_hash is NOT NULL in the schema.
    random_password_hash = hash_password(secrets.token_urlsafe(32))
    user = execute_returning(
        """
        INSERT INTO users (email, username, first_name, last_name, birth_date, password_hash, is_verified)
        VALUES (%s, %s, %s, %s, %s, %s, TRUE)
        RETURNING id
        """,
        (email.lower(), username, first_name, last_name, birth_date, random_password_hash),
    )
    execute(
        "INSERT INTO oauth_accounts (user_id, provider, provider_uid) VALUES (%s, %s, %s)",
        (user["id"], provider, provider_uid),
    )
    return issue_login(user["id"])
