"""Events reminders router."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.event import Event, ReminderTime
from ...models.user import User
from ...services.events import (
    get_reminder_setting,
    upsert_reminder,
)
from ..events.deps import require_event_visibility, get_event_with_access

router = APIRouter()


class ReminderSettingsRequest(BaseModel):
    reminder_time: ReminderTime


class ReminderSettingsResponse(BaseModel):
    event_id: str
    user_id: str
    reminder_time: ReminderTime

    class Config:
        from_attributes = True


@router.get("", response_model=ReminderSettingsResponse)
async def get_reminder_setting_endpoint(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    event: Event = Depends(get_event_with_access),
):
    """Get user's reminder setting for an event."""
    reminder_time = await get_reminder_setting(db, event_id, current_user.id)

    return ReminderSettingsResponse(
        event_id=event_id,
        user_id=current_user.id,
        reminder_time=reminder_time,
    )


@router.patch("", response_model=ReminderSettingsResponse)
async def update_reminder_setting(
    event_id: str,
    reminder_data: ReminderSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _visibility: bool = Depends(require_event_visibility),
    event: Event = Depends(get_event_with_access),
):
    """Update user's reminder setting for an event."""
    await upsert_reminder(db, event_id, current_user.id, reminder_data.reminder_time)

    return ReminderSettingsResponse(
        event_id=event_id,
        user_id=current_user.id,
        reminder_time=reminder_data.reminder_time,
    )