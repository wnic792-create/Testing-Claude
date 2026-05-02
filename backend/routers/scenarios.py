from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.scenario import Scenario, StressTestPreset
from backend.models.forecast import (
    ForecastAssumptions, IncomeStream, RecurringExpense,
    OneOffEvent, DebtAccount, CreditCardDebt, SavingsContribution,
    EmployerRRSPMatch,
)
from backend.models.user import User
from backend.dependencies import get_current_user, get_user_profile_ids

router = APIRouter()


class ScenarioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#3B82F6"
    profile_id: Optional[int] = None


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


@router.get("/")
def list_scenarios(
    profile_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    query = db.query(Scenario).filter(Scenario.profile_id.in_(pids))
    if profile_id is not None and profile_id in pids:
        query = query.filter(Scenario.profile_id == profile_id)
    return query.all()


@router.get("/presets/stress-tests")
def list_stress_test_presets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.query(StressTestPreset).all()


@router.post("/", status_code=201)
def create_scenario(
    scenario: ScenarioCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    if not scenario.profile_id or scenario.profile_id not in pids:
        scenario.profile_id = pids[0]
    db_scenario = Scenario(**scenario.model_dump())
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    # Create default assumptions
    assumptions = ForecastAssumptions(scenario_id=db_scenario.id)
    db.add(assumptions)
    db.commit()
    return db_scenario


@router.get("/{scenario_id}")
def get_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.profile_id.in_(pids)).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.patch("/{scenario_id}")
def update_scenario(
    scenario_id: int,
    updates: ScenarioUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.profile_id.in_(pids)).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(scenario, key, value)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}", status_code=204)
def delete_scenario(
    scenario_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.profile_id.in_(pids)).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    # Cascade delete all related forecast data
    db.query(ForecastAssumptions).filter(ForecastAssumptions.scenario_id == scenario_id).delete()
    db.query(IncomeStream).filter(IncomeStream.scenario_id == scenario_id).delete()
    db.query(RecurringExpense).filter(RecurringExpense.scenario_id == scenario_id).delete()
    db.query(OneOffEvent).filter(OneOffEvent.scenario_id == scenario_id).delete()
    db.query(DebtAccount).filter(DebtAccount.scenario_id == scenario_id).delete()
    db.query(CreditCardDebt).filter(CreditCardDebt.scenario_id == scenario_id).delete()
    db.query(SavingsContribution).filter(SavingsContribution.scenario_id == scenario_id).delete()
    db.query(EmployerRRSPMatch).filter(EmployerRRSPMatch.scenario_id == scenario_id).delete()
    db.delete(scenario)
    db.commit()


@router.post("/{scenario_id}/clone")
def clone_scenario(
    scenario_id: int,
    name: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    original = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.profile_id.in_(pids)).first()
    if not original:
        raise HTTPException(status_code=404, detail="Scenario not found")

    clone = Scenario(
        name=name or f"{original.name} (copy)",
        description=original.description,
        cloned_from_id=original.id,
        color=original.color,
        profile_id=original.profile_id,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)

    # Clone assumptions
    orig_assumptions = db.query(ForecastAssumptions).filter(
        ForecastAssumptions.scenario_id == scenario_id
    ).first()
    if orig_assumptions:
        new_assumptions = ForecastAssumptions(
            scenario_id=clone.id,
            inflation_rate=orig_assumptions.inflation_rate,
            salary_growth_rate=orig_assumptions.salary_growth_rate,
            investment_return_rate=orig_assumptions.investment_return_rate,
            tax_config_year=orig_assumptions.tax_config_year,
            rrsp_room=orig_assumptions.rrsp_room,
            tfsa_room=orig_assumptions.tfsa_room,
            fhsa_room=orig_assumptions.fhsa_room,
            fx_rate_cad_usd=orig_assumptions.fx_rate_cad_usd,
        )
        db.add(new_assumptions)

    # Clone income streams
    for stream in db.query(IncomeStream).filter(IncomeStream.scenario_id == scenario_id).all():
        new_stream = IncomeStream(
            scenario_id=clone.id, name=stream.name, amount=stream.amount,
            frequency=stream.frequency, start_month=stream.start_month,
            end_month=stream.end_month, growth_rate=stream.growth_rate,
            income_type=stream.income_type, account_id=stream.account_id,
        )
        db.add(new_stream)

    # Clone recurring expenses
    for expense in db.query(RecurringExpense).filter(RecurringExpense.scenario_id == scenario_id).all():
        new_expense = RecurringExpense(
            scenario_id=clone.id, name=expense.name, amount=expense.amount,
            frequency=expense.frequency, category_id=expense.category_id,
            start_month=expense.start_month, end_month=expense.end_month,
            inflation_adjusted=expense.inflation_adjusted, account_id=expense.account_id,
        )
        db.add(new_expense)

    # Clone one-off events
    for event in db.query(OneOffEvent).filter(OneOffEvent.scenario_id == scenario_id).all():
        new_event = OneOffEvent(
            scenario_id=clone.id, name=event.name, amount=event.amount,
            month=event.month, type=event.type,
            from_account_id=event.from_account_id, to_account_id=event.to_account_id,
        )
        db.add(new_event)

    # Clone debt accounts
    for debt in db.query(DebtAccount).filter(DebtAccount.scenario_id == scenario_id).all():
        new_debt = DebtAccount(
            scenario_id=clone.id, account_id=debt.account_id, principal=debt.principal,
            interest_rate=debt.interest_rate, term_months=debt.term_months,
            amortization_months=debt.amortization_months, payment_frequency=debt.payment_frequency,
            start_month=debt.start_month, extra_payment=debt.extra_payment,
        )
        db.add(new_debt)

    # Clone credit card debts
    for cc in db.query(CreditCardDebt).filter(CreditCardDebt.scenario_id == scenario_id).all():
        db.add(CreditCardDebt(
            scenario_id=clone.id, account_id=cc.account_id, balance=cc.balance,
            interest_rate=cc.interest_rate, monthly_payment=cc.monthly_payment,
            start_month=cc.start_month,
        ))

    # Clone savings contributions
    for contrib in db.query(SavingsContribution).filter(SavingsContribution.scenario_id == scenario_id).all():
        new_contrib = SavingsContribution(
            scenario_id=clone.id, account_id=contrib.account_id, amount=contrib.amount,
            frequency=contrib.frequency, start_month=contrib.start_month,
            end_month=contrib.end_month, expected_return_rate=contrib.expected_return_rate,
        )
        db.add(new_contrib)

    # Clone employer RRSP matches
    for er in db.query(EmployerRRSPMatch).filter(EmployerRRSPMatch.scenario_id == scenario_id).all():
        db.add(EmployerRRSPMatch(
            scenario_id=clone.id, income_stream_id=er.income_stream_id,
            rrsp_account_id=er.rrsp_account_id, label=er.label,
            employee_rate=er.employee_rate, employer_match_rate=er.employer_match_rate,
            start_month=er.start_month, end_month=er.end_month,
        ))

    db.commit()
    db.refresh(clone)
    return clone


@router.post("/{scenario_id}/stress-test/{preset_id}")
def apply_stress_test(
    scenario_id: int,
    preset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    pids: list[int] = Depends(get_user_profile_ids),
):
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id, Scenario.profile_id.in_(pids)).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    # TODO: clone scenario and apply preset modifiers
    return {"status": "not_implemented"}
