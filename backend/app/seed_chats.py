"""Seed script for chat rooms, messages, and events."""

from datetime import datetime, timedelta
from sqlalchemy import select
from .database import async_session
from .models.user import User
from .models.chat_room import ChatRoom, ChatRoomMember, UserConversationPreference
from .models.message import Message
from .models.event import Event, EventStatus, EventLocationType, RSVPStatus, EventRSVP


async def seed_chats_and_events():
    """Create chat rooms with members, messages, and events."""
    async with async_session() as db:
        # Check if already seeded
        existing_room = await db.execute(
            select(ChatRoom).where(ChatRoom.name == "Gryffindor Common Room")
        )
        if existing_room.scalar_one_or_none():
            print("Chat rooms already seeded, skipping...")
            return

        # Get all users
        users_result = await db.execute(select(User))
        users = {u.email: u for u in users_result.scalars().all()}

        admin = users.get("admin@nexus.com")
        hermione = users.get("hermione@nexus.com")
        luna = users.get("luna@nexus.com")
        cedric = users.get("cedric@nexus.com")
        harry = users.get("harry@nexus.com")

        # ============================================================
        # CREATE CHAT ROOMS
        # ============================================================
        rooms = [
            ChatRoom(
                name="Gryffindor Common Room",
                description="The official common room for Gryffindor students. Password: Caput Draconis.",
                type="group",
                created_by=admin.id,
            ),
            ChatRoom(
                name="Dumbledore's Army",
                description="Secret organization for learning defensive magic. Meet in the Room of Requirement.",
                type="group",
                created_by=hermione.id,
            ),
            ChatRoom(
                name="Slug Club",
                description="Professor Slughorn's exclusive club for talented and well-connected students.",
                type="group",
                created_by=admin.id,
            ),
            ChatRoom(
                name="S.P.E.W.",
                description="Society for the Promotion of Elfish Welfare. Founded by Hermione Granger.",
                type="group",
                created_by=hermione.id,
            ),
            ChatRoom(
                name="Quidditch Team - Gryffindor",
                description="Gryffindor Quidditch team coordination. Practices, strategies, and match prep.",
                type="group",
                created_by=harry.id,
            ),
        ]
        db.add_all(rooms)
        await db.flush()

        # ============================================================
        # ADD MEMBERS TO ROOMS
        # ============================================================
        room_members = [
            # Gryffindor Common Room - all Gryffindors + admin
            (rooms[0].id, hermione.id, "moderator"),
            (rooms[0].id, harry.id, "member"),
            (rooms[0].id, admin.id, "admin"),
            (rooms[0].id, cedric.id, "member"),  # Hufflepuff but friend
            # Dumbledore's Army - DA members
            (rooms[1].id, hermione.id, "admin"),
            (rooms[1].id, harry.id, "moderator"),
            (rooms[1].id, luna.id, "member"),
            (rooms[1].id, cedric.id, "member"),
            (rooms[1].id, admin.id, "member"),
            # Slug Club - selected students
            (rooms[2].id, admin.id, "admin"),
            (rooms[2].id, hermione.id, "member"),
            (rooms[2].id, harry.id, "member"),
            (rooms[2].id, luna.id, "member"),
            (rooms[2].id, cedric.id, "member"),
            # S.P.E.W.
            (rooms[3].id, hermione.id, "admin"),
            (rooms[3].id, luna.id, "member"),
            # Quidditch Team
            (rooms[4].id, harry.id, "admin"),
            (rooms[4].id, cedric.id, "moderator"),
            (rooms[4].id, admin.id, "member"),
        ]

        members = [
            ChatRoomMember(
                room_id=room_id,
                user_id=user_id,
                role=role,
                joined_at=datetime.now() - timedelta(days=30),
            )
            for room_id, user_id, role in room_members
        ]
        db.add_all(members)
        await db.flush()

        # ============================================================
        # CREATE MESSAGES IN EACH ROOM
        # ============================================================
        now = datetime.now()
        base_time = now - timedelta(days=7)

        def msg_time(day_offset: int, hour: int, minute: int) -> datetime:
            return base_time.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(days=day_offset)

        messages = []

        # --- Gryffindor Common Room (room 0) ---
        gryff_msgs = [
            (hermione, "Welcome everyone! Remember the password is Caput Draconis. Don't tell anyone from other houses!", msg_time(0, 8, 0)),
            (harry, "Thanks Hermione! Ron's already forgotten it twice this week.", msg_time(0, 8, 15)),
            (cedric, "Even as a Hufflepuff I know the password... Cedric Diggory, at your service!", msg_time(0, 9, 0)),
            (harry, "Cedric! Good to see you here. How's the Triwizard prep going?", msg_time(0, 9, 30)),
            (cedric, "Intense! The dragons were no joke. But Harry, you did amazing with the Hungarian Horntail.", msg_time(0, 10, 0)),
            (luna, "I heard the dragons have Crumple-Horned Snorkacks as distant cousins. Very shy creatures.", msg_time(0, 11, 0)),
            (hermione, "Luna, Snorkacks don't exist. There's no scientific evidence whatsoever.", msg_time(0, 11, 30)),
            (luna, "That's what the Nargles want you to believe. They hide the evidence.", msg_time(0, 12, 0)),
            (admin, "Students, remember curfew is at 10 PM. The Fat Lady gets very cross if you're late.", msg_time(1, 21, 0)),
            (harry, "Noted, Professor. We'll keep it down.", msg_time(1, 21, 15)),
            (hermione, "Has anyone seen my copy of 'Hogwarts: A History'? I swear I left it on the table.", msg_time(2, 14, 0)),
            (harry, "Check the dormitory? Ron might have used it to prop up his broken bed leg.", msg_time(2, 14, 30)),
            (cedric, "I saw a copy in the library yesterday. Might have been yours.", msg_time(2, 15, 0)),
            (hermione, "Found it! It was under a pile of Parvati's Divination homework. Thank you!", msg_time(2, 16, 0)),
            (harry, "Anyone up for Exploding Snap tonight? Common room, 8 PM?", msg_time(3, 18, 0)),
            (cedric, "I'm in! Haven't played in ages.", msg_time(3, 18, 30)),
            (luna, "I'll bring my Spectrespecs. The Wrackspurts are thick tonight.", msg_time(3, 19, 0)),
            (admin, "20 points to Gryffindor for house unity! Cedric, welcome anytime.", msg_time(3, 19, 30)),
            (harry, "Brilliant! See you all at 8.", msg_time(3, 20, 0)),
            (hermione, "Don't forget your Potions essays are due Monday!", msg_time(4, 10, 0)),
        ]

        for sender, body, created_at in gryff_msgs:
            messages.append(Message(
                sender_id=sender.id,
                room_id=rooms[0].id,
                body=body,
                kind="text",
                read=True,
                created_at=created_at,
            ))

        # --- Dumbledore's Army (room 1) ---
        da_msgs = [
            (hermione, "DA Meeting this Friday, Room of Requirement, 7 PM sharp. We're practicing Patronus Charms.", msg_time(0, 16, 0)),
            (harry, "I'll demonstrate the full Patronus first. Everyone bring your wands.", msg_time(0, 16, 30)),
            (luna, "My Patronus is a hare. It's very fast and jumps through walls.", msg_time(0, 17, 0)),
            (cedric, "Mine's a badger. Stubborn but gets the job done.", msg_time(0, 17, 30)),
            (hermione, "Excellent! Remember: think of your happiest memory. Expecto Patronum!", msg_time(0, 18, 0)),
            (harry, "Pro tip: chocolate helps after. Dementors drain happiness.", msg_time(0, 18, 30)),
            (luna, "The Room of Requirement smells like rain and old parchment today. Very calming.", msg_time(1, 10, 0)),
            (cedric, "Neville's improving so much! His Patronus was almost corporeal last time.", msg_time(1, 10, 30)),
            (hermione, "That's wonderful! Positive reinforcement works.", msg_time(1, 11, 0)),
            (harry, "Next week: defensive shields and counter-jinxes. Any requests?", msg_time(1, 12, 0)),
            (luna, "Can we learn to repel Gulping Plimpies? They're a nightmare in the lake.", msg_time(1, 12, 30)),
            (cedric, "Stupefy practice would be good. For... unexpected situations.", msg_time(1, 13, 0)),
            (hermione, "Noted. I'll prepare shield charm drills. See you all Friday!", msg_time(1, 14, 0)),
            (admin, "I'm proud of all of you. This is exactly what Hogwarts needs.", msg_time(2, 8, 0)),
        ]

        for sender, body, created_at in da_msgs:
            messages.append(Message(
                sender_id=sender.id,
                room_id=rooms[1].id,
                body=body,
                kind="text",
                read=True,
                created_at=created_at,
            ))

        # --- Slug Club (room 2) ---
        slug_msgs = [
            (admin, "Welcome to the Slug Club! Horace has outdone himself with the refreshments tonight.", msg_time(0, 19, 0)),
            (harry, "These dragón tartlets are amazing. Who made them?", msg_time(0, 19, 30)),
            (hermione, "I believe the house-elves prepared them. Though I still think S.P.E.W. has a point...", msg_time(0, 20, 0)),
            (luna, "The Crumple-Horned Snorkack would appreciate the salad. Very discerning palate.", msg_time(0, 20, 30)),
            (cedric, "Anyone heard about the new Potions master? Rumor says it's someone famous.", msg_time(0, 21, 0)),
            (admin, "All in good time, Cedric. For now, enjoy the company and the oak-matured mead.", msg_time(0, 21, 30)),
            (hermione, "I've been reading about the Half-Blood Prince's annotations. Fascinating stuff.", msg_time(1, 10, 0)),
            (harry, "You mean the book I found? It's been incredibly helpful for Potions.", msg_time(1, 10, 30)),
            (luna, "Books have memories. That one remembers every hand that held it.", msg_time(1, 11, 0)),
            (cedric, "Well, whoever the Prince was, they knew their Wolfsbane.", msg_time(1, 11, 30)),
        ]

        for sender, body, created_at in slug_msgs:
            messages.append(Message(
                sender_id=sender.id,
                room_id=rooms[2].id,
                body=body,
                kind="text",
                read=True,
                created_at=created_at,
            ))

        # --- S.P.E.W. (room 3) ---
        spew_msgs = [
            (hermione, "S.P.E.W. meeting tomorrow at lunch! We're knitting hats and socks for the house-elves.", msg_time(0, 12, 0)),
            (luna, "I'll bring my blue yarn. The elves like blue - it matches the sky.", msg_time(0, 12, 30)),
            (hermione, "Perfect! We also need to plan the Dobby Appreciation Day.", msg_time(0, 13, 0)),
            (luna, "Dobby is a free elf. He'd want us to celebrate freedom, not just socks.", msg_time(0, 13, 30)),
            (hermione, "Absolutely. Freedom AND socks. Both are important.", msg_time(0, 14, 0)),
            (harry, "Hermione, you're doing brilliant work. The elves are lucky to have you.", msg_time(1, 10, 0)),
            (hermione, "Thank you, Harry. It's a long road but every hat counts.", msg_time(1, 10, 30)),
        ]

        for sender, body, created_at in spew_msgs:
            messages.append(Message(
                sender_id=sender.id,
                room_id=rooms[3].id,
                body=body,
                kind="text",
                read=True,
                created_at=created_at,
            ))

        # --- Quidditch Team (room 4) ---
        quidditch_msgs = [
            (harry, "Team! Practice tomorrow 6 AM sharp. New strategy for the Slytherin match.", msg_time(0, 20, 0)),
            (cedric, "I've watched their seeker. He favors the left side on the dive. We can exploit that.", msg_time(0, 20, 30)),
            (harry, "Good catch. I'll fake right, go left. Beaters - cover me on the feint.", msg_time(0, 21, 0)),
            (cedric, "Chasers - we need to draw their keeper out. Quick passes, then sudden shot.", msg_time(0, 21, 30)),
            (harry, "Ron's keeping looking sharp lately. Confidence is up.", msg_time(1, 8, 0)),
            (cedric, "He saved three penalties yesterday. The firewhisky incident actually helped his reflexes?", msg_time(1, 8, 30)),
            (harry, "Don't ask. Just... don't ask. Practice at 6. Don't be late.", msg_time(1, 9, 0)),
        ]

        for sender, body, created_at in quidditch_msgs:
            messages.append(Message(
                sender_id=sender.id,
                room_id=rooms[4].id,
                body=body,
                kind="text",
                read=True,
                created_at=created_at,
            ))

        db.add_all(messages)
        await db.flush()

        # ============================================================
        # CREATE EVENTS
        # ============================================================
        events = [
            Event(
                room_id=rooms[0].id,
                created_by=hermione.id,
                title="Gryffindor House Meeting",
                description="Monthly house meeting with Prefects. Discussing upcoming Quidditch match and House Cup standings.",
                starts_at=now + timedelta(days=2, hours=18),  # 2 days from now, 6 PM
                ends_at=now + timedelta(days=2, hours=19, minutes=30),
                location_type=EventLocationType.PHYSICAL,
                location_name="Gryffindor Common Room",
                status=EventStatus.PUBLISHED,
                max_attendees=50,
            ),
            Event(
                room_id=rooms[1].id,
                created_by=harry.id,
                title="DA Patronus Workshop",
                description="Intensive Patronus Charm practice. Bring chocolate. We'll work on corporeal forms.",
                starts_at=now + timedelta(days=3, hours=19),  # 3 days, 7 PM
                ends_at=now + timedelta(days=3, hours=21),
                location_type=EventLocationType.PHYSICAL,
                location_name="Room of Requirement",
                status=EventStatus.PUBLISHED,
                max_attendees=30,
                require_approval=False,
            ),
            Event(
                room_id=rooms[0].id,
                created_by=admin.id,
                title="Yule Ball Planning Committee",
                description="Planning for this year's Yule Ball. Theme: 'A Night in the Forbidden Forest'. Decorations, music, refreshments.",
                starts_at=now + timedelta(days=5, hours=16),  # 5 days, 4 PM
                ends_at=now + timedelta(days=5, hours=18),
                location_type=EventLocationType.PHYSICAL,
                location_name="Great Hall",
                status=EventStatus.PUBLISHED,
                max_attendees=20,
            ),
            Event(
                room_id=rooms[4].id,
                created_by=harry.id,
                title="Gryffindor vs Slytherin - Quidditch Match",
                description="The big match! Gryffindor vs Slytherin. Be there to cheer or play. Pitch opens 10 AM for warm-ups.",
                starts_at=now + timedelta(days=7, hours=11),  # 7 days, 11 AM
                ends_at=now + timedelta(days=7, hours=14),
                location_type=EventLocationType.PHYSICAL,
                location_name="Quidditch Pitch",
                status=EventStatus.PUBLISHED,
                max_attendees=200,
            ),
            Event(
                room_id=rooms[3].id,
                created_by=hermione.id,
                title="Dobby Appreciation Day",
                description="Annual celebration of house-elf rights and Dobby's legacy. Sock knitting, elf-made treats, speeches.",
                starts_at=now + timedelta(days=10, hours=12),  # 10 days, noon
                ends_at=now + timedelta(days=10, hours=17),
                location_type=EventLocationType.PHYSICAL,
                location_name="Hogsmeade - Three Broomsticks",
                status=EventStatus.PUBLISHED,
                max_attendees=100,
            ),
        ]
        db.add_all(events)
        await db.flush()

        # Add RSVPs for events
        rsvps = []
        for event in events:
            # Creator always going
            rsvps.append(EventRSVP(
                event_id=event.id,
                user_id=event.created_by,
                status=RSVPStatus.GOING,
            ))
            # Add some other members
            for user in [hermione, harry, luna, cedric, admin]:
                if user.id != event.created_by:
                    rsvps.append(EventRSVP(
                        event_id=event.id,
                        user_id=user.id,
                        status=RSVPStatus.GOING if user in [hermione, harry] else RSVPStatus.MAYBE,
                    ))

        db.add_all(rsvps)

        # ============================================================
        # CREATE DM CONVERSATIONS (UserConversationPreference entries)
        # ============================================================
        # The fallback in build_conversations will pick these up from messages,
        # but we can also create prefs explicitly for cleaner data

        dm_pairs = [
            (hermione, harry),
            (harry, luna),
            (luna, cedric),
            (hermione, luna),
            (harry, cedric),
            (admin, harry),
            (admin, hermione),
        ]

        for user1, user2 in dm_pairs:
            # Create prefs for both users
            for u1, u2 in [(user1, user2), (user2, user1)]:
                # Check if pref already exists
                existing = await db.execute(
                    select(UserConversationPreference).where(
                        UserConversationPreference.user_id == u1.id,
                        UserConversationPreference.conversation_type == "dm",
                        UserConversationPreference.conversation_id == u2.id,
                    )
                )
                if not existing.scalar_one_or_none():
                    pref = UserConversationPreference(
                        user_id=u1.id,
                        conversation_type="dm",
                        conversation_id=u2.id,
                        hidden=False,
                        unread_count=0,
                    )
                    db.add(pref)

        # Room prefs - check before creating
        for room in rooms:
            for member in [m for m in members if m.room_id == room.id]:
                existing = await db.execute(
                    select(UserConversationPreference).where(
                        UserConversationPreference.user_id == member.user_id,
                        UserConversationPreference.conversation_type == "room",
                        UserConversationPreference.conversation_id == room.id,
                    )
                )
                if not existing.scalar_one_or_none():
                    pref = UserConversationPreference(
                        user_id=member.user_id,
                        conversation_type="room",
                        conversation_id=room.id,
                        hidden=False,
                        unread_count=0,
                    )
                    db.add(pref)

        await db.commit()
        print(f"Seeded {len(rooms)} chat rooms, {len(messages)} messages, {len(events)} events, {len(rsvps)} RSVPs")
        print("Chat rooms:")
        for r in rooms:
            print(f"  - {r.name} ({r.id})")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_chats_and_events())