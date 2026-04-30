from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from backend.database import Base


class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    profile_id = Column(Integer, ForeignKey("profiles.id"), default=1)
    name = Column(String, nullable=False)
    ticker = Column(String, nullable=True)
    fund_code = Column(String, nullable=True)
    units = Column(Float, default=0)
    price_per_unit = Column(Float, default=0)
    market_value = Column(Float, default=0)
    book_value = Column(Float, nullable=True)
    asset_class = Column(String, default="equity")
    region = Column(String, nullable=True)
    allocation_json = Column(Text, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
