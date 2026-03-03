import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class KanbanEvent(BaseModel):
    type: str
    taskId: str
    data: dict = {}
    timestamp: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str


class Token(BaseModel):
    access_token: str
    token_type: str


class WorkspaceCreate(BaseModel):
    name: str


class BoardCreate(BaseModel):
    name: str
    workspace_id: str
    icon: Optional[str] = "dashboard"
    icon_color: Optional[str] = "#3b82f6"


class BoardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    icon: str
    icon_color: str
    position: int
    workspace_id: str


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    icon_color: Optional[str] = None
    position: Optional[int] = None


class BoardReorderItem(BaseModel):
    id: str
    position: int


class BoardMemberCreate(BaseModel):
    user_email: str
    role: str = "viewer"


class BoardMemberUpdate(BaseModel):
    role: str


class BoardMemberResponse(BaseModel):
    user_id: str
    board_id: str
    role: str
    user_email: str
    user_full_name: str


class BoardColumnCreate(BaseModel):
    title: str
    position: int
    color: Optional[str] = None


class BoardColumnUpdate(BaseModel):
    title: Optional[str] = None
    position: Optional[int] = None
    color: Optional[str] = None


class LabelCreate(BaseModel):
    name: str
    color: Optional[str] = None


class LabelUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class LabelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    color: Optional[str] = None
    workspace_id: Optional[str] = None
    board_id: Optional[str] = None
    created_at: datetime.datetime


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    status: str = "todo"
    label: Optional[str] = None
    label_ids: Optional[List[str]] = None
    board_id: str
    column_id: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime.datetime] = None
    images: Optional[List[str]] = []


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    label: Optional[str] = None
    labels: List[LabelResponse] = []
    board_id: str
    column_id: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[datetime.datetime] = None
    events: Optional[list] = []
    images: Optional[List[str]] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime


class CommentCreate(BaseModel):
    content: str
    images: Optional[List[str]] = []


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    user_id: str
    content: str
    images: Optional[List[str]] = []
    created_at: datetime.datetime
    updated_at: datetime.datetime
