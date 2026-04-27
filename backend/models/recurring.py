from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, func

from backend.database import Base


class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), default=1)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="CAD")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    frequency = Column(String, nullable=False)  # weekly | biweekly | monthly | quarterly | annual
    start_date = Column(String, nullable=False)  # ISO YYYY-MM-DD
    end_date = Column(String, nullable=True)
    next_date = Column(String, nullable=False)   # next execution date
    is_active = Column(Boolean, default=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
