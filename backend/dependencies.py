from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.profile import Profile
from backend.services.auth import verify_token


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        print(f"[AUTH] Missing or bad Authorization header: '{auth[:50]}'")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    token = auth[7:]  # strip "Bearer "
    payload = verify_token(token)
    if not payload:
        print(f"[AUTH] Token verification FAILED for token: {token[:30]}...")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        print(f"[AUTH] User {user_id} not found or inactive")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    print(f"[AUTH] OK: {user.username} (id={user.id})")
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
