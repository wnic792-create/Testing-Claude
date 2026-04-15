from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend.models.category import Category, CategorizationRule

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    name_fr: Optional[str] = None
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    type: str = "expense"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    name_fr: Optional[str] = None
    parent_id: Optional[int] = None
    icon: Optional[str] = None
    type: Optional[str] = None
    is_transfer_category: Optional[bool] = None


class RuleCreate(BaseModel):
    pattern: str
    category_id: int
    priority: int = 0


class RuleUpdate(BaseModel):
    pattern: Optional[str] = None
    category_id: Optional[int] = None
    priority: Optional[int] = None


@router.get("/")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).all()
    # Build hierarchical structure
    cat_map = {}
    roots = []
    for cat in cats:
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "name_fr": cat.name_fr,
            "parent_id": cat.parent_id,
            "icon": cat.icon,
            "type": cat.type,
            "is_system": cat.is_system,
            "is_transfer_category": cat.is_transfer_category,
            "children": [],
        }
        cat_map[cat.id] = cat_dict

    for cat_dict in cat_map.values():
        if cat_dict["parent_id"] and cat_dict["parent_id"] in cat_map:
            cat_map[cat_dict["parent_id"]]["children"].append(cat_dict)
        else:
            roots.append(cat_dict)

    return roots


@router.get("/flat")
def list_categories_flat(db: Session = Depends(get_db)):
    return db.query(Category).all()


@router.post("/", status_code=201)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    db_cat = Category(**category.model_dump())
    db.add(db_cat)
    db.commit()
    db.refresh(db_cat)
    return db_cat


@router.patch("/{category_id}")
def update_category(category_id: int, updates: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system category")
    db.delete(cat)
    db.commit()


# --- Categorization Rules ---

@router.get("/rules")
def list_rules(db: Session = Depends(get_db)):
    return db.query(CategorizationRule).order_by(CategorizationRule.priority.desc()).all()


@router.post("/rules", status_code=201)
def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    db_rule = CategorizationRule(**rule.model_dump(), source="manual")
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.patch("/rules/{rule_id}")
def update_rule(rule_id: int, updates: RuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(CategorizationRule).filter(CategorizationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for key, value in updates.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(CategorizationRule).filter(CategorizationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
