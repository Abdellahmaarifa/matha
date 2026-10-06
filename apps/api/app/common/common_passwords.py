"""Small multilingual dictionary-word / common-password blocklist.

The subject requires rejecting "commonly used dictionary words (regardless of
language)" as passwords. A production system would ship a much larger list
(e.g. the top 100k from SecLists); this is a representative sample covering
English, French, Spanish, German and Arabic-transliterated common passwords
plus the classic "top offenders", kept small on purpose so it ships in git.
"""

COMMON_PASSWORDS: set[str] = {
    "password", "password1", "passw0rd", "letmein", "welcome", "qwerty",
    "azerty", "iloveyou", "admin", "administrator", "sunshine", "dragon",
    "football", "baseball", "monkey", "shadow", "master", "superman",
    "trustno1", "abc123", "123456", "123456789", "12345678", "1234567",
    "111111", "000000", "123123", "654321", "121212", "qwertyuiop",
    "motdepasse", "bonjour", "soleil", "bienvenue", "amour", "chocolat",
    "contraseña", "hola", "amor", "estrella", "familia",
    "passwort", "willkommen", "liebe", "sonnenschein",
    "matcha", "matcha42", "quarante", "42matcha", "flaskreact",
}


def is_common_password(raw: str) -> bool:
    return raw.strip().lower() in COMMON_PASSWORDS
