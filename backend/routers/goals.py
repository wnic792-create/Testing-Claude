from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.goal import Goal
from backend.models.scenario import Scenario
from backend.models.user import User
from backend.dependencies import get_current_user, get_user_profile_ids

router = APIRouter()


class GoalCreate(BaseModel):
    scenario_id: int
    name: str
    target_amount: Optional[float] = None
    type: str = "lump_sum"
    months_expenses: Optional[int] = None
    linked_account_id: Optional[int] = None
    target_date: Optional[str] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    type: Optional[str] = None
    months_expenses: Optional[int] = None
    linked_account_id: Optional[int] = None
    target_date: Optional[str] = None


@router.get("/")
def list_goals(
    scenario_id: Optional[int] = None,
    profile_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    query = db.query(Goal).join(Scenario, Goal.scenario_id == Scenario.id).filter(Scenario.profile_id.in_(pids))
    if scenario_id:
        query = query.filter(Goal.scenario_id == scenario_id)
    if profile_id is not None and profile_id in pids:
        query = query.filter(Scenario.profile_id == profile_id)
    return query.all()


@router.post("/", status_code=201)
def create_goal(
    goal: GoalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    # Verify the scenario belongs to the user
    scenario = db.query(Scenario).filter(Scenario.id == goal.scenario_id, Scenario.profile_id.in_(pids)).first()
    if not scenario:
        raise HTTPException(status_code=403, detail="Access denied to this scenario")
    db_goal = Goal(**goal.model_dump())
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal


@router.patch("/{goal_id}")
def update_goal(
    goal_id: int,
    updates: GoalUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    goal = (
        db.query(Goal)
        .join(Scenario, Goal.scenario_id == Scenario.id)
        .filter(Goal.id == goal_id, Scenario.profile_id.in_(pids))
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    goal = (
        db.query(Goal)
        .join(Scenario, Goal.scenario_id == Scenario.id)
        .filter(Goal.id == goal_id, Scenario.profile_id.in_(pids))
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
