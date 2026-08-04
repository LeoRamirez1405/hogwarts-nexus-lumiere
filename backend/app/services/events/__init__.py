"""Event services package."""

from .event_service import (
    check_event_visibility,
    check_room_admin_or_mod,
    check_room_member,
    get_event_with_counts,
    create_event,
    update_event,
    cancel_event,
    get_events_list,
    get_attending_users,
    link_voice_channel,
    unlink_voice_channel,
    get_or_create_visibility_settings,
)

from .rsvp_service import (
    check_capacity,
    upsert_rsvp,
    delete_rsvp,
    get_rsvps_list,
    get_rsvp_counts,
    get_reminder_setting,
    upsert_reminder,
)

from .notification_service import (
    notify_event_created,
    notify_event_updated,
    notify_event_cancelled,
    notify_rsvp_update,
    notify_rsvp_to_creator,
)

__all__ = [
    # event_service
    "check_event_visibility",
    "check_room_admin_or_mod",
    "check_room_member",
    "get_event_with_counts",
    "create_event",
    "update_event",
    "cancel_event",
    "get_events_list",
    "get_attending_users",
    "link_voice_channel",
    "unlink_voice_channel",
    "get_or_create_visibility_settings",
    # rsvp_service
    "check_capacity",
    "upsert_rsvp",
    "delete_rsvp",
    "get_rsvps_list",
    "get_rsvp_counts",
    "get_reminder_setting",
    "upsert_reminder",
    # notification_service
    "notify_event_created",
    "notify_event_updated",
    "notify_event_cancelled",
    "notify_rsvp_update",
    "notify_rsvp_to_creator",
]