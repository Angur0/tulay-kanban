from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.core.deps import ensure_workspace_access, get_current_user
from backend.database import get_db
from backend.schemas import WorkspaceCreate

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("")
def get_workspaces(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Get workspaces user owns
    owned_workspaces = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).all()
    
    # Get workspaces where user is a member of at least one board
    board_workspaces = db.query(models.Workspace).join(
        models.Board, models.Workspace.id == models.Board.workspace_id
    ).join(
        models.board_members, models.Board.id == models.board_members.c.board_id
    ).filter(
        models.board_members.c.user_id == current_user.id
    ).all()
    
    # Combine and deduplicate
    all_workspaces = {ws.id: ws for ws in owned_workspaces + board_workspaces}
    workspaces = list(all_workspaces.values())
    
    if not workspaces:
        ws_name = f"{current_user.full_name.split(' ')[0]}'s Workspace" if current_user.full_name else "My Workspace"
        default_ws = models.Workspace(name=ws_name, owner_id=current_user.id)
        db.add(default_ws)
        db.commit()
        db.refresh(default_ws)
        workspaces = [default_ws]
    return workspaces


@router.post("")
def create_workspace(ws_in: WorkspaceCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_ws = models.Workspace(name=ws_in.name, owner_id=current_user.id)
    db.add(new_ws)
    db.commit()
    db.refresh(new_ws)
    return new_ws


@router.get("/{ws_id}/members")
def get_workspace_members(ws_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == ws_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ensure_workspace_access(ws, current_user)
    members = [{"id": ws.owner.id, "email": ws.owner.email, "full_name": ws.owner.full_name}]
    for m in ws.members:
        if m.id != ws.owner.id:
            members.append({"id": m.id, "email": m.email, "full_name": m.full_name})
    return members
