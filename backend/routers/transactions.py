from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from backend.database import get_db
from backend.models.transaction import Transaction
from backend.models.account import Account
from backend.models.user import User
from backend.dependencies import get_current_user, get_user_profile_ids
from backend.services.categorization import learn_from_correction, auto_categorize, categorize_batch
from backend.services.recurring_detector import detect_recurring
from backend.services import account_balance
from backend.services.transfer_pairing import maybe_auto_pair

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


class TransferCreate(BaseModel):
    from_account_id: int
    to_account_id: int
    date: str
    description: str
    amount: float          # positive value — money moving from → to
    currency: str = "CAD"
    category_id: Optional[int] = None
    notes: Optional[str] = None


@router.get("/")
def list_transactions(
    account_id: Optional[int] = None,
    profile_id: Optional[int] = None,
    category_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    query = db.query(Transaction).join(Account, Transaction.account_id == Account.id).filter(Account.profile_id.in_(pids))
    if profile_id is not None and profile_id in pids:
        query = query.filter(Account.profile_id == profile_id)
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
def create_transaction(
    tx: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    # Verify the account belongs to the user
    acct = db.query(Account).filter(Account.id == tx.account_id, Account.profile_id.in_(pids)).first()
    if not acct:
        raise HTTPException(status_code=403, detail="Access denied to this account")
    data = tx.model_dump()
    # Auto-categorize if no category was provided
    if data.get("category_id") is None:
        data["category_id"] = auto_categorize(db, data["description"])
    db_tx = Transaction(**data)
    db.add(db_tx)
    db.flush()
    account_balance.on_create(db, db_tx)
    db.commit()
    db.refresh(db_tx)
    return db_tx


@router.get("/recurring/detect")
def detect_recurring_transactions(
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    """Detect potential recurring transactions (subscriptions)."""
    if account_id:
        acct = db.query(Account).filter(Account.id == account_id, Account.profile_id.in_(pids)).first()
        if not acct:
            raise HTTPException(status_code=403, detail="Access denied to this account")
    return detect_recurring(db, account_id)


@router.post("/categorize-uncategorized")
def categorize_uncategorized(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    """Run auto-categorization across all transactions that currently have no category."""
    txs = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(Account.profile_id.in_(pids), Transaction.category_id.is_(None))
        .all()
    )
    count = categorize_batch(db, txs)
    db.commit()
    return {"categorized": count, "checked": len(txs)}


@router.post("/recategorize-all")
def recategorize_all(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    """
    Re-run categorization against every transaction using the current rules
    (ordered by priority desc). Overwrites existing categories — use when rule
    priorities change and you want them reflected across the full history.
    """
    txs = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(Account.profile_id.in_(pids))
        .all()
    )
    count = categorize_batch(db, txs, force=True)
    db.commit()
    return {"categorized": count, "checked": len(txs)}


@router.delete("/bulk")
def bulk_delete(
    account_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    """Delete all transactions matching the given filters. Returns count deleted."""
    query = db.query(Transaction).join(Account, Transaction.account_id == Account.id).filter(Account.profile_id.in_(pids))
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if date_from:
        query = query.filter(Transaction.date >= date_from)
    if date_to:
        query = query.filter(Transaction.date <= date_to)
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
    # Materialize rows first so we can refund each affected account's balance.
    rows = query.all()
    account_balance.on_bulk_delete(db, rows)
    count = len(rows)
    for row in rows:
        db.delete(row)
    db.commit()
    return {"deleted": count}


@router.post("/transfer", status_code=201)
def create_transfer(
    body: TransferCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    """
    Atomically create a linked pair of transactions representing an internal transfer.
    The outflow leg (negative amount) is booked against from_account_id and the
    inflow leg (positive amount) against to_account_id. Both share transfer_pair_id.
    """
    # Verify both accounts belong to the user
    from_acct = db.query(Account).filter(Account.id == body.from_account_id, Account.profile_id.in_(pids)).first()
    to_acct = db.query(Account).filter(Account.id == body.to_account_id, Account.profile_id.in_(pids)).first()
    if not from_acct or not to_acct:
        raise HTTPException(status_code=403, detail="Access denied to one or both accounts")

    # Outflow from the source account
    out_tx = Transaction(
        account_id=body.from_account_id,
        date=body.date,
        description=body.description,
        amount=-abs(body.amount),
        currency=body.currency,
        category_id=body.category_id,
        is_transfer=True,
        notes=body.notes,
    )
    db.add(out_tx)
    db.flush()

    # Inflow into the destination account
    in_tx = Transaction(
        account_id=body.to_account_id,
        date=body.date,
        description=body.description,
        amount=abs(body.amount),
        currency=body.currency,
        category_id=body.category_id,
        is_transfer=True,
        transfer_pair_id=out_tx.id,
        notes=body.notes,
    )
    db.add(in_tx)
    db.flush()

    # Cross-link
    out_tx.transfer_pair_id = in_tx.id

    # Update balances for both legs
    account_balance.on_create(db, out_tx)
    account_balance.on_create(db, in_tx)

    db.commit()
    db.refresh(out_tx)
    db.refresh(in_tx)
    return {"out": {c.name: getattr(out_tx, c.name) for c in Transaction.__table__.columns},
            "in": {c.name: getattr(in_tx, c.name) for c in Transaction.__table__.columns}}


@router.get("/{tx_id}")
def get_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    tx = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(Transaction.id == tx_id, Account.profile_id.in_(pids))
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.patch("/{tx_id}")
def update_transaction(
    tx_id: int,
    updates: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    tx = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(Transaction.id == tx_id, Account.profile_id.in_(pids))
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    learn_result = None
    payload = updates.model_dump(exclude_unset=True)

    # If category changed, learn from the correction BEFORE applying other updates
    # so the rule is based on the current (unchanged) description.
    if "category_id" in payload and payload["category_id"] is not None:
        learn_result = learn_from_correction(db, tx_id, payload["category_id"])
        payload.pop("category_id")  # already applied inside learn_from_correction

    # Snapshot the fields that can move account balances so we can diff later.
    old_amount = tx.amount
    old_account_id = tx.account_id

    for key, value in payload.items():
        setattr(tx, key, value)

    account_balance.on_update(db, tx, old_amount, old_account_id)

    # If the new category is a transfer-category with a default destination,
    # promote this single-leg tx into a paired transfer (idempotent — no-op
    # if already paired, or if not an outflow).
    auto_paired = maybe_auto_pair(db, tx)

    # Mirror amount/date/description changes to the linked transfer pair
    if tx.transfer_pair_id and not auto_paired and ("amount" in payload or "date" in payload or "description" in payload):
        pair = db.query(Transaction).filter(Transaction.id == tx.transfer_pair_id).first()
        if pair:
            pair_old_amount = pair.amount
            pair_old_account_id = pair.account_id
            if "amount" in payload:
                # Pair leg has the opposite sign
                pair.amount = -tx.amount if (pair.amount > 0) != (tx.amount > 0) else tx.amount
            if "date" in payload:
                pair.date = tx.date
            if "description" in payload:
                pair.description = tx.description
            account_balance.on_update(db, pair, pair_old_amount, pair_old_account_id)

    db.commit()
    db.refresh(tx)

    # Return the updated transaction + info about auto-applied categorization
    response = {c.name: getattr(tx, c.name) for c in Transaction.__table__.columns}
    if learn_result:
        response["_learn"] = learn_result
    return response


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    tx = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(Transaction.id == tx_id, Account.profile_id.in_(pids))
        .first()
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # For linked transfers, delete the pair too
    pair_id = tx.transfer_pair_id
    account_balance.on_delete(db, tx)
    db.delete(tx)

    if pair_id:
        pair = db.query(Transaction).filter(Transaction.id == pair_id).first()
        if pair:
            account_balance.on_delete(db, pair)
            db.delete(pair)

    db.commit()


@router.post("/{tx_id}/split")
def split_transaction(
    tx_id: int,
    splits: List[SplitItem],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    tx = (
        db.query(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .filter(Transaction.id == tx_id, Account.profile_id.in_(pids))
        .first()
    )
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
