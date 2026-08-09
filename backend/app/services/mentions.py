"""Mention resolution helpers shared across messaging and social features.

``resolve_mentions`` turns an "@Name" body into the mentioned ``User`` rows. On
top of plain user names it supports group-wide commands used inside chat rooms:

- ``@all``   → every room member (except the sender)
- ``@alle``  → every student (platform role != admin)
- ``@alla``  → every admin (platform role == admin)
- ``@allg`` / ``@alls`` / ``@allh`` / ``@allr`` → members of the matching house
"""

import re
from typing import Callable, List, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.chat_room import ChatRoomMember
from ..models.user import User

# Names can be multi-word and the text after an "@" usually keeps going
# ("@Hermione Granger mira esto"), so we can't match the phrase whole. For every
# "@<phrase>" we pick the longest real user name that is a prefix of the phrase.
# We only fetch users whose name starts with the mention's first word instead of
# loading the whole users table into memory.
_MENTION_RE = re.compile(r"@([A-Za-zÀ-ſ]+(?: [A-Za-zÀ-ſ]+)*)")

# Group-wide mention commands: @all (everyone), @alle (students), @alla
# (admins) and @allg/@alls/@allh/@allr (houses). A trailing letter must not be
# followed by another letter so "@Allison" keeps matching as a user name.
_SPECIAL_MENTION_RE = re.compile(r"@(all[a-z]?)(?![A-Za-zÀ-ſ])", re.IGNORECASE)

_SPECIAL_MENTION_HOUSES = {
    "allg": "Gryffindor",
    "alls": "Slytherin",
    "allh": "Hufflepuff",
    "allr": "Ravenclaw",
}


async def _resolve_special_mentions(
    db: AsyncSession,
    commands: set[str],
    room_id: Optional[str],
    sender_id: Optional[str],
) -> List[User]:
    """Expand group-wide mention commands into the matching room members."""
    if not room_id or not commands:
        return []

    member_stmt = select(ChatRoomMember).where(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.pending.is_(False),
    )
    if sender_id:
        member_stmt = member_stmt.where(ChatRoomMember.user_id != sender_id)
    rows = (
        await db.execute(member_stmt)
    ).scalars().all()
    users = [m.user for m in rows if m.user is not None]
    if not users:
        return []

    predicates: List[Callable[[User], bool]] = []
    if "all" in commands:
        predicates.append(lambda u: True)
    if "alle" in commands:
        predicates.append(lambda u: u.role != "admin")
    if "alla" in commands:
        predicates.append(lambda u: u.role == "admin")
    houses = {_SPECIAL_MENTION_HOUSES[c] for c in commands if c in _SPECIAL_MENTION_HOUSES}
    if houses:
        predicates.append(lambda u: u.house in houses)

    return [u for u in users if any(p(u) for p in predicates)]


async def resolve_mentions(
    db: AsyncSession,
    body: Optional[str],
    room_id: Optional[str] = None,
    sender_id: Optional[str] = None,
) -> List[User]:
    """Return the distinct ``User`` rows mentioned via "@Name" in ``body``.

    When ``room_id`` is provided, group-wide commands (@all, @alle, @alla,
    @allg, @alls, @allh, @allr) are expanded into the matching room members
    (excluding ``sender_id``).
    """
    if not body or "@" not in body:
        return []

    special_commands = {
        match.group(1).lower() for match in _SPECIAL_MENTION_RE.finditer(body)
    }

    found: List[User] = []
    seen: set[str] = set()

    if special_commands:
        for u in await _resolve_special_mentions(db, special_commands, room_id, sender_id):
            if u.id not in seen:
                seen.add(u.id)
                found.append(u)
        # Drop the command tokens so they are not matched as user names below.
        body = _SPECIAL_MENTION_RE.sub(" ", body)
        if "@" not in body:
            return found

    first_words = set()
    for match in _MENTION_RE.finditer(body):
        word = match.group(1).split(" ", 1)[0].lower()
        if word:
            first_words.add(word)
    if not first_words:
        return found

    clauses = [User.name.ilike(f"{word}%") for word in sorted(first_words)]
    all_users = (
        await db.execute(select(User).where(or_(*clauses)))
    ).scalars().all()
    users_by_lower = {}
    for u in all_users:
        users_by_lower.setdefault(u.name.lower(), u)

    for match in _MENTION_RE.finditer(body):
        words = match.group(1).split(" ")
        mentioned = None
        for k in range(len(words), 0, -1):  # longest prefix first
            candidate = " ".join(words[:k]).lower()
            if candidate in users_by_lower:
                mentioned = users_by_lower[candidate]
                break
        if mentioned and mentioned.id not in seen:
            seen.add(mentioned.id)
            found.append(mentioned)
    return found
