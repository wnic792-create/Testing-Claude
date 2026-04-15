"""
Keep `Account.current_balance` in sync with transaction activity.

Contract: the value the user enters when creating an account is the *opening*
balance. Every non-split-child transaction then adjusts it by its signed amount
(positive = inflow, negative = outflow). Split children are ignored because
their parent already counted.
"""
from sqlalchemy.orm import Session

from backend.models.account import Account
from backend.models.transaction import Transaction


def _counts_toward_balance(tx: Transaction) -> bool:
    # Split children roll up through their parent, which already moved the balance.
    return tx.parent_tx_id is None


def apply_delta(db: Session, account_id: int, delta: float) -> None:
    """Add `delta` to the account's current_balance (no-op if not found)."""
    if delta == 0:
        return
    account = db.query(Account).filter(Account.id == account_id).first()
    if account is None:
        return
    account.current_balance = (account.current_balance or 0) + delta
    db.flush()


def on_create(db: Session, tx: Transaction) -> None:
    """Called after a transaction row has been added."""
    if _counts_toward_balance(tx):
        apply_delta(db, tx.account_id, tx.amount)


def on_update(
    db: Session,
    tx: Transaction,
    old_amount: float,
    old_account_id: int,
) -> None:
    """
    Called after a transaction's fields have been mutated but before commit.
    Handles amount change and (future) account reassignment.
    """
    if not _counts_toward_balance(tx):
        return
    if old_account_id != tx.account_id:
        apply_delta(db, old_account_id, -old_amount)
        apply_delta(db, tx.account_id, tx.amount)
        return
    diff = tx.amount - old_amount
    if diff:
        apply_delta(db, tx.account_id, diff)


def on_delete(db: Session, tx: Transaction) -> None:
    """Called before a transaction is deleted."""
    if _counts_toward_balance(tx):
        apply_delta(db, tx.account_id, -tx.amount)


def on_bulk_create(db: Session, transactions: list[Transaction]) -> None:
    """Apply deltas for a batch of newly created transactions, grouped by account."""
    by_account: dict[int, float] = {}
    for tx in transactions:
        if not _counts_toward_balance(tx):
            continue
        by_account[tx.account_id] = by_account.get(tx.account_id, 0.0) + tx.amount
    for account_id, delta in by_account.items():
        apply_delta(db, account_id, delta)


def on_bulk_delete(db: Session, transactions: list[Transaction]) -> None:
    """Apply deltas for a batch of transactions about to be deleted."""
    by_account: dict[int, float] = {}
    for tx in transactions:
        if not _counts_toward_balance(tx):
            continue
        by_account[tx.account_id] = by_account.get(tx.account_id, 0.0) - tx.amount
    for account_id, delta in by_account.items():
        apply_delta(db, account_id, delta)


def rebase_from_transactions(db: Session, account_id: int, opening_balance: float) -> float:
    """
    Admin helper: reset an account so `current_balance = opening_balance + sum(txs)`.
    Useful when balances have drifted (e.g. existing data before the delta hooks
    were wired up). Returns the newly stored balance.
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    if account is None:
        return 0.0
    posted = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.parent_tx_id.is_(None),
        )
        .all()
    )
    account.current_balance = opening_balance + sum(tx.amount for tx in posted)
    db.flush()
    return account.current_balance
