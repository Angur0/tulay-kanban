import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse

from backend.core import realtime
from backend.core.deps import get_current_user
from backend.core.realtime import manager, broadcast_event
from backend.database import get_db
from backend.schemas import KanbanEvent

router = APIRouter(tags=["misc"])


@router.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    if realtime.storage is None:
        raise HTTPException(
            status_code=503,
            detail="Storage backend not initialized. Check server logs for configuration errors."
        )

    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.")

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")

    try:
        url = await realtime.storage.upload_file(
            file=file.file,
            filename=file.filename,
            content_type=file.content_type
        )
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")


@router.post("/api/events")
async def publish_event(event: KanbanEvent):
    event_data = event.model_dump()

    try:
        await broadcast_event(event_data)
        return {"status": "sent"}
    except Exception as e:
        print(f"Failed to broadcast event: {e}")
        return {"status": "error", "error": str(e)}


@router.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "websocket_connections": len(manager.active_connections)
    }


@router.websocket("/ws/{board_id}")
async def websocket_endpoint(websocket: WebSocket, board_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received from client on board {board_id}: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


@router.get("/")
async def serve_index():
    return FileResponse(FRONTEND_DIST / "index.html")


@router.get("/login")
async def serve_login():
    return FileResponse(FRONTEND_DIST / "login.html")


@router.get("/app.js")
async def serve_app_js():
    return FileResponse(FRONTEND_DIST / "app.js")
