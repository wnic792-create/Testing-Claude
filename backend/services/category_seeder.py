import json
import os

from sqlalchemy.orm import Session

from backend.models.category import Category, CategorizationRule

CATEGORIES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "seed", "default_categories.json"
)
RULES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "seed", "default_rules.json"
)


def seed_categories(db: Session) -> int:
    """
    Seed default categories from default_categories.json if none exist.
    Returns the number of categories created.
    """
    existing = db.query(Category).count()
    if existing > 0:
        # Categories already exist — still ensure rules are seeded
        seed_rules(db)
        return 0

    with open(CATEGORIES_PATH, "r", encoding="utf-8") as f:
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

    # Seed default auto-categorization rules on top of the fresh categories
    seed_rules(db)

    return count


def seed_rules(db: Session) -> int:
    """
    Seed default categorization rules from default_rules.json if none exist.
    Each rule maps a regex pattern to a category (looked up by child name).
    Returns the number of rules created.
    """
    if db.query(CategorizationRule).count() > 0:
        return 0

    if not os.path.exists(RULES_PATH):
        return 0

    with open(RULES_PATH, "r", encoding="utf-8") as f:
        rules = json.load(f)

    # Build a name -> category_id map (prefer child categories, which are more specific)
    categories = db.query(Category).all()
    by_name: dict[str, int] = {}
    for c in categories:
        # Child categories take precedence over parents with the same name
        if c.name not in by_name or c.parent_id is not None:
            by_name[c.name] = c.id

    count = 0
    for rule in rules:
        cat_id = by_name.get(rule["category"])
        if cat_id is None:
            continue
        db.add(
            CategorizationRule(
                pattern=rule["pattern"],
                category_id=cat_id,
                priority=rule.get("priority", 5),
                source="manual",
                match_count=0,
            )
        )
        count += 1

    db.commit()
    return count
