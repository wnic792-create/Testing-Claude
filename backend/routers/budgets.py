from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.budget import Budget
from backend.models.transaction import Transaction
from backend.models.category import Category

router = APIRouter()


class BudgetCreate(BaseModel):
    category_id: int
    year_month: str
    amount: float
    rollover: bool = False
    profile_id: int = 1


class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    rollover: Optional[bool] = None


class BudgetBulkItem(BaseModel):
    category_id: int
    amount: float
    rollover: bool = False


@router.get("/")
def list_budgets(year_month: Optional[str] = None, profile_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Budget)
    if profile_id is not None:
        query = query.filter(Budget.profile_id == profile_id)
    if year_month:
        query = query.filter(Budget.year_month == year_month)
    return query.all()


@router.post("/", status_code=201)
def create_budget(budget: BudgetCreate, db: Session = Depends(get_db)):
    # Upsert: update if exists for this category+month
    existing = db.query(Budget).filter(
        Budget.category_id == budget.category_id,
        Budget.year_month == budget.year_month,
    ).first()
    if existing:
        existing.amount = budget.amount
        existing.rollover = budget.rollover
        db.commit()
        db.refresh(existing)
        return existing
    db_budget = Budget(**budget.model_dump())
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget


@router.post("/bulk/{year_month}")
def set_budgets_bulk(year_month: str, items: list[BudgetBulkItem], db: Session = Depends(get_db)):
    """Set multiple budgets at once for a given month."""
    results = []
    for item in items:
        existing = db.query(Budget).filter(
            Budget.category_id == item.category_id,
            Budget.year_month == year_month,
        ).first()
        if existing:
            existing.amount = item.amount
            existing.rollover = item.rollover
            results.append(existing)
        else:
            b = Budget(
                category_id=item.category_id,
                year_month=year_month,
                amount=item.amount,
                rollover=item.rollover,
            )
            db.add(b)
            results.append(b)
    db.commit()
    return results


@router.post("/copy/{from_month}/{to_month}")
def copy_budgets(from_month: str, to_month: str, db: Session = Depends(get_db)):
    """Copy all budgets from one month to another."""
    source = db.query(Budget).filter(Budget.year_month == from_month).all()
    if not source:
        raise HTTPException(status_code=404, detail="No budgets found for source month")

    created = 0
    for b in source:
        existing = db.query(Budget).filter(
            Budget.category_id == b.category_id,
            Budget.year_month == to_month,
        ).first()
        if not existing:
            new_b = Budget(
                category_id=b.category_id,
                year_month=to_month,
                amount=b.amount,
                rollover=b.rollover,
            )
            db.add(new_b)
            created += 1
    db.commit()
    return {"copied": created, "from": from_month, "to": to_month}


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
def budget_variance(year_month: str, profile_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Compute budget vs actual spending per category for a given month.
    Returns each budget line with actual spending, variance, and rollover.
    """
    # Parse year_month to get date range
    parts = year_month.split("-")
    year, month = int(parts[0]), int(parts[1])
    date_from = f"{year:04d}-{month:02d}-01"
    if month == 12:
        date_to = f"{year + 1:04d}-01-01"
    else:
        date_to = f"{year:04d}-{month + 1:02d}-01"

    # Get all budgets for this month
    bq = db.query(Budget).filter(Budget.year_month == year_month)
    if profile_id is not None:
        bq = bq.filter(Budget.profile_id == profile_id)
    budgets = bq.all()

    # Get actual spending grouped by category for this month
    actuals = (
        db.query(
            Transaction.category_id,
            func.sum(Transaction.amount).label("total"),
        )
        .filter(
            Transaction.date >= date_from,
            Transaction.date < date_to,
            Transaction.is_transfer == False,
            Transaction.parent_tx_id == None,
        )
        .group_by(Transaction.category_id)
        .all()
    )
    actual_map = {row.category_id: row.total for row in actuals}

    # Get category info
    all_cats = db.query(Category).all()
    cat_map = {c.id: c for c in all_cats}

    # Build child-to-parent mapping for rolling up subcategory spending
    children_of = {}
    for c in all_cats:
        if c.parent_id:
            children_of.setdefault(c.parent_id, []).append(c.id)

    results = []
    total_budgeted = 0.0
    total_actual = 0.0

    for b in budgets:
        cat = cat_map.get(b.category_id)
        cat_name = cat.name if cat else "Unknown"
        cat_name_fr = cat.name_fr if cat else None

        # Sum actuals for this category + its children
        actual = actual_map.get(b.category_id, 0.0) or 0.0
        for child_id in children_of.get(b.category_id, []):
            actual += actual_map.get(child_id, 0.0) or 0.0

        # For expenses, amount is negative in transactions, so we compare abs
        spent = abs(actual) if actual < 0 else 0.0
        earned = actual if actual > 0 else 0.0

        # Compute rollover from previous month
        rollover_in = 0.0
        if b.rollover:
            prev_month = _prev_month(year_month)
            prev_budget = db.query(Budget).filter(
                Budget.category_id == b.category_id,
                Budget.year_month == prev_month,
            ).first()
            if prev_budget:
                rollover_in = prev_budget.rollover_amount

        effective_budget = b.amount + rollover_in
        variance = effective_budget - spent
        is_over = variance < 0
        pct_used = (spent / effective_budget * 100) if effective_budget > 0 else 0.0

        # Update rollover_amount for this month
        b.rollover_amount = variance if b.rollover else 0.0

        total_budgeted += effective_budget
        total_actual += spent

        results.append({
            "budget_id": b.id,
            "category_id": b.category_id,
            "category_name": cat_name,
            "category_name_fr": cat_name_fr,
            "category_type": cat.type if cat else "expense",
            "budgeted": b.amount,
            "rollover_in": rollover_in,
            "effective_budget": effective_budget,
            "actual": spent,
            "variance": variance,
            "pct_used": round(pct_used, 1),
            "is_over": is_over,
            "rollover": b.rollover,
        })

    db.commit()

    return {
        "year_month": year_month,
        "lines": sorted(results, key=lambda x: x["pct_used"], reverse=True),
        "total_budgeted": total_budgeted,
        "total_actual": total_actual,
        "total_variance": total_budgeted - total_actual,
    }


def _prev_month(year_month: str) -> str:
    parts = year_month.split("-")
    year, month = int(parts[0]), int(parts[1])
    if month == 1:
        return f"{year - 1:04d}-12"
    return f"{year:04d}-{month - 1:02d}"
