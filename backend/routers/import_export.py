import csv
import io
import json

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models.account import Account
from backend.models.transaction import Transaction
from backend.services.csv_parser import parse_csv, list_profiles
from backend.services.ofx_parser import parse_ofx
from backend.services.duplicate_detector import find_duplicates, compute_import_hash
from backend.services.categorization import auto_categorize
from backend.services import account_balance

router = APIRouter()


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

    created = []
    for tx_data in new_txs:
        category_id = auto_categorize(db, tx_data["description"])
        db_tx = Transaction(
            account_id=account_id,
            date=tx_data["date"],
            description=tx_data["description"],
            amount=tx_data["amount"],
            currency=tx_data.get("currency", account.currency),
            category_id=category_id,
            import_hash=tx_data["import_hash"],
            source_file=file.filename,
        )
        db.add(db_tx)
        created.append(db_tx)

    db.flush()
    account_balance.on_bulk_create(db, created)
    db.commit()

    return {
        "imported": len(created),
        "duplicates_skipped": len(dup_txs),
        "auto_categorized": sum(1 for tx in created if tx.category_id is not None),
        "filename": file.filename,
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

    created = []
    for tx_data in new_txs:
        category_id = auto_categorize(db, tx_data["description"])
        db_tx = Transaction(
            account_id=account_id,
            date=tx_data["date"],
            description=tx_data["description"],
            amount=tx_data["amount"],
            currency=tx_data.get("currency", account.currency),
            category_id=category_id,
            import_hash=tx_data["import_hash"],
            source_file=file.filename,
        )
        db.add(db_tx)
        created.append(db_tx)

    db.flush()
    account_balance.on_bulk_create(db, created)
    db.commit()

    return {
        "imported": len(created),
        "duplicates_skipped": len(dup_txs),
        "auto_categorized": sum(1 for tx in created if tx.category_id is not None),
        "filename": file.filename,
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
