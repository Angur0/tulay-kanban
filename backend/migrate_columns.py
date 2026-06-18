from database import engine
from sqlalchemy import text

def migrate():
    with engine.begin() as conn:
        columns = [
            ("start_date", "TIMESTAMP"),
            ("due_date", "TIMESTAMP"),
            ('"order"', "INTEGER DEFAULT 0"),
            ("events", "JSON DEFAULT '[]'::json"),
            ("images", "JSON DEFAULT '[]'::json"),
            ("is_orphaned", "BOOLEAN DEFAULT FALSE"),
        ]
        
        for col, dtype in columns:
            try:
                conn.execute(text(f"ALTER TABLE tasks ADD COLUMN IF NOT EXISTS {col} {dtype}"))
                print(f"Added column {col} successfully (or it already exists).")
            except Exception as e:
                print(f"Could not add {col}: {e}")

if __name__ == "__main__":
    migrate()
