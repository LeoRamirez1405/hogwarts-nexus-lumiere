import asyncio
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from brotli_asgi import BrotliMiddleware

from .config import settings
from .rate_limit import limiter
from .database import init_db
from .routers import auth, users, products, articles, creatures, messages, posts, transactions, dashboard, friend_requests, upload, notifications, pet_items, support, announcements, classifieds, forum, enum_types, feature_flags, ws_messages, push, voice_channels, e2e_encryption, events, catalogs
from .routers.admin import users as admin_users
from .routers.admin import products as admin_products
from .routers.admin import creatures as admin_creatures
from .routers.admin import articles as admin_articles
from .routers.admin import announcements as admin_announcements
from .routers.admin import classifieds as admin_classifieds
from .routers.admin import pet_items as admin_pet_items
from .routers.admin import transactions as admin_transactions
from .routers.admin import rooms as admin_rooms
from .routers.admin import messages as admin_messages
from .routers.admin import enums as admin_enums
from .routers.admin import feature_flags as admin_feature_flags
from .routers.admin import audit_logs as admin_audit_logs
from .routers.admin import notifications as admin_notifications
from .routers.admin import inventory as admin_inventory
from .routers.admin import catalogs as admin_catalogs
from .models import friend_request  # noqa: F401
from .retention import retention_loop, disappearing_loop
from .pet_care import pet_care_loop
from .scheduled_messages import scheduled_messages_loop
from .event_reminders import event_reminders_loop
from .mute_cleanup import mute_cleanup_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    retention_task = asyncio.create_task(retention_loop())
    disappearing_task = asyncio.create_task(disappearing_loop())
    pet_care_task = asyncio.create_task(pet_care_loop())
    scheduled_task = asyncio.create_task(scheduled_messages_loop())
    event_reminders_task = asyncio.create_task(event_reminders_loop())
    mute_cleanup_task = asyncio.create_task(mute_cleanup_loop())
    # Redis pub/sub bus so WebSocket delivery works across uvicorn workers.
    from .ws_manager import manager
    await manager.start()
    try:
        yield
    finally:
        retention_task.cancel()
        disappearing_task.cancel()
        pet_care_task.cancel()
        scheduled_task.cancel()
        event_reminders_task.cancel()
        mute_cleanup_task.cancel()
        await manager.shutdown()


app = FastAPI(title="Hogwarts Nexus Lumiere API", lifespan=lifespan)

# Rate limiting (slowapi): register the shared limiter and its 429 handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Compression: Brotli first (better ratio), then GZip fallback.
app.add_middleware(BrotliMiddleware, minimum_size=512)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS: restrict to configured frontend origins instead of a wildcard.
# An explicit CORS_ORIGINS list wins; otherwise fall back to a regex that
# allows localhost (dev) and any *.vercel.app deployment.
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if _cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://[a-zA-Z0-9-]+\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(catalogs.router, prefix="/catalogs", tags=["catalogs"])
app.include_router(articles.router, prefix="/articles", tags=["articles"])
app.include_router(creatures.router, prefix="/creatures", tags=["creatures"])
app.include_router(pet_items.router, prefix="/pet-items", tags=["pet-items"])
app.include_router(messages.router, prefix="/messages", tags=["messages"])
app.include_router(ws_messages.router, prefix="/messages", tags=["messages"])
app.include_router(voice_channels.ws_router, prefix="/messages", tags=["voice"])
app.include_router(posts.router, prefix="/posts", tags=["posts"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(friend_requests.router, prefix="/friend-requests", tags=["friend-requests"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(support.router, prefix="/support", tags=["support"])
app.include_router(announcements.router, prefix="/announcements", tags=["announcements"])
app.include_router(classifieds.router, prefix="/classifieds", tags=["classifieds"])
app.include_router(forum.router, prefix="/forum", tags=["forum"])
app.include_router(enum_types.router, prefix="/enum-types", tags=["enum-types"])
app.include_router(feature_flags.router, prefix="/feature-flags", tags=["feature-flags"])
app.include_router(admin_users.router, tags=["admin-users"])
app.include_router(admin_products.router, tags=["admin-products"])
app.include_router(admin_catalogs.router, tags=["admin-catalogs"])
app.include_router(admin_creatures.router, tags=["admin-creatures"])
app.include_router(admin_articles.router, tags=["admin-articles"])
app.include_router(admin_announcements.router, tags=["admin-announcements"])
app.include_router(admin_classifieds.router, tags=["admin-classifieds"])
app.include_router(admin_pet_items.router, tags=["admin-pet-items"])
app.include_router(admin_transactions.router, tags=["admin-transactions"])
app.include_router(admin_rooms.router, tags=["admin-rooms"])
app.include_router(admin_messages.router, tags=["admin-messages"])
app.include_router(admin_enums.router, tags=["admin-enums"])
app.include_router(admin_feature_flags.router, tags=["admin-feature-flags"])
app.include_router(admin_audit_logs.router, tags=["admin-audit-logs"])
app.include_router(admin_notifications.router, tags=["admin-notifications"])
app.include_router(admin_inventory.router, tags=["admin-inventory"])
app.include_router(push.router, tags=["push"])
app.include_router(voice_channels.rest_router, prefix="/messages/voice", tags=["voice"])
app.include_router(events.router, prefix="/events", tags=["events"])
app.include_router(e2e_encryption, tags=["e2e-encryption"])

# Serve locally-stored uploads (avatars, post images, etc.) as static files so
# the frontend can load them by absolute URL. In production Cloudinary is used
# instead and returns its own absolute URLs.
_uploads_dir = Path("uploads")
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/")
def root():
    return {"message": "Hogwarts Nexus Lumiere API"}
