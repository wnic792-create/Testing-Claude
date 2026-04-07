from sqlalchemy import Column, Integer, String, Float, DateTime, func

from backend.database import Base


class NetWorthSnapshot(Base):
    __tablename__ = "net_worth_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False)
    total_assets = Column(Float, nullable=False)
    total_liabilities = Column(Float, nullable=False)
    net_worth = Column(Float, nullable=False)
    breakdown = Column(String, nullable=True)  # JSON
    created_at = Column(DateTime, server_default=func.now())
