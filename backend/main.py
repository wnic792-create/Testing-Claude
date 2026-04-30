from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from backend.database import engine, Base

# Import all models so they register with Base
import backend.models.account
import backend.models.transaction
import backend.models.category
import backend.models.budget
import backend.models.scenario
import backend.models.forecast
import backend.models.goal
import backend.models.snapshot
import backend.models.settings
import backend.models.recurring
import backend.models.profile
import backend.models.holding

from backend.routers import accounts, transactions, categories, import_export, budgets, forecast, scenarios, goals, backup, recurring, profiles, holdings
from backend.database import SessionLocal
from backend.services.category_seeder import seed_categories
from backend.services.migrations import run_migrations

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Apply lightweight column-add migrations BEFORE create_all so models
    # with newly-added columns don't blow up on legacy databases.
    run_migrations(engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_categories(db)
        _seed_default_profile(db)
    finally:
        db.close()
    yield

def _seed_default_profile(db):
    from backend.models.profile import Profile
    if db.query(Profile).count() == 0:
        db.add(Profile(name="My Finances", color="#3B82F6", avatar_initial="M"))
        db.commit()


app = FastAPI(title="Local Finance", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(import_export.router, prefix="/api/import", tags=["import"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(forecast.router, prefix="/api/forecast", tags=["forecast"])
app.include_router(scenarios.router, prefix="/api/scenarios", tags=["scenarios"])
app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
app.include_router(backup.router, prefix="/api/backup", tags=["backup"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["recurring"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["profiles"])
app.include_router(holdings.router, prefix="/api/holdings", tags=["holdings"])

@app.get("/api/health")
def health():
    return {"status": "ok"}
