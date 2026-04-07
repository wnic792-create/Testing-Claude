from sqlalchemy import Column, String

from backend.database import Base


class Settings(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)
