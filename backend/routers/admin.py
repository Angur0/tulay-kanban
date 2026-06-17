import datetime
import secrets
import string
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend import models, schemas
from backend.core import auth
from backend.core.deps import get_admin_user
from backend.database import get_db

router = APIRouter(tags=["admin"])


@router.get("/api/admin/boards", response_model=List[schemas.BoardResponse])
def get_admin_boards(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_admin_user)
):
    """Retrieve all boards across all workspaces with 'admin' role."""
    boards = db.query(models.Board).all()
    result = []
    for board in boards:
        result.append({
            "id": board.id,
            "name": board.name,
            "icon": board.icon,
            "icon_color": board.icon_color,
            "position": board.position,
            "workspace_id": board.workspace_id,
            "role": "admin"
        })
    return result


@router.get("/api/admin/users", response_model=List[schemas.UserResponse])
def get_admin_users(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_admin_user)
):
    """Retrieve all users in the system."""
    users = db.query(models.User).all()
    return users


@router.put("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
def update_admin_user(
    user_id: str,
    user_update: schemas.AdminUserUpdate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_admin_user)
):
    """Update a user (ban/timeout/reset password)."""
    if str(user_id) == str(current_admin.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify yourself"
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user_update.full_name is not None:
        user.full_name = user_update.full_name

    if user_update.email is not None:
        # Check if email is already taken by someone else
        existing = db.query(models.User).filter(
            models.User.email == user_update.email,
            models.User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        user.email = user_update.email

    # If updating ban status or timeout duration
    ban_status_changed = False
    if user_update.is_banned is not None:
        if user.is_banned != user_update.is_banned:
            user.is_banned = user_update.is_banned
            ban_status_changed = True

    if user_update.ban_until is not None or "ban_until" in user_update.model_fields_set:
        if user.ban_until != user_update.ban_until:
            user.ban_until = user_update.ban_until
            ban_status_changed = True

    # If password is being reset by admin
    if user_update.password:
        user.hashed_password = auth.get_password_hash(user_update.password)
        user.must_change_password = True
        # Password reset also invalidates existing sessions
        ban_status_changed = True

    # Enforce instant logout if banned or password reset
    if ban_status_changed:
        # Upsert or insert new entry to TokenBlacklist
        blacklist_entry = db.query(models.TokenBlacklist).filter(
            models.TokenBlacklist.user_id == user_id
        ).first()
        if blacklist_entry:
            blacklist_entry.created_at = datetime.datetime.utcnow()
        else:
            new_entry = models.TokenBlacklist(
                user_id=user_id,
                created_at=datetime.datetime.utcnow()
            )
            db.add(new_entry)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/api/admin/users/{user_id}")
def delete_admin_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(get_admin_user)
):
    """Permanently delete a user."""
    if str(user_id) == str(current_admin.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Orphan all tasks assigned to this user
    assigned_tasks = db.query(models.Task).filter(models.Task.assignee_id == user_id).all()
    for task in assigned_tasks:
        task.assignee_id = None
        task.is_orphaned = True

    # Delete comments by this user
    db.query(models.Comment).filter(models.Comment.user_id == user_id).delete()

    # Delete board memberships
    db.execute(models.board_members.delete().where(models.board_members.c.user_id == user_id))

    # Invalidate tokens
    db.query(models.TokenBlacklist).filter(models.TokenBlacklist.user_id == user_id).delete()

    # Delete the user
    db.delete(user)
    db.commit()

    return {"status": "deleted"}
