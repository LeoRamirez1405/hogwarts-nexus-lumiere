"""Seed sample scheduled messages so the "Mensajes programados" view has data.

Run from the backend directory:

    python scripts/seed_scheduled_messages.py

Idempotent: it never touches messages that already exist; re-running just
re-seeds the same set for demo accounts. All timestamps are in the future
so the delivery loop does not fire them immediately.
"""

import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import async_session
from app.models.chat_room import ChatRoom
from app.models.message import Message
from app.models.user import User

RECIPIENTS = {
    "harry": "00000000-0000-0000-0000-000000000005",
    "hermione": "00000000-0000-0000-0000-000000000002",
    "luna": "00000000-0000-0000-0000-000000000003",
}


async def main():
    async with async_session() as db:
        admin = (
            await db.execute(
                select(User).where(User.email == "admin@nexus.com")
            )
        ).scalar_one_or_none()
        if not admin:
            print("SKIP: admin@nexus.com not found (run app/seed.py first)")
            return

        all_users = (await db.execute(select(User))).scalars().all()
        by_id = {u.id: u for u in all_users}

        room = (
            await db.execute(
                select(ChatRoom).where(ChatRoom.members.any())
            )
        ).scalars().first()
        room_id = room.id if room else None
        room_name = room.name if room else "el grupo"

        now = datetime.utcnow()

        sample = [
            (
                "harry",
                None,
                "Recuerda entregar tu ensayo sobre pociones antes del viernes.",
                "text",
                now + timedelta(hours=1),
            ),
            (
                "hermione",
                None,
                "¿Podrías revisar el capítulo de encantamientos autodefensivos? Quiero tu opinión.",
                "text",
                now + timedelta(hours=3),
            ),
            (
                "luna",
                None,
                "Mañana al amanecer salgo a cazar nargles. ¿Te apuntas?",
                "text",
                now + timedelta(days=1, hours=9),
            ),
            (
                "harry",
                None,
                "Reunión del Club de Duelos el domingo. Trae tu varita y el libro de hechizos defensivos.",
                "text",
                now + timedelta(days=3, hours=10),
            ),
            (
                None,
                room_id,
                f"Asamblea general en la Sala Común. ¡Asistencia obligatoria, {room_name}!",
                "text",
                now + timedelta(days=5, hours=12),
            ),
        ]

        created = 0
        for recipient_key, room_key, body, kind, scheduled_at in sample:
            recipient = by_id.get(RECIPIENTS[recipient_key]) if recipient_key else None
            existing = (
                await db.execute(
                    select(Message).where(
                        Message.sender_id == admin.id,
                        Message.body == body,
                        Message.scheduled_at.is_not(None),
                    )
                )
            ).scalar_one_or_none()
            if existing:
                print(f"skip (already seeded): {body[:50]}...")
                continue

            msg = Message(
                sender_id=admin.id,
                receiver_id=recipient.id if recipient else None,
                room_id=room_key,
                kind=kind,
                body=body,
                scheduled_at=scheduled_at,
                read=False,
            )
            db.add(msg)
            created += 1

        await db.commit()
        print(f"Seeded {created} scheduled message(s)")


if __name__ == "__main__":
    asyncio.run(main())