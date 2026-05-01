from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.profile import Profile
from backend.services.auth import verify_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def get_user_profile_ids(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[int]:
    rows = db.query(Profile.id).filter(Profile.user_id == user.id).all()
    pids = [r[0] for r in rows]
    if not pids:
        orphans = db.query(Profile).filter(Profile.user_id == None).all()
        for p in orphans:
            p.user_id = user.id
        if orphans:
            db.commit()
            pids = [p.id for p in orphans]
        if not pids:
            new_profile = Profile(
                user_id=user.id,
                name="My Finances",
                color="#00d632",
                avatar_initial=user.username[0].upper() if user.username else "U",
            )
            db.add(new_profile)
            db.commit()
            db.refresh(new_profile)
            pids = [new_profile.id]
    return pids
