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
        Tuple of (new_transactions, duplicate_items). Each duplicate item is
        a dict {"incoming": <parsed row>, "existing": <existing row summary>}
        so the UI can show "you're about to re-import X, which matches Y".
    """
    # Compute hashes for all incoming transactions
    for tx in transactions:
        tx["import_hash"] = compute_import_hash(
            tx["date"], tx["amount"], tx["description"]
        )

    incoming_hashes = [tx["import_hash"] for tx in transactions]

    # Fetch existing rows (not just hashes) so we can describe the match
    existing_rows = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.import_hash.in_(incoming_hashes),
        )
        .all()
    )
    existing_by_hash: dict[str, Transaction] = {r.import_hash: r for r in existing_rows}

    new_txs: list[dict] = []
    dup_items: list[dict] = []
    seen_in_batch: set[str] = set()
    for tx in transactions:
        h = tx["import_hash"]
        if h in existing_by_hash:
            e = existing_by_hash[h]
            dup_items.append({
                "incoming": tx,
                "existing": {
                    "id": e.id,
                    "date": e.date,
                    "description": e.description,
                    "amount": e.amount,
                    "currency": e.currency,
                    "category_id": e.category_id,
                },
            })
        elif h in seen_in_batch:
            # Intra-file duplicate — flag it but we don't have an existing row
            dup_items.append({
                "incoming": tx,
                "existing": None,
            })
        else:
            new_txs.append(tx)
            seen_in_batch.add(h)

    return new_txs, dup_items
