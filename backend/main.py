"""
Kafka Kanban Backend
FastAPI server with Kafka Producer/Consumer and WebSocket broadcasting
"""

import asyncio
import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from aiokafka import AIOKafkaProducer
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend import models
from backend.core import realtime
from backend.core.realtime import KAFKA_BOOTSTRAP_SERVERS, consume_events
from backend.core.setup import ensure_board_icon_column, seed_db
from backend.database import engine
from backend.routers import auth, boards, labels, misc, tasks, workspaces
from backend.storage import get_storage_backend

models.Base.metadata.create_all(bind=engine)
ensure_board_icon_column()
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

    try:
        realtime.producer = AIOKafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8")
        )
        await realtime.producer.start()
        print("Kafka producer started")
        realtime.consumer_task = asyncio.create_task(consume_events())
        print("Kafka consumer task started")
    except Exception as e:
        print(f"Failed to connect to Kafka: {e}")
        print("Running in OFFLINE mode - events will not be sent to Kafka")

    yield

    if realtime.producer:
        await realtime.producer.stop()
        print("Kafka producer stopped")
    if realtime.consumer_task:
        realtime.consumer_task.cancel()
        print("Kafka consumer task cancelled")


app = FastAPI(title="Tulay Kanban API", lifespan=lifespan)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
UPLOAD_DIR = PROJECT_ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(boards.router)
app.include_router(labels.router)
app.include_router(tasks.router)
app.include_router(misc.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
