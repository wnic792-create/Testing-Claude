def calculate_amortization(
    principal: float,
    annual_rate: float,
    amortization_months: int,
    term_months: int | None = None,
    payment_frequency: str = "monthly",
    extra_payment: float = 0.0,
) -> dict:
    """
    Generate a full amortization schedule.

    Args:
        principal: Loan principal amount.
        annual_rate: Annual interest rate as percentage (e.g., 5.5 for 5.5%).
        amortization_months: Total amortization period in months.
        term_months: Current term length (for renewal tracking). Defaults to amortization_months.
        payment_frequency: monthly | biweekly | accelerated_biweekly
        extra_payment: Additional principal payment per period.

    Returns dict with:
        regular_payment, total_payments, total_interest, total_principal,
        schedule (list of period dicts)
    """
    if term_months is None:
        term_months = amortization_months

    rate = annual_rate / 100.0

    # Canadian mortgages compound semi-annually by convention
    # Convert to effective per-period rate
    if payment_frequency == "monthly":
        periods_per_year = 12
    elif payment_frequency == "biweekly":
        periods_per_year = 26
    elif payment_frequency == "accelerated_biweekly":
        periods_per_year = 26
    else:
        periods_per_year = 12

    # Semi-annual compounding → effective periodic rate
    semi_annual_rate = rate / 2
    effective_annual = (1 + semi_annual_rate) ** 2 - 1
    periodic_rate = (1 + effective_annual) ** (1 / periods_per_year) - 1

    # Calculate regular payment
    if periodic_rate == 0:
        regular_payment = principal / amortization_months
    else:
        # For accelerated biweekly: calculate monthly payment then divide by 2
        if payment_frequency == "accelerated_biweekly":
            monthly_rate = (1 + effective_annual) ** (1 / 12) - 1
            monthly_payment = principal * monthly_rate / (1 - (1 + monthly_rate) ** (-amortization_months))
            regular_payment = monthly_payment / 2
        else:
            total_periods = amortization_months if payment_frequency == "monthly" else int(amortization_months * periods_per_year / 12)
            regular_payment = principal * periodic_rate / (1 - (1 + periodic_rate) ** (-total_periods))

    regular_payment = round(regular_payment, 2)

    # Generate schedule
    balance = principal
    schedule = []
    total_interest = 0.0
    total_principal_paid = 0.0
    term_periods = term_months if payment_frequency == "monthly" else int(term_months * periods_per_year / 12)

    period = 0
    while balance > 0.01 and period < amortization_months * 2:  # safety limit
        period += 1
        interest = round(balance * periodic_rate, 2)
        principal_portion = regular_payment - interest + extra_payment
        principal_portion = min(principal_portion, balance)  # don't overpay

        actual_payment = interest + principal_portion
        balance = max(0, balance - principal_portion)

        total_interest += interest
        total_principal_paid += principal_portion

        # Convert period to month for forecast integration
        if payment_frequency == "monthly":
            month = period
        else:
            month = int(period * 12 / periods_per_year) + 1

        schedule.append({
            "period": period,
            "month": month,
            "payment": round(actual_payment, 2),
            "principal": round(principal_portion, 2),
            "interest": round(interest, 2),
            "balance": round(balance, 2),
            "is_in_term": period <= term_periods,
        })

        if balance <= 0:
            break

    return {
        "principal": principal,
        "annual_rate": annual_rate,
        "amortization_months": amortization_months,
        "term_months": term_months,
        "payment_frequency": payment_frequency,
        "regular_payment": regular_payment,
        "extra_payment": extra_payment,
        "total_payment": round(regular_payment + extra_payment, 2),
        "total_interest": round(total_interest, 2),
        "total_paid": round(total_interest + total_principal_paid, 2),
        "periods": len(schedule),
        "schedule": schedule,
    }


def get_monthly_payment_and_balance(
    principal: float,
    annual_rate: float,
    amortization_months: int,
    months_elapsed: int,
    payment_frequency: str = "monthly",
    extra_payment: float = 0.0,
) -> dict:
    """
    Get the monthly payment amount and remaining balance after N months.
    Used by the forecast engine to integrate debt into month-by-month projections.
    """
    result = calculate_amortization(
        principal, annual_rate, amortization_months,
        payment_frequency=payment_frequency, extra_payment=extra_payment,
    )

    # Find the schedule entry closest to the requested month
    monthly_payment = result["regular_payment"] + extra_payment
    remaining_balance = principal

    for entry in result["schedule"]:
        if entry["month"] > months_elapsed:
            break
        remaining_balance = entry["balance"]

    return {
        "monthly_payment": monthly_payment if payment_frequency == "monthly" else round(monthly_payment * 26 / 12, 2),
        "remaining_balance": remaining_balance,
        "total_payment_per_month": result["total_payment"] if payment_frequency == "monthly" else round(result["total_payment"] * 26 / 12, 2),
    }
