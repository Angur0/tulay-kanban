from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.core.deps import ensure_workspace_access, get_current_user
from backend.database import get_db
from backend.schemas import LabelCreate, LabelResponse, LabelUpdate, LabelBulkCreate, LabelBulkDelete

router = APIRouter(tags=["labels"])


@router.get("/api/workspaces/{ws_id}/labels", response_model=List[LabelResponse])
def get_workspace_labels(ws_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == ws_id).first()
    ensure_workspace_access(ws, current_user)
    return db.query(models.Label).filter(models.Label.workspace_id == ws_id, models.Label.board_id.is_(None)).all()


@router.post("/api/workspaces/{ws_id}/labels", response_model=LabelResponse)
def create_workspace_label(ws_id: str, label_in: LabelCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == ws_id).first()
    ensure_workspace_access(ws, current_user)
    label = models.Label(name=label_in.name, color=label_in.color, workspace_id=ws_id)
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.get("/api/boards/{board_id}/labels", response_model=List[LabelResponse])
def get_board_labels(board_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    ws = db.query(models.Workspace).filter(models.Workspace.id == board.workspace_id).first()
    ensure_workspace_access(ws, current_user)
    return db.query(models.Label).filter(models.Label.board_id == board_id).all()


@router.post("/api/boards/{board_id}/labels", response_model=LabelResponse)
def create_board_label(board_id: str, label_in: LabelCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    ws = db.query(models.Workspace).filter(models.Workspace.id == board.workspace_id).first()
    ensure_workspace_access(ws, current_user)
    label = models.Label(name=label_in.name, color=label_in.color, board_id=board_id)
    db.add(label)
    db.commit()
    db.refresh(label)
    db.refresh(label)
    return label


@router.post("/api/boards/{board_id}/labels/bulk", response_model=List[LabelResponse])
def create_board_labels_bulk(board_id: str, payload: LabelBulkCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    ws = db.query(models.Workspace).filter(models.Workspace.id == board.workspace_id).first()
    ensure_workspace_access(ws, current_user)
    
    created_labels = []
    for label_in in payload.labels:
        label = models.Label(name=label_in.name, color=label_in.color, board_id=board_id)
        db.add(label)
        created_labels.append(label)
        
    db.commit()
    for label in created_labels:
        db.refresh(label)
    return created_labels


@router.post("/api/boards/{board_id}/labels/bulk-delete")
def delete_board_labels_bulk(board_id: str, payload: LabelBulkDelete, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    ws = db.query(models.Workspace).filter(models.Workspace.id == board.workspace_id).first()
    ensure_workspace_access(ws, current_user)
    
    labels_to_delete = db.query(models.Label).filter(
        models.Label.board_id == board_id,
        models.Label.id.in_(payload.label_ids)
    ).all()
    
    deleted_count = len(labels_to_delete)
    for label in labels_to_delete:
        db.delete(label)
        
    db.commit()
    return {"ok": True, "deleted_count": deleted_count}


@router.put("/api/labels/{label_id}", response_model=LabelResponse)
def update_label(label_id: str, label_in: LabelUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    label = db.query(models.Label).filter(models.Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    ws_id = label.workspace_id
    if label.board_id is not None:
        board = db.query(models.Board).filter(models.Board.id == label.board_id).first()
        ws_id = board.workspace_id if board else None

    ws = db.query(models.Workspace).filter(models.Workspace.id == ws_id).first()
    ensure_workspace_access(ws, current_user)

    if label_in.name is not None:
        setattr(label, "name", label_in.name)
    if label_in.color is not None:
        setattr(label, "color", label_in.color)

    db.commit()
    db.refresh(label)
    return label


@router.delete("/api/labels/{label_id}")
def delete_label(label_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    label = db.query(models.Label).filter(models.Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    ws_id = label.workspace_id
    if label.board_id is not None:
        board = db.query(models.Board).filter(models.Board.id == label.board_id).first()
        ws_id = board.workspace_id if board else None

    ws = db.query(models.Workspace).filter(models.Workspace.id == ws_id).first()
    ensure_workspace_access(ws, current_user)

    db.delete(label)
    db.commit()
    return {"ok": True}
