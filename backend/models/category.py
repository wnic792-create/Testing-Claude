from sqlalchemy import Column, Integer, String, Boolean, ForeignKey

from backend.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    name_fr = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    icon = Column(String, nullable=True)
    type = Column(String, default="expense")  # income | expense | transfer
    is_system = Column(Boolean, default=False)


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pattern = Column(String, nullable=False)  # regex
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    priority = Column(Integer, default=0)
    source = Column(String, default="manual")  # manual | learned
    match_count = Column(Integer, default=0)
