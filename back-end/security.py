import os
from secrets import token_urlsafe
from hashlib import sha256
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

# "production" on the deployed setup,  "development" (default) for local work
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"

# Secure cookies are only sent over HTTPS 
COOKIE_SECURE = IS_PRODUCTION

SESSION_LIFETIME = timedelta(hours=12)  


def new_session_token() -> str:
    token = token_urlsafe(32)
    return token

def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()  # encode token to bytes, hash, output 64 hex chars


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

def session_expiry() -> datetime:
    return utc_now() + SESSION_LIFETIME

