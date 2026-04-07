import io
from typing import Optional

try:
    from ofxparse import OfxParser
    HAS_OFX = True
except ImportError:
    HAS_OFX = False


def parse_ofx(file_bytes: bytes) -> list[dict]:
    """
    Parse an OFX/QFX file into standardized transaction dicts.

    Returns:
        List of dicts with keys: date, description, amount, currency, ofx_id, ofx_type.
    """
    if not HAS_OFX:
        raise ImportError("ofxparse is not installed. Install it with: pip install ofxparse")

    ofx = OfxParser.parse(io.BytesIO(file_bytes))

    transactions = []
    for account in ofx.accounts:
        currency = getattr(account.statement, "currency", "CAD") or "CAD"
        for tx in account.statement.transactions:
            transactions.append({
                "date": tx.date.strftime("%Y-%m-%d"),
                "description": (tx.payee or tx.memo or "Unknown").strip(),
                "amount": float(tx.amount),
                "currency": currency.upper(),
                "ofx_id": tx.id,
                "ofx_type": tx.type,
            })

    return transactions
