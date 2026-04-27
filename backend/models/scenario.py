from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, func

from backend.database import Base


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), default=1)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    cloned_from_id = Column(Integer, ForeignKey("scenarios.id"), nullable=True)
    color = Column(String, default="#3B82F6")  # hex for chart
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class StressTestPreset(Base):
    __tablename__ = "stress_test_presets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    modifiers = Column(String, nullable=False)  # JSON: list of {field, operator, value}
