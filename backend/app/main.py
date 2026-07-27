import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path

from .database import init_db
from .routers import auth, users, products, articles, creatures, messages, posts, transactions, dashboard, friend_requests, upload, notifications, pet_items, support
from .models import friend_request  # noqa: F401
from .retention import retention_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from .seed import seed_data, seed_pet_supplies
    await seed_data()
    await seed_pet_supplies()
    retention_task = asyncio.create_task(retention_loop())
    try:
        yield
    finally:
        retention_task.cancel()


app = FastAPI(title="Hogwarts Nexus Lumiere API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(articles.router, prefix="/articles", tags=["articles"])
app.include_router(creatures.router, prefix="/creatures", tags=["creatures"])
app.include_router(pet_items.router, prefix="/pet-items", tags=["pet-items"])
app.include_router(messages.router, prefix="/messages", tags=["messages"])
app.include_router(posts.router, prefix="/posts", tags=["posts"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(friend_requests.router, prefix="/friend-requests", tags=["friend-requests"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(support.router, prefix="/support", tags=["support"])

uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def root():
    return {"message": "Hogwarts Nexus Lumiere API"}
