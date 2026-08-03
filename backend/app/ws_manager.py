import asyncio
import json
from typing import Dict, Set, Optional

import redis.asyncio as redis
from fastapi import WebSocket

from .config import settings

# Single channel shared by every worker. `send_to_user` / `broadcast_to_room`
# publish here and each worker's subscriber re-broadcasts to its LOCAL
# connections, so a message reaches a user no matter which worker holds their
# socket (multi-worker safe, see audit item #10).
CHANNEL = "nexus_ws"


class ConnectionManager:
    """Maneja conexiones WebSocket por usuario.

    Delivery is routed through Redis pub/sub so the bus works across multiple
    uvicorn workers. When Redis is unavailable (local dev without Redis) the
    manager degrades to the previous single-process in-memory behavior.
    """

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, Set[str]] = {}  # user_id -> set of room_ids
        self.room_users: Dict[str, Set[str]] = {}  # room_id -> set of user_ids
        self._redis: Optional[redis.Redis] = None
        self._pubsub = None
        self._subscriber_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------ #
    # Lifecycle (started/stopped from the FastAPI lifespan in main.py)     #
    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        """Connect Redis and launch the cross-worker subscriber task."""
        try:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                decode_responses=True,
            )
            self._pubsub = self._redis.pubsub()
            await self._pubsub.subscribe(CHANNEL)
            self._subscriber_task = asyncio.create_task(self._subscriber_loop())
        except Exception:
            # No Redis → fall back to in-memory delivery.
            self._redis = None
            self._pubsub = None
            self._subscriber_task = None

    async def shutdown(self) -> None:
        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except (asyncio.CancelledError, Exception):
                pass
        if self._pubsub is not None:
            try:
                await self._pubsub.unsubscribe(CHANNEL)
                await self._pubsub.close()
            except Exception:
                pass
        if self._redis is not None:
            try:
                await self._redis.close()
            except Exception:
                pass
        self._pubsub = None
        self._redis = None
        self._subscriber_task = None

    # ------------------------------------------------------------------ #
    # Redis pub/sub bus                                                    #
    # ------------------------------------------------------------------ #
    async def _publish(self, payload: dict) -> Optional[int]:
        """Publish a cross-worker message.

        Returns the number of subscribers that received it, or ``None`` when
        Redis is unavailable (callers then fall back to in-memory delivery).
        """
        if self._redis is None:
            return None
        try:
            return int(await self._redis.publish(CHANNEL, json.dumps(payload)))
        except Exception:
            return None

    async def _subscriber_loop(self) -> None:
        while True:
            try:
                async for message in self._pubsub.listen():
                    if message.get("type") != "message":
                        continue
                    try:
                        payload = json.loads(message["data"])
                    except Exception:
                        continue
                    await self._route(payload)
            except asyncio.CancelledError:
                raise
            except Exception:
                # Connection hiccup: back off briefly and resubscribe.
                await asyncio.sleep(1)
                try:
                    await self._pubsub.subscribe(CHANNEL)
                except Exception:
                    pass

    async def _route(self, payload: dict) -> None:
        """Deliver a cross-worker message to this worker's LOCAL connections."""
        try:
            if payload.get("kind") == "user":
                await self._local_send(payload["user_id"], payload["data"])
            elif payload.get("kind") == "room":
                exclude = payload.get("exclude_user")
                for uid in list(self.room_users.get(payload["room_id"], set())):
                    if uid != exclude:
                        await self._local_send(uid, payload["data"])
        except Exception:
            pass

    async def _local_send(self, user_id: str, data: dict) -> bool:
        """Deliver directly to a locally-connected socket (no pub/sub)."""
        ws = self.active_connections.get(user_id)
        if ws is None:
            return False
        try:
            await ws.send_json(data)
            return True
        except Exception:
            self.disconnect(user_id)
            return False

    # ------------------------------------------------------------------ #
    # Connection tracking                                                  #
    # ------------------------------------------------------------------ #
    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active_connections[user_id] = ws
        self.user_rooms[user_id] = set()

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)
        rooms = self.user_rooms.pop(user_id, set())
        for room_id in rooms:
            self.room_users.get(room_id, set()).discard(user_id)

    def add_user_to_room(self, user_id: str, room_id: str):
        if user_id not in self.user_rooms:
            self.user_rooms[user_id] = set()
        self.user_rooms[user_id].add(room_id)

        if room_id not in self.room_users:
            self.room_users[room_id] = set()
        self.room_users[room_id].add(user_id)

    def remove_user_from_room(self, user_id: str, room_id: str):
        self.user_rooms.get(user_id, set()).discard(room_id)
        self.room_users.get(room_id, set()).discard(user_id)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.active_connections

    def get_online_users(self) -> Set[str]:
        return set(self.active_connections.keys())

    # ------------------------------------------------------------------ #
    # Delivery APIs (used across the codebase)                             #
    # ------------------------------------------------------------------ #
    async def send_to_user(self, user_id: str, data: dict):
        """Send a message to a user. Cross-worker via Redis when available."""
        receivers = await self._publish({"kind": "user", "user_id": user_id, "data": data})
        if receivers is None or receivers == 0:
            # Redis down, or no subscriber running yet → deliver in-process.
            await self._local_send(user_id, data)

    async def broadcast_to_room(self, room_id: str, data: dict, exclude_user: str = None):
        """Broadcast to every connected member of a room (except exclude_user)."""
        receivers = await self._publish(
            {
                "kind": "room",
                "room_id": room_id,
                "exclude_user": exclude_user,
                "data": data,
            }
        )
        if receivers is None or receivers == 0:
            for uid in list(self.room_users.get(room_id, set())):
                if uid != exclude_user:
                    await self._local_send(uid, data)


manager = ConnectionManager()
