from typing import Dict, Set
from fastapi import WebSocket
import json


class ConnectionManager:
    """Maneja conexiones WebSocket por usuario."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, Set[str]] = {}  # user_id -> set of room_ids
        self.room_users: Dict[str, Set[str]] = {}  # room_id -> set of user_ids

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active_connections[user_id] = ws
        self.user_rooms[user_id] = set()

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)
        rooms = self.user_rooms.pop(user_id, set())
        for room_id in rooms:
            self.room_users.get(room_id, set()).discard(user_id)

    async def send_to_user(self, user_id: str, data: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(user_id)

    async def broadcast_to_room(self, room_id: str, data: dict, exclude_user: str = None):
        user_ids = self.room_users.get(room_id, set())
        for user_id in user_ids:
            if user_id != exclude_user:
                await self.send_to_user(user_id, data)

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


manager = ConnectionManager()