"""
Event Reminders Scheduler
Runs every minute to check for upcoming events and send reminders.
"""

import asyncio
from datetime import timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import async_session
from .models.event import (
    Event,
    EventReminder,
    EventRSVP,
    EventStatus,
    ReminderTime,
    RSVPStatus,
)
from .models.user import User
from .notifications_service import notify, N
from .ws_manager import manager
from app.utils.dates import utcnow


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
            await _process_lifecycle()
            await _process_rsvp_reminders()
            await _process_reminders()
        except Exception as e:
            print(f"Error in event_reminders_loop: {e}")

        await asyncio.sleep(60)  # Check every minute


# Automatic attendee reminders: everyone who marked GOING/MAYBE gets two fixed
# notifications, 1h and 5min before the event starts, regardless of their custom
# reminder setting. Each fires once (tracked per-RSVP), so late RSVPs simply miss
# whichever mark already passed.
RSVP_REMINDER_MARKS = [
    ("reminded_1h", timedelta(hours=1), "en 1 hora"),
    ("reminded_5m", timedelta(minutes=5), "en 5 minutos"),
]


async def _send_rsvp_reminder(db: AsyncSession, user: User, event: Event, when_str: str):
    """Notify an attendee that the event they're going to starts soon."""
    await notify(
        db,
        user_id=user.id,
        type=N.GROUP_EVENT,
        title=f"«{event.title}» empieza {when_str}",
        body=f"El evento al que vas empieza {when_str}",
        related_id=f"event:{event.id}",
        actor_id=user.id,
    )
    await manager.send_to_user(
        user.id,
        {
            "t": "event_reminder",
            "e": {
                "id": event.id,
                "title": event.title,
                "starts_at": event.starts_at.isoformat(),
                "when": when_str,
            },
        },
    )


async def _process_rsvp_reminders():
    """Send the fixed 1h / 5min reminders to GOING/MAYBE attendees."""
    async with async_session() as db:
        now = utcnow()

        # Only events starting within the next ~65 min can have a mark due now.
        events_result = await db.execute(
            select(Event).where(
                and_(
                    Event.status == EventStatus.PUBLISHED,
                    Event.starts_at > now,
                    Event.starts_at <= now + timedelta(hours=1, minutes=5),
                )
            )
        )
        events = events_result.scalars().all()

        changed = False
        for event in events:
            for flag_attr, delta, when_str in RSVP_REMINDER_MARKS:
                mark = event.starts_at - delta
                # Fire only within a ±1min window of the mark (same as custom
                # reminders), so a mark that already passed is not sent late.
                if not (now - timedelta(minutes=1) <= mark <= now + timedelta(minutes=1)):
                    continue

                rsvps_result = await db.execute(
                    select(EventRSVP)
                    .options(selectinload(EventRSVP.user))
                    .where(
                        and_(
                            EventRSVP.event_id == event.id,
                            EventRSVP.status.in_([RSVPStatus.GOING, RSVPStatus.MAYBE]),
                            getattr(EventRSVP, flag_attr).is_(False),
                        )
                    )
                )
                for rsvp in rsvps_result.scalars().all():
                    await _send_rsvp_reminder(db, rsvp.user, event, when_str)
                    setattr(rsvp, flag_attr, True)
                    changed = True

        if changed:
            await db.commit()


async def _process_lifecycle():
    """Advance event lifecycle: notify on start, auto-complete on end.

    - When starts_at is crossed (and the event hasn't ended), notify GOING
      attendees once and broadcast ``event_started``.
    - When ends_at passes, mark COMPLETED. Completed events are excluded from
      every listing query, so they disappear and free the room's single slot.
    """
    from .services.events.notification_service import notify_event_started

    async with async_session() as db:
        now = utcnow()

        # Events that just started (still running): notify attendees once.
        started_result = await db.execute(
            select(Event).where(
                and_(
                    Event.status == EventStatus.PUBLISHED,
                    Event.started_notified.is_(False),
                    Event.starts_at <= now,
                    or_(Event.ends_at.is_(None), Event.ends_at > now),
                )
            )
        )
        started = started_result.scalars().all()
        for event in started:
            await notify_event_started(db, event)
            event.started_notified = True

        # Events whose end time passed: complete them (frees the slot).
        ended_result = await db.execute(
            select(Event).where(
                and_(
                    Event.status == EventStatus.PUBLISHED,
                    Event.ends_at.isnot(None),
                    Event.ends_at <= now,
                )
            )
        )
        ended = ended_result.scalars().all()
        for event in ended:
            event.status = EventStatus.COMPLETED
            
            # Close associated voice channel (kick participants, delete channel)
            from .services.events.event_service import close_event_voice_channel
            await close_event_voice_channel(db, event, manager)

            # Silent UI refresh (no bell notification): lets the live banner and
            # in-progress state disappear in real time when the event ends.
            await manager.broadcast_to_room(
                event.room_id,
                {"t": "event_ended", "c": event.room_id, "e": {"id": event.id, "status": "completed"}},
            )

        if started or ended:
            await db.commit()


async def _process_reminders():
    """Process all pending reminders that are due."""
    async with async_session() as db:
        now = utcnow()

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