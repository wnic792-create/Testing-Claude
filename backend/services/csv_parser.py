import csv
import io
import json
import os
from datetime import datetime
from typing import Optional

import chardet

TEMPLATES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "seed", "bank_csv_templates.json"
)


def load_templates() -> dict:
    with open(TEMPLATES_PATH, "r") as f:
        templates = json.load(f)
    return {k: v for k, v in templates.items() if not k.startswith("_")}


def get_template(profile_name: str) -> dict:
    templates = load_templates()
    if profile_name not in templates:
        raise ValueError(f"Unknown bank profile: {profile_name}. Available: {list(templates.keys())}")
    return templates[profile_name]


def detect_encoding(raw_bytes: bytes) -> str:
    result = chardet.detect(raw_bytes)
    encoding = result.get("encoding", "utf-8") or "utf-8"
    # Normalize common aliases
    encoding = encoding.lower()
    if encoding in ("iso-8859-1", "latin-1", "latin1"):
        encoding = "latin-1"
    elif encoding in ("windows-1252", "cp1252"):
        encoding = "windows-1252"
    return encoding


def parse_csv(
    file_bytes: bytes,
    profile_name: Optional[str] = None,
    custom_mapping: Optional[dict] = None,
) -> list[dict]:
    """
    Parse a bank CSV file into standardized transaction dicts.

    Args:
        file_bytes: Raw bytes of the CSV file.
        profile_name: Name of a bank profile from bank_csv_templates.json.
        custom_mapping: Optional override mapping (same structure as template).

    Returns:
        List of dicts with keys: date, description, amount, currency.
    """
    if profile_name:
        template = get_template(profile_name)
    elif custom_mapping:
        template = custom_mapping
    else:
        raise ValueError("Either profile_name or custom_mapping is required")

    encoding = detect_encoding(file_bytes)
    text = file_bytes.decode(encoding)

    # Handle BOM
    if text.startswith("\ufeff"):
        text = text[1:]

    delimiter = template.get("delimiter", ",")
    skip_rows = template.get("skip_rows", 0)
    columns = template["columns"]
    date_format = template["date_format"]
    invert_sign = template.get("invert_sign", False)

    reader = csv.DictReader(
        io.StringIO(text),
        delimiter=delimiter,
    )

    # Skip header rows if needed
    rows = list(reader)
    if skip_rows > 0:
        rows = rows[skip_rows:]

    transactions = []
    for row in rows:
        # Parse date
        date_col = columns.get("date", "Date")
        raw_date = row.get(date_col, "").strip()
        if not raw_date:
            continue
        try:
            parsed_date = datetime.strptime(raw_date, date_format).strftime("%Y-%m-%d")
        except ValueError:
            # Try ISO format as fallback
            try:
                parsed_date = datetime.strptime(raw_date, "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                continue

        # Parse description (merge description + description_2)
        desc_col = columns.get("description", "Description")
        desc2_col = columns.get("description_2")
        description = row.get(desc_col, "").strip()
        if desc2_col and row.get(desc2_col, "").strip():
            description = f"{description} - {row[desc2_col].strip()}"
        description = description or "Unknown"

        # Parse amount
        amount = _parse_amount(row, columns, invert_sign)
        if amount is None:
            continue

        transactions.append({
            "date": parsed_date,
            "description": description,
            "amount": amount,
            "currency": "CAD",
        })

    return transactions


def _parse_amount(row: dict, columns: dict, invert_sign: bool) -> Optional[float]:
    """Parse amount from row based on column mapping."""
    amount_handling = columns

    # Case 1: Single "amount" column
    if columns.get("amount"):
        raw = row.get(columns["amount"], "").strip()
        if not raw:
            return None
        amount = _clean_number(raw)
        if invert_sign:
            amount = -amount
        return amount

    # Case 2: Single signed column (debit column, no credit column)
    if columns.get("amount_debit") and not columns.get("amount_credit"):
        raw = row.get(columns["amount_debit"], "").strip()
        if not raw:
            return None
        amount = _clean_number(raw)
        if invert_sign:
            amount = -amount
        return amount

    # Case 3: Separate debit and credit columns
    if columns.get("amount_debit") and columns.get("amount_credit"):
        debit_raw = row.get(columns["amount_debit"], "").strip()
        credit_raw = row.get(columns["amount_credit"], "").strip()
        if credit_raw:
            return abs(_clean_number(credit_raw))
        elif debit_raw:
            return -abs(_clean_number(debit_raw))
        return None

    return None


def _clean_number(s: str) -> float:
    """Clean a number string: remove $, spaces, commas."""
    s = s.replace("$", "").replace(" ", "").replace(",", "").strip()
    # Handle parentheses as negative: (100.00) -> -100.00
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    return float(s)


def list_profiles() -> list[dict]:
    """Return available bank profiles with their names."""
    templates = load_templates()
    return [
        {"id": k, "name": v.get("name", k), "institution": v.get("institution", "")}
        for k, v in templates.items()
    ]
