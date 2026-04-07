from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from backend.database import get_db

router = APIRouter()


@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    bank_profile: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    # TODO: implement CSV import with flexible parser
    return {"status": "not_implemented", "message": "CSV import coming in next milestone"}


@router.post("/ofx")
async def import_ofx(
    file: UploadFile = File(...),
    account_id: int = Form(...),
    db: Session = Depends(get_db),
):
    # TODO: implement OFX/QFX import
    return {"status": "not_implemented", "message": "OFX import coming in next milestone"}


@router.get("/export/csv")
def export_csv(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    # TODO: implement CSV export with filters
    return {"status": "not_implemented"}


@router.get("/export/json")
def export_json(
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    # TODO: implement JSON export with filters
    return {"status": "not_implemented"}
