import re
from sqlalchemy.orm import Session

from backend.models.category import Category, CategorizationRule
from backend.models.transaction import Transaction


def auto_categorize(db: Session, description: str) -> int | None:
    """
    Try to match a transaction description against categorization rules.
    Returns category_id if matched, None otherwise.

    Rules are checked in descending priority order.
    """
    rules = (
        db.query(CategorizationRule)
        .order_by(CategorizationRule.priority.desc())
        .all()
    )

    description_lower = description.lower()

    for rule in rules:
        try:
            if re.search(rule.pattern, description_lower, re.IGNORECASE):
                # Increment match count
                rule.match_count += 1
                db.flush()
                return rule.category_id
        except re.error:
            continue

    return None


def categorize_batch(db: Session, transactions: list[Transaction]) -> int:
    """
    Apply auto-categorization to a batch of uncategorized transactions.
    Returns count of successfully categorized transactions.
    """
    rules = (
        db.query(CategorizationRule)
        .order_by(CategorizationRule.priority.desc())
        .all()
    )

    categorized = 0
    for tx in transactions:
        if tx.category_id is not None:
            continue

        description_lower = tx.description.lower()
        for rule in rules:
            try:
                if re.search(rule.pattern, description_lower, re.IGNORECASE):
                    tx.category_id = rule.category_id
                    rule.match_count += 1
                    categorized += 1
                    break
            except re.error:
                continue

    db.flush()
    return categorized


def learn_from_correction(
    db: Session,
    transaction_id: int,
    new_category_id: int,
) -> CategorizationRule | None:
    """
    When a user manually recategorizes a transaction, learn from it.
    Creates or updates a categorization rule based on the merchant name.

    Strategy: extract a normalized merchant name from the description,
    create a regex rule, and mark it as 'learned'.
    """
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        return None

    # Update the transaction's category
    old_category_id = tx.category_id
    tx.category_id = new_category_id

    # Normalize the merchant name for pattern creation
    merchant = _normalize_merchant(tx.description)
    if not merchant or len(merchant) < 3:
        db.flush()
        return None

    # Escape regex special characters and create a case-insensitive pattern
    pattern = re.escape(merchant)

    # Check if a rule already exists for this pattern
    existing = (
        db.query(CategorizationRule)
        .filter(CategorizationRule.pattern == pattern)
        .first()
    )

    if existing:
        # Update existing rule to new category
        existing.category_id = new_category_id
        existing.match_count += 1
        db.flush()
        return existing

    # Create new learned rule
    rule = CategorizationRule(
        pattern=pattern,
        category_id=new_category_id,
        priority=10,  # learned rules get medium priority
        source="learned",
        match_count=1,
    )
    db.add(rule)
    db.flush()
    return rule


def _normalize_merchant(description: str) -> str:
    """
    Extract a stable merchant identifier from a transaction description.
    Strips dates, transaction numbers, trailing digits, etc.
    """
    text = description.strip()

    # Remove common prefixes (POS, INTERAC, VISA, etc.)
    prefixes = [
        r"^(POS|INTERAC|VISA|MC|MASTERCARD|DEBIT|CREDIT|CHQ|CHEQUE|PURCHASE)\s*[-/]?\s*",
        r"^(PAIEMENT|ACHAT|RETRAIT|VIREMENT)\s*[-/]?\s*",
    ]
    for prefix in prefixes:
        text = re.sub(prefix, "", text, flags=re.IGNORECASE)

    # Remove trailing numbers (reference numbers, dates)
    text = re.sub(r"\s+\d{4,}.*$", "", text)
    # Remove trailing date patterns
    text = re.sub(r"\s+\d{2}[/-]\d{2}([/-]\d{2,4})?$", "", text)
    # Remove city/province suffixes common in Canadian bank statements
    text = re.sub(r"\s+(QC|ON|BC|AB|MB|SK|NB|NS|PE|NL|NT|NU|YT|CA|CAN)\s*$", "", text, flags=re.IGNORECASE)

    return text.strip()


def detect_transfers(db: Session, account_ids: list[int], date: str, amount: float) -> list[Transaction]:
    """
    Find potential transfer counterparts: same date, opposite amount,
    in one of the user's other accounts.
    """
    return (
        db.query(Transaction)
        .filter(
            Transaction.account_id.in_(account_ids),
            Transaction.date == date,
            Transaction.amount == -amount,
            Transaction.is_transfer == False,
        )
        .all()
    )
