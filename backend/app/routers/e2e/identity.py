"""Identity key endpoints."""
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


@router.get("/identity", response_model=dict)
async def get_my_identity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's identity public keys."""
    service = E2EEncryptionService(db, current_user.id)
    identity = await service.ensure_identity()

    return {
        "identity_key_public": b64e(identity.identity_key.public),
        "signing_key_public": b64e(identity.signing_key.public),
        "registration_id": identity.registration_id,
    }


@router.post("/identity/rotate", response_model=dict)
async def rotate_identity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rotate identity keys (dangerous - breaks all existing sessions!)."""
    service = E2EEncryptionService(db, current_user.id)
    identity = await service.rotate_identity()

    return {
        "identity_key_public": b64e(identity.identity_key.public),
        "signing_key_public": b64e(identity.signing_key.public),
        "registration_id": identity.registration_id,
    }