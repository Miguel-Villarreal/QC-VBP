import os
import sys
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException
import bcrypt as _bcrypt
import jwt

_DEFAULT_SECRET = "qc-inspector-dev-secret-key-change-in-production"
SECRET_KEY = os.environ.get("JWT_SECRET", _DEFAULT_SECRET)
if SECRET_KEY == _DEFAULT_SECRET:
    print("WARNING: JWT_SECRET is using default value. Set JWT_SECRET environment variable for production.", file=sys.stderr)
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def get_token_from_request(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return request.query_params.get("token")


def require_auth(request: Request) -> str:
    token = get_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    username = decode_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return username


def require_admin(request: Request) -> str:
    username = require_auth(request)
    import database  # lazy import to avoid circular dependency
    user = database.get_user(username)
    if not user or not user["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return username


def require_user_manager(request: Request) -> str:
    username = require_auth(request)
    import database
    user = database.get_user(username)
    if not user or not (user["is_admin"] or user["can_manage_users"]):
        raise HTTPException(status_code=403, detail="User management access required")
    return username
