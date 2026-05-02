import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.recurring import RecurringTransaction
from backend.models.transaction import Transaction
from backend.services import account_balance
from backend.models.user import User
from backend.dependencies import get_current_user, get_user_profile_ids

router = APIRouter()


class RecurringCreate(BaseModel):
    account_id: int
    description: str
    amount: float
    profile_id: Optional[int] = None
    currency: str = "CAD"
    category_id: Optional[int] = None
    frequency: str  # weekly | biweekly | monthly | quarterly | annual
    start_date: str
    end_date: Optional[str] = None
    notes: Optional[str] = None


class RecurringUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[int] = None
    frequency: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


def advance_date(current: str, frequency: str) -> str:
    d = datetime.date.fromisoformat(current)
    if frequency == "weekly":
        d += datetime.timedelta(days=7)
    elif frequency == "biweekly":
        d += datetime.timedelta(days=14)
    elif frequency == "monthly":
        month = d.month + 1
        year = d.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        d = datetime.date(year, month, day)
    elif frequency == "quarterly":
        month = d.month + 3
        year = d.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        d = datetime.date(year, month, day)
    elif frequency == "annual":
        year = d.year + 1
        day = min(d.day, 29 if d.month == 2 and year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28 if d.month == 2 else d.day)
        d = datetime.date(year, d.month, day)
    return d.isoformat()


@router.get("/")
def list_recurring(
    profile_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    query = db.query(RecurringTransaction).filter(RecurringTransaction.profile_id.in_(pids))
    if profile_id is not None and profile_id in pids:
        query = query.filter(RecurringTransaction.profile_id == profile_id)
    return query.order_by(RecurringTransaction.next_date).all()


@router.post("/", status_code=201)
def create_recurring(
    data: RecurringCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    if not data.profile_id or data.profile_id not in pids:
        data.profile_id = pids[0]
    obj = RecurringTransaction(
        **data.model_dump(),
        next_date=data.start_date,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{rule_id}")
def update_recurring(
    rule_id: int,
    data: RecurringUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    rule = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == rule_id, RecurringTransaction.profile_id.in_(pids)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
def delete_recurring(
    rule_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    rule = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == rule_id, RecurringTransaction.profile_id.in_(pids)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(rule)
    db.commit()


@router.post("/{rule_id}/skip")
def skip_next(
    rule_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    """Skip the next occurrence — advance next_date without creating a transaction."""
    rule = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == rule_id, RecurringTransaction.profile_id.in_(pids)
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Not found")
    rule.next_date = advance_date(rule.next_date, rule.frequency)
    if rule.end_date and rule.next_date > rule.end_date:
        rule.is_active = False
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/execute")
def execute_due(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    """Create real transactions for all active recurring rules that are due today or earlier."""
    today = datetime.date.today().isoformat()
    due = db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_date <= today,
        RecurringTransaction.profile_id.in_(pids),
    ).all()

    created = []
    for rule in due:
        # May need to catch up multiple missed dates
        while rule.next_date <= today:
            if rule.end_date and rule.next_date > rule.end_date:
                rule.is_active = False
                break

            tx = Transaction(
                account_id=rule.account_id,
                date=rule.next_date,
                description=rule.description,
                amount=rule.amount,
                currency=rule.currency,
                category_id=rule.category_id,
                notes=f"Auto-generated from recurring rule #{rule.id}",
            )
            db.add(tx)
            db.flush()
            account_balance.refresh_balance(db, rule.account_id)
            created.append({
                "rule_id": rule.id,
                "transaction_id": tx.id,
                "date": tx.date,
                "description": tx.description,
                "amount": tx.amount,
            })

            rule.next_date = advance_date(rule.next_date, rule.frequency)

        if rule.end_date and rule.next_date > rule.end_date:
            rule.is_active = False

    db.commit()
    return {"created": len(created), "transactions": created}
