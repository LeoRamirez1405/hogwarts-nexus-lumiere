"""Safety number endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.user import User
from ...services.e2e import E2EEncryptionService

router = APIRouter()


class SafetyNumberRequest(BaseModel):
    remote_user_id: str
    remote_identity_key: str
    remote_registration_id: int


class SafetyNumberResponse(BaseModel):
    safety_number: str


class SafetyNumberVerifyRequest(BaseModel):
    remote_user_id: str
    remote_identity_key: str
    remote_registration_id: int
    displayed_number: str


class SafetyNumberVerifyResponse(BaseModel):
    verified: bool


class SafetyNumberStoreRequest(BaseModel):
    remote_user_id: str
    safety_number: str
    verified: bool = False
    verification_method: str = None


@router.post("/safety-number/compute", response_model=SafetyNumberResponse)
async def compute_safety_number_endpoint(
    request: SafetyNumberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compute safety number with another user."""
    service = E2EEncryptionService(db, current_user.id)

    safety_number = await service.compute_safety_number(
        bytes.fromhex(request.remote_identity_key) if len(request.remote_identity_key) == 64 else request.remote_identity_key.encode(),
        request.remote_registration_id,
    )

    return SafetyNumberResponse(safety_number=safety_number)


@router.post("/safety-number/verify", response_model=SafetyNumberVerifyResponse)
async def verify_safety_number_endpoint(
    request: SafetyNumberVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a displayed safety number."""
    service = E2EEncryptionService(db, current_user.id)

    verified = await service.verify_safety_number(
        bytes.fromhex(request.remote_identity_key) if len(request.remote_identity_key) == 64 else request.remote_identity_key.encode(),
        request.remote_registration_id,
        request.displayed_number,
    )

    return SafetyNumberVerifyResponse(verified=verified)


@router.post("/safety-number/store", response_model=dict)
async def store_safety_number(
    request: SafetyNumberStoreRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store a verified safety number."""
    service = E2EEncryptionService(db, current_user.id)
    await service.store_safety_number(
        request.remote_user_id,
        request.safety_number,
        request.verified,
        request.verification_method,
    )
    return {"status": "stored"}


@router.get("/safety-number/{remote_user_id}", response_model=SafetyNumberResponse)
async def get_safety_number(
    remote_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get stored safety number for a contact."""
    service = E2EEncryptionService(db, current_user.id)
    safety_number = await service.get_safety_number(remote_user_id)

    if not safety_number:
        raise HTTPException(status_code=404, detail="Safety number not found")

    return SafetyNumberResponse(safety_number=safety_number)