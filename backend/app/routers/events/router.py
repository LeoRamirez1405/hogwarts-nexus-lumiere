"""Events router - combines all event sub-routers."""

from fastapi import APIRouter

from . import visibility, events, rsvp, reminders, voice_channels

router = APIRouter(tags=["events"])

# Global settings (no event_id)
router.include_router(visibility.router, prefix="/visibility")

# Event CRUD (root level under /events)
router.include_router(events.router)

# Event-scoped routes (require event_id)
event_scoped = APIRouter(prefix="/{event_id}")
event_scoped.include_router(rsvp.router, prefix="")  # rsvp router handles its own paths
event_scoped.include_router(reminders.router, prefix="/reminder")
event_scoped.include_router(voice_channels.router, prefix="/voice-channel")
router.include_router(event_scoped)