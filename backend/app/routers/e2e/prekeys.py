"""Prekey endpoints."""
import base64
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.user import User
from ...services.e2e import E2EEncryptionService

router = APIRouter()


def b64e(data: bytes) -> str:
    return base64.b64encode(data).decode()


@router.get("/prekeys", response_model=dict)
async def get_prekeys(
    count: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unused prekeys, generating more if needed."""
    service = E2EEncryptionService(db, current_user.id)
    prekeys = await service.get_unused_prekeys(count)

    if len(prekeys) < count:
        new_prekeys = await service.generate_prekeys(count - len(prekeys))
        prekeys.extend(new_prekeys)

    return {
        "prekeys": [
            {"prekey_id": pk.prekey_id, "public_key": b64e(pk.key_pair.public)}
            for pk in prekeys[:count]
        ]
    }


@router.post("/prekeys/consume/{prekey_id}", response_model=dict)
async def consume_prekey(
    prekey_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a prekey as used (called by sender after building session)."""
    service = E2EEncryptionService(db, current_user.id)
    prekey = await service.consume_prekey(prekey_id)

    if not prekey:
        raise HTTPException(status_code=404, detail="Prekey not found or already used")

    return {"prekey_id": prekey.prekey_id, "public_key": b64e(prekey.key_pair.public)}