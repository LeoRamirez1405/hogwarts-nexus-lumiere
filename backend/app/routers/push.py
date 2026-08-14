from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..config import settings
from ..database import get_db
from ..models.user import User
from ..models.push_subscription import PushSubscription
from ..schemas.push_subscription import PushSubscriptionCreate, PushSubscriptionResponse, PushSubscriptionDelete
from ..middleware.auth import get_current_user
from ..services.push_service import _parse_subscription, send_webpush_to_user

router = APIRouter(prefix="/push", tags=["push"])


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