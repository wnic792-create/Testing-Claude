"""
Lightweight startup migrations for SQLite.

We don't use Alembic — schema is defined via `Base.metadata.create_all()`,
which creates missing tables but does NOT alter existing ones. When a new
column is added to a model, databases that predate the change would keep
failing to query that column. This module adds missing columns in-place.

Each migration is idempotent: it checks whether the column already exists
(via PRAGMA table_info) before issuing ALTER TABLE.
"""
from sqlalchemy import text
from sqlalchemy.engine import Engine


# List of (table_name, column_name, column_ddl) that should exist.
# Keep this list append-only; removing entries doesn't drop columns.
REQUIRED_COLUMNS: list[tuple[str, str, str]] = [
    ("categories", "is_transfer_category", "BOOLEAN DEFAULT 0"),
]


def _existing_columns(conn, table: str) -> set[str]:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}  # row[1] is the column name


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:n"),
        {"n": table},
    ).fetchone()
    return row is not None


def run_migrations(engine: Engine) -> None:
    """Add any missing columns listed in REQUIRED_COLUMNS."""
    with engine.begin() as conn:
        for table, column, ddl in REQUIRED_COLUMNS:
            if not _table_exists(conn, table):
                # Table will be created by create_all() with the column already present.
                continue
            if column in _existing_columns(conn, table):
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
