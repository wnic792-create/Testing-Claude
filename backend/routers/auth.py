from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.profile import Profile
from backend.services.auth import hash_password, verify_password, create_token
from backend.dependencies import get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if len(data.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if len(data.username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")

    existing = db.query(User).filter(
        (User.username == data.username) | (User.email == data.email)
    ).first()
    if existing:
        raise HTTPException(409, "Username or email already taken")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(Profile(
        user_id=user.id,
        name="My Finances",
        color="#3B82F6",
        avatar_initial=user.username[0].upper(),
    ))
    db.commit()

    token = create_token(user.id, user.username)
    return TokenResponse(access_token=token, user_id=user.id, username=user.username)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    print(f"[LOGIN] Attempt for user: {data.username}")
    user = db.query(User).filter(User.username == data.username).first()
    if not user:
        print(f"[LOGIN] User '{data.username}' not found in database")
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(data.password, user.hashed_password):
        print(f"[LOGIN] Wrong password for '{data.username}'")
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account disabled")

    token = create_token(user.id, user.username)
    from backend.services.auth import verify_token
    check = verify_token(token)
    print(f"[LOGIN] Success for '{data.username}' — token verify test: {'PASS' if check else 'FAIL'}")
    return TokenResponse(access_token=token, user_id=user.id, username=user.username)


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "email": user.email}
