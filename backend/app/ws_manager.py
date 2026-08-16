import asyncio
import json
import uuid
from typing import Dict, Set, Optional

import redis.asyncio as redis
from fastapi import WebSocket

from .config import settings


# Redis Streams configuration
STREAM_KEY = "nexus:ws:stream"
CONSUMER_GROUP = "ws_workers"
CONSUMER_NAME_PREFIX = "worker"
# Cap the stream length. XACK removes entries from the pending list but NOT from
# the stream itself, so without trimming the stream grows forever and, on a small
# Redis with an `allkeys-lru` policy, eventually triggers eviction of the stream /
# consumer group and breaks delivery. Approximate trimming (~) is O(1)-ish.
STREAM_MAXLEN = 2000


class ConnectionManager:
    """Maneja conexiones WebSocket por usuario.

    Delivery is routed through Redis Streams with consumer groups for
    guaranteed delivery across multiple uvicorn workers. Each worker runs
    a consumer that claims messages, delivers to local connections, and ACKs.
    When Redis is unavailable (local dev without Redis) the manager degrades
    to the previous single-process in-memory behavior.
    """

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, Set[str]] = {}  # user_id -> set of room_ids
        self.room_users: Dict[str, Set[str]] = {}  # room_id -> set of user_ids
        self._redis: Optional[redis.Redis] = None
        self._consumer_task: Optional[asyncio.Task] = None
        self._consumer_name = f"{CONSUMER_NAME_PREFIX}-{uuid.uuid4().hex[:8]}"
        self._pending_acks: Dict[str, str] = {}  # message_id -> stream_key (for ACK tracking)

    # ------------------------------------------------------------------ #
    # Lifecycle (started/stopped from the FastAPI lifespan in main.py)     #
    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        """Connect Redis, create consumer group, and launch the consumer task."""
        # Render free runs a single worker (WEB_CONCURRENCY=1), so delivery is
        # in-process; the Redis Streams relay adds a silent failure point
        # (stream eviction / NOGROUP) with zero benefit. Enable only when the
        # deployment actually runs multiple uvicorn workers.
        if not settings.WS_STREAMS_ENABLED:
            print("[WS Manager] Redis Streams disabled (single worker) — in-memory delivery.")
            return
        try:
            self._redis = redis.from_url(
                settings.REDIS_URL,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                decode_responses=True,
                # redis-py 8 defaults socket_timeout to 5s, which kills the
                # blocking xreadgroup(block=5000) read before Redis answers.
                socket_timeout=None,
                socket_connect_timeout=10,
            )
            await self._redis.ping()
            try:
                await self._redis.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True)
            except redis.ResponseError as e:
                if "BUSYGROUP" not in str(e):
                    raise
            self._consumer_task = asyncio.create_task(self._consumer_loop())
            print("[WS Manager] Redis Streams consumer started.")
        except Exception:
            print("[WS Manager] Redis unavailable — falling back to in-memory delivery.")
            if self._redis is not None:
                try:
                    await self._redis.close()
                except Exception:
                    pass
            self._redis = None
            self._consumer_task = None

    async def shutdown(self) -> None:
        if self._consumer_task:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except (asyncio.CancelledError, Exception):
                pass
        # ACK any pending messages before shutdown
        if self._redis and self._pending_acks:
            try:
                await self._redis.xack(STREAM_KEY, CONSUMER_GROUP, *self._pending_acks.keys())
            except Exception:
                pass
        if self._redis is not None:
            try:
                await self._redis.close()
            except Exception:
                pass
        self._redis = None
        self._consumer_task = None
        self._pending_acks.clear()

    # ------------------------------------------------------------------ #
    # Redis Streams consumer                                              #
    # ------------------------------------------------------------------ #
    async def _consumer_loop(self) -> None:
        """Continuously read from stream, deliver locally, and ACK."""
        while True:
            try:
                # Block for up to 5 seconds waiting for new messages
                messages = await self._redis.xreadgroup(
                    CONSUMER_GROUP,
                    self._consumer_name,
                    {STREAM_KEY: ">"},
                    count=10,
                    block=5000,
                )
                if not messages:
                    continue

                for stream_key, entries in messages:
                    for msg_id, data in entries:
                        try:
                            payload = json.loads(data["payload"])
                            await self._route(payload)
                            # ACK after successful delivery
                            await self._redis.xack(STREAM_KEY, CONSUMER_GROUP, msg_id)
                        except Exception as e:
                            # Log error but don't ACK - message will be redelivered
                            # In production, could add to dead letter stream after max retries
                            print(f"[WS Manager] Failed to deliver message {msg_id}: {e}")
                            # Don't ACK - let it be redelivered to another consumer
            except asyncio.CancelledError:
                raise
            except Exception as e:
                # Connection hiccup: back off briefly and retry
                print(f"[WS Manager] Consumer loop error: {e}")
                await asyncio.sleep(1)

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
        # The client sends the JWT as the Sec-WebSocket-Protocol subprotocol.
        # Browsers REQUIRE the server to echo back one of the offered
        # subprotocols in the 101 response — without it, Chrome/Firefox/Brave
        # abort the handshake with a generic "WebSocket connection failed".
        subprotocols = ws.scope.get("subprotocols") or []
        await ws.accept(subprotocol=subprotocols[0] if subprotocols else None)
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
        """Send a message to a user. Cross-worker via Redis Streams when available."""
        payload = {"kind": "user", "user_id": user_id, "data": data}
        if self._redis is None:
            await self._local_send(user_id, data)
            return
        try:
            await self._redis.xadd(
                STREAM_KEY, {"payload": json.dumps(payload)},
                maxlen=STREAM_MAXLEN, approximate=True,
            )
        except Exception:
            # Redis down → fall back to in-memory
            await self._local_send(user_id, data)

    async def broadcast_to_room(self, room_id: str, data: dict, exclude_user: str = None):
        """Broadcast to every connected member of a room (except exclude_user)."""
        payload = {
            "kind": "room",
            "room_id": room_id,
            "exclude_user": exclude_user,
            "data": data,
        }
        if self._redis is None:
            for uid in list(self.room_users.get(room_id, set())):
                if uid != exclude_user:
                    await self._local_send(uid, data)
            return
        try:
            await self._redis.xadd(
                STREAM_KEY, {"payload": json.dumps(payload)},
                maxlen=STREAM_MAXLEN, approximate=True,
            )
        except Exception:
            # Redis down → fall back to in-memory
            for uid in list(self.room_users.get(room_id, set())):
                if uid != exclude_user:
                    await self._local_send(uid, data)


manager = ConnectionManager()