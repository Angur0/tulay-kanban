from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend import models
from backend.core import auth
from backend.core.deps import get_current_user
from backend.database import get_db
from backend.schemas import Token, UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = auth.get_password_hash(user_in.password)
    new_user = models.User(
        email=user_in.email,
        hashed_password=hashed_password,
        full_name=user_in.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    ws_name = f"{user_in.full_name.split(' ')[0]}'s Workspace" if user_in.full_name else "My Workspace"
    default_ws = models.Workspace(name=ws_name, owner_id=new_user.id)
    db.add(default_ws)
    db.commit()

    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if not auth.verify_password(form_data.password, str(user.hashed_password)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    access_token = auth.create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "must_change_password": bool(user.must_change_password),
        "is_admin": bool(user.is_admin),
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(user_in: UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if user_in.email and user_in.email != current_user.email:
        # Check if email is taken
        existing = db.query(models.User).filter(models.User.email == user_in.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_in.email
    
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
        
    if user_in.password:
        current_user.hashed_password = auth.get_password_hash(user_in.password)
        current_user.must_change_password = False
        
    db.commit()
    db.refresh(current_user)
    return current_user
