from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request, Response, status, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..database import get_db
from ..models.user import User
from app.utils.dates import utcnow

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode.update({"type": "access"})
    expire = utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode.update({"type": "refresh"})
    expire = utcnow() + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_ws_token(data: dict) -> str:
    """Create a short-lived WebSocket token (60 seconds)."""
    to_encode = data.copy()
    to_encode.update({"type": "ws", "purpose": "ws_connect"})
    expire = utcnow() + timedelta(seconds=60)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_ws_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired WebSocket token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("type") != "ws" or payload.get("purpose") != "ws_connect":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for WebSocket",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return payload


# Frontend and backend live on different sites in production (Vercel + Render),
# so the session cookies are cross-site. A cross-site cookie is only sent by the
# browser on XHR/fetch when it is `SameSite=None; Secure`. In local dev (plain
# HTTP, COOKIE_SECURE off) `SameSite=None` would be rejected, so fall back to
# `Lax`. secure/samesite are tied: None requires Secure.
_COOKIE_SAMESITE = "none" if settings.COOKIE_SECURE else "lax"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    # Match the attributes used when setting, so the browser actually clears them.
    response.delete_cookie(
        key=ACCESS_COOKIE, path="/", samesite=_COOKIE_SAMESITE, secure=settings.COOKIE_SECURE
    )
    response.delete_cookie(
        key=REFRESH_COOKIE, path="/", samesite=_COOKIE_SAMESITE, secure=settings.COOKIE_SECURE
    )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = None
    if credentials is not None:
        token = credentials.credentials
    if token is None:
        token = request.cookies.get(ACCESS_COOKIE)

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


async def get_current_user_ws(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """WebSocket authentication.

    The access token is sent as the ``Sec-WebSocket-Protocol`` subprotocol
    (the client passes it as the second argument to ``new WebSocket(url, [token])``)
    so it never appears in the URL and therefore never leaks into logs, proxies
    or ``Referer`` headers. Falls back to ``?token=`` for backward compatibility.
    """
    token = None
    subprotocols = websocket.scope.get("subprotocols") or []
    if subprotocols:
        token = subprotocols[0]
    if not token:
        token = websocket.query_params.get("token")

    if not token:
        return None
    try:
        # Prefer the dedicated WS token (short-lived, type="ws") issued by
        # /auth/ws-token. Fall back to a regular access token so legacy
        # clients passing the access token still authenticate.
        try:
            payload = decode_ws_token(token)
        except HTTPException:
            payload = decode_token(token)
    except HTTPException:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    return user
