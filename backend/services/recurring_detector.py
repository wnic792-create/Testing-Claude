"""
Recurring transaction detection.

Strategy: group transactions by normalized merchant name, then check if
amounts are within ±5% and intervals cluster around 7/14/30/365 days.
Returns candidates for user confirmation.
"""

import re
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from backend.models.transaction import Transaction


def detect_recurring(db: Session, account_id: int | None = None) -> list[dict]:
    """
    Detect potential recurring transactions (subscriptions).

    Returns a list of candidate recurring patterns:
    {merchant, avg_amount, frequency_days, count, last_date, transactions}
    """
    query = db.query(Transaction).filter(
        Transaction.is_transfer == False,
        Transaction.parent_tx_id == None,
        Transaction.amount < 0,  # expenses only
    )
    if account_id:
        query = query.filter(Transaction.account_id == account_id)

    txs = query.order_by(Transaction.date.asc()).all()

    # Group by normalized merchant
    groups: dict[str, list[Transaction]] = defaultdict(list)
    for tx in txs:
        key = _normalize_merchant(tx.description)
        if key and len(key) >= 3:
            groups[key].append(tx)

    candidates = []
    for merchant, merchant_txs in groups.items():
        if len(merchant_txs) < 3:
            continue

        # Check amount consistency (within ±5%)
        amounts = [abs(tx.amount) for tx in merchant_txs]
        avg_amount = sum(amounts) / len(amounts)
        if avg_amount == 0:
            continue

        consistent = all(
            abs(a - avg_amount) / avg_amount <= 0.05 for a in amounts
        )
        if not consistent:
            continue

        # Check interval consistency
        dates = sorted(
            datetime.strptime(tx.date, "%Y-%m-%d") for tx in merchant_txs
        )
        intervals = [
            (dates[i + 1] - dates[i]).days
            for i in range(len(dates) - 1)
        ]

        if not intervals:
            continue

        avg_interval = sum(intervals) / len(intervals)

        # Match to known frequencies (±3 day tolerance)
        frequency = _match_frequency(avg_interval)
        if not frequency:
            continue

        candidates.append({
            "merchant": merchant,
            "avg_amount": round(avg_amount, 2),
            "frequency_days": round(avg_interval, 1),
            "frequency_label": frequency,
            "count": len(merchant_txs),
            "last_date": max(tx.date for tx in merchant_txs),
            "transaction_ids": [tx.id for tx in merchant_txs[-5:]],
        })

    # Sort by confidence (more occurrences = more confident)
    candidates.sort(key=lambda x: x["count"], reverse=True)
    return candidates


def _match_frequency(avg_days: float) -> str | None:
    """Match average interval to a known frequency."""
    tolerances = [
        (7, 3, "Weekly"),
        (14, 3, "Biweekly"),
        (30, 5, "Monthly"),
        (90, 10, "Quarterly"),
        (365, 20, "Annual"),
    ]
    for target, tolerance, label in tolerances:
        if abs(avg_days - target) <= tolerance:
            return label
    return None


def _normalize_merchant(description: str) -> str:
    """Normalize merchant name for grouping."""
    text = description.strip().lower()
    # Remove common prefixes
    text = re.sub(
        r"^(pos|interac|visa|mc|mastercard|debit|credit|purchase|paiement|achat)\s*[-/]?\s*",
        "", text, flags=re.IGNORECASE,
    )
    # Remove trailing numbers/dates
    text = re.sub(r"\s+\d{4,}.*$", "", text)
    text = re.sub(r"\s+\d{2}[/-]\d{2}([/-]\d{2,4})?$", "", text)
    # Remove city/province
    text = re.sub(
        r"\s+(qc|on|bc|ab|mb|sk|nb|ns|pe|nl|nt|nu|yt|ca|can)\s*$",
        "", text, flags=re.IGNORECASE,
    )
    return text.strip()
