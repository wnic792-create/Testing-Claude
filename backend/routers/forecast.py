from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.forecast import (
    ForecastAssumptions, IncomeStream, RecurringExpense,
    OneOffEvent, DebtAccount, SavingsContribution,
)
from backend.services.forecast_engine import run_forecast, rollup_forecast
from backend.services.amortization import calculate_amortization
from backend.services.tax_engine import calculate_annual_tax, calculate_rrsp_tax_savings

router = APIRouter()


# --- Static routes (must be before /{scenario_id} to avoid path conflicts) ---

@router.get("/tools/tax-calc")
def tax_calculator(
    gross_income: float,
    income_type: str = "employment",
    year: str = "2025",
):
    """Standalone tax calculator."""
    return calculate_annual_tax(gross_income, income_type)


@router.get("/tools/rrsp-calc")
def rrsp_calculator(
    contribution: float,
    marginal_income: float,
):
    """Calculate RRSP contribution tax savings."""
    return calculate_rrsp_tax_savings(contribution, marginal_income)


@router.get("/compare")
def compare_scenarios(
    scenario_ids: str = "",
    granularity: str = "monthly",
    db: Session = Depends(get_db),
):
    """Run forecast for multiple scenarios, return side-by-side."""
    ids = [int(x) for x in scenario_ids.split(",") if x.strip()]
    results = []
    for sid in ids:
        try:
            forecast = run_forecast(db, sid)
            results.append(rollup_forecast(forecast, granularity))
        except ValueError as e:
            results.append({"scenario_id": sid, "error": str(e)})
    return results


@router.get("/{scenario_id}")
def get_forecast(
    scenario_id: int,
    granularity: str = "monthly",
    db: Session = Depends(get_db),
):
    """Run the 60-month forecast for a scenario."""
    try:
        forecast = run_forecast(db, scenario_id)
        return rollup_forecast(forecast, granularity)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{scenario_id}/amortization/{debt_id}")
def get_amortization_schedule(
    scenario_id: int,
    debt_id: int,
    db: Session = Depends(get_db),
):
    """Generate full amortization schedule for a debt."""
    debt = db.query(DebtAccount).filter(
        DebtAccount.id == debt_id,
        DebtAccount.scenario_id == scenario_id,
    ).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    return calculate_amortization(
        principal=debt.principal,
        annual_rate=debt.interest_rate,
        amortization_months=debt.amortization_months,
        term_months=debt.term_months,
        payment_frequency=debt.payment_frequency,
        extra_payment=debt.extra_payment,
    )


# --- Assumptions CRUD ---

class AssumptionsUpdate(BaseModel):
    inflation_rate: Optional[float] = None
    salary_growth_rate: Optional[float] = None
    investment_return_rate: Optional[float] = None
    tax_config_year: Optional[str] = None
    rrsp_room: Optional[float] = None
    tfsa_room: Optional[float] = None
    fhsa_room: Optional[float] = None
    fx_rate_cad_usd: Optional[float] = None


@router.get("/{scenario_id}/assumptions")
def get_assumptions(scenario_id: int, db: Session = Depends(get_db)):
    a = db.query(ForecastAssumptions).filter(
        ForecastAssumptions.scenario_id == scenario_id
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assumptions not found")
    return a


@router.patch("/{scenario_id}/assumptions")
def update_assumptions(scenario_id: int, updates: AssumptionsUpdate, db: Session = Depends(get_db)):
    a = db.query(ForecastAssumptions).filter(
        ForecastAssumptions.scenario_id == scenario_id
    ).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assumptions not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(a, key, value)
    db.commit()
    db.refresh(a)
    return a


# --- Income streams CRUD ---

class IncomeStreamCreate(BaseModel):
    name: str
    amount: float
    frequency: str = "monthly"
    start_month: int = 0
    end_month: Optional[int] = None
    growth_rate: Optional[float] = None
    income_type: str = "employment"
    account_id: Optional[int] = None


@router.get("/{scenario_id}/incomes")
def list_incomes(scenario_id: int, db: Session = Depends(get_db)):
    return db.query(IncomeStream).filter(IncomeStream.scenario_id == scenario_id).all()


@router.post("/{scenario_id}/incomes", status_code=201)
def create_income(scenario_id: int, data: IncomeStreamCreate, db: Session = Depends(get_db)):
    obj = IncomeStream(scenario_id=scenario_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{scenario_id}/incomes/{income_id}", status_code=204)
def delete_income(scenario_id: int, income_id: int, db: Session = Depends(get_db)):
    obj = db.query(IncomeStream).filter(IncomeStream.id == income_id, IncomeStream.scenario_id == scenario_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Income not found")
    db.delete(obj)
    db.commit()


# --- Recurring expenses CRUD ---

class RecurringExpenseCreate(BaseModel):
    name: str
    amount: float
    frequency: str = "monthly"
    category_id: Optional[int] = None
    start_month: int = 0
    end_month: Optional[int] = None
    inflation_adjusted: bool = True
    account_id: Optional[int] = None


@router.get("/{scenario_id}/expenses")
def list_expenses(scenario_id: int, db: Session = Depends(get_db)):
    return db.query(RecurringExpense).filter(RecurringExpense.scenario_id == scenario_id).all()


@router.post("/{scenario_id}/expenses", status_code=201)
def create_expense(scenario_id: int, data: RecurringExpenseCreate, db: Session = Depends(get_db)):
    obj = RecurringExpense(scenario_id=scenario_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{scenario_id}/expenses/{expense_id}", status_code=204)
def delete_expense(scenario_id: int, expense_id: int, db: Session = Depends(get_db)):
    obj = db.query(RecurringExpense).filter(RecurringExpense.id == expense_id, RecurringExpense.scenario_id == scenario_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(obj)
    db.commit()


# --- One-off events CRUD ---

class OneOffEventCreate(BaseModel):
    name: str
    amount: float
    month: int
    type: str = "expense"
    from_account_id: Optional[int] = None
    to_account_id: Optional[int] = None


@router.get("/{scenario_id}/events")
def list_events(scenario_id: int, db: Session = Depends(get_db)):
    return db.query(OneOffEvent).filter(OneOffEvent.scenario_id == scenario_id).all()


@router.post("/{scenario_id}/events", status_code=201)
def create_event(scenario_id: int, data: OneOffEventCreate, db: Session = Depends(get_db)):
    obj = OneOffEvent(scenario_id=scenario_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{scenario_id}/events/{event_id}", status_code=204)
def delete_event(scenario_id: int, event_id: int, db: Session = Depends(get_db)):
    obj = db.query(OneOffEvent).filter(OneOffEvent.id == event_id, OneOffEvent.scenario_id == scenario_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(obj)
    db.commit()


# --- Debt accounts CRUD ---

class DebtAccountCreate(BaseModel):
    account_id: int
    principal: float
    interest_rate: float
    term_months: int
    amortization_months: int
    payment_frequency: str = "monthly"
    start_month: int = 0
    extra_payment: float = 0.0


@router.get("/{scenario_id}/debts")
def list_debts(scenario_id: int, db: Session = Depends(get_db)):
    return db.query(DebtAccount).filter(DebtAccount.scenario_id == scenario_id).all()


@router.post("/{scenario_id}/debts", status_code=201)
def create_debt(scenario_id: int, data: DebtAccountCreate, db: Session = Depends(get_db)):
    obj = DebtAccount(scenario_id=scenario_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{scenario_id}/debts/{debt_id}", status_code=204)
def delete_debt(scenario_id: int, debt_id: int, db: Session = Depends(get_db)):
    obj = db.query(DebtAccount).filter(DebtAccount.id == debt_id, DebtAccount.scenario_id == scenario_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Debt not found")
    db.delete(obj)
    db.commit()


# --- Savings contributions CRUD ---

class SavingsContribCreate(BaseModel):
    account_id: int
    amount: float
    frequency: str = "monthly"
    start_month: int = 0
    end_month: Optional[int] = None


@router.get("/{scenario_id}/savings")
def list_savings(scenario_id: int, db: Session = Depends(get_db)):
    return db.query(SavingsContribution).filter(SavingsContribution.scenario_id == scenario_id).all()


@router.post("/{scenario_id}/savings", status_code=201)
def create_savings(scenario_id: int, data: SavingsContribCreate, db: Session = Depends(get_db)):
    obj = SavingsContribution(scenario_id=scenario_id, **data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{scenario_id}/savings/{savings_id}", status_code=204)
def delete_savings(scenario_id: int, savings_id: int, db: Session = Depends(get_db)):
    obj = db.query(SavingsContribution).filter(SavingsContribution.id == savings_id, SavingsContribution.scenario_id == scenario_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Savings contribution not found")
    db.delete(obj)
    db.commit()
