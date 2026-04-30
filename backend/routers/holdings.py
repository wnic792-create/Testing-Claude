import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.holding import Holding
from backend.models.user import User
from backend.dependencies import get_current_user, get_user_profile_ids
from backend.services.fund_data import (
    lookup_fund, search_funds, FUND_DATABASE,
    REGION_LABELS, REGION_COLORS, SECTOR_LABELS,
)

router = APIRouter()


class HoldingCreate(BaseModel):
    account_id: int
    profile_id: int = 1
    name: str
    ticker: Optional[str] = None
    fund_code: Optional[str] = None
    units: float = 0
    price_per_unit: float = 0
    market_value: float = 0
    book_value: Optional[float] = None
    asset_class: str = "equity"
    region: Optional[str] = None
    allocation_json: Optional[str] = None
    notes: Optional[str] = None


class HoldingUpdate(BaseModel):
    name: Optional[str] = None
    ticker: Optional[str] = None
    fund_code: Optional[str] = None
    units: Optional[float] = None
    price_per_unit: Optional[float] = None
    market_value: Optional[float] = None
    book_value: Optional[float] = None
    asset_class: Optional[str] = None
    region: Optional[str] = None
    allocation_json: Optional[str] = None
    notes: Optional[str] = None


# ── Static paths MUST come before /{holding_id} ──────────────────────

@router.get("/")
def list_holdings(
    profile_id: Optional[int] = None,
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    query = db.query(Holding).filter(Holding.profile_id.in_(pids))
    if profile_id is not None:
        if profile_id not in pids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Holding.profile_id == profile_id)
    if account_id is not None:
        query = query.filter(Holding.account_id == account_id)
    return query.all()


@router.post("/", status_code=201)
def create_holding(
    data: HoldingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    if data.profile_id not in pids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")
    if data.fund_code and not data.allocation_json:
        fund = lookup_fund(data.fund_code)
        if fund:
            data.allocation_json = json.dumps(fund["allocation"])
    h = Holding(**data.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.get("/lookthrough")
def portfolio_lookthrough(
    profile_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    query = db.query(Holding).filter(Holding.profile_id.in_(pids))
    if profile_id is not None:
        if profile_id not in pids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Holding.profile_id == profile_id)
    holdings = query.all()

    total_value = sum(h.market_value for h in holdings)
    if total_value == 0:
        return {"total_value": 0, "region_allocation": {}, "sector_allocation": {}}

    region_totals: dict[str, float] = {}
    sector_totals: dict[str, float] = {}

    for h in holdings:
        weight = h.market_value / total_value if total_value > 0 else 0
        alloc = None
        sectors = None

        if h.allocation_json:
            try:
                alloc = json.loads(h.allocation_json)
            except json.JSONDecodeError:
                pass

        if not alloc and h.fund_code:
            fund = lookup_fund(h.fund_code)
            if fund:
                alloc = fund.get("allocation")
                sectors = fund.get("top_sectors")

        if not alloc and h.ticker:
            fund = lookup_fund(h.ticker)
            if fund:
                alloc = fund.get("allocation")
                sectors = fund.get("top_sectors")

        if alloc:
            for region, pct in alloc.items():
                region_totals[region] = region_totals.get(region, 0) + weight * pct
        else:
            region_key = h.region or _guess_region(h.asset_class)
            region_totals[region_key] = region_totals.get(region_key, 0) + weight * 100

        if sectors:
            for sector, pct in sectors.items():
                sector_totals[sector] = sector_totals.get(sector, 0) + weight * pct

    return {
        "total_value": total_value,
        "region_allocation": {
            k: round(v, 2) for k, v in sorted(region_totals.items(), key=lambda x: -x[1])
        },
        "sector_allocation": {
            k: round(v, 2) for k, v in sorted(sector_totals.items(), key=lambda x: -x[1])
        },
        "region_labels": REGION_LABELS,
        "region_colors": REGION_COLORS,
        "sector_labels": SECTOR_LABELS,
    }


@router.get("/funds")
def list_all_funds(user: User = Depends(get_current_user)):
    return [{"code": code, **data} for code, data in FUND_DATABASE.items()]


@router.get("/funds/search")
def search_fund_db(q: str = "", user: User = Depends(get_current_user)):
    return search_funds(q)


@router.get("/funds/{code}")
def get_fund_info(code: str, user: User = Depends(get_current_user)):
    fund = lookup_fund(code)
    if not fund:
        raise HTTPException(404, "Fund not found in database")
    return {"code": code.upper(), **fund}


# ── Parameterized paths ──────────────────────────────────────────────

@router.patch("/{holding_id}")
def update_holding(
    holding_id: int,
    data: HoldingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    h = db.query(Holding).filter(Holding.id == holding_id, Holding.profile_id.in_(pids)).first()
    if not h:
        raise HTTPException(404, "Holding not found")
    updates = data.model_dump(exclude_unset=True)
    if "fund_code" in updates and updates["fund_code"] and "allocation_json" not in updates:
        fund = lookup_fund(updates["fund_code"])
        if fund:
            updates["allocation_json"] = json.dumps(fund["allocation"])
    for k, v in updates.items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{holding_id}", status_code=204)
def delete_holding(
    holding_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    h = db.query(Holding).filter(Holding.id == holding_id, Holding.profile_id.in_(pids)).first()
    if not h:
        raise HTTPException(404, "Holding not found")
    db.delete(h)
    db.commit()


def _guess_region(asset_class: str) -> str:
    mapping = {
        "equity": "us_equity",
        "cad_equity": "cad_equity",
        "us_equity": "us_equity",
        "intl_equity": "intl_developed_equity",
        "bonds": "cad_bonds",
        "cash": "cash",
        "real_estate": "cad_equity",
        "crypto": "us_equity",
    }
    return mapping.get(asset_class, "us_equity")
