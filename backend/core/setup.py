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


def ensure_user_admin_columns():
    """Ensure is_admin, must_change_password, is_banned, ban_until exist on users"""
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("users")}

    if "is_admin" not in columns:
        print("Adding is_admin column to users table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE NOT NULL"))

    if "must_change_password" not in columns:
        print("Adding must_change_password column to users table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE NOT NULL"))

    if "is_banned" not in columns:
        print("Adding is_banned column to users table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE NOT NULL"))

    if "ban_until" not in columns:
        print("Adding ban_until column to users table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN ban_until TIMESTAMP"))


def ensure_task_orphaned_column():
    """Ensure is_orphaned exists on tasks"""
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("tasks")}

    if "is_orphaned" not in columns:
        print("Adding is_orphaned column to tasks table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN is_orphaned BOOLEAN DEFAULT FALSE NOT NULL"))


def ensure_task_date_columns():
    """Ensure start_date and due_date exist on tasks"""
    inspector = inspect(engine)
    columns = {col["name"] for col in inspector.get_columns("tasks")}

    if "start_date" not in columns:
        print("Adding start_date column to tasks table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN start_date TIMESTAMP"))

    if "due_date" not in columns:
        print("Adding due_date column to tasks table...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tasks ADD COLUMN due_date TIMESTAMP"))


def remove_test_user():
    """Remove test@example.com user and all cascading relationships if exists"""
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.email == "test@example.com").first()
        if user:
            print("Removing test@example.com user...")
            # Delete comments
            db.query(models.Comment).filter(models.Comment.user_id == user.id).delete()
            # Delete activities
            db.query(models.Activity).filter(models.Activity.user_id == user.id).delete()
            # Delete workspace memberships
            db.execute(models.workspace_members.delete().where(models.workspace_members.c.user_id == user.id))
            # Delete board memberships
            db.execute(models.board_members.delete().where(models.board_members.c.user_id == user.id))
            # Orphan tasks
            db.query(models.Task).filter(models.Task.assignee_id == user.id).update({"assignee_id": None, "is_orphaned": True})
            # Delete owned workspaces
            workspaces = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).all()
            for ws in workspaces:
                db.delete(ws)
            # Delete user
            db.delete(user)
            db.commit()
            print("test@example.com removed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error removing test user: {e}")
    finally:
        db.close()


def seed_admin():
    """Seed the default admin account: admin@tulay.local / admin1234"""
    db = SessionLocal()
    try:
        admin_user = db.query(models.User).filter(models.User.is_admin == True).first()
        if not admin_user:
            print("Seeding default admin user...")
            hashed_pw = auth.get_password_hash("admin1234")
            admin = models.User(
                email="admin@tulay.local",
                hashed_password=hashed_pw,
                full_name="System Administrator",
                is_admin=True,
                must_change_password=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print("Default admin created: admin@tulay.local / admin1234")
    except Exception as e:
        db.rollback()
        print(f"Error seeding admin user: {e}")
    finally:
        db.close()


def ensure_system_settings():
    """Ensure the system settings singleton row exists."""
    db = SessionLocal()
    try:
        settings = db.query(models.SystemSettings).filter(models.SystemSettings.id == "singleton").first()
        if not settings:
            print("Initializing default system settings...")
            settings = models.SystemSettings(
                id="singleton",
                maintenance_mode=False,
                maintenance_start=None,
                maintenance_end=None
            )
            db.add(settings)
            db.commit()
            print("Default system settings initialized.")
    except Exception as e:
        db.rollback()
        print(f"Error ensuring system settings: {e}")
    finally:
        db.close()
