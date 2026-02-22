from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from backend import models
from backend.core import auth
from backend.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


async def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def ensure_workspace_access(ws: models.Workspace, current_user: models.User):
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    owner_matches = str(ws.owner_id) == str(current_user.id)
    member_matches = any(str(m.id) == str(current_user.id) for m in ws.members)
    if not owner_matches and not member_matches:
        raise HTTPException(status_code=403, detail="Not authorized for this workspace")
