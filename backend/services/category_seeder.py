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


TRANSFER_CATEGORY_NAMES = {"Investment", "Credit Card Payment"}


def _backfill_transfer_categories(db: Session) -> None:
    """
    Ensure is_transfer_category is set on the two special categories and that
    'Investment' exists under 'Financial' for DBs seeded before this feature.
    """
    cats = db.query(Category).all()
    by_name: dict[str, Category] = {c.name: c for c in cats}

    changed = False
    for name in TRANSFER_CATEGORY_NAMES:
        cat = by_name.get(name)
        if cat and not cat.is_transfer_category:
            cat.is_transfer_category = True
            changed = True

    # Create Investment child under Financial if missing
    financial = by_name.get("Financial")
    if financial and "Investment" not in by_name:
        db.add(Category(
            name="Investment",
            name_fr="Investissement",
            parent_id=financial.id,
            type="expense",
            is_system=False,
            is_transfer_category=True,
        ))
        changed = True

    if changed:
        db.commit()


def seed_categories(db: Session) -> int:
    """
    Seed default categories from default_categories.json if none exist.
    Returns the number of categories created.
    """
    existing = db.query(Category).count()
    if existing > 0:
        # Categories already exist — still ensure rules are seeded
        seed_rules(db)
        # Back-fill is_transfer_category for existing DBs that predate this field
        _backfill_transfer_categories(db)
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
                is_transfer_category=child.get("is_transfer_category", False),
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
