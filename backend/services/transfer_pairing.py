"""
Convert existing single-leg transactions into linked transfer pairs.

Used in two places:
  1. After a user changes a transaction's category to a transfer-category
     that has a default destination — the existing tx becomes the outflow leg
     and we materialize a matching inflow leg in the destination account.
  2. Bulk backfill: when the user first sets up a transfer-category's default
     destination, run this against every existing transaction in that category
     to retroactively pair them up.

The source account's balance is left alone (it already has the outflow delta);
only the destination account gets a new credit.
"""
from sqlalchemy.orm import Session

from backend.models.category import Category
from backend.models.transaction import Transaction
from backend.services import account_balance


def convert_to_transfer(db: Session, tx: Transaction, dest_account_id: int) -> bool:
    """
    Promote a single-leg outflow transaction into a transfer pair.
    Returns True if conversion happened, False if it was a no-op.
    """
    if tx.transfer_pair_id is not None:
        return False  # already paired
    if tx.parent_tx_id is not None:
        return False  # split child — the parent is the real movement
    if tx.amount >= 0:
        return False  # not an outflow; direction would be ambiguous
    if tx.account_id == dest_account_id:
        return False  # can't transfer to self

    in_tx = Transaction(
        account_id=dest_account_id,
        date=tx.date,
        description=tx.description,
        amount=-tx.amount,        # flip sign for the destination leg
        currency=tx.currency,
        category_id=tx.category_id,
        is_transfer=True,
        transfer_pair_id=tx.id,
        source_file=tx.source_file,
    )
    db.add(in_tx)
    db.flush()

    # Promote the existing tx to a transfer too and link the pair
    tx.is_transfer = True
    tx.transfer_pair_id = in_tx.id

    # The source account balance already reflects this outflow (it was applied
    # when the tx was first created). Only the destination needs crediting.
    account_balance.apply_delta(db, dest_account_id, in_tx.amount)
    return True


def maybe_auto_pair(db: Session, tx: Transaction) -> bool:
    """
    If `tx` is now categorized into a transfer-category with a configured
    default destination, convert it into a transfer pair. No-op otherwise.
    """
    if tx.category_id is None:
        return False
    cat = db.query(Category).filter(Category.id == tx.category_id).first()
    if not cat or not cat.is_transfer_category or not cat.default_transfer_account_id:
        return False
    return convert_to_transfer(db, tx, cat.default_transfer_account_id)


def backfill_transfers_for_category(db: Session, category_id: int) -> int:
    """
    Convert every eligible single-leg outflow currently in `category_id` into
    a transfer pair using the category's configured default destination.
    Returns the number of transactions converted.
    """
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat or not cat.is_transfer_category or not cat.default_transfer_account_id:
        return 0

    candidates = (
        db.query(Transaction)
        .filter(
            Transaction.category_id == category_id,
            Transaction.transfer_pair_id.is_(None),
            Transaction.parent_tx_id.is_(None),
            Transaction.amount < 0,
        )
        .all()
    )

    converted = 0
    for tx in candidates:
        if convert_to_transfer(db, tx, cat.default_transfer_account_id):
            converted += 1
    return converted
