"""
Pre-built fund composition database for popular Canadian mutual funds and ETFs.

Each entry maps a fund code or ticker to its approximate underlying allocation.
Allocations are expressed as percentages that sum to ~100.

Sources: fund fact sheets (publicly available). These are approximate and may
drift as fund managers rebalance. Users can override per-holding via
allocation_json.
"""

FUND_DATABASE: dict[str, dict] = {
    # ─── Fidelity Canada Mutual Funds ─────────────────────────────────
    "FID500": {
        "name": "Fidelity Global Fund",
        "category": "Global Equity",
        "mer": 2.14,
        "allocation": {
            "us_equity": 58,
            "intl_developed_equity": 24,
            "emerging_equity": 8,
            "cad_equity": 5,
            "cash": 5,
        },
        "top_sectors": {
            "technology": 28,
            "healthcare": 16,
            "financials": 12,
            "consumer_discretionary": 11,
            "industrials": 10,
            "communication": 7,
            "other": 16,
        },
    },
    "FID501": {
        "name": "Fidelity Global Fund Series F",
        "category": "Global Equity",
        "mer": 1.05,
        "allocation": {
            "us_equity": 58,
            "intl_developed_equity": 24,
            "emerging_equity": 8,
            "cad_equity": 5,
            "cash": 5,
        },
        "top_sectors": {
            "technology": 28,
            "healthcare": 16,
            "financials": 12,
            "consumer_discretionary": 11,
            "industrials": 10,
            "communication": 7,
            "other": 16,
        },
    },
    "FID006": {
        "name": "Fidelity Canadian Growth Company",
        "category": "Canadian Equity",
        "mer": 2.28,
        "allocation": {
            "cad_equity": 82,
            "us_equity": 12,
            "cash": 6,
        },
        "top_sectors": {
            "technology": 22,
            "industrials": 18,
            "consumer_discretionary": 15,
            "energy": 12,
            "financials": 10,
            "materials": 8,
            "other": 15,
        },
    },
    "FID585": {
        "name": "Fidelity NorthStar Fund",
        "category": "Global Equity",
        "mer": 2.19,
        "allocation": {
            "us_equity": 48,
            "cad_equity": 18,
            "intl_developed_equity": 20,
            "emerging_equity": 8,
            "cash": 6,
        },
        "top_sectors": {
            "technology": 24,
            "financials": 15,
            "healthcare": 12,
            "industrials": 11,
            "consumer_discretionary": 10,
            "energy": 8,
            "other": 20,
        },
    },
    "FID586": {
        "name": "Fidelity NorthStar Fund Series F",
        "category": "Global Equity",
        "mer": 1.10,
        "allocation": {
            "us_equity": 48,
            "cad_equity": 18,
            "intl_developed_equity": 20,
            "emerging_equity": 8,
            "cash": 6,
        },
        "top_sectors": {
            "technology": 24,
            "financials": 15,
            "healthcare": 12,
            "industrials": 11,
            "consumer_discretionary": 10,
            "energy": 8,
            "other": 20,
        },
    },
    "FID015": {
        "name": "Fidelity Canadian Balanced Fund",
        "category": "Canadian Balanced",
        "mer": 2.10,
        "allocation": {
            "cad_equity": 35,
            "cad_bonds": 30,
            "us_equity": 15,
            "intl_developed_equity": 8,
            "cash": 7,
            "global_bonds": 5,
        },
        "top_sectors": {
            "financials": 18,
            "government_bonds": 15,
            "corporate_bonds": 12,
            "energy": 10,
            "technology": 9,
            "industrials": 8,
            "other": 28,
        },
    },
    "FID016": {
        "name": "Fidelity Monthly Income Fund",
        "category": "Canadian Fixed Income Balanced",
        "mer": 1.73,
        "allocation": {
            "cad_bonds": 38,
            "cad_equity": 28,
            "us_equity": 12,
            "global_bonds": 10,
            "intl_developed_equity": 5,
            "cash": 7,
        },
        "top_sectors": {
            "government_bonds": 20,
            "corporate_bonds": 18,
            "financials": 15,
            "energy": 8,
            "utilities": 7,
            "real_estate": 5,
            "other": 27,
        },
    },
    "FID120": {
        "name": "Fidelity American Disciplined Equity Fund",
        "category": "US Equity",
        "mer": 2.23,
        "allocation": {
            "us_equity": 94,
            "cash": 6,
        },
        "top_sectors": {
            "technology": 30,
            "healthcare": 14,
            "financials": 13,
            "consumer_discretionary": 11,
            "industrials": 10,
            "communication": 8,
            "other": 14,
        },
    },
    "FID080": {
        "name": "Fidelity International Growth Fund",
        "category": "International Equity",
        "mer": 2.30,
        "allocation": {
            "intl_developed_equity": 72,
            "emerging_equity": 18,
            "cash": 5,
            "us_equity": 5,
        },
        "top_sectors": {
            "technology": 20,
            "financials": 16,
            "healthcare": 14,
            "industrials": 13,
            "consumer_discretionary": 12,
            "consumer_staples": 8,
            "other": 17,
        },
    },
    "FID090": {
        "name": "Fidelity Emerging Markets Fund",
        "category": "Emerging Markets Equity",
        "mer": 2.45,
        "allocation": {
            "emerging_equity": 90,
            "intl_developed_equity": 5,
            "cash": 5,
        },
        "top_sectors": {
            "technology": 28,
            "financials": 20,
            "consumer_discretionary": 15,
            "communication": 10,
            "materials": 8,
            "energy": 5,
            "other": 14,
        },
    },
    "FID010": {
        "name": "Fidelity Canadian Bond Fund",
        "category": "Canadian Fixed Income",
        "mer": 1.43,
        "allocation": {
            "cad_bonds": 88,
            "global_bonds": 5,
            "cash": 7,
        },
        "top_sectors": {
            "government_bonds": 45,
            "corporate_bonds": 35,
            "mortgage_backed": 8,
            "other": 12,
        },
    },
    "FID532": {
        "name": "Fidelity Global Asset Allocation Fund",
        "category": "Global Balanced",
        "mer": 2.18,
        "allocation": {
            "us_equity": 30,
            "intl_developed_equity": 15,
            "cad_equity": 10,
            "emerging_equity": 5,
            "cad_bonds": 15,
            "global_bonds": 15,
            "cash": 10,
        },
        "top_sectors": {
            "government_bonds": 16,
            "technology": 14,
            "corporate_bonds": 12,
            "financials": 10,
            "healthcare": 8,
            "industrials": 7,
            "other": 33,
        },
    },
    "FID2023": {
        "name": "Fidelity Global Innovators Fund",
        "category": "Global Equity",
        "mer": 2.32,
        "allocation": {
            "us_equity": 65,
            "intl_developed_equity": 18,
            "emerging_equity": 10,
            "cash": 7,
        },
        "top_sectors": {
            "technology": 45,
            "healthcare": 15,
            "consumer_discretionary": 12,
            "communication": 10,
            "industrials": 8,
            "other": 10,
        },
    },
    "FID305": {
        "name": "Fidelity Special Situations Fund",
        "category": "Global Equity",
        "mer": 2.28,
        "allocation": {
            "us_equity": 52,
            "intl_developed_equity": 22,
            "emerging_equity": 12,
            "cad_equity": 8,
            "cash": 6,
        },
        "top_sectors": {
            "technology": 22,
            "industrials": 15,
            "healthcare": 13,
            "financials": 12,
            "consumer_discretionary": 11,
            "materials": 8,
            "other": 19,
        },
    },
    "FID640": {
        "name": "Fidelity Canadian Large Cap Fund",
        "category": "Canadian Equity",
        "mer": 2.13,
        "allocation": {
            "cad_equity": 90,
            "us_equity": 5,
            "cash": 5,
        },
        "top_sectors": {
            "financials": 32,
            "energy": 18,
            "materials": 12,
            "industrials": 10,
            "technology": 8,
            "utilities": 5,
            "other": 15,
        },
    },

    # ─── Fidelity All-in-One ETFs ─────────────────────────────────────
    "FBAL": {
        "name": "Fidelity All-in-One Balanced ETF",
        "category": "Global Balanced ETF",
        "mer": 0.39,
        "allocation": {
            "us_equity": 20,
            "cad_equity": 15,
            "intl_developed_equity": 10,
            "emerging_equity": 5,
            "cad_bonds": 30,
            "global_bonds": 15,
            "cash": 5,
        },
        "top_sectors": {
            "government_bonds": 22,
            "corporate_bonds": 18,
            "technology": 10,
            "financials": 12,
            "other": 38,
        },
    },
    "FGRO": {
        "name": "Fidelity All-in-One Growth ETF",
        "category": "Global Growth ETF",
        "mer": 0.39,
        "allocation": {
            "us_equity": 32,
            "cad_equity": 20,
            "intl_developed_equity": 15,
            "emerging_equity": 8,
            "cad_bonds": 12,
            "global_bonds": 8,
            "cash": 5,
        },
        "top_sectors": {
            "technology": 16,
            "financials": 14,
            "government_bonds": 10,
            "industrials": 8,
            "healthcare": 7,
            "other": 45,
        },
    },
    "FEQT": {
        "name": "Fidelity All-in-One Equity ETF",
        "category": "Global Equity ETF",
        "mer": 0.37,
        "allocation": {
            "us_equity": 42,
            "cad_equity": 25,
            "intl_developed_equity": 18,
            "emerging_equity": 10,
            "cash": 5,
        },
        "top_sectors": {
            "technology": 22,
            "financials": 16,
            "industrials": 10,
            "healthcare": 9,
            "consumer_discretionary": 8,
            "energy": 7,
            "other": 28,
        },
    },

    # ─── Popular Canadian ETFs (non-Fidelity) ─────────────────────────
    "VFV": {
        "name": "Vanguard S&P 500 Index ETF",
        "category": "US Equity ETF",
        "mer": 0.09,
        "allocation": {"us_equity": 100},
        "top_sectors": {"technology": 32, "healthcare": 12, "financials": 12, "consumer_discretionary": 10, "communication": 9, "industrials": 8, "other": 17},
    },
    "XIC": {
        "name": "iShares Core S&P/TSX Capped Composite",
        "category": "Canadian Equity ETF",
        "mer": 0.06,
        "allocation": {"cad_equity": 100},
        "top_sectors": {"financials": 32, "energy": 17, "materials": 11, "industrials": 10, "technology": 8, "other": 22},
    },
    "XUU": {
        "name": "iShares Core S&P U.S. Total Market",
        "category": "US Equity ETF",
        "mer": 0.07,
        "allocation": {"us_equity": 100},
        "top_sectors": {"technology": 30, "healthcare": 12, "financials": 12, "consumer_discretionary": 11, "industrials": 9, "other": 26},
    },
    "XEF": {
        "name": "iShares Core MSCI EAFE IMI",
        "category": "International Equity ETF",
        "mer": 0.22,
        "allocation": {"intl_developed_equity": 100},
        "top_sectors": {"financials": 18, "industrials": 15, "healthcare": 12, "consumer_discretionary": 11, "technology": 10, "other": 34},
    },
    "XEC": {
        "name": "iShares Core MSCI Emerging Markets",
        "category": "Emerging Markets ETF",
        "mer": 0.27,
        "allocation": {"emerging_equity": 100},
        "top_sectors": {"technology": 22, "financials": 20, "consumer_discretionary": 14, "communication": 10, "materials": 8, "other": 26},
    },
    "XBB": {
        "name": "iShares Core Canadian Universe Bond",
        "category": "Canadian Bond ETF",
        "mer": 0.10,
        "allocation": {"cad_bonds": 100},
        "top_sectors": {"government_bonds": 55, "corporate_bonds": 35, "mortgage_backed": 10},
    },
    "XEQT": {
        "name": "iShares Core Equity ETF Portfolio",
        "category": "Global Equity ETF",
        "mer": 0.20,
        "allocation": {"us_equity": 45, "cad_equity": 25, "intl_developed_equity": 22, "emerging_equity": 8},
        "top_sectors": {"technology": 24, "financials": 16, "industrials": 10, "healthcare": 9, "consumer_discretionary": 8, "other": 33},
    },
    "XGRO": {
        "name": "iShares Core Growth ETF Portfolio",
        "category": "Global Growth ETF",
        "mer": 0.20,
        "allocation": {"us_equity": 36, "cad_equity": 20, "intl_developed_equity": 17, "emerging_equity": 7, "cad_bonds": 12, "global_bonds": 8},
        "top_sectors": {"technology": 18, "financials": 15, "government_bonds": 10, "industrials": 8, "other": 49},
    },
    "VGRO": {
        "name": "Vanguard Growth ETF Portfolio",
        "category": "Global Growth ETF",
        "mer": 0.24,
        "allocation": {"us_equity": 33, "cad_equity": 18, "intl_developed_equity": 16, "emerging_equity": 6, "cad_bonds": 14, "global_bonds": 8, "us_bonds": 5},
        "top_sectors": {"technology": 16, "financials": 14, "government_bonds": 12, "industrials": 8, "other": 50},
    },
    "VEQT": {
        "name": "Vanguard All-Equity ETF Portfolio",
        "category": "Global Equity ETF",
        "mer": 0.24,
        "allocation": {"us_equity": 42, "cad_equity": 24, "intl_developed_equity": 22, "emerging_equity": 7, "cash": 5},
        "top_sectors": {"technology": 22, "financials": 16, "industrials": 10, "healthcare": 9, "other": 43},
    },
    "ZAG": {
        "name": "BMO Aggregate Bond Index ETF",
        "category": "Canadian Bond ETF",
        "mer": 0.09,
        "allocation": {"cad_bonds": 100},
        "top_sectors": {"government_bonds": 55, "corporate_bonds": 35, "mortgage_backed": 10},
    },
    "VAB": {
        "name": "Vanguard Canadian Aggregate Bond",
        "category": "Canadian Bond ETF",
        "mer": 0.09,
        "allocation": {"cad_bonds": 100},
        "top_sectors": {"government_bonds": 55, "corporate_bonds": 35, "mortgage_backed": 10},
    },
    "TDB902": {
        "name": "TD Canadian Index Fund",
        "category": "Canadian Equity",
        "mer": 0.33,
        "allocation": {"cad_equity": 100},
        "top_sectors": {"financials": 33, "energy": 17, "materials": 11, "industrials": 10, "technology": 8, "other": 21},
    },
    "TDB911": {
        "name": "TD U.S. Index Fund",
        "category": "US Equity",
        "mer": 0.35,
        "allocation": {"us_equity": 100},
        "top_sectors": {"technology": 31, "healthcare": 12, "financials": 12, "consumer_discretionary": 10, "other": 35},
    },
    "TDB900": {
        "name": "TD Canadian Bond Index Fund",
        "category": "Canadian Fixed Income",
        "mer": 0.48,
        "allocation": {"cad_bonds": 100},
        "top_sectors": {"government_bonds": 55, "corporate_bonds": 35, "other": 10},
    },
}

REGION_LABELS = {
    "us_equity": "US Equity",
    "cad_equity": "Canadian Equity",
    "intl_developed_equity": "Intl Developed",
    "emerging_equity": "Emerging Markets",
    "cad_bonds": "Canadian Bonds",
    "global_bonds": "Global Bonds",
    "us_bonds": "US Bonds",
    "cash": "Cash & Equiv.",
}

REGION_COLORS = {
    "us_equity": "#3b82f6",
    "cad_equity": "#ef4444",
    "intl_developed_equity": "#a855f7",
    "emerging_equity": "#f59e0b",
    "cad_bonds": "#22c55e",
    "global_bonds": "#06b6d4",
    "us_bonds": "#6366f1",
    "cash": "#94a3b8",
}

SECTOR_LABELS = {
    "technology": "Technology",
    "financials": "Financials",
    "healthcare": "Healthcare",
    "industrials": "Industrials",
    "consumer_discretionary": "Consumer Disc.",
    "consumer_staples": "Consumer Staples",
    "energy": "Energy",
    "materials": "Materials",
    "communication": "Communication",
    "utilities": "Utilities",
    "real_estate": "Real Estate",
    "government_bonds": "Gov. Bonds",
    "corporate_bonds": "Corp. Bonds",
    "mortgage_backed": "Mortgage-Backed",
    "other": "Other",
}


def lookup_fund(code: str) -> dict | None:
    key = code.upper().strip()
    return FUND_DATABASE.get(key)


def search_funds(query: str) -> list[dict]:
    q = query.lower().strip()
    results = []
    for code, data in FUND_DATABASE.items():
        if q in code.lower() or q in data["name"].lower() or q in data.get("category", "").lower():
            results.append({"code": code, **data})
    return results[:20]
