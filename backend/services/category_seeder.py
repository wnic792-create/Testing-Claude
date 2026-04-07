import json
import os

from sqlalchemy.orm import Session

from backend.models.category import Category

CATEGORIES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "seed", "default_categories.json"
)


def seed_categories(db: Session) -> int:
    """
    Seed default categories from default_categories.json if none exist.
    Returns the number of categories created.
    """
    existing = db.query(Category).count()
    if existing > 0:
        return 0

    with open(CATEGORIES_PATH, "r") as f:
        categories = json.load(f)

    count = 0
    for cat in categories:
        parent = Category(
            name=cat["name"],
            name_fr=cat.get("name_fr"),
            type=cat.get("type", "expense"),
            is_system=cat.get("is_system", False),
        )
        db.add(parent)
        db.flush()
        count += 1

        for child in cat.get("children", []):
            child_cat = Category(
                name=child["name"],
                name_fr=child.get("name_fr"),
                parent_id=parent.id,
                type=cat.get("type", "expense"),
                is_system=child.get("is_system", False),
            )
            db.add(child_cat)
            count += 1

    db.commit()
    return count
