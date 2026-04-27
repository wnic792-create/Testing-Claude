"""Net worth snapshot service — records point-in-time net worth."""

import json
from datetime import date

from sqlalchemy.orm import Session
from backend.models.account import Account
from backend.models.snapshot import NetWorthSnapshot


def take_snapshot(db: Session, profile_id: int | None = None) -> NetWorthSnapshot:
    """Take a net worth snapshot with per-account breakdown."""
    query = db.query(Account)
    if profile_id is not None:
        query = query.filter(Account.profile_id == profile_id)
    accounts = query.all()

    total_assets = 0.0
    total_liabilities = 0.0
    breakdown = {}

    for a in accounts:
        breakdown[a.name] = {
            "id": a.id,
            "type": a.type,
            "balance": a.current_balance,
            "currency": a.currency,
        }
        if a.is_asset:
            total_assets += a.current_balance
        else:
            total_liabilities += abs(a.current_balance)

    snapshot = NetWorthSnapshot(
        profile_id=profile_id,
        date=date.today().isoformat(),
        total_assets=round(total_assets, 2),
        total_liabilities=round(total_liabilities, 2),
        net_worth=round(total_assets - total_liabilities, 2),
        breakdown=json.dumps(breakdown),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_snapshot_history(db: Session, profile_id: int | None = None) -> list[dict]:
    """Get all snapshots ordered by date."""
    query = db.query(NetWorthSnapshot)
    if profile_id is not None:
        query = query.filter(NetWorthSnapshot.profile_id == profile_id)
    snapshots = query.order_by(NetWorthSnapshot.date.asc()).all()
    return [
        {
            "id": s.id,
            "date": s.date,
            "total_assets": s.total_assets,
            "total_liabilities": s.total_liabilities,
            "net_worth": s.net_worth,
            "breakdown": json.loads(s.breakdown) if s.breakdown else {},
        }
        for s in snapshots
    ]
