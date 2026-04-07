from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from backend.database import get_db
from backend.models.transaction import Transaction
from backend.services.categorization import learn_from_correction
from backend.services.recurring_detector import detect_recurring

router = APIRouter()


class TransactionCreate(BaseModel):
    account_id: int
    date: str
    description: str
    amount: float
    currency: str = "CAD"
    category_id: Optional[int] = None
    is_transfer: bool = False
    transfer_pair_id: Optional[int] = None
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    category_id: Optional[int] = None
    is_transfer: Optional[bool] = None
    notes: Optional[str] = None


class SplitItem(BaseModel):
    amount: float
    category_id: int
    description: Optional[str] = None


@router.get("/")
def list_transactions(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if date_from:
        query = query.filter(Transaction.date >= date_from)
    if date_to:
        query = query.filter(Transaction.date <= date_to)
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
    return query.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()


@router.post("/", status_code=201)
def create_transaction(tx: TransactionCreate, db: Session = Depends(get_db)):
    db_tx = Transaction(**tx.model_dump())
    db.add(db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx


@router.get("/recurring/detect")
def detect_recurring_transactions(
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Detect potential recurring transactions (subscriptions)."""
    return detect_recurring(db, account_id)


@router.get("/{tx_id}")
def get_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.patch("/{tx_id}")
def update_transaction(tx_id: int, updates: TransactionUpdate, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(tx, key, value)
    # If category changed, learn from the correction
    if updates.category_id is not None:
        learn_from_correction(db, tx_id, updates.category_id)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()


@router.post("/{tx_id}/split")
def split_transaction(tx_id: int, splits: List[SplitItem], db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    tx.is_split = True
    for split in splits:
        child = Transaction(
            account_id=tx.account_id,
            date=tx.date,
            description=split.description or tx.description,
            amount=split.amount,
            currency=tx.currency,
            category_id=split.category_id,
            parent_tx_id=tx.id,
            source_file=tx.source_file,
        )
        db.add(child)
    db.commit()
    db.refresh(tx)
    return tx
