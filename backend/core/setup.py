from sqlalchemy import inspect, text

from backend import models
from backend.core import auth
from backend.database import SessionLocal, engine


def ensure_board_icon_column():
    """Ensure the icon, icon_color, and position columns exist on boards"""
    inspector = inspect(engine)
    board_columns = {col["name"] for col in inspector.get_columns("boards")}

    if "icon" not in board_columns:
        print("Adding icon column to boards table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE boards ADD COLUMN icon VARCHAR DEFAULT 'dashboard'"))

    if "icon_color" not in board_columns:
        print("Adding icon_color column to boards table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE boards ADD COLUMN icon_color VARCHAR DEFAULT '#3b82f6'"))

    if "position" not in board_columns:
        print("Adding position column to boards table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE boards ADD COLUMN position INTEGER DEFAULT 0"))
            conn.execute(
                text(
                    """
                UPDATE boards SET position = (
                    SELECT COUNT(*) FROM boards b2
                    WHERE b2.workspace_id = boards.workspace_id
                    AND b2.created_at < boards.created_at
                )
            """
                )
            )

    with engine.begin() as conn:
        conn.execute(text("UPDATE boards SET icon = 'dashboard' WHERE icon IS NULL OR icon = ''"))
        conn.execute(text("UPDATE boards SET icon_color = '#3b82f6' WHERE icon_color IS NULL OR icon_color = ''"))
    print("Board icon/icon_color/position columns ensured with default values")


def ensure_task_order_column():
    """Ensure the order column exists on tasks and initialize it deterministically."""
    inspector = inspect(engine)
    task_columns = {col["name"] for col in inspector.get_columns("tasks")}

    if "order" not in task_columns:
        print("Adding order column to tasks table...")
        with engine.begin() as conn:
            conn.execute(text('ALTER TABLE tasks ADD COLUMN "order" INTEGER DEFAULT 0'))
            conn.execute(
                text(
                    """
                UPDATE tasks
                SET "order" = (
                    SELECT COUNT(*)
                    FROM tasks t2
                    WHERE t2.board_id = tasks.board_id
                      AND COALESCE(t2.column_id, '') = COALESCE(tasks.column_id, '')
                      AND (
                            t2.created_at < tasks.created_at
                            OR (t2.created_at = tasks.created_at AND t2.id <= tasks.id)
                      )
                ) - 1
            """
                )
            )

    with engine.begin() as conn:
        conn.execute(text('UPDATE tasks SET "order" = 0 WHERE "order" IS NULL'))

    print("Task order column ensured with default values")


def ensure_column_parameters():
    """Ensure the is_hidden and is_archive columns exist on board_columns"""
    inspector = inspect(engine)
    col_columns = {col["name"] for col in inspector.get_columns("board_columns")}

    if "is_hidden" not in col_columns:
        print("Adding is_hidden column to board_columns table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE board_columns ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE"))

    if "is_archive" not in col_columns:
        print("Adding is_archive column to board_columns table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE board_columns ADD COLUMN is_archive BOOLEAN DEFAULT FALSE"))

    print("BoardColumn parameters ensured with default values")


def seed_db():
    db = SessionLocal()
    try:
        test_email = "test@example.com"
        user = db.query(models.User).filter(models.User.email == test_email).first()
        if not user:
            print("Seeding default test user...")
            hashed_pw = auth.get_password_hash("password123")
            new_user = models.User(email=test_email, hashed_password=hashed_pw, full_name="Test User")
            db.add(new_user)
            db.commit()
            db.refresh(new_user)

            ws = models.Workspace(name="Test Workspace", owner_id=new_user.id)
            db.add(ws)
            db.commit()
            db.refresh(ws)

            board = models.Board(name="Task Board", workspace_id=ws.id)
            db.add(board)
            db.commit()
            db.refresh(board)

            cols = [
                models.BoardColumn(board_id=board.id, title="To Do", position=0, color="amber-100"),
                models.BoardColumn(board_id=board.id, title="In Progress", position=1, color="blue-100"),
                models.BoardColumn(board_id=board.id, title="Done", position=2, color="green-100"),
                models.BoardColumn(board_id=board.id, title="Archive", position=3, color="gray-100", is_archive=True),
            ]
            db.add_all(cols)
            db.commit()
            print(f"Default user created: {test_email} / password123")
    finally:
        db.close()
