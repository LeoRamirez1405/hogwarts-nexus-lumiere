"""RSVP business logic service."""

from datetime import datetime
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...models.event import Event, EventReminder, EventRSVP, ReminderTime, RSVPStatus


async def check_capacity(
    db: AsyncSession,
    event_id: str,
    new_status: RSVPStatus,
    user_id: str,
) -> bool:
    """Check if event has capacity for a new GOING RSVP."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event or not event.max_attendees:
        return True  # No limit

    if new_status != RSVPStatus.GOING:
        return True  # Only GOING counts towards capacity

    going_count_result = await db.execute(
        select(func.count(EventRSVP.id)).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.status == RSVPStatus.GOING)
        )
    )
    going_count = going_count_result.scalar() or 0

    existing_result = await db.execute(
        select(EventRSVP).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.user_id == user_id)
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing and existing.status == RSVPStatus.GOING:
        return True  # User already counted

    return going_count < event.max_attendees


async def upsert_rsvp(
    db: AsyncSession,
    event_id: str,
    user_id: str,
    status: RSVPStatus,
) -> EventRSVP:
    """Create or update RSVP."""
    existing_result = await db.execute(
        select(EventRSVP).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.user_id == user_id)
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.status = status
        existing.updated_at = datetime.utcnow()
        existing.responded_at = datetime.utcnow()
    else:
        existing = EventRSVP(
            event_id=event_id,
            user_id=user_id,
            status=status,
        )
        db.add(existing)

    await db.commit()
    await db.refresh(existing)
    return existing


async def delete_rsvp(db: AsyncSession, event_id: str, user_id: str) -> bool:
    """Delete RSVP. Returns True if deleted."""
    result = await db.execute(
        select(EventRSVP).where(
            and_(EventRSVP.event_id == event_id, EventRSVP.user_id == user_id)
        )
    )
    rsvp = result.scalar_one_or_none()
    if not rsvp:
        return False
    await db.delete(rsvp)
    await db.commit()
    return True


async def get_rsvps_list(
    db: AsyncSession,
    event_id: str,
) -> list[EventRSVP]:
    """Get all RSVPs for an event with user info."""
    result = await db.execute(
        select(EventRSVP)
        .options(selectinload(EventRSVP.user))
        .where(EventRSVP.event_id == event_id)
        .order_by(EventRSVP.responded_at.desc())
    )
    return list(result.scalars().all())


async def get_rsvp_counts(db: AsyncSession, event_id: str) -> dict[str, int]:
    """Get RSVP counts by status."""
    result = await db.execute(
        select(EventRSVP.status, func.count(EventRSVP.id))
        .where(EventRSVP.event_id == event_id)
        .group_by(EventRSVP.status)
    )
    return {status.value: count for status, count in result.all()}


async def get_reminder_setting(
    db: AsyncSession,
    event_id: str,
    user_id: str,
) -> ReminderTime:
    """Get user's reminder setting for an event."""
    result = await db.execute(
        select(EventReminder).where(
            and_(EventReminder.event_id == event_id, EventReminder.user_id == user_id)
        )
    )
    reminder = result.scalar_one_or_none()
    return reminder.reminder_time if reminder else ReminderTime.HOUR_1


async def upsert_reminder(
    db: AsyncSession,
    event_id: str,
    user_id: str,
    reminder_time: ReminderTime,
) -> EventReminder:
    """Create or update reminder setting."""
    result = await db.execute(
        select(EventReminder).where(
            and_(EventReminder.event_id == event_id, EventReminder.user_id == user_id)
        )
    )
    reminder = result.scalar_one_or_none()

    if reminder:
        reminder.reminder_time = reminder_time
    else:
        reminder = EventReminder(
            event_id=event_id,
            user_id=user_id,
            reminder_time=reminder_time,
        )
        db.add(reminder)

    await db.commit()
    return reminder