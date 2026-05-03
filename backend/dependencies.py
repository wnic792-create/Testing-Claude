from fastapi import Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.profile import Profile


def get_profile_ids(
    db: Session = Depends(get_db),
) -> list[int]:
    rows = db.query(Profile.id).order_by(Profile.id).all()
    pids = [r[0] for r in rows]
    if not pids:
        new_profile = Profile(
            name="My Finances",
            color="#00d632",
            avatar_initial="M",
        )
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)
        pids = [new_profile.id]
    return pids
