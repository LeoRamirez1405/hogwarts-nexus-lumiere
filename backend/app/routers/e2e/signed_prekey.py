"""Signed prekey endpoints."""
import base64
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.user import User
from ...services.e2e import E2EEncryptionService

router = APIRouter()


def b64e(data: bytes) -> str:
    return base64.b64encode(data).decode()


@router.get("/signed-prekey", response_model=dict)
async def get_signed_prekey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current signed prekey."""
    service = E2EEncryptionService(db, current_user.id)
    spk = await service.get_signed_prekey()

    if not spk:
        spk = await service.generate_signed_prekey()

    return {
        "prekey_id": spk.prekey_id,
        "public_key": b64e(spk.key_pair.public),
        "signature": b64e(spk.signature),
        "timestamp": spk.timestamp,
    }


@router.post("/signed-prekey/rotate", response_model=dict)
async def rotate_signed_prekey(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate signed prekey."""
    service = E2EEncryptionService(db, current_user.id)
    spk = await service.rotate_signed_prekey()

    return {
        "prekey_id": spk.prekey_id,
        "public_key": b64e(spk.key_pair.public),
        "signature": b64e(spk.signature),
        "timestamp": spk.timestamp,
    }