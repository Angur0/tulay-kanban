import datetime
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
        iat = payload.get("iat")
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception

    if not user.is_admin:
        settings = db.query(models.SystemSettings).filter(models.SystemSettings.id == "singleton").first()
        if settings:
            is_active = False
            if settings.maintenance_mode:
                is_active = True
            elif settings.maintenance_start and settings.maintenance_end:
                now = datetime.datetime.utcnow()
                is_active = settings.maintenance_start <= now <= settings.maintenance_end
            
            if is_active:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={
                        "message": "System is currently undergoing maintenance.",
                        "end_time": settings.maintenance_end.isoformat() if settings.maintenance_end else None
                    }
                )

        now = datetime.datetime.utcnow()
        if user.is_banned or (user.ban_until and user.ban_until > now):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been suspended"
            )

        blacklist_entry = db.query(models.TokenBlacklist).filter(
            models.TokenBlacklist.user_id == user.id
        ).first()
        if blacklist_entry:
            if iat is not None:
                token_issued_at = datetime.datetime.utcfromtimestamp(iat)
                if token_issued_at < blacklist_entry.created_at:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your account has been suspended"
                    )

    return user


async def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def ensure_workspace_access(ws: models.Workspace, current_user: models.User):
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    owner_matches = str(ws.owner_id) == str(current_user.id)
    member_matches = any(str(m.id) == str(current_user.id) for m in ws.members)
    if not owner_matches and not member_matches:
        raise HTTPException(status_code=403, detail="Not authorized for this workspace")
