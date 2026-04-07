from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional, List
from backend.database import get_db

router = APIRouter()


@router.get("/compare")
def compare_scenarios(
    scenario_ids: str = "",  # comma-separated
    db: Session = Depends(get_db),
):
    # TODO: run forecast for multiple scenarios, return side-by-side
    ids = [int(x) for x in scenario_ids.split(",") if x.strip()]
    return {"status": "not_implemented", "scenario_ids": ids}


@router.get("/{scenario_id}")
def get_forecast(
    scenario_id: int,
    granularity: str = "monthly",  # monthly | quarterly | yearly
    db: Session = Depends(get_db),
):
    # TODO: run forecast engine for scenario
    return {"status": "not_implemented", "scenario_id": scenario_id, "granularity": granularity}


@router.get("/{scenario_id}/amortization/{debt_id}")
def get_amortization_schedule(
    scenario_id: int,
    debt_id: int,
    db: Session = Depends(get_db),
):
    # TODO: generate amortization schedule
    return {"status": "not_implemented"}
