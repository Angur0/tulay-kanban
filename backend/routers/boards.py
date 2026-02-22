from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.core.deps import ensure_workspace_access, get_current_user
from backend.database import get_db
from backend.schemas import BoardColumnCreate, BoardColumnUpdate, BoardCreate, BoardReorderItem, BoardResponse, BoardUpdate

ALLOWED_BOARD_ICONS = {
    "dashboard",
    "folder",
    "campaign",
    "code",
    "shopping_bag",
    "rocket_launch",
    "design_services",
    "event",
    "school",
    "inventory_2",
}


def normalize_board_icon(icon):
    if not icon:
        return "dashboard"
    normalized = icon.strip()
    return normalized if normalized in ALLOWED_BOARD_ICONS else "dashboard"


router = APIRouter(tags=["boards"])


@router.get("/api/workspaces/{ws_id}/boards", response_model=List[BoardResponse])
def get_boards(ws_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == ws_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    boards = db.query(models.Board).filter(models.Board.workspace_id == ws_id).order_by(models.Board.position).all()
    print(f"Returning {len(boards)} boards for workspace {ws_id}")
    for board in boards:
        print(f"  Board: id={board.id}, name={board.name}, icon={board.icon}")
    return boards


@router.post("/api/boards", response_model=BoardResponse)
def create_board(board_in: BoardCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    print(f"Creating board: name={board_in.name}, icon={board_in.icon}, color={board_in.icon_color}")
    existing_count = db.query(models.Board).filter(models.Board.workspace_id == board_in.workspace_id).count()
    new_board = models.Board(
        name=board_in.name,
        icon=normalize_board_icon(board_in.icon),
        icon_color=board_in.icon_color or "#3b82f6",
        position=existing_count,
        workspace_id=board_in.workspace_id
    )
    db.add(new_board)
    db.commit()
    db.refresh(new_board)
    print(f"Board created: id={new_board.id}, icon={new_board.icon}, color={new_board.icon_color}")

    cols = [
        models.BoardColumn(board_id=new_board.id, title="To Do", position=0, color="amber-100"),
        models.BoardColumn(board_id=new_board.id, title="In Progress", position=1, color="blue-100"),
        models.BoardColumn(board_id=new_board.id, title="Done", position=2, color="green-100")
    ]
    db.add_all(cols)
    db.commit()

    return new_board


@router.put("/api/boards/{board_id}", response_model=BoardResponse)
def update_board(board_id: str, board_in: BoardUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    ws = db.query(models.Workspace).filter(models.Workspace.id == board.workspace_id).first()
    ensure_workspace_access(ws, current_user)
    if board_in.name is not None:
        setattr(board, "name", board_in.name)
    if board_in.icon is not None:
        setattr(board, "icon", normalize_board_icon(board_in.icon))
    if board_in.icon_color is not None:
        setattr(board, "icon_color", board_in.icon_color)
    if board_in.position is not None:
        setattr(board, "position", board_in.position)
    db.commit()
    db.refresh(board)
    return board


@router.post("/api/workspaces/{ws_id}/boards/reorder")
def reorder_boards(ws_id: str, items: List[BoardReorderItem], current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == ws_id).first()
    ensure_workspace_access(ws, current_user)
    for item in items:
        db.query(models.Board).filter(models.Board.id == item.id).update({"position": item.position})
    db.commit()
    return {"ok": True}


@router.delete("/api/boards/{board_id}")
def delete_board(board_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    db.delete(board)
    db.commit()
    return {"message": "Board deleted successfully"}


@router.get("/api/boards/{board_id}/columns")
def get_board_columns(board_id: str, db: Session = Depends(get_db)):
    return db.query(models.BoardColumn).filter(models.BoardColumn.board_id == board_id).order_by(models.BoardColumn.position).all()


@router.post("/api/boards/{board_id}/columns")
def create_column(board_id: str, col_in: BoardColumnCreate, db: Session = Depends(get_db)):
    new_col = models.BoardColumn(
        board_id=board_id,
        title=col_in.title,
        position=col_in.position,
        color=col_in.color
    )
    db.add(new_col)
    db.commit()
    db.refresh(new_col)
    return new_col


@router.put("/api/columns/{column_id}")
def update_column(column_id: str, col_in: BoardColumnUpdate, db: Session = Depends(get_db)):
    col = db.query(models.BoardColumn).filter(models.BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    if col_in.title is not None:
        setattr(col, "title", col_in.title)
    if col_in.position is not None:
        setattr(col, "position", col_in.position)
    if col_in.color is not None:
        setattr(col, "color", col_in.color)

    db.commit()
    return col


@router.delete("/api/columns/{column_id}")
def delete_column(column_id: str, db: Session = Depends(get_db)):
    col = db.query(models.BoardColumn).filter(models.BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    db.query(models.Task).filter(models.Task.column_id == column_id).delete()
    db.delete(col)
    db.commit()
    return {"ok": True}
