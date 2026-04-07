# Local Finance

Local-first personal finance app for budgeting, forecasting, and net worth tracking. Single-user, runs on your machine, data stored in SQLite.

## Stack

- **Backend**: Python 3.11+ / FastAPI / SQLAlchemy / SQLite
- **Frontend**: React 19 / Vite / TypeScript / Tailwind CSS / Recharts
- **Database**: SQLite (`data/finance.db`)

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

API docs available at http://127.0.0.1:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at http://localhost:5173

### Both together

Terminal 1: start backend (from project root)
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2: start frontend
```bash
cd frontend && npm run dev
```

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI app, router mounts, CORS
│   ├── database.py          # SQLAlchemy engine, session, Base
│   ├── models/              # ORM models (account, transaction, category, etc.)
│   ├── routers/             # API endpoints per domain
│   ├── services/            # Business logic (forecast, tax, import, categorization)
│   ├── seed/                # Config data (tax brackets, bank templates, categories)
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/      # React components by domain
│       ├── api/             # API client
│       ├── stores/          # Zustand state stores
│       ├── i18n/            # EN/FR translations
│       └── hooks/
├── data/                    # SQLite database (gitignored)
└── README.md
```

## Data & Backups

- Database location: `data/finance.db`
- **Backup**: `GET /api/backup/export` downloads the entire database as a single `.db` file
- **Restore**: `POST /api/backup/import` uploads a `.db` file to replace the current database (server restart required after restore)
- Manual backup: simply copy `data/finance.db` to your backup location

## Configuration

- **Tax brackets**: `backend/seed/tax_config_2025.json` — swap in new year by creating a new file
- **Bank CSV mappings**: `backend/seed/bank_csv_templates.json` — add new banks as JSON entries
- **Default categories**: `backend/seed/default_categories.json` — bilingual (EN/FR)
- **Stress test presets**: `backend/seed/stress_test_presets.json`

## Features

- [x] Data model + project scaffolding
- [x] Transaction import (CSV/OFX/QFX) + auto-categorization (regex rules + learning)
- [x] Budgeting (envelope-style with rollover, variance reporting)
- [x] 5-year forecast engine (60-month, QC+federal tax, amortization, investment returns)
- [x] Scenario management (create, clone, compare side-by-side) + stress test presets
- [x] Goal tracking with projected hit dates from forecast
- [x] Net worth snapshots + history
- [x] Recurring transaction detection
- [x] Backup/restore (full database export/import)
- [x] Bilingual UI (EN/FR Québécois) with toggle
- [x] Dark mode + dense information-rich design
- [x] Export (CSV + JSON with filters)
- [x] Settings page (theme, language, backup/restore)

## Security

- Binds to `127.0.0.1` only — not exposed on your network
- Zero auth — single user, localhost only
- No data leaves your machine
