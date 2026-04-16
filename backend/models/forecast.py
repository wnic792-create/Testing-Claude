from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey

from backend.database import Base


class ForecastAssumptions(Base):
    __tablename__ = "forecast_assumptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False, unique=True)
    inflation_rate = Column(Float, default=2.0)
    salary_growth_rate = Column(Float, default=3.0)
    investment_return_rate = Column(Float, default=6.0)
    tax_config_year = Column(String, default="2025")
    rrsp_room = Column(Float, default=0.0)
    tfsa_room = Column(Float, default=7000.0)
    fhsa_room = Column(Float, default=8000.0)
    fx_rate_cad_usd = Column(Float, default=0.73)


class IncomeStream(Base):
    __tablename__ = "income_streams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    frequency = Column(String, default="monthly")  # monthly | biweekly | annual | one_time
    start_month = Column(Integer, default=0)  # 0-59 in horizon
    end_month = Column(Integer, nullable=True)
    growth_rate = Column(Float, nullable=True)  # override global
    income_type = Column(String, default="employment")  # employment | self_employment | dividend_eligible | dividend_ineligible | interest | capital_gain
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    frequency = Column(String, default="monthly")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    start_month = Column(Integer, default=0)
    end_month = Column(Integer, nullable=True)
    inflation_adjusted = Column(Boolean, default=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)


class OneOffEvent(Base):
    __tablename__ = "one_off_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    month = Column(Integer, nullable=False)  # 0-59
    type = Column(String, default="expense")  # income | expense | transfer
    from_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    to_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)


class DebtAccount(Base):
    __tablename__ = "debt_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    principal = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)
    term_months = Column(Integer, nullable=False)
    amortization_months = Column(Integer, nullable=False)
    payment_frequency = Column(String, default="monthly")  # monthly | biweekly | accelerated_biweekly
    start_month = Column(Integer, default=0)
    extra_payment = Column(Float, default=0.0)


class SavingsContribution(Base):
    __tablename__ = "savings_contributions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    amount = Column(Float, nullable=False)
    frequency = Column(String, default="monthly")
    start_month = Column(Integer, default=0)
    end_month = Column(Integer, nullable=True)
    expected_return_rate = Column(Float, nullable=True)
