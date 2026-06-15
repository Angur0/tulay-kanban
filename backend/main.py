"""
Tulay Kanban Backend
FastAPI server with WebSocket broadcasting
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend import models
from backend.core import realtime
from backend.core.setup import ensure_board_icon_column, ensure_task_order_column, seed_db
from backend.database import engine
from backend.routers import auth, boards, labels, misc, tasks, workspaces
from backend.storage import get_storage_backend

models.Base.metadata.create_all(bind=engine)
ensure_board_icon_column()
ensure_task_order_column()
seed_db()

if sys.platform == "win32" and sys.version_info < (3, 11):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        realtime.storage = get_storage_backend()
        print(f"Storage backend initialized: {realtime.storage.__class__.__name__}")
    except Exception as e:
        print(f"Warning: Failed to initialize storage backend: {e}")
        print("Image uploads will not work until storage is configured.")

    yield


from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Tulay Kanban API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:4173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
        "http://localhost:5176", "http://127.0.0.1:5176",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
UPLOAD_DIR = PROJECT_ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

FRONTEND_DIST = FRONTEND_DIR / "dist"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"

# Ensure frontend build directories exist so Starlette/FastAPI doesn't crash on startup
FRONTEND_ASSETS.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/assets", StaticFiles(directory=str(FRONTEND_ASSETS)), name="assets")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIST)), name="static")

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(boards.router)
app.include_router(labels.router)
app.include_router(tasks.router)
app.include_router(misc.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
