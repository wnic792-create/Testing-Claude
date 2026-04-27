from sqlalchemy import Column, Integer, String, DateTime, func

from backend.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    color = Column(String, default="#3B82F6")
    avatar_initial = Column(String(2), default="P")
    created_at = Column(DateTime, server_default=func.now())
