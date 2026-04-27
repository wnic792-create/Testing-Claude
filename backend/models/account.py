from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, func

from backend.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), default=1)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # chequing, savings_hisa, tfsa, rrsp, fhsa, non_registered, crypto, real_estate, credit_card, loc, mortgage, student_loan, car_loan
    currency = Column(String, default="CAD")  # CAD | USD
    institution = Column(String, nullable=True)
    current_balance = Column(Float, default=0.0)
    interest_rate = Column(Float, nullable=True)
    is_asset = Column(Boolean, default=True)
    notes = Column(String, nullable=True)
    # Crypto-specific
    last_price_update = Column(DateTime, nullable=True)
    # Real estate specific
    purchase_price = Column(Float, nullable=True)
    purchase_date = Column(String, nullable=True)
    down_payment = Column(Float, nullable=True)
    appreciation_rate = Column(Float, nullable=True)  # annual %
    property_tax_annual = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
