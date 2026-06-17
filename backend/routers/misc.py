import csv
import io
import json
from datetime import date as dt_date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend import models
from backend.core import realtime
from backend.core.deps import get_current_user
from backend.core.rbac import ensure_board_access
from backend.core.realtime import manager, broadcast_event
from backend.database import get_db
from backend.schemas import KanbanEvent
from backend.services.gantt_image_service import (
    generate_export_filename,
    generate_gantt_html,
    render_html_to_image,
)

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


# ─── NEW: Gantt chart export ───────────────────────────────────────────────

@router.post("/api/boards/{board_id}/export-gantt")
async def export_gantt(
    board_id: str,
    format: str = "png",
    view_mode: str = "Week",
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Export a Gantt chart image or PDF for a board.

    Query params:
        format: 'png' or 'pdf' (default: png)

    Returns:
        { "url": "/uploads/gantt_boardId_timestamp.png" }
    """
    # Enforce board membership
    ensure_board_access(db, board_id, current_user)

    # Fetch board and tasks
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    columns = (
        db.query(models.BoardColumn)
        .filter(models.BoardColumn.board_id == board_id)
        .order_by(models.BoardColumn.position.asc())
        .all()
    )

    tasks_query = (
        db.query(models.Task)
        .filter(models.Task.board_id == board_id)
        .order_by(models.Task.column_id, models.Task.order)
        .all()
    )

    if not tasks_query:
        raise HTTPException(status_code=400, detail="No tasks found on this board")

    # Sort by column position then task order
    col_positions = {c.id: c.position for c in columns}
    sorted_tasks = sorted(
        tasks_query,
        key=lambda t: (col_positions.get(t.column_id, 0), t.order or 0),
    )

    # Build task data for the template
    task_data = []
    for t in sorted_tasks:
        start = None
        end = None
        if t.start_date:
            start = t.start_date.date() if hasattr(t.start_date, "date") else t.start_date

        if t.due_date:
            end = t.due_date.date() if hasattr(t.due_date, "date") else t.due_date

        has_dates = start is not None or end is not None

        task_data.append(
            {
                "id": t.id,
                "name": t.title,
                "start_date": start,
                "due_date": end,
                "has_dates": has_dates,
            }
        )

    # Generate HTML
    html_content = generate_gantt_html(
        tasks=task_data,
        board_name=board.name,
        dark_mode=False,
        view_mode=view_mode,
    )

    if not html_content:
        raise HTTPException(status_code=400, detail="No tasks found on this board")

    # Render to image/PDF
    filename = generate_export_filename(board_id, format)
    output_path = Path("uploads") / filename
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        await render_html_to_image(
            html_content=html_content,
            output_path=output_path,
            format=format,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to render chart: {str(e)}\n\n{traceback.format_exc()}")

    return {"url": f"/uploads/{filename}"}


@router.get("/api/boards/{board_id}/export-csv")
async def export_board_csv(
    board_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Export board tasks as CSV.
    """
    ensure_board_access(db, board_id, current_user)

    tasks = (
        db.query(models.Task)
        .filter(models.Task.board_id == board_id)
        .all()
    )

    if not tasks:
        raise HTTPException(status_code=400, detail="No tasks found on this board")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["ID", "Title", "Description", "Status", "Priority", "Start Date", "Due Date", "Order"]
    )

    for t in tasks:
        writer.writerow(
            [
                t.id,
                t.title,
                t.description or "",
                t.status,
                t.priority,
                t.start_date.isoformat() if t.start_date else "",
                t.due_date.isoformat() if t.due_date else "",
                t.order,
            ]
        )

    content = output.getvalue()
    output.close()

    return {"csv": content}


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