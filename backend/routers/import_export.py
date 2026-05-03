import csv
import io
import json

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Optional

from backend.database import get_db
from backend.models.account import Account
from backend.models.category import Category
from backend.models.transaction import Transaction
from backend.services.csv_parser import parse_csv, list_profiles
from backend.services.ofx_parser import parse_ofx
from backend.services.duplicate_detector import find_duplicates, compute_import_hash
from backend.services.categorization import auto_categorize
from backend.services import account_balance

router = APIRouter()


def _create_imported_row(
    db: Session,
    source_account: Account,
    tx_data: dict,
    filename: str | None,
) -> tuple[list[Transaction], bool]:
    """
    Turn one parsed file row into database row(s).

    Returns (created_transactions, was_paired_transfer). When the row
    auto-categorizes into a transfer-category with a configured default
    destination — and the amount is an outflow from the source account —
    we materialize both legs of a linked transfer instead of a single row.
    """
    category_id = auto_categorize(db, tx_data["description"])
    amount = tx_data["amount"]
    currency = tx_data.get("currency", source_account.currency)

    # Auto-pair transfer? Only when outflow + category has a default destination.
    if category_id is not None and amount < 0:
        cat = db.query(Category).filter(Category.id == category_id).first()
        if (
            cat
            and cat.is_transfer_category
            and cat.default_transfer_account_id
            and cat.default_transfer_account_id != source_account.id
        ):
            dest_id = cat.default_transfer_account_id
            out_tx = Transaction(
                account_id=source_account.id,
                date=tx_data["date"],
                description=tx_data["description"],
                amount=amount,  # already negative
                currency=currency,
                category_id=category_id,
                is_transfer=True,
                import_hash=tx_data["import_hash"],
                source_file=filename,
            )
            db.add(out_tx)
            db.flush()
            in_tx = Transaction(
                account_id=dest_id,
                date=tx_data["date"],
                description=tx_data["description"],
                amount=-amount,  # flip sign for destination leg
                currency=currency,
                category_id=category_id,
                is_transfer=True,
                transfer_pair_id=out_tx.id,
                # No import_hash on the synthetic leg — dedup only applies to
                # rows that actually came from the file.
                source_file=filename,
            )
            db.add(in_tx)
            db.flush()
            out_tx.transfer_pair_id = in_tx.id
            return [out_tx, in_tx], True

    # Regular single-leg transaction
    db_tx = Transaction(
        account_id=source_account.id,
        date=tx_data["date"],
        description=tx_data["description"],
        amount=amount,
        currency=currency,
        category_id=category_id,
        import_hash=tx_data["import_hash"],
        source_file=filename,
    )
    db.add(db_tx)
    return [db_tx], False


@router.get("/profiles")
def get_bank_profiles():
    """List available bank CSV profiles."""
    return list_profiles()


@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    bank_profile: Optional[str] = Form(None),
    db: Session = Depends(get_db),

):
    """Import transactions from a CSV file."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        parsed = parse_csv(file_bytes, profile_name=bank_profile)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    new_txs, dup_txs = find_duplicates(db, account_id, parsed)

    created: list[Transaction] = []
    paired_count = 0
    for tx_data in new_txs:
        rows, was_paired = _create_imported_row(db, account, tx_data, file.filename)
        created.extend(rows)
        if was_paired:
            paired_count += 1

    db.flush()
    account_balance.on_bulk_create(db, created)
    db.commit()

    return {
        "imported": len(new_txs),
        "duplicates_skipped": len(dup_txs),
        "auto_categorized": sum(1 for tx in created if tx.category_id is not None and not (tx.is_transfer and tx.amount > 0)),
        "auto_transferred": paired_count,
        "filename": file.filename,
        "duplicates": dup_txs,
    }


@router.post("/ofx")
async def import_ofx(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    db: Session = Depends(get_db),

):
    """Import transactions from an OFX/QFX file."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        parsed = parse_ofx(file_bytes)
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse OFX: {e}")

    new_txs, dup_txs = find_duplicates(db, account_id, parsed)

    created: list[Transaction] = []
    paired_count = 0
    for tx_data in new_txs:
        rows, was_paired = _create_imported_row(db, account, tx_data, file.filename)
        created.extend(rows)
        if was_paired:
            paired_count += 1

    db.flush()
    account_balance.on_bulk_create(db, created)
    db.commit()

    return {
        "imported": len(new_txs),
        "duplicates_skipped": len(dup_txs),
        "auto_categorized": sum(1 for tx in created if tx.category_id is not None and not (tx.is_transfer and tx.amount > 0)),
        "auto_transferred": paired_count,
        "filename": file.filename,
        "duplicates": dup_txs,
    }


class ForceImportItem(BaseModel):
    date: str
    description: str
    amount: float
    currency: Optional[str] = None
    import_hash: Optional[str] = None


class ForceImportRequest(BaseModel):
    account_id: int
    filename: Optional[str] = None
    transactions: list[ForceImportItem]


@router.post("/force-import")
def force_import(body: ForceImportRequest, db: Session = Depends(get_db)):
    """
    Re-import a set of transactions the user explicitly confirmed, even though
    they matched existing rows by hash. Bypasses dedup entirely.
    """
    account = db.query(Account).filter(Account.id == body.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    created: list[Transaction] = []
    paired_count = 0
    for item in body.transactions:
        tx_data: dict[str, Any] = {
            "date": item.date,
            "description": item.description,
            "amount": item.amount,
            "currency": item.currency or account.currency,
            "import_hash": item.import_hash or compute_import_hash(
                item.date, item.amount, item.description
            ),
        }
        rows, was_paired = _create_imported_row(db, account, tx_data, body.filename)
        created.extend(rows)
        if was_paired:
            paired_count += 1

    db.flush()
    account_balance.on_bulk_create(db, created)
    db.commit()

    return {
        "imported": len(body.transactions),
        "auto_transferred": paired_count,
        "filename": body.filename,
    }


def _build_export_query(
    db: Session,
    account_id: Optional[int],
    category_id: Optional[int],
    date_from: Optional[str],
    date_to: Optional[str],
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
    return query.order_by(Transaction.date.desc()).all()


@router.get("/export/csv")
def export_csv(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),

):
    """Export transactions as CSV."""
    transactions = _build_export_query(db, account_id, category_id, date_from, date_to)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", "Amount", "Currency", "Account ID", "Category ID", "Notes"])
    for tx in transactions:
        writer.writerow([tx.date, tx.description, tx.amount, tx.currency, tx.account_id, tx.category_id, tx.notes or ""])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/export/json")
def export_json(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),

):
    """Export transactions as JSON."""
    transactions = _build_export_query(db, account_id, category_id, date_from, date_to)

    data = [
        {
            "id": tx.id,
            "date": tx.date,
            "description": tx.description,
            "amount": tx.amount,
            "currency": tx.currency,
            "account_id": tx.account_id,
            "category_id": tx.category_id,
            "is_transfer": tx.is_transfer,
            "notes": tx.notes,
        }
        for tx in transactions
    ]

    return StreamingResponse(
        iter([json.dumps(data, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=transactions.json"},
    )
