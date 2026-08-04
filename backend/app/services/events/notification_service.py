"""Event notification and WebSocket broadcast service."""

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.chat_room import ChatRoom, ChatRoomMember
from ...models.event import Event, EventRSVP, RSVPStatus
from ...notifications_service import notify, N
from ...ws_manager import manager


async def notify_event_created(
    db: AsyncSession,
    event: Event,
    room: ChatRoom,
    actor_id: str,
) -> None:
    """Notify room members about new event."""
    member_result = await db.execute(
        select(ChatRoomMember.user_id).where(ChatRoomMember.room_id == event.room_id)
    )
    for (member_id,) in member_result.all():
        if member_id != actor_id:
            await notify(
                db,
                user_id=member_id,
                type=N.GROUP_EVENT,
                title=f"Nuevo evento en {room.name}",
                body=f"{event.creator.name if event.creator else 'Alguien'} creó: {event.title}",
                related_id=f"event:{event.id}",
                actor_id=actor_id,
            )

    payload = {
        "t": "event_created",
        "c": event.room_id,
        "e": event.id,  # Minimal, router will serialize
    }
    await manager.broadcast_to_room(event.room_id, payload)


async def notify_event_updated(
    db: AsyncSession,
    event: Event,
    room_id: str,
) -> None:
    """Broadcast event update."""
    payload = {
        "t": "event_updated",
        "c": room_id,
        "e": event.id,  # Router will serialize full response
    }
    await manager.broadcast_to_room(room_id, payload)


async def notify_event_cancelled(
    db: AsyncSession,
    event: Event,
    actor_id: str,
) -> None:
    """Notify attendees about cancelled event."""
    rsvp_result = await db.execute(
        select(EventRSVP.user_id).where(
            and_(EventRSVP.event_id == event.id, EventRSVP.status == RSVPStatus.GOING)
        )
    )
    for (attendee_id,) in rsvp_result.all():
        if attendee_id != actor_id:
            await notify(
                db,
                user_id=attendee_id,
                type=N.GROUP_EVENT,
                title="Evento cancelado",
                body=f"El evento '{event.title}' ha sido cancelado",
                related_id=f"event:{event.id}",
                actor_id=actor_id,
            )

    payload = {
        "t": "event_cancelled",
        "c": event.room_id,
        "e": {"id": event.id, "status": "cancelled"},
    }
    await manager.broadcast_to_room(event.room_id, payload)


async def notify_rsvp_update(
    db: AsyncSession,
    event: Event,
    room_id: str,
    rsvp_counts: dict[str, int],
    user_id: str,
    status: RSVPStatus,
) -> None:
    """Broadcast RSVP update."""
    payload = {
        "t": "event_rsvp_updated",
        "c": room_id,
        "e": {"id": event.id, "rsvp_counts": rsvp_counts},
        "u": {"id": user_id, "status": status.value},
    }
    await manager.broadcast_to_room(room_id, payload)


async def notify_rsvp_to_creator(
    db: AsyncSession,
    event: Event,
    actor_id: str,
    actor_name: str,
) -> None:
    """Notify event creator about new GOING RSVP."""
    if event.created_by != actor_id:
        await notify(
            db,
            user_id=event.created_by,
            type=N.GROUP_EVENT,
            title="Nueva confirmación",
            body=f"{actor_name} va a tu evento '{event.title}'",
            related_id=f"event:{event.id}",
            actor_id=actor_id,
        )