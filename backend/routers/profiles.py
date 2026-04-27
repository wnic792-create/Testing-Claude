from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.profile import Profile

router = APIRouter()


class ProfileCreate(BaseModel):
    name: str
    color: str = "#3B82F6"
    avatar_initial: str = "P"


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    avatar_initial: Optional[str] = None


@router.get("/")
def list_profiles(db: Session = Depends(get_db)):
    return db.query(Profile).order_by(Profile.id).all()


@router.post("/", status_code=201)
def create_profile(data: ProfileCreate, db: Session = Depends(get_db)):
    obj = Profile(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{profile_id}")
def update_profile(profile_id: int, data: ProfileUpdate, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    count = db.query(Profile).count()
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last profile")
    db.delete(profile)
    db.commit()
