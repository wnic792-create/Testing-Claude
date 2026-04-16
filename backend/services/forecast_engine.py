"""
60-month forecast engine.

Iterates month by month, applying:
- Income streams (with growth rate, tax deductions)
- Recurring expenses (with optional inflation adjustment)
- One-off events
- Debt payments (amortization schedules)
- Savings contributions (with contribution room tracking)
- Investment returns (flat % compounded monthly, per-account)
- Real estate appreciation + mortgage paydown → equity
- Net worth computation per month
"""

from sqlalchemy.orm import Session

from backend.models.account import Account
from backend.models.scenario import Scenario
from backend.models.forecast import (
    ForecastAssumptions, IncomeStream, RecurringExpense,
    OneOffEvent, DebtAccount, CreditCardDebt, SavingsContribution,
)
from backend.services.tax_engine import load_tax_config, calculate_annual_tax
from backend.services.amortization import calculate_amortization

HORIZON = 60  # months


def run_forecast(db: Session, scenario_id: int) -> dict:
    """
    Run a full 60-month forecast for a scenario.

    Returns:
        {
            months: [{month, date_label, accounts: {id: balance}, net_worth, ...}],
            summary: {starting_nw, ending_nw, total_income, total_expenses, ...}
        }
    """
    # Load scenario data
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise ValueError(f"Scenario {scenario_id} not found")

    assumptions = db.query(ForecastAssumptions).filter(
        ForecastAssumptions.scenario_id == scenario_id
    ).first()
    if not assumptions:
        raise ValueError(f"No assumptions for scenario {scenario_id}")

    incomes = db.query(IncomeStream).filter(IncomeStream.scenario_id == scenario_id).all()
    expenses = db.query(RecurringExpense).filter(RecurringExpense.scenario_id == scenario_id).all()
    events = db.query(OneOffEvent).filter(OneOffEvent.scenario_id == scenario_id).all()
    debts = db.query(DebtAccount).filter(DebtAccount.scenario_id == scenario_id).all()
    credit_cards = db.query(CreditCardDebt).filter(CreditCardDebt.scenario_id == scenario_id).all()
    savings = db.query(SavingsContribution).filter(SavingsContribution.scenario_id == scenario_id).all()

    # Load all accounts as starting balances
    accounts = db.query(Account).all()
    balances = {a.id: a.current_balance for a in accounts}
    account_map = {a.id: a for a in accounts}

    # Track revolving credit card balances independently
    cc_balances = {cc.id: cc.balance for cc in credit_cards}

    # Load tax config
    tax_config = load_tax_config(assumptions.tax_config_year)

    # Pre-compute amortization schedules for debts
    amort_schedules = {}
    for debt in debts:
        amort_schedules[debt.id] = calculate_amortization(
            principal=debt.principal,
            annual_rate=debt.interest_rate,
            amortization_months=debt.amortization_months,
            term_months=debt.term_months,
            payment_frequency=debt.payment_frequency,
            extra_payment=debt.extra_payment,
        )

    # Monthly rates
    monthly_inflation = (1 + assumptions.inflation_rate / 100) ** (1 / 12) - 1
    monthly_investment_return = (1 + assumptions.investment_return_rate / 100) ** (1 / 12) - 1

    # Contribution room tracking
    rrsp_room = assumptions.rrsp_room
    tfsa_room = assumptions.tfsa_room
    fhsa_room = assumptions.fhsa_room

    # Build per-account return rate overrides from savings contributions.
    # If a contribution sets expected_return_rate, it takes priority over
    # the account-level interest_rate and the global assumption.
    contrib_return_overrides: dict[int, float] = {}
    for contrib in savings:
        if contrib.expected_return_rate is not None:
            contrib_return_overrides[contrib.account_id] = contrib.expected_return_rate

    # Results
    months_data = []
    total_income = 0.0
    total_expenses = 0.0
    total_tax = 0.0
    total_savings = 0.0
    total_investment_growth = 0.0

    # Compute starting date label
    import datetime
    start_date = datetime.date.today().replace(day=1)

    for m in range(HORIZON):
        current_date = start_date + datetime.timedelta(days=32 * m)
        current_date = current_date.replace(day=1)
        date_label = current_date.strftime("%Y-%m")

        month_income = 0.0
        month_expenses = 0.0
        month_tax = 0.0
        month_savings_contrib = 0.0
        month_debt_payment = 0.0

        # --- Income streams ---
        for inc in incomes:
            if inc.start_month <= m and (inc.end_month is None or m <= inc.end_month):
                if inc.frequency == "one_time" and m != inc.start_month:
                    continue

                amount = inc.amount
                # Apply growth rate
                growth = inc.growth_rate if inc.growth_rate is not None else assumptions.salary_growth_rate
                if m > 0 and inc.frequency != "one_time":
                    amount *= (1 + growth / 100 / 12) ** m

                # Frequency adjustment
                if inc.frequency == "annual":
                    if m % 12 != inc.start_month % 12:
                        continue
                elif inc.frequency == "biweekly":
                    amount = amount * 26 / 12  # Convert biweekly to monthly

                # Tax calculation (annualized then divided by 12)
                annual_gross = amount * 12 if inc.frequency not in ("annual", "one_time") else amount
                tax_result = calculate_annual_tax(annual_gross, inc.income_type, tax_config)
                monthly_tax = tax_result["total_deductions"] / 12
                net_monthly = amount - monthly_tax

                month_income += amount
                month_tax += monthly_tax

                # Deposit to account
                if inc.account_id and inc.account_id in balances:
                    balances[inc.account_id] += net_monthly

        # --- Recurring expenses ---
        for exp in expenses:
            if exp.start_month <= m and (exp.end_month is None or m <= exp.end_month):
                amount = exp.amount
                if exp.inflation_adjusted and m > 0:
                    amount *= (1 + monthly_inflation) ** m

                if exp.frequency == "annual":
                    if m % 12 != exp.start_month % 12:
                        continue
                elif exp.frequency == "biweekly":
                    amount = amount * 26 / 12

                month_expenses += amount

                if exp.account_id and exp.account_id in balances:
                    balances[exp.account_id] -= amount

        # --- One-off events ---
        for event in events:
            if event.month == m:
                if event.type == "income":
                    month_income += event.amount
                    if event.to_account_id and event.to_account_id in balances:
                        balances[event.to_account_id] += event.amount
                elif event.type == "expense":
                    month_expenses += event.amount
                    if event.from_account_id and event.from_account_id in balances:
                        balances[event.from_account_id] -= event.amount
                elif event.type == "transfer":
                    if event.from_account_id and event.from_account_id in balances:
                        balances[event.from_account_id] -= event.amount
                    if event.to_account_id and event.to_account_id in balances:
                        balances[event.to_account_id] += event.amount

        # --- Debt payments ---
        for debt in debts:
            if debt.start_month <= m:
                schedule = amort_schedules[debt.id]["schedule"]
                period_idx = m - debt.start_month
                if period_idx < len(schedule):
                    entry = schedule[period_idx]
                    payment = entry["payment"]
                    month_debt_payment += payment
                    month_expenses += payment

                    # Update the debt account balance
                    if debt.account_id in balances:
                        balances[debt.account_id] = -entry["balance"]

        # --- Credit card payments (revolving balance) ---
        for cc in credit_cards:
            if cc.start_month <= m and cc_balances[cc.id] > 0:
                monthly_rate = (1 + cc.interest_rate / 100) ** (1 / 12) - 1
                # Interest accrues on the outstanding balance
                cc_balances[cc.id] *= (1 + monthly_rate)
                # Apply payment (capped at remaining balance)
                payment = min(cc.monthly_payment, cc_balances[cc.id])
                cc_balances[cc.id] -= payment
                cc_balances[cc.id] = max(cc_balances[cc.id], 0)
                month_debt_payment += payment
                month_expenses += payment
                # Mirror to account balance (negative = owed)
                if cc.account_id in balances:
                    balances[cc.account_id] = -cc_balances[cc.id]

        # --- Savings contributions ---
        for contrib in savings:
            if contrib.start_month <= m and (contrib.end_month is None or m <= contrib.end_month):
                amount = contrib.amount
                if contrib.frequency == "annual":
                    if m % 12 != contrib.start_month % 12:
                        continue
                elif contrib.frequency == "biweekly":
                    amount = amount * 26 / 12

                # Check contribution room for registered accounts
                acct = account_map.get(contrib.account_id)
                if acct:
                    if acct.type == "rrsp" and rrsp_room < amount:
                        amount = max(0, rrsp_room)
                    elif acct.type == "tfsa" and tfsa_room < amount:
                        amount = max(0, tfsa_room)
                    elif acct.type == "fhsa" and fhsa_room < amount:
                        amount = max(0, fhsa_room)

                    # Deduct room
                    if acct.type == "rrsp":
                        rrsp_room -= amount
                    elif acct.type == "tfsa":
                        tfsa_room -= amount
                    elif acct.type == "fhsa":
                        fhsa_room -= amount

                if contrib.account_id in balances:
                    balances[contrib.account_id] += amount
                month_savings_contrib += amount

        # --- Investment returns (monthly compounding) ---
        month_investment_growth = 0.0
        for acct_id, acct in account_map.items():
            if acct_id not in balances:
                continue
            if acct.type in ("tfsa", "rrsp", "fhsa", "non_registered"):
                if acct_id in contrib_return_overrides:
                    rate = contrib_return_overrides[acct_id]
                elif acct.interest_rate is not None:
                    rate = acct.interest_rate
                else:
                    rate = assumptions.investment_return_rate
                monthly_return = (1 + rate / 100) ** (1 / 12) - 1
                growth = balances[acct_id] * monthly_return
                balances[acct_id] += growth
                month_investment_growth += growth
            elif acct.type == "savings_hisa":
                if acct_id in contrib_return_overrides:
                    rate = contrib_return_overrides[acct_id]
                elif acct.interest_rate is not None:
                    rate = acct.interest_rate
                else:
                    rate = 0
                monthly_return = (1 + rate / 100) ** (1 / 12) - 1
                growth = balances[acct_id] * monthly_return
                balances[acct_id] += growth
                month_investment_growth += growth

        # --- Real estate appreciation ---
        for acct_id, acct in account_map.items():
            if acct.type == "real_estate" and acct.appreciation_rate is not None:
                monthly_appreciation = (1 + acct.appreciation_rate / 100) ** (1 / 12) - 1
                balances[acct_id] *= (1 + monthly_appreciation)

        # --- Refresh contribution room annually (at month 12, 24, etc.) ---
        if m > 0 and m % 12 == 0:
            limits = tax_config["contribution_limits"]
            # RRSP room: 18% of previous year income, capped
            annual_income = month_income * 12
            new_rrsp = min(annual_income * limits["rrsp_rate"], limits["rrsp_max"])
            rrsp_room += new_rrsp
            tfsa_room += limits["tfsa_annual"]
            fhsa_room = min(fhsa_room + limits["fhsa_annual"], limits["fhsa_lifetime"])

        # --- Compute net worth ---
        assets = sum(
            bal for aid, bal in balances.items()
            if account_map.get(aid) and account_map[aid].is_asset
        )
        liabilities = sum(
            abs(bal) for aid, bal in balances.items()
            if account_map.get(aid) and not account_map[aid].is_asset
        )
        net_worth = assets - liabilities

        total_income += month_income
        total_expenses += month_expenses
        total_tax += month_tax
        total_savings += month_savings_contrib
        total_investment_growth += month_investment_growth

        months_data.append({
            "month": m,
            "date_label": date_label,
            "income": round(month_income, 2),
            "expenses": round(month_expenses, 2),
            "tax": round(month_tax, 2),
            "net_cash_flow": round(month_income - month_expenses - month_tax, 2),
            "savings_contributions": round(month_savings_contrib, 2),
            "debt_payments": round(month_debt_payment, 2),
            "investment_growth": round(month_investment_growth, 2),
            "assets": round(assets, 2),
            "liabilities": round(liabilities, 2),
            "net_worth": round(net_worth, 2),
            "balances": {aid: round(bal, 2) for aid, bal in balances.items()},
        })

    # Summary
    starting_nw = months_data[0]["net_worth"] if months_data else 0
    ending_nw = months_data[-1]["net_worth"] if months_data else 0

    return {
        "scenario_id": scenario_id,
        "scenario_name": scenario.name,
        "scenario_color": scenario.color,
        "horizon_months": HORIZON,
        "months": months_data,
        "summary": {
            "starting_net_worth": starting_nw,
            "ending_net_worth": ending_nw,
            "net_worth_change": round(ending_nw - starting_nw, 2),
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "total_tax": round(total_tax, 2),
            "total_savings": round(total_savings, 2),
            "total_investment_growth": round(total_investment_growth, 2),
        },
    }


def rollup_forecast(forecast: dict, granularity: str) -> dict:
    """
    Roll up monthly forecast data to quarterly or yearly.

    Args:
        forecast: Output of run_forecast.
        granularity: "monthly" | "quarterly" | "yearly"

    Returns same structure but with aggregated periods.
    """
    if granularity == "monthly":
        return forecast

    months = forecast["months"]
    periods = []

    if granularity == "quarterly":
        chunk_size = 3
    elif granularity == "yearly":
        chunk_size = 12
    else:
        return forecast

    for i in range(0, len(months), chunk_size):
        chunk = months[i:i + chunk_size]
        if not chunk:
            break

        period = {
            "month": chunk[0]["month"],
            "date_label": chunk[0]["date_label"],
            "income": round(sum(m["income"] for m in chunk), 2),
            "expenses": round(sum(m["expenses"] for m in chunk), 2),
            "tax": round(sum(m["tax"] for m in chunk), 2),
            "net_cash_flow": round(sum(m["net_cash_flow"] for m in chunk), 2),
            "savings_contributions": round(sum(m["savings_contributions"] for m in chunk), 2),
            "debt_payments": round(sum(m["debt_payments"] for m in chunk), 2),
            "investment_growth": round(sum(m["investment_growth"] for m in chunk), 2),
            # End-of-period snapshot
            "assets": chunk[-1]["assets"],
            "liabilities": chunk[-1]["liabilities"],
            "net_worth": chunk[-1]["net_worth"],
            "balances": chunk[-1]["balances"],
        }
        periods.append(period)

    result = {**forecast, "months": periods}
    return result
