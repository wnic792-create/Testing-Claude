from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.account import Account
from backend.services.snapshot_service import take_snapshot, get_snapshot_history
from backend.services.account_balance import rebase_from_transactions

router = APIRouter()


class AccountCreate(BaseModel):
    name: str
    type: str
    currency: str = "CAD"
    institution: Optional[str] = None
    current_balance: float = 0.0
    interest_rate: Optional[float] = None
    is_asset: bool = True
    notes: Optional[str] = None
    last_price_update: Optional[str] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    down_payment: Optional[float] = None
    appreciation_rate: Optional[float] = None
    property_tax_annual: Optional[float] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    currency: Optional[str] = None
    institution: Optional[str] = None
    current_balance: Optional[float] = None
    interest_rate: Optional[float] = None
    is_asset: Optional[bool] = None
    notes: Optional[str] = None
    last_price_update: Optional[str] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None
    down_payment: Optional[float] = None
    appreciation_rate: Optional[float] = None
    property_tax_annual: Optional[float] = None


@router.get("/")
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).all()


@router.get("/snapshots")
def list_snapshots(db: Session = Depends(get_db)):
    """Get net worth snapshot history."""
    return get_snapshot_history(db)


@router.post("/snapshots", status_code=201)
def create_snapshot(db: Session = Depends(get_db)):
    """Take a new net worth snapshot."""
    return take_snapshot(db)


@router.post("/", status_code=201)
def create_account(account: AccountCreate, db: Session = Depends(get_db)):
    db_account = Account(**account.model_dump())
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


@router.get("/{account_id}")
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}")
def update_account(account_id: int, updates: AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(account, key, value)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()


class RecalculateRequest(BaseModel):
    opening_balance: float = 0.0


@router.post("/{account_id}/recalculate")
def recalculate_balance(
    account_id: int,
    body: RecalculateRequest,
    db: Session = Depends(get_db),
):
    """
    Reset `current_balance` to `opening_balance + sum(transactions)`.
    Useful to fix accounts whose balance drifted (e.g. transactions were added
    before the balance-sync hooks existed).
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    new_balance = rebase_from_transactions(db, account_id, body.opening_balance)
    db.commit()
    return {"account_id": account_id, "current_balance": new_balance}
