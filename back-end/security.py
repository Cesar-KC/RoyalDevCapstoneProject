from secrets import token_urlsafe
from hashlib import sha256
from datetime import datetime, timedelta, timezone

SESSION_LIFETIME = timedelta(days=.5) #define session to one day



def new_session_token() -> str:
    token = token_urlsafe(32)
    return token

def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest() #encode token to bytes, hash, and then output to 64char 




def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

def session_expiry() -> datetime:
    return utc_now() + SESSION_LIFETIME





