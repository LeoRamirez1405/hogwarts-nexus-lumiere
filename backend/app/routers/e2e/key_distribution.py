"""Key distribution endpoints (public)."""
import base64
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...models.e2e_encryption import UserIdentityKey, UserSignedPreKey, UserPreKey

router = APIRouter()


def b64e(data: bytes) -> str:
    return base64.b64encode(data).decode()


@router.get("/keys/{user_id}/identity", response_model=dict)
async def get_user_identity(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get another user's identity public keys (public endpoint)."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == user_id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="User identity not found")

    return {
        "identity_key_public": b64e(identity.identity_key_public),
        "signing_key_public": b64e(identity.signing_key_public),
        "registration_id": identity.registration_id,
    }


@router.get("/keys/{user_id}/signed-prekey", response_model=dict)
async def get_user_signed_prekey(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get another user's signed prekey (public endpoint)."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == user_id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="User identity not found")

    spk = (
        await db.execute(
            select(UserSignedPreKey).where(UserSignedPreKey.identity_id == identity.id)
        )
    ).scalar_one_or_none()

    if not spk:
        raise HTTPException(status_code=404, detail="Signed prekey not found")

    return {
        "prekey_id": spk.prekey_id,
        "public_key": b64e(spk.public_key),
        "signature": b64e(spk.signature),
        "timestamp": int(spk.created_at.timestamp()),
    }


@router.get("/keys/{user_id}/prekeys", response_model=dict)
async def get_user_prekeys(
    user_id: str,
    count: int = 1,
    db: AsyncSession = Depends(get_db),
):
    """Get another user's prekeys (public endpoint)."""
    identity = (
        await db.execute(
            select(UserIdentityKey).where(UserIdentityKey.user_id == user_id)
        )
    ).scalar_one_or_none()

    if not identity:
        raise HTTPException(status_code=404, detail="User identity not found")

    prekeys = (
        await db.execute(
            select(UserPreKey).where(
                UserPreKey.identity_id == identity.id,
                not UserPreKey.used,
            ).limit(count)
        )
    ).scalars().all()

    if not prekeys:
        raise HTTPException(status_code=404, detail="No prekeys available")

    return {
        "prekeys": [
            {"prekey_id": pk.prekey_id, "public_key": b64e(pk.public_key)}
            for pk in prekeys
        ]
    }