import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.core import realtime
from backend.core.deps import get_current_user
from backend.core.rbac import ensure_board_access
from backend.database import get_db
from backend.schemas import CommentCreate, CommentResponse, TaskCreate, TaskResponse, SubtaskCreate, SubtaskUpdate, SubtaskResponse, TaskBulkReorder, ColumnBulkMove, ColumnBulkCreate

router = APIRouter(tags=["tasks"])


def _get_task_workspace(task: models.Task, db: Session) -> models.Workspace | None:
    board = db.query(models.Board).filter(models.Board.id == task.board_id).first()
    if board is None:
        return None
    return db.query(models.Workspace).filter(models.Workspace.id == board.workspace_id).first()


@router.get("/api/tasks/my", response_model=list[TaskResponse])
def get_my_tasks(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    tasks = db.query(models.Task).join(
        models.board_members, models.Task.board_id == models.board_members.c.board_id
    ).filter(
        models.Task.assignee_id == current_user.id,
        models.board_members.c.user_id == current_user.id
    ).order_by(models.Task.order, models.Task.created_at).all()
    return tasks


@router.get("/api/boards/{board_id}/tasks", response_model=list[TaskResponse])
def get_board_tasks(board_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user)
    try:
        tasks = db.query(models.Task).filter(models.Task.board_id == board_id).order_by(models.Task.order, models.Task.created_at).all()
        return tasks
    except Exception as e:
        print(f"Error loading tasks: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/tasks", response_model=TaskResponse)
async def create_task(task_in: TaskCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, task_in.board_id, current_user, ["owner", "editor", "moderator", "member"])
    
    task_data = task_in.model_dump(exclude={"label_ids", "order"})

    if task_in.order is None:
        max_order = (
            db.query(models.Task.order)
            .filter(
                models.Task.board_id == task_in.board_id,
                models.Task.column_id == task_in.column_id,
            )
            .order_by(models.Task.order.desc())
            .first()
        )
        task_data["order"] = (max_order[0] + 1) if (max_order and max_order[0] is not None) else 0
    else:
        task_data["order"] = task_in.order

    new_task = models.Task(**task_data)

    if task_in.label_ids:
        labels = db.query(models.Label).filter(models.Label.id.in_(task_in.label_ids)).all()
        new_task.labels = labels

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    activity = models.Activity(
        board_id=new_task.board_id,
        user_id=current_user.id,
        event_type="TASK_CREATED",
        task_id=new_task.id,
        task_title=new_task.title,
        data={"status": new_task.status}
    )
    db.add(activity)
    db.commit()

    event = {
        "type": "TASK_CREATED",
        "taskId": new_task.id,
        "taskTitle": new_task.title,
        "data": {"title": new_task.title, "status": new_task.status, "board_id": new_task.board_id, "assignee_id": new_task.assignee_id},
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": current_user.id
    }
    await realtime.publish_or_broadcast(event)

    return new_task


@router.put("/api/tasks/reorder")
async def reorder_tasks(reorder_in: TaskBulkReorder, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not reorder_in.items:
        return {"status": "ok"}
    
    first_task = db.query(models.Task).filter(models.Task.id == reorder_in.items[0].id).first()
    if not first_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    ensure_board_access(db, first_task.board_id, current_user, ["owner", "editor", "moderator", "member"])
    board_id = first_task.board_id

    task_ids = [item.id for item in reorder_in.items]
    tasks = db.query(models.Task).filter(models.Task.id.in_(task_ids)).all()
    task_map = {t.id: t for t in tasks}

    for item in reorder_in.items:
        if item.id in task_map:
            task = task_map[item.id]
            if task.column_id != item.column_id:
                dest_col = db.query(models.BoardColumn).filter(models.BoardColumn.id == item.column_id).first()
                if dest_col:
                    task.status = dest_col.title.lower().replace(" ", "")
            task.column_id = item.column_id
            task.order = item.order

    db.commit()

    event = {
        "type": "TASKS_REORDERED",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": current_user.id,
        "board_id": board_id
    }
    await realtime.publish_or_broadcast(event)

    return {"status": "ok"}


@router.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, updates: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    ensure_board_access(db, task.board_id, current_user, ["owner", "editor", "moderator", "member"])

    new_column_id = updates.get("column_id")
    if new_column_id and new_column_id != task.column_id:
        dest_col = db.query(models.BoardColumn).filter(models.BoardColumn.id == new_column_id).first()
        if dest_col:
            updates["status"] = dest_col.title.lower().replace(" ", "")

    old_status = task.status
    label_ids = updates.pop("label_ids", None)

    for key, value in updates.items():
        if hasattr(task, key):
            setattr(task, key, value)

    if "assignee_id" in updates and updates["assignee_id"] is not None:
        task.is_orphaned = False

    if label_ids is not None:
        labels = db.query(models.Label).filter(models.Label.id.in_(label_ids)).all()
        task.labels = labels

    db.commit()
    db.refresh(task)

    event_type = "TASK_MOVED" if str(old_status) != str(task.status) else "TASK_UPDATED"
    activity = models.Activity(
        board_id=task.board_id,
        user_id=current_user.id,
        event_type=event_type,
        task_id=task.id,
        task_title=task.title,
        data=updates
    )
    db.add(activity)
    db.commit()

    event = {
        "type": event_type,
        "taskId": task.id,
        "data": updates,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": current_user.id,
        "board_id": task.board_id
    }
    await realtime.publish_or_broadcast(event)

    return task


@router.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        ensure_board_access(db, task.board_id, current_user, ["owner", "editor"])

        task_title = task.title
        board_id = task.board_id

        # Check for archive list on the board
        archive_col = db.query(models.BoardColumn).filter(
            models.BoardColumn.board_id == board_id,
            models.BoardColumn.is_archive == True
        ).first()

        # If archive exists and task is not in it, move to archive
        if archive_col and task.column_id != archive_col.id:
            task.column_id = archive_col.id
            task.status = archive_col.title.lower().replace(" ", "")
            # Recalculate order to be at the end of the archive column
            max_order = (
                db.query(models.Task.order)
                .filter(
                    models.Task.board_id == board_id,
                    models.Task.column_id == archive_col.id,
                )
                .order_by(models.Task.order.desc())
                .first()
            )
            task.order = (max_order[0] + 1) if (max_order and max_order[0] is not None) else 0
            db.commit()

            # Record activity as TASK_MOVED
            activity = models.Activity(
                board_id=board_id,
                user_id=current_user.id,
                event_type="TASK_MOVED",
                task_id=task_id,
                task_title=task_title,
                data={"status": task.status, "column_id": archive_col.id}
            )
            db.add(activity)
            db.commit()

            event = {
                "type": "TASK_MOVED",
                "taskId": task_id,
                "data": {"status": task.status, "column_id": archive_col.id},
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "user_id": current_user.id,
                "board_id": board_id
            }
            await realtime.publish_or_broadcast(event)
            return {"status": "archived", "column_id": archive_col.id}

        activity = models.Activity(
            board_id=board_id,
            user_id=current_user.id,
            event_type="TASK_DELETED",
            task_id=task_id,
            task_title=task_title,
            data={}
        )
        db.add(activity)

        db.delete(task)
        db.commit()

        event = {
            "type": "TASK_DELETED",
            "taskId": task_id,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "user_id": current_user.id,
            "board_id": board_id
        }
        await realtime.publish_or_broadcast(event)

        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def get_task_comments(task_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    ensure_board_access(db, task.board_id, current_user)

    comments = db.query(models.Comment).filter(models.Comment.task_id == task_id).order_by(models.Comment.created_at.desc()).all()
    return comments


@router.post("/api/tasks/{task_id}/comments", response_model=CommentResponse)
async def create_comment(task_id: str, comment_in: CommentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    ensure_board_access(db, task.board_id, current_user, ["owner", "editor", "moderator", "member"])

    new_comment = models.Comment(
        task_id=task_id,
        user_id=current_user.id,
        content=comment_in.content,
        images=comment_in.images or []
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    event = {
        "type": "COMMENT_ADDED",
        "taskId": task_id,
        "commentId": new_comment.id,
        "data": {
            "content": new_comment.content,
            "user_id": current_user.id,
            "user_email": current_user.email,
            "images": new_comment.images
        },
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "board_id": task.board_id
    }
    await realtime.publish_or_broadcast(event)

    return new_comment


@router.put("/api/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(comment_id: str, comment_in: CommentCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if str(comment.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")

    setattr(comment, "content", comment_in.content)
    setattr(comment, "images", comment_in.images or [])
    setattr(comment, "updated_at", datetime.datetime.utcnow())

    db.commit()
    db.refresh(comment)

    task = db.query(models.Task).filter(models.Task.id == comment.task_id).first()
    event = {
        "type": "COMMENT_UPDATED",
        "taskId": comment.task_id,
        "commentId": comment.id,
        "data": {
            "content": comment.content,
            "images": comment.images
        },
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "board_id": task.board_id if task else None
    }
    await realtime.publish_or_broadcast(event)

    return comment


@router.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if str(comment.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    task_id = comment.task_id
    task = db.query(models.Task).filter(models.Task.id == task_id).first()

    db.delete(comment)
    db.commit()

    event = {
        "type": "COMMENT_DELETED",
        "taskId": task_id,
        "commentId": comment_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "board_id": task.board_id if task else None
    }
    await realtime.publish_or_broadcast(event)

    return {"status": "deleted"}


@router.get("/api/boards/{board_id}/activities")
def get_board_activities(board_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_board_access(db, board_id, current_user)
    activities = db.query(models.Activity).filter(
        models.Activity.board_id == board_id
    ).order_by(models.Activity.timestamp.desc()).limit(100).all()
    return [{
        "id": a.id,
        "event_type": a.event_type,
        "task_id": a.task_id,
        "task_title": a.task_title,
        "data": a.data,
        "timestamp": a.timestamp.isoformat() if a.timestamp is not None else None,
        "user_id": a.user_id
    } for a in activities]


def recalculate_subtask_percentages(task_id: str, db: Session):
    subtasks = db.query(models.Subtask).filter(models.Subtask.task_id == task_id).order_by(models.Subtask.created_at).all()
    if not subtasks:
        return
    
    manual_subtasks = [s for s in subtasks if s.is_manual_percentage]
    auto_subtasks = [s for s in subtasks if not s.is_manual_percentage]
    
    sum_manual = sum(s.percentage for s in manual_subtasks)
    remaining = max(0.0, 100.0 - sum_manual)
    
    if auto_subtasks:
        share = remaining / len(auto_subtasks)
        allocated = 0.0
        for s in auto_subtasks[:-1]:
            rounded_share = round(share, 2)
            s.percentage = rounded_share
            allocated += rounded_share
        
        auto_subtasks[-1].percentage = max(0.0, round(remaining - allocated, 2))
    
    db.commit()


@router.post("/api/tasks/{task_id}/subtasks", response_model=SubtaskResponse)
async def create_subtask(
    task_id: str,
    subtask_in: SubtaskCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    ensure_board_access(db, task.board_id, current_user, ["owner", "editor", "moderator", "member"])
    
    is_manual = subtask_in.percentage is not None
    percentage_val = subtask_in.percentage if is_manual else 0.0
    
    new_subtask = models.Subtask(
        task_id=task_id,
        title=subtask_in.title,
        percentage=percentage_val,
        is_manual_percentage=is_manual,
        is_finished=False
    )
    db.add(new_subtask)
    db.commit()
    
    recalculate_subtask_percentages(task_id, db)
    db.refresh(new_subtask)
    
    event = {
        "type": "SUBTASK_CREATED",
        "taskId": task_id,
        "subtask": {
            "id": new_subtask.id,
            "task_id": new_subtask.task_id,
            "title": new_subtask.title,
            "is_finished": new_subtask.is_finished,
            "percentage": new_subtask.percentage,
            "is_manual_percentage": new_subtask.is_manual_percentage,
            "finish_date": new_subtask.finish_date.isoformat() if new_subtask.finish_date else None,
            "created_at": new_subtask.created_at.isoformat()
        },
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "board_id": task.board_id
    }
    await realtime.publish_or_broadcast(event)
    
    return new_subtask


@router.put("/api/subtasks/{subtask_id}", response_model=SubtaskResponse)
async def update_subtask(
    subtask_id: str,
    updates: dict,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
        
    task = db.query(models.Task).filter(models.Task.id == subtask.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    ensure_board_access(db, task.board_id, current_user, ["owner", "editor", "moderator", "member"])
    
    percentage_changed = False
    
    if "title" in updates:
        subtask.title = updates["title"]
        
    if "is_finished" in updates:
        val = updates["is_finished"]
        subtask.is_finished = val
        if val:
            if not subtask.finish_date:
                subtask.finish_date = datetime.datetime.utcnow()
        else:
            subtask.finish_date = None
            
    if "finish_date" in updates:
        fd = updates["finish_date"]
        if fd:
            if isinstance(fd, str):
                try:
                    subtask.finish_date = datetime.datetime.fromisoformat(fd.replace("Z", "+00:00"))
                except ValueError:
                    subtask.finish_date = datetime.datetime.utcnow()
            else:
                subtask.finish_date = fd
        else:
            subtask.finish_date = None
            
    if "percentage" in updates:
        val = updates["percentage"]
        if val is None:
            subtask.is_manual_percentage = False
        else:
            subtask.is_manual_percentage = True
            subtask.percentage = float(val)
        percentage_changed = True
        
    db.commit()
    
    if percentage_changed:
        recalculate_subtask_percentages(task.id, db)
            
    db.refresh(subtask)
    
    event = {
        "type": "SUBTASK_UPDATED",
        "taskId": task.id,
        "subtask": {
            "id": subtask.id,
            "task_id": subtask.task_id,
            "title": subtask.title,
            "is_finished": subtask.is_finished,
            "percentage": subtask.percentage,
            "is_manual_percentage": subtask.is_manual_percentage,
            "finish_date": subtask.finish_date.isoformat() if subtask.finish_date else None,
            "created_at": subtask.created_at.isoformat()
        },
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "board_id": task.board_id
    }
    await realtime.publish_or_broadcast(event)
    
    return subtask


@router.delete("/api/subtasks/{subtask_id}")
async def delete_subtask(
    subtask_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
        
    task = db.query(models.Task).filter(models.Task.id == subtask.task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    ensure_board_access(db, task.board_id, current_user, ["owner", "editor", "moderator", "member"])
    
    db.delete(subtask)
    db.commit()
    
    recalculate_subtask_percentages(task.id, db)
    
    event = {
        "type": "SUBTASK_DELETED",
        "taskId": task.id,
        "subtaskId": subtask_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "board_id": task.board_id
    }
    await realtime.publish_or_broadcast(event)
    
    return {"status": "deleted"}


@router.post("/api/columns/{column_id}/tasks/bulk-move")
async def bulk_move_tasks(column_id: str, payload: ColumnBulkMove, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    col = db.query(models.BoardColumn).filter(models.BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")
    dest_col = db.query(models.BoardColumn).filter(models.BoardColumn.id == payload.destination_column_id).first()
    if not dest_col:
        raise HTTPException(status_code=404, detail="Destination column not found")
    if col.board_id != dest_col.board_id:
        raise HTTPException(status_code=400, detail="Columns must belong to the same board")

    ensure_board_access(db, col.board_id, current_user, ["owner", "editor", "moderator", "member"])

    max_order_row = db.query(models.Task.order).filter(
        models.Task.column_id == payload.destination_column_id
    ).order_by(models.Task.order.desc()).first()
    start_order = (max_order_row[0] + 1) if (max_order_row and max_order_row[0] is not None) else 0

    tasks_to_move = db.query(models.Task).filter(
        models.Task.column_id == column_id
    ).order_by(models.Task.order).all()

    new_status = dest_col.title.lower().replace(" ", "")
    for idx, task in enumerate(tasks_to_move):
        task.column_id = payload.destination_column_id
        task.status = new_status
        task.order = start_order + idx

    db.commit()

    event = {
        "type": "TASKS_REORDERED",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": current_user.id,
        "board_id": col.board_id
    }
    await realtime.publish_or_broadcast(event)

    return {"status": "ok", "moved_count": len(tasks_to_move)}


@router.post("/api/columns/{column_id}/tasks/bulk-delete")
async def bulk_delete_tasks(column_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    col = db.query(models.BoardColumn).filter(models.BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    ensure_board_access(db, col.board_id, current_user, ["owner", "editor"])

    archive_col = db.query(models.BoardColumn).filter(
        models.BoardColumn.board_id == col.board_id,
        models.BoardColumn.is_archive == True
    ).first()

    tasks_in_col = db.query(models.Task).filter(models.Task.column_id == column_id).all()

    if not tasks_in_col:
        return {"status": "ok", "deleted_count": 0, "archived_count": 0}

    if archive_col and col.id != archive_col.id:
        max_order_row = db.query(models.Task.order).filter(
            models.Task.column_id == archive_col.id
        ).order_by(models.Task.order.desc()).first()
        start_order = (max_order_row[0] + 1) if (max_order_row and max_order_row[0] is not None) else 0

        new_status = archive_col.title.lower().replace(" ", "")
        for idx, task in enumerate(tasks_in_col):
            task.column_id = archive_col.id
            task.status = new_status
            task.order = start_order + idx

            activity = models.Activity(
                board_id=col.board_id,
                user_id=current_user.id,
                event_type="TASK_MOVED",
                task_id=task.id,
                task_title=task.title,
                data={"status": task.status, "column_id": archive_col.id}
            )
            db.add(activity)
        
        db.commit()

        event = {
            "type": "TASKS_REORDERED",
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "user_id": current_user.id,
            "board_id": col.board_id
        }
        await realtime.publish_or_broadcast(event)
        return {"status": "archived", "archived_count": len(tasks_in_col), "deleted_count": 0}

    deleted_count = len(tasks_in_col)
    for task in tasks_in_col:
        activity = models.Activity(
            board_id=col.board_id,
            user_id=current_user.id,
            event_type="TASK_DELETED",
            task_id=task.id,
            task_title=task.title,
            data={}
        )
        db.add(activity)
        db.delete(task)

    db.commit()

    event = {
        "type": "TASKS_REORDERED",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": current_user.id,
        "board_id": col.board_id
    }
    await realtime.publish_or_broadcast(event)

    return {"status": "deleted", "deleted_count": deleted_count, "archived_count": 0}


@router.post("/api/columns/{column_id}/tasks/bulk-create")
async def bulk_create_tasks(column_id: str, payload: ColumnBulkCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    col = db.query(models.BoardColumn).filter(models.BoardColumn.id == column_id).first()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    ensure_board_access(db, col.board_id, current_user, ["owner", "editor", "moderator", "member"])

    max_order_row = db.query(models.Task.order).filter(
        models.Task.column_id == column_id
    ).order_by(models.Task.order.desc()).first()
    start_order = (max_order_row[0] + 1) if (max_order_row and max_order_row[0] is not None) else 0

    new_tasks = []
    status_val = col.title.lower().replace(" ", "")
    for idx, title in enumerate(payload.titles):
        title_strip = title.strip()
        if not title_strip:
            continue
        new_task = models.Task(
            board_id=col.board_id,
            column_id=column_id,
            title=title_strip,
            status=status_val,
            order=start_order + idx,
            priority="medium"
        )
        db.add(new_task)
        new_tasks.append(new_task)

    db.commit()

    for task in new_tasks:
        db.refresh(task)
        activity = models.Activity(
            board_id=col.board_id,
            user_id=current_user.id,
            event_type="TASK_CREATED",
            task_id=task.id,
            task_title=task.title,
            data={"status": task.status}
        )
        db.add(activity)
    db.commit()

    event = {
        "type": "TASKS_REORDERED",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": current_user.id,
        "board_id": col.board_id
    }
    await realtime.publish_or_broadcast(event)

    return {"status": "ok", "created_count": len(new_tasks)}
