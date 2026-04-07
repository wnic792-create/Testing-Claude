import json
import os

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "seed")


def load_tax_config(year: str = "2025") -> dict:
    path = os.path.join(CONFIG_DIR, f"tax_config_{year}.json")
    with open(path, "r") as f:
        return json.load(f)


def calculate_annual_tax(
    gross_income: float,
    income_type: str = "employment",
    config: dict | None = None,
) -> dict:
    """
    Calculate annual QC+federal tax for a given gross income.

    Args:
        gross_income: Total annual gross income.
        income_type: employment | self_employment | dividend_eligible |
                     dividend_ineligible | interest | capital_gain
        config: Tax config dict (loaded if not provided).

    Returns dict with:
        federal_tax, provincial_tax, qpp, ei, qpip, total_deductions, net_income
    """
    if config is None:
        config = load_tax_config()

    # Adjust taxable income based on income type
    taxable_income = gross_income
    if income_type == "capital_gain":
        taxable_income = gross_income * config["capital_gains_inclusion_rate"]
    elif income_type == "dividend_eligible":
        taxable_income = gross_income * (1 + config["dividend_tax_credit"]["eligible"]["federal_gross_up"])
    elif income_type == "dividend_ineligible":
        taxable_income = gross_income * (1 + config["dividend_tax_credit"]["non_eligible"]["federal_gross_up"])

    # Federal tax
    federal_tax = _apply_brackets(taxable_income, config["federal"]["brackets"])
    # Basic personal amount credit
    federal_tax -= config["federal"]["basic_personal_amount"] * config["federal"]["brackets"][0]["rate"]
    # Employment amount credit
    if income_type in ("employment", "self_employment"):
        federal_tax -= config["federal"]["employment_amount"] * config["federal"]["brackets"][0]["rate"]
    # Quebec abatement (16.5% reduction for QC residents)
    federal_tax *= (1 - config["quebec"]["abatement_rate"])
    # Dividend tax credits (federal)
    if income_type == "dividend_eligible":
        federal_tax -= taxable_income * config["dividend_tax_credit"]["eligible"]["federal_credit_rate"]
    elif income_type == "dividend_ineligible":
        federal_tax -= taxable_income * config["dividend_tax_credit"]["non_eligible"]["federal_credit_rate"]
    federal_tax = max(0, federal_tax)

    # Provincial (Quebec) tax
    provincial_tax = _apply_brackets(taxable_income, config["quebec"]["brackets"])
    provincial_tax -= config["quebec"]["basic_personal_amount"] * config["quebec"]["brackets"][0]["rate"]
    # Dividend tax credits (Quebec)
    if income_type == "dividend_eligible":
        qc_taxable = gross_income * (1 + config["dividend_tax_credit"]["eligible"]["quebec_gross_up"])
        provincial_tax -= qc_taxable * config["dividend_tax_credit"]["eligible"]["quebec_credit_rate"]
    elif income_type == "dividend_ineligible":
        qc_taxable = gross_income * (1 + config["dividend_tax_credit"]["non_eligible"]["quebec_gross_up"])
        provincial_tax -= qc_taxable * config["dividend_tax_credit"]["non_eligible"]["quebec_credit_rate"]
    provincial_tax = max(0, provincial_tax)

    # QPP (employee portion)
    qpp = 0.0
    if income_type in ("employment", "self_employment"):
        qpp_config = config["qpp"]
        pensionable = min(gross_income, qpp_config["max_pensionable_earnings"])
        base = max(0, pensionable - qpp_config["basic_exemption"])
        qpp = base * qpp_config["base_contribution_rate"]
        # Enhanced QPP1
        qpp += base * qpp_config["enhanced_rate_1"]
        # Enhanced QPP2 (on earnings between first and second ceiling)
        if gross_income > qpp_config["max_pensionable_earnings"]:
            qpp2_earnings = min(
                gross_income, qpp_config["additional_max_pensionable_earnings"]
            ) - qpp_config["max_pensionable_earnings"]
            qpp += max(0, qpp2_earnings) * qpp_config["enhanced_rate_2"]
        if income_type == "self_employment":
            qpp *= 2  # Self-employed pay both portions

    # EI (Quebec has lower rate + QPIP)
    ei = 0.0
    qpip = 0.0
    if income_type == "employment":
        ei_config = config["ei"]
        insurable = min(gross_income, ei_config["max_insurable_earnings"])
        ei = insurable * ei_config["premium_rate_qc"]
        # QPIP
        qpip_insurable = min(gross_income, ei_config["qpip_max_insurable_earnings"])
        qpip = qpip_insurable * ei_config["qpip_employee_rate"]

    total_deductions = federal_tax + provincial_tax + qpp + ei + qpip
    net_income = gross_income - total_deductions

    return {
        "gross_income": gross_income,
        "taxable_income": taxable_income,
        "federal_tax": round(federal_tax, 2),
        "provincial_tax": round(provincial_tax, 2),
        "qpp": round(qpp, 2),
        "ei": round(ei, 2),
        "qpip": round(qpip, 2),
        "total_deductions": round(total_deductions, 2),
        "net_income": round(net_income, 2),
        "effective_rate": round(total_deductions / gross_income * 100, 2) if gross_income > 0 else 0,
    }


def calculate_monthly_net(
    annual_gross: float,
    income_type: str = "employment",
    config: dict | None = None,
) -> float:
    """Return estimated monthly net income after all deductions."""
    result = calculate_annual_tax(annual_gross, income_type, config)
    return round(result["net_income"] / 12, 2)


def calculate_rrsp_tax_savings(
    contribution: float,
    marginal_income: float,
    config: dict | None = None,
) -> dict:
    """Calculate tax savings from an RRSP contribution."""
    if config is None:
        config = load_tax_config()

    tax_before = calculate_annual_tax(marginal_income, config=config)
    tax_after = calculate_annual_tax(marginal_income - contribution, config=config)

    savings = tax_before["total_deductions"] - tax_after["total_deductions"]
    return {
        "contribution": contribution,
        "tax_savings": round(savings, 2),
        "effective_deduction_rate": round(savings / contribution * 100, 2) if contribution > 0 else 0,
    }


def _apply_brackets(income: float, brackets: list[dict]) -> float:
    """Apply progressive tax brackets to income."""
    tax = 0.0
    for bracket in brackets:
        lower = bracket["min"]
        upper = bracket["max"]
        rate = bracket["rate"]

        if income <= lower:
            break

        if upper is None:
            taxable = income - lower
        else:
            taxable = min(income, upper) - lower

        tax += taxable * rate

    return tax
