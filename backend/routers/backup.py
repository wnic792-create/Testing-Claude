import json
import os
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.database import get_db, DB_PATH

router = APIRouter()


@router.get("/export")
def export_database():
    """Download the entire SQLite database file."""
    if not os.path.exists(DB_PATH):
        return {"error": "Database file not found"}
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        DB_PATH,
        media_type="application/octet-stream",
        filename=f"finance_backup_{timestamp}.db",
    )


@router.post("/import")
async def import_database(file: UploadFile = File(...)):
    """Replace the database with an uploaded backup file."""
    backup_path = DB_PATH + ".bak"
    # Save current as backup
    if os.path.exists(DB_PATH):
        os.rename(DB_PATH, backup_path)
    try:
        content = await file.read()
        with open(DB_PATH, "wb") as f:
            f.write(content)
        return {"status": "ok", "message": "Database restored. Restart the server to apply changes."}
    except Exception as e:
        # Restore backup on failure
        if os.path.exists(backup_path):
            os.rename(backup_path, DB_PATH)
        return {"status": "error", "message": str(e)}
