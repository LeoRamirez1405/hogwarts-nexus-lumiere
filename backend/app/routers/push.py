import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

import webpush
from webpush import WebPushException

from ..config import settings
from ..database import get_db
from ..models.user import User
from ..models.push_subscription import PushSubscription
from ..schemas.push_subscription import PushSubscriptionCreate, PushSubscriptionResponse, PushSubscriptionDelete
from ..middleware.auth import get_current_user

router = APIRouter(prefix="/push", tags=["push"])


# Configure webpush with VAPID
if settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY:
    webpush.set_vapid_details(
        settings.VAPID_SUBJECT,
        settings.VAPID_PUBLIC_KEY,
        settings.VAPID_PRIVATE_KEY,
    )


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
            sub_data = eval(sub.subscription_json) if isinstance(sub.subscription_json, str) else sub.subscription_json
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

    sent_count = 0
    for sub in subscriptions:
        try:
            sub_data = eval(sub.subscription_json) if isinstance(sub.subscription_json, str) else sub.subscription_json
            webpush.webpush(
                subscription_info=sub_data,
                data='{"title":"Notificación de prueba","body":"Las notificaciones push funcionan correctamente! 💎","icon":"/icons/icon-192.svg"}',
            )
            sent_count += 1
        except WebPushException as e:
            # If subscription expired (410), delete it
            if e.response and e.response.status_code == 410:
                await db.delete(sub)
            print(f"Push send failed: {e}")

    await db.commit()

    return {"success": True, "sent": sent_count, "total": len(subscriptions)}


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