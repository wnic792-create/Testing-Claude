from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.budget import Budget

router = APIRouter()


class BudgetCreate(BaseModel):
    category_id: int
    year_month: str
    amount: float
    rollover: bool = False


class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    rollover: Optional[bool] = None


@router.get("/")
def list_budgets(year_month: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Budget)
    if year_month:
        query = query.filter(Budget.year_month == year_month)
    return query.all()


@router.post("/", status_code=201)
def create_budget(budget: BudgetCreate, db: Session = Depends(get_db)):
    db_budget = Budget(**budget.model_dump())
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget


@router.patch("/{budget_id}")
def update_budget(budget_id: int, updates: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(budget, key, value)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()


@router.get("/variance/{year_month}")
def budget_variance(year_month: str, db: Session = Depends(get_db)):
    # TODO: compute budget vs actual spending per category
    return {"status": "not_implemented", "year_month": year_month}
