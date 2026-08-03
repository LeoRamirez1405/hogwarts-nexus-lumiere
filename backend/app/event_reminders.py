"""
Event Reminders Scheduler
Runs every minute to check for upcoming events and send reminders.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import async_session
from ..models.event import Event, EventReminder, EventStatus, ReminderTime
from ..models.user import User
from ..notifications_service import notify, N
from ..ws_manager import manager


# Mapping of reminder time to timedelta before event start
REMINDER_DELTAS = {
    ReminderTime.AT_TIME: timedelta(minutes=0),
    ReminderTime.MINUTES_15: timedelta(minutes=15),
    ReminderTime.HOUR_1: timedelta(hours=1),
    ReminderTime.HOURS_3: timedelta(hours=3),
    ReminderTime.DAY_1: timedelta(days=1),
    ReminderTime.DAYS_3: timedelta(days=3),
    ReminderTime.WEEK_1: timedelta(weeks=1),
}


async def _send_reminder_notification(
    db: AsyncSession,
    user: User,
    event: Event,
    reminder_time: ReminderTime,
):
    """Send a reminder notification to a user."""
    # In-app notification
    time_str = _format_reminder_time(reminder_time)
    await notify(
        db,
        user_id=user.id,
        type=N.GROUP_EVENT,
        title=f"Recordatorio: {event.title}",
        body=f"El evento empieza {time_str}",
        related_id=f"event:{event.id}",
        actor_id=user.id,
    )

    # WebSocket push if user is online
    payload = {
        "t": "event_reminder",
        "e": {
            "id": event.id,
            "title": event.title,
            "starts_at": event.starts_at.isoformat(),
            "reminder_time": reminder_time.value,
        },
    }
    await manager.send_to_user(user.id, payload)


def _format_reminder_time(reminder_time: ReminderTime) -> str:
    """Format reminder time for display."""
    mapping = {
        ReminderTime.AT_TIME: "ahora",
        ReminderTime.MINUTES_15: "en 15 minutos",
        ReminderTime.HOUR_1: "en 1 hora",
        ReminderTime.HOURS_3: "en 3 horas",
        ReminderTime.DAY_1: "mañana",
        ReminderTime.DAYS_3: "en 3 días",
        ReminderTime.WEEK_1: "en 1 semana",
    }
    return mapping.get(reminder_time, "pronto")


async def event_reminders_loop():
    """Background task that checks for event reminders every minute."""
    while True:
        try:
            await _process_reminders()
        except Exception as e:
            print(f"Error in event_reminders_loop: {e}")

        await asyncio.sleep(60)  # Check every minute


async def _process_reminders():
    """Process all pending reminders that are due."""
    async with async_session() as db:
        now = datetime.utcnow()

        # Find events that are upcoming (within the next week max)
        max_lookahead = timedelta(weeks=1) + timedelta(minutes=5)  # buffer
        events_result = await db.execute(
            select(Event)
            .options(selectinload(Event.reminders).selectinload(EventReminder.user))
            .where(
                and_(
                    Event.status == EventStatus.PUBLISHED,
                    Event.starts_at > now,
                    Event.starts_at <= now + max_lookahead,
                )
            )
        )
        events = events_result.scalars().all()

        for event in events:
            for reminder in event.reminders:
                if reminder.sent:
                    continue

                delta = REMINDER_DELTAS.get(reminder.reminder_time, timedelta(hours=1))
                reminder_time = event.starts_at - delta

                # Check if it's time to send (within 1 minute window)
                if reminder_time <= now + timedelta(minutes=1) and reminder_time >= now - timedelta(minutes=1):
                    # Send reminder
                    await _send_reminder_notification(db, reminder.user, event, reminder.reminder_time)

                    # Mark as sent
                    reminder.sent = True
                    reminder.sent_at = now
                    await db.commit()