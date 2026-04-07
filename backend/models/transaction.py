from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, func

from backend.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    date = Column(String, nullable=False)  # ISO date string YYYY-MM-DD
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)  # negative = outflow
    currency = Column(String, default="CAD")
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_transfer = Column(Boolean, default=False)
    transfer_pair_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    is_split = Column(Boolean, default=False)
    parent_tx_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    import_hash = Column(String, nullable=True, index=True)  # SHA256 for dedup
    source_file = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
