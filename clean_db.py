import sys
import os

# Ensure the root directory is in sys.path so we can import 'backend'
sys.path.append(os.getcwd())

from backend.database import engine, Base
# Import models to ensure they are registered with Base.metadata
from backend import models 

def clean_database():
    print("WARNING: This will delete ALL data from the database.")
    
    # check for --force argument
    force = '--force' in sys.argv
    
    if not force:
        print("To proceed without confirmation, use --force argument.")
        confirmation = input("Type 'y' to confirm deletion of all data: ")
        if confirmation.lower() != 'y':
            print("Operation cancelled.")
            return

    print("Dropping all tables...")
    try:
        Base.metadata.drop_all(bind=engine)
        print("Tables dropped.")
    except Exception as e:
        print(f"Error dropping tables: {e}")
        return

    print("Creating all tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Tables created.")
    except Exception as e:
        print(f"Error creating tables: {e}")
        return
    
    print("Database cleaned and reset successfully.")

if __name__ == "__main__":
    clean_database()
