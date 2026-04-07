import hashlib

from sqlalchemy.orm import Session

from backend.models.transaction import Transaction


def compute_import_hash(date: str, amount: float, description: str) -> str:
    """Generate a SHA256 hash for deduplication."""
    raw = f"{date}|{amount:.2f}|{description.strip().lower()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def find_duplicates(
    db: Session,
    account_id: int,
    transactions: list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Split transactions into new and duplicate lists.

    Args:
        db: Database session.
        account_id: Target account ID.
        transactions: List of parsed transaction dicts (date, description, amount).

    Returns:
        Tuple of (new_transactions, duplicate_transactions).
    """
    # Compute hashes for all incoming transactions
    for tx in transactions:
        tx["import_hash"] = compute_import_hash(
            tx["date"], tx["amount"], tx["description"]
        )

    incoming_hashes = [tx["import_hash"] for tx in transactions]

    # Query existing hashes for this account in one batch
    existing_hashes = set(
        h[0] for h in db.query(Transaction.import_hash)
        .filter(
            Transaction.account_id == account_id,
            Transaction.import_hash.in_(incoming_hashes),
        )
        .all()
    )

    new_txs = []
    dup_txs = []
    for tx in transactions:
        if tx["import_hash"] in existing_hashes:
            dup_txs.append(tx)
        else:
            new_txs.append(tx)
            # Also track within the batch to catch intra-file duplicates
            existing_hashes.add(tx["import_hash"])

    return new_txs, dup_txs
