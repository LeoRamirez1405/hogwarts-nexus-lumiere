"""Notification templates for pet lifecycle events.

Centralizes the strings used by the creatures routers so they stay consistent
and testable. Helpers only add to the session; the caller commits.
"""

from ..models.article_subscription import Notification
from ..notifications_service import N


def pet_farewell(user_id: str, creature_id: str, name: str) -> Notification:
    return Notification(
        user_id=user_id,
        type=N.PET_FAREWELL,
        title="Una despedida",
        body=f"{name} ha vivido una larga y feliz vida en tu santuario, y hoy parte en paz. Gracias por cuidarla.",
        related_id=creature_id,
    )


def pet_aging_warning(user_id: str, creature_id: str, name: str) -> Notification:
    return Notification(
        user_id=user_id,
        type=N.PET_AGING,
        title="Tu mascota esta muy ancianita",
        body=f"{name} ya es muy mayor. Disfruta y cuida bien sus ultimos dias.",
        related_id=creature_id,
    )


def pet_escaped(user_id: str, creature_id: str, name: str) -> Notification:
    return Notification(
        user_id=user_id,
        type=N.PET_ESCAPED,
        title="Tu mascota se ha escapado",
        body=f"{name} ha aprovechado un descuido y ha salido corriendo. Se ha ido para siempre.",
        related_id=creature_id,
    )


def pet_sold(
    former_owner_id: str,
    buyer_name: str,
    creature_name: str,
    price: int,
    creature_id: str,
) -> Notification:
    return Notification(
        user_id=former_owner_id,
        type=N.PET_SOLD,
        title="Vendiste una mascota",
        body=f"{buyer_name} compro a {creature_name} por {price} zerines.",
        related_id=creature_id,
    )
