from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.user import User
from ..schemas.user import UserCreate, UserLogin, UserResponse, ChangePassword
from ..middleware.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_ws_token,
    decode_refresh_token,
    get_current_user,
    set_auth_cookies,
    clear_auth_cookies,
)
from ..rate_limit import limiter

router = APIRouter()


class FirstAdminCreate(BaseModel):
    name: str
    email: str
    password: str
    house: Optional[str] = None


@router.post("/first-admin", response_model=UserResponse)
async def first_admin(data: FirstAdminCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    user = existing.scalar_one_or_none()
    if user:
        if user.role == "admin":
            raise HTTPException(status_code=400, detail="Este usuario ya es admin.")
        user.name = data.name
        user.password_hash = hash_password(data.password)
        user.house = data.house
        user.role = "admin"
    else:
        user = User(
            name=data.name,
            email=data.email,
            password_hash=hash_password(data.password),
            house=data.house,
            role="admin",
        )
        db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/register", response_model=UserResponse)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        house=user_data.house,
        avatar_url=user_data.avatar_url,
        bio=user_data.bio,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    set_auth_cookies(response, access_token, refresh_token)

    return {
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }


@router.post("/refresh")
@limiter.limit("30/minute")
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_refresh_token(refresh_token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    access_token = create_access_token(data={"sub": user.id})
    new_refresh_token = create_refresh_token(data={"sub": user.id})
    set_auth_cookies(response, access_token, new_refresh_token)

    return {
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/ws-token")
async def get_ws_token(current_user: User = Depends(get_current_user)):
    """Get a short-lived WebSocket token (60s) for establishing WS connection."""
    token = create_ws_token(data={"sub": current_user.id})
    return {"token": token, "expires_in": 60}


@router.post("/change-password")
async def change_password(
    data: ChangePassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(400, "La contraseña actual es incorrecta")

    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"message": "contraseña actualizada correctamente"}
