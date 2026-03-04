import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend import models
from backend.core import realtime
from backend.core.deps import get_current_user
from backend.core.rbac import ensure_board_access
from backend.database import get_db
from backend.schemas import CommentCreate, CommentResponse, TaskCreate, TaskResponse

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
    ensure_board_access(db, task_in.board_id, current_user, ["owner", "moderator", "member"])
    
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
        task_data["order"] = (max_order[0] + 1) if max_order else 0
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
        "data": {"title": new_task.title, "status": new_task.status, "board_id": new_task.board_id},
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    await realtime.publish_or_broadcast(event)

    return new_task


@router.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, updates: dict, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    ensure_board_access(db, task.board_id, current_user, ["owner", "moderator", "member"])

    old_status = task.status
    label_ids = updates.pop("label_ids", None)

    for key, value in updates.items():
        if hasattr(task, key):
            setattr(task, key, value)

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
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    ensure_board_access(db, task.board_id, current_user, ["owner", "moderator", "member"])

    task_title = task.title
    board_id = task.board_id

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

    ensure_board_access(db, task.board_id, current_user, ["owner", "moderator", "member"])

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
