"""Hand-written request validation.

No validation library is used on purpose: the subject's micro-framework
definition explicitly excludes frameworks that bundle validators, and the
same "write it yourself, like experienced developers do" spirit applies here
just like it does to SQL queries.
"""
import datetime as dt
import re

from app.common.common_passwords import is_common_password
from app.common.errors import bad_request

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")
NAME_RE = re.compile(r"^[^\d]{1,60}$")
GENDERS = {"man", "woman", "other"}
ORIENTATIONS = {"heterosexual", "homosexual", "bisexual"}
REPORT_REASONS = {"fake_account", "harassment", "inappropriate_content", "other"}


class Validator:
    """Accumulates field errors instead of failing on the first one."""

    def __init__(self, data: dict):
        self.data = data or {}
        self.errors: dict[str, str] = {}
        self.clean: dict = {}

    def raise_if_invalid(self):
        if self.errors:
            raise bad_request("Validation failed", self.errors)

    def _get(self, field: str):
        return self.data.get(field)

    def required_str(self, field: str, *, min_len=1, max_len=10_000, pattern: re.Pattern | None = None,
                      label: str | None = None) -> "Validator":
        value = self._get(field)
        label = label or field
        if not isinstance(value, str) or not value.strip():
            self.errors[field] = f"{label} is required"
            return self
        value = value.strip()
        if len(value) < min_len or len(value) > max_len:
            self.errors[field] = f"{label} must be between {min_len} and {max_len} characters"
            return self
        if pattern and not pattern.match(value):
            self.errors[field] = f"{label} format is invalid"
            return self
        self.clean[field] = value
        return self

    def optional_str(self, field: str, *, max_len=10_000, pattern: re.Pattern | None = None,
                      label: str | None = None) -> "Validator":
        value = self._get(field)
        if value is None or value == "":
            return self
        label = label or field
        if not isinstance(value, str):
            self.errors[field] = f"{label} must be a string"
            return self
        value = value.strip()
        if len(value) > max_len:
            self.errors[field] = f"{label} must be at most {max_len} characters"
            return self
        if pattern and not pattern.match(value):
            self.errors[field] = f"{label} format is invalid"
            return self
        self.clean[field] = value
        return self

    def email(self, field: str = "email", *, required: bool = True) -> "Validator":
        value = self._get(field)
        if value is None or value == "":
            if required:
                self.errors[field] = "Enter a valid email address"
            return self
        if not isinstance(value, str) or not EMAIL_RE.match(value.strip()):
            self.errors[field] = "Enter a valid email address"
            return self
        self.clean[field] = value.strip().lower()
        return self

    def username(self, field: str = "username") -> "Validator":
        return self.required_str(field, pattern=USERNAME_RE,
                                  label="Username (3-20 letters/digits/underscore)")

    def password(self, field: str = "password") -> "Validator":
        value = self._get(field)
        if not isinstance(value, str):
            self.errors[field] = "Password is required"
            return self
        if len(value) < 8:
            self.errors[field] = "Password must be at least 8 characters"
            return self
        if len(value) > 128:
            self.errors[field] = "Password is too long"
            return self
        classes = sum([
            bool(re.search(r"[a-z]", value)),
            bool(re.search(r"[A-Z]", value)),
            bool(re.search(r"\d", value)),
            bool(re.search(r"[^a-zA-Z0-9]", value)),
        ])
        if classes < 3:
            self.errors[field] = "Password must mix upper/lowercase, digits and symbols"
            return self
        if is_common_password(value):
            self.errors[field] = "This password is too common, choose another one"
            return self
        self.clean[field] = value
        return self

    def birth_date(self, field: str = "birth_date", *, min_age=18, max_age=120) -> "Validator":
        value = self._get(field)
        if not isinstance(value, str):
            self.errors[field] = "Birth date is required"
            return self
        try:
            parsed = dt.date.fromisoformat(value)
        except ValueError:
            self.errors[field] = "Birth date must be in YYYY-MM-DD format"
            return self
        today = dt.date.today()
        age = today.year - parsed.year - ((today.month, today.day) < (parsed.month, parsed.day))
        if age < min_age:
            self.errors[field] = f"You must be at least {min_age} years old"
            return self
        if age > max_age:
            self.errors[field] = "Enter a valid birth date"
            return self
        self.clean[field] = parsed
        return self

    def datetime_iso(self, field: str, *, label: str | None = None) -> "Validator":
        value = self._get(field)
        label = label or field
        if not isinstance(value, str) or not value:
            self.errors[field] = f"{label} is required"
            return self
        try:
            parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            self.errors[field] = f"{label} must be a valid date/time"
            return self
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        self.clean[field] = parsed
        return self

    def one_of(self, field: str, choices: set[str], *, required=True, label: str | None = None) -> "Validator":
        value = self._get(field)
        label = label or field
        if value is None or value == "":
            if required:
                self.errors[field] = f"{label} is required"
            return self
        if value not in choices:
            self.errors[field] = f"{label} must be one of: {', '.join(sorted(choices))}"
            return self
        self.clean[field] = value
        return self

    def number(self, field: str, *, minimum=None, maximum=None, required=True, integer=False,
               label: str | None = None) -> "Validator":
        value = self._get(field)
        label = label or field
        if value is None or value == "":
            if required:
                self.errors[field] = f"{label} is required"
            return self
        try:
            num = int(value) if integer else float(value)
        except (TypeError, ValueError):
            self.errors[field] = f"{label} must be a number"
            return self
        if minimum is not None and num < minimum:
            self.errors[field] = f"{label} must be >= {minimum}"
            return self
        if maximum is not None and num > maximum:
            self.errors[field] = f"{label} must be <= {maximum}"
            return self
        self.clean[field] = num
        return self

    def tag_list(self, field: str = "tags", *, max_items=15) -> "Validator":
        value = self._get(field)
        if value is None:
            self.clean[field] = []
            return self
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            self.errors[field] = "Tags must be a list of strings"
            return self
        cleaned = []
        for raw in value:
            tag = raw.strip().lstrip("#").lower()
            if not tag:
                continue
            if not re.match(r"^[a-z0-9_]{1,30}$", tag):
                self.errors[field] = "Tags may only contain letters, digits and underscore"
                return self
            if tag not in cleaned:
                cleaned.append(tag)
        if len(cleaned) > max_items:
            self.errors[field] = f"At most {max_items} tags"
            return self
        self.clean[field] = cleaned
        return self


def full_name_pattern():
    return NAME_RE
