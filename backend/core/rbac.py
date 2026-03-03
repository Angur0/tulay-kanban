from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from backend import models

def ensure_board_access(db: Session, board_id: str, current_user: models.User, required_roles: list[str] = None):
    board = db.query(models.Board).filter(models.Board.id == board_id).first()
    if not board:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
        
    stmt = models.board_members.select().where(
        models.board_members.c.user_id == current_user.id,
        models.board_members.c.board_id == board_id
    )
    result = db.execute(stmt).fetchone()
    
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found or access denied")
        
    role = result._mapping["role"] if hasattr(result, "_mapping") else result[2]
        
    if required_roles and role not in required_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        
    return role
