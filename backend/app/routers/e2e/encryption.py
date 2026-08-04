"""Message encryption/decryption endpoints."""
import base64
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.user import User
from ...services.e2e import (
    E2EEncryptionService,
    serialize_signal_message,
    deserialize_signal_message,
)

router = APIRouter()


def b64e(data: bytes) -> str:
    return base64.b64encode(data).decode()


def b64d(data: str) -> bytes:
    return base64.b64decode(data)


class EncryptRequest(BaseModel):
    recipient_id: str
    plaintext: str


class EncryptResponse(BaseModel):
    ciphertext: str
    message: str


class DecryptRequest(BaseModel):
    sender_id: str
    message: str


class DecryptResponse(BaseModel):
    plaintext: str


@router.post("/encrypt", response_model=EncryptResponse)
async def encrypt_message_endpoint(
    request: EncryptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Encrypt a message for a recipient using existing session."""
    service = E2EEncryptionService(db, current_user.id)
    session = await service.get_session(request.recipient_id)

    if not session:
        raise HTTPException(status_code=404, detail="No established session with recipient")

    ciphertext, signal_msg = await service.encrypt(
        request.recipient_id, b64d(request.plaintext)
    )

    return EncryptResponse(
        ciphertext=b64e(ciphertext),
        message=b64e(serialize_signal_message(signal_msg)),
    )


@router.post("/decrypt", response_model=DecryptResponse)
async def decrypt_message_endpoint(
    request: DecryptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decrypt a message from a sender using existing session."""
    service = E2EEncryptionService(db, current_user.id)
    session = await service.get_session(request.sender_id)

    if not session:
        raise HTTPException(status_code=404, detail="No established session with sender")

    signal_msg = deserialize_signal_message(b64d(request.message))
    plaintext = await service.decrypt(request.sender_id, signal_msg)

    return DecryptResponse(plaintext=b64e(plaintext))