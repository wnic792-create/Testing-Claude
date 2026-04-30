import os
import hashlib
import secrets
import hmac
import json
import base64
import time
from datetime import datetime, timedelta

_SECRET_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", ".secret_key")

def _get_secret_key() -> str:
    env = os.environ.get("SECRET_KEY")
    if env:
        return env
    os.makedirs(os.path.dirname(_SECRET_FILE), exist_ok=True)
    if os.path.exists(_SECRET_FILE):
        with open(_SECRET_FILE) as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(_SECRET_FILE, "w") as f:
        f.write(key)
    return key

SECRET_KEY = _get_secret_key()
TOKEN_EXPIRY_HOURS = 72
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000)
    return f"{salt}${hashed.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed_hex = stored.split("$", 1)
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000)
        return hmac.compare_digest(expected.hex(), hashed_hex)
    except (ValueError, AttributeError):
        return False


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(s: str) -> bytes:
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def create_token(user_id: int, username: str) -> str:
    header = _b64encode(json.dumps({"alg": ALGORITHM, "typ": "JWT"}).encode())
    payload_data = {
        "sub": str(user_id),
        "username": username,
        "exp": int((datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
    }
    payload = _b64encode(json.dumps(payload_data).encode())
    signing_input = f"{header}.{payload}"
    sig = hmac.new(SECRET_KEY.encode(), signing_input.encode(), hashlib.sha256).digest()
    signature = _b64encode(sig)
    return f"{header}.{payload}.{signature}"


def verify_token(token: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, signature = parts
        signing_input = f"{header}.{payload}"
        expected_sig = hmac.new(SECRET_KEY.encode(), signing_input.encode(), hashlib.sha256).digest()
        actual_sig = _b64decode(signature)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload_data = json.loads(_b64decode(payload))
        if payload_data.get("exp", 0) < time.time():
            return None
        return payload_data
    except Exception:
        return None
