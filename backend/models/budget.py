from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey

from backend.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), default=1)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    year_month = Column(String, nullable=False)  # "2026-04"
    amount = Column(Float, nullable=False)
    rollover = Column(Boolean, default=False)
    rollover_amount = Column(Float, default=0.0)
