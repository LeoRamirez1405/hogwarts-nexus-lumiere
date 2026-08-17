from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from ..config import settings
from ..database import get_db
from ..models.user import User
from ..models.push_subscription import PushSubscription
from ..models.fcm_token import FCMToken
from ..schemas.push_subscription import PushSubscriptionCreate, PushSubscriptionResponse, PushSubscriptionDelete
from ..middleware.auth import get_current_user
from ..services.push_service import _parse_subscription, send_webpush_to_user
from app.utils.dates import utcnow

router = APIRouter(tags=["push"])


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Get the VAPID public key for client-side subscription."""
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications not configured on server",
        )
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_to_push(
    payload: PushSubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Subscribe the current user to push notifications."""
    # Check if this exact subscription already exists
    existing = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == current_user.id,
            PushSubscription.subscription_json == payload.subscription_json,
        )
    )
    if existing.scalar_one_or_none():
        # Return existing
        return existing.scalar_one()

    # Create new subscription
    subscription = PushSubscription(
        user_id=current_user.id,
        subscription_json=payload.subscription_json,
        user_agent=payload.user_agent,
    )
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)
    return subscription


@router.delete("/unsubscribe")
async def unsubscribe_from_push(
    payload: PushSubscriptionDelete,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unsubscribe the current user from push notifications by endpoint."""
    # Find subscription by endpoint (need to parse JSON)
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == current_user.id)
    )
    subscriptions = result.scalars().all()

    for sub in subscriptions:
        try:
            sub_data = _parse_subscription(sub.subscription_json)
            if sub_data.get("endpoint") == payload.endpoint:
                await db.delete(sub)
                await db.commit()
                return {"success": True}
        except Exception:
            continue

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Subscription not found",
    )


@router.post("/send-test")
async def send_test_notification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a test push notification to the current user."""
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == current_user.id)
    )
    subscriptions = result.scalars().all()

    if not subscriptions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No push subscriptions found for user",
        )

    sent = await send_webpush_to_user(
        db,
        user_id=current_user.id,
        title="Notificación de prueba",
        body="Las notificaciones push funcionan correctamente! ",
        url="/",
    )
    await db.commit()

    return {"success": True, "sent": sent, "total": len(subscriptions)}


@router.get("/subscriptions", response_model=List[PushSubscriptionResponse])
async def list_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all push subscriptions for the current user."""
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == current_user.id)
    )
    return result.scalars().all()


class FCMTokenRequest(BaseModel):
    token: str
    platform: str = "web"
    user_agent: str | None = None


class FCMTokenResponse(BaseModel):
    success: bool
    token_id: str | None = None


@router.post("/fcm-token", response_model=FCMTokenResponse)
async def register_fcm_token(
    payload: FCMTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register an FCM token for the current user (native Android/iOS)."""
    if not payload.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FCM token is required",
        )

    # Check if token already exists for this user
    existing = await db.execute(
        select(FCMToken).where(
            FCMToken.user_id == current_user.id,
            FCMToken.token == payload.token,
        )
    )
    existing_token = existing.scalar_one_or_none()

    if existing_token:
        # Update platform and user_agent if different
        existing_token.platform = payload.platform
        existing_token.user_agent = payload.user_agent
        existing_token.active = True
        existing_token.last_used_at = utcnow()
        await db.commit()
        await db.refresh(existing_token)
        return FCMTokenResponse(success=True, token_id=existing_token.id)

    # Create new FCM token
    token = FCMToken(
        user_id=current_user.id,
        token=payload.token,
        platform=payload.platform,
        user_agent=payload.user_agent,
        active=True,
    )
    db.add(token)
    await db.commit()
    await db.refresh(token)

    return FCMTokenResponse(success=True, token_id=token.id)


@router.delete("/fcm-token")
async def unregister_fcm_token(
    payload: FCMTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unregister an FCM token for the current user."""
    if not payload.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FCM token is required",
        )

    result = await db.execute(
        select(FCMToken).where(
            FCMToken.user_id == current_user.id,
            FCMToken.token == payload.token,
        )
    )
    token = result.scalar_one_or_none()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FCM token not found",
        )

    token.active = False
    await db.commit()

    return {"success": True}