from sqlalchemy import Column, Integer, String, Float, ForeignKey

from backend.database import Base


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scenario_id = Column(Integer, ForeignKey("scenarios.id"), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=True)
    type = Column(String, default="lump_sum")  # lump_sum | months_expenses | fire_number
    months_expenses = Column(Integer, nullable=True)  # for emergency fund
    linked_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    target_date = Column(String, nullable=True)  # ISO date
