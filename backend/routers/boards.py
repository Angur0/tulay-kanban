from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.core.deps import ensure_workspace_access, get_current_user
from backend.core.rbac import ensure_board_access
from backend.database import get_db
from backend.schemas import BoardColumnCreate, BoardColumnUpdate, BoardCreate, BoardReorderItem, BoardResponse, BoardUpdate, BoardMemberCreate, BoardMemberUpdate, BoardMemberResponse

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
    boards_with_roles = db.query(models.Board, models.board_members.c.role).join(
        models.board_members, models.Board.id == models.board_members.c.board_id
    ).filter(
        models.Board.workspace_id == ws_id,
        models.board_members.c.user_id == current_user.id
    ).order_by(models.Board.position).all()
    print(f"Returning {len(boards_with_roles)} boards for workspace {ws_id}")
    
    result = []
    for board, role in boards_with_roles:
        print(f"  Board: id={board.id}, name={board.name}, icon={board.icon}, role={role}")
        board_dict = {
            "id": board.id,
            "name": board.name,
            "icon": board.icon,
            "icon_color": board.icon_color,
            "position": board.position,
            "workspace_id": board.workspace_id,
            "role": role
        }
        result.append(board_dict)
    return result


@router.get("/api/boards", response_model=List[BoardResponse])
def get_all_boards(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    boards_with_roles = db.query(models.Board, models.board_members.c.role).join(
        models.board_members, models.Board.id == models.board_members.c.board_id
    ).filter(
        models.board_members.c.user_id == current_user.id
    ).order_by(models.Board.position).all()
    print(f"Returning {len(boards_with_roles)} boards for user {current_user.email}")
    
    result = []
    for board, role in boards_with_roles:
        board_dict = {
            "id": board.id,
            "name": board.name,
            "icon": board.icon,
            "icon_color": board.icon_color,
            "position": board.position,
            "workspace_id": board.workspace_id,
            "role": role
        }
        result.append(board_dict)
    return result


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

    stmt = models.board_members.insert().values(
        user_id=current_user.id,
        board_id=new_board.id,
        role="owner"
    )
    db.execute(stmt)
    db.commit()

    print(f"Board created: id={new_board.id}, icon={new_board.icon}, color={new_board.icon_color}")

    cols = [
        models.BoardColumn(board_id=new_board.id, title="To Do", position=0, color="amber-100"),
        models.BoardColumn(board_id=new_board.id, title="In Progress", position=1, color="blue-100"),
        models.BoardColumn(board_id=new_board.id, title="Done", position=2, color="green-100"),
        models.BoardColumn(board_id=new_board.id, title="Archive", position=3, color="gray-100", is_archive=True)
    ]
    db.add_all(cols)
    db.commit()

    return new_board


@router.put("/api/boards/{board_id}", response_model=BoardResponse)
def update_board(board_id: str, board_in: BoardUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user, ["owner", "moderator"])
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    
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
    # Filter to items the user actually has member access to
    user_boards = db.query(models.board_members.c.board_id).filter(
        models.board_members.c.user_id == current_user.id
    ).all()
    user_board_ids = [b[0] for b in user_boards]
    
    for item in items:
        if item.id in user_board_ids:
            db.query(models.Board).filter(models.Board.id == item.id).update({"position": item.position})
    db.commit()
    return {"ok": True}


@router.delete("/api/boards/{board_id}")
def delete_board(board_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user, ["owner"])
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    db.delete(board)
    db.commit()
    return {"message": "Board deleted successfully"}


@router.get("/api/boards/{board_id}/columns")
def get_board_columns(board_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user)
    return db.query(models.BoardColumn).filter(models.BoardColumn.board_id == board_id).order_by(models.BoardColumn.position).all()


@router.post("/api/boards/{board_id}/columns")
def create_column(board_id: str, col_in: BoardColumnCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user, ["owner", "moderator"])
    if col_in.is_archive:
        existing_archive = db.query(models.BoardColumn).filter(
            models.BoardColumn.board_id == board_id,
            models.BoardColumn.is_archive == True
        ).first()
        if existing_archive:
            raise HTTPException(status_code=400, detail="An archive list already exists on this board.")

    new_col = models.BoardColumn(
        board_id=board_id,
        title=col_in.title,
        position=col_in.position,
        color=col_in.color,
        is_hidden=col_in.is_hidden or False,
        is_archive=col_in.is_archive or False
    )
    db.add(new_col)
    db.commit()
    db.refresh(new_col)
    return new_col


@router.put("/api/columns/{column_id}")
def update_column(column_id: str, col_in: BoardColumnUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    col = db.query(models.BoardColumn).filter(models.BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    ensure_board_access(db, col.board_id, current_user, ["owner", "moderator"])

    if col_in.is_archive:
        existing_archive = db.query(models.BoardColumn).filter(
            models.BoardColumn.board_id == col.board_id,
            models.BoardColumn.is_archive == True,
            models.BoardColumn.id != column_id
        ).first()
        if existing_archive:
            raise HTTPException(status_code=400, detail="An archive list already exists on this board.")

    if col_in.title is not None:
        setattr(col, "title", col_in.title)
    if col_in.position is not None:
        setattr(col, "position", col_in.position)
    if col_in.color is not None:
        setattr(col, "color", col_in.color)
    if col_in.is_hidden is not None:
        setattr(col, "is_hidden", col_in.is_hidden)
    if col_in.is_archive is not None:
        setattr(col, "is_archive", col_in.is_archive)

    db.commit()
    return col


@router.delete("/api/columns/{column_id}")
def delete_column(column_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    col = db.query(models.BoardColumn).filter(models.BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    ensure_board_access(db, col.board_id, current_user, ["owner", "moderator"])

    db.query(models.Task).filter(models.Task.column_id == column_id).delete()
    db.delete(col)
    db.commit()
    return {"ok": True}

# Membership Management

@router.get("/api/boards/{board_id}/members", response_model=List[BoardMemberResponse])
def get_board_members(board_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user)
    
    stmt = models.board_members.select().where(models.board_members.c.board_id == board_id)
    memberships = db.execute(stmt).fetchall()
    
    results = []
    for member in memberships:
        user = db.query(models.User).filter(models.User.id == member.user_id).first()
        if user:
            role = member._mapping["role"] if hasattr(member, "_mapping") else member[2]
            results.append({
                "user_id": user.id,
                "board_id": board_id,
                "role": role,
                "user_email": user.email,
                "user_full_name": user.full_name
            })
    return results

@router.post("/api/boards/{board_id}/members", response_model=BoardMemberResponse)
def add_board_member(board_id: str, member_in: BoardMemberCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user, ["owner"])
    
    target_user = db.query(models.User).filter(models.User.email == member_in.user_email).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    stmt_check = models.board_members.select().where(
        models.board_members.c.user_id == target_user.id,
        models.board_members.c.board_id == board_id
    )
    existing = db.execute(stmt_check).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this board")
        
    stmt_insert = models.board_members.insert().values(
        user_id=target_user.id,
        board_id=board_id,
        role=member_in.role
    )
    db.execute(stmt_insert)
    db.commit()
    
    return {
        "user_id": target_user.id,
        "board_id": board_id,
        "role": member_in.role,
        "user_email": target_user.email,
        "user_full_name": target_user.full_name
    }

@router.put("/api/boards/{board_id}/members/{user_id}", response_model=BoardMemberResponse)
def update_board_member(board_id: str, user_id: str, member_in: BoardMemberUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user, ["owner"]) # Only owners can change roles
    
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    stmt_check = models.board_members.select().where(
        models.board_members.c.user_id == target_user.id,
        models.board_members.c.board_id == board_id
    )
    existing = db.execute(stmt_check).first()
    if not existing:
        raise HTTPException(status_code=404, detail="User is not a member of this board")
        
    stmt_update = models.board_members.update().where(
        models.board_members.c.user_id == target_user.id,
        models.board_members.c.board_id == board_id
    ).values(role=member_in.role)
    db.execute(stmt_update)
    db.commit()
    
    return {
        "user_id": target_user.id,
        "board_id": board_id,
        "role": member_in.role,
        "user_email": target_user.email,
        "user_full_name": target_user.full_name
    }
    
@router.delete("/api/boards/{board_id}/members/{user_id}")
def remove_board_member(board_id: str, user_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user, ["owner"])
    
    # Cannot remove the last owner
    if str(user_id) == str(current_user.id):
        # A user might want to leave, or checking if they are the last owner
        stmt_owners = models.board_members.select().where(
            models.board_members.c.board_id == board_id,
            models.board_members.c.role == "owner"
        )
        owners = db.execute(stmt_owners).fetchall()
        if len(owners) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last owner")

    stmt_delete = models.board_members.delete().where(
        models.board_members.c.user_id == user_id,
        models.board_members.c.board_id == board_id
    )
    result = db.execute(stmt_delete)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User is not a member of this board")
    db.commit()
    
    return {"ok": True}
