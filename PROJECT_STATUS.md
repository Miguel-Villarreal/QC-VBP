# QC Inspector - Project Status

## Current State: Step 1 Complete

Step 1 (Build Initial Testable Instance) from `plan.md` is fully complete. The app runs locally without persistence (in-memory backend). Ready to proceed to Step 2 (AQL Research).

---

## Architecture

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS v4 -- dev server on port 3000
- **Backend**: Python FastAPI with in-memory dicts -- runs on port 8001
- **Auth**: Hardcoded credentials (user/password), token stored in localStorage
- **No persistence**: All data resets on backend restart

---

## How to Run

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8001
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:3000
```

Login: username `user`, password `password`

---

## File Inventory

### Root
| File | Purpose |
|------|---------|
| `AGENTS.md` | Business requirements and coding standards |
| `plan.md` | 6-step development plan with milestones and tests |
| `PROJECT_STATUS.md` | This file |

### Backend (`backend/`)
| File | Purpose |
|------|---------|
| `main.py` | Entire FastAPI application (190 lines) |
| `requirements.txt` | Python deps: `fastapi`, `uvicorn[standard]` |

### Frontend (`frontend/`)
| File | Purpose |
|------|---------|
| `package.json` | Next.js 15, React 19, Tailwind v4 |
| `tsconfig.json` | TypeScript config (ES2017 target, bundler resolution) |
| `next.config.ts` | Empty config (defaults) |
| `postcss.config.mjs` | Tailwind via `@tailwindcss/postcss` |
| `app/globals.css` | Single line: `@import "tailwindcss"` |
| `app/layout.tsx` | Root layout, page title "QC Inspector" |
| `app/page.tsx` | Login page (username/password form) |
| `app/dashboard/layout.tsx` | Nav bar with "Master List" and "Events" tabs, auth check, sign out |
| `app/dashboard/page.tsx` | Redirects to `/dashboard/products` |
| `app/dashboard/products/page.tsx` | Master List CRUD (add/remove products) |
| `app/dashboard/events/page.tsx` | Main events page (~687 lines, most complex file) |

---

## API Endpoints

### Auth
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | `{username, password}` | Returns `{token, username}`. Hardcoded to user/password |

### Products (Master List)
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/products` | -- | Returns array of all products |
| POST | `/api/products` | `{name}` | Creates product, auto-increments ID |
| DELETE | `/api/products/{id}` | -- | Removes product |

### Pending Inspections
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/pending` | -- | Returns array of all pending inspections |
| POST | `/api/pending` | `{product_id, direction, lot_size, estimated_date}` | Creates pending inspection |
| PUT | `/api/pending/{id}` | `{product_id, direction, lot_size, estimated_date}` | Updates pending inspection |
| DELETE | `/api/pending/{id}` | -- | Removes pending inspection |

### Events (Completed Inspections)
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/events` | -- | Returns array of all events |
| POST | `/api/events` | `{product_id, direction, lot_size, quantity_inspected, quantity_non_conforming, date_inspected, pending_id?}` | Creates event. If `pending_id` provided, auto-removes that pending inspection |
| PUT | `/api/events/{id}` | `{product_id, direction, lot_size, quantity_inspected, quantity_non_conforming, date_inspected}` | Updates event |
| DELETE | `/api/events/{id}` | -- | Removes event |

---

## Data Models

### Product
```python
{
    "id": int,           # auto-increment
    "name": str,
    "created_at": str    # ISO datetime
}
```

### PendingInspection
```python
{
    "id": int,
    "product_id": int,
    "product_name": str,
    "direction": str,       # "incoming" or "outgoing"
    "lot_size": int,
    "estimated_date": str,  # ISO date "YYYY-MM-DD"
    "created_at": str
}
```

### Event (Completed Inspection)
```python
{
    "id": int,
    "product_id": int,
    "product_name": str,
    "direction": str,
    "lot_size": int,
    "quantity_inspected": int,
    "quantity_non_conforming": int,
    "pass_fail": None,      # placeholder -- will be calculated by AQL in Step 4
    "date_inspected": str,
    "created_at": str
}
```

---

## UI Features Implemented

### Login Page (`/`)
- Username/password form, validates against backend, stores token in localStorage

### Navigation (`/dashboard/*`)
- Top nav bar: "QC Inspector" branding, "Master List" tab, "Events" tab, "Sign Out"
- Active tab highlighted in blue
- Auth check on load (redirects to login if no token)

### Master List (`/dashboard/products`)
- Add product form (text input + button)
- Table: ID, Name, Date Added, Remove button

### Events Page (`/dashboard/events`)

**Schedule Inspection** (top form):
- Product dropdown (from Master List), Direction dropdown, Lot Size input, Estimated Date picker
- "Schedule" button creates a pending inspection

**Pending Inspections** (table, only shown when items exist):
- Columns: Product, Direction, Lot Size, Suggested Qty (placeholder "--"), Est. Date
- Overdue detection: rows with past dates get red background + "OVERDUE" badge
- Actions: Inspect, Edit, Delete
- Edit mode: inline editing with yellow background, Save/Cancel buttons

**Complete Inspection** (blue panel, appears when "Inspect" clicked):
- Pre-fills from pending: product, direction, lot size
- Fields: Lot Size, Suggested Inspection Qty (disabled placeholder "--"), Qty Inspected, Qty Non-Conforming, Date Inspected (defaults to today)
- Complete/Cancel buttons
- On complete: creates event + removes pending inspection

**Completed Events** (table):
- Columns: ID, Product, Direction, Lot Size, Inspected, Non-Conforming, Pass/Fail (placeholder "--"), Date Inspected
- Actions: Edit, Delete
- Edit mode: inline editing with yellow background, Save/Cancel buttons

---

## Placeholder Fields (for Step 2-4: AQL Integration)

These fields exist in the UI but show "--" and are marked with TODO comments:

1. **Suggested Qty** column in Pending Inspections table -- will show recommended sample size based on lot size + AQL level
2. **Suggested Inspection Qty** field in Complete Inspection panel -- same, shown during inspection
3. **Pass/Fail** column in Completed Events table -- will be auto-calculated based on AQL accept/reject numbers vs non-conforming count

All three have `TODO: populate from AQL table based on lot size + inspection level` comments in the source code.

---

## Remaining Steps (from plan.md)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Build initial testable instance | COMPLETE |
| 2 | Research AQL levels (ANSI/ASQ Z1.4 / ISO 2859-1) | NOT STARTED |
| 3 | Convert AQL table to JSON (`backend/data/aql_table.json`) | NOT STARTED |
| 4 | Connect AQL to Events (dropdowns, auto-calculate pass/fail, populate Suggested Qty) | NOT STARTED |
| 5 | Google Sheets integration for dynamic spreadsheet updates | NOT STARTED |
| 6 | SQLite persistence, JWT auth, Docker container, start/stop scripts | NOT STARTED |

---

## Technical Notes

- Backend uses port 8001 (port 8000 was occupied by another app)
- Frontend API URL configured via `NEXT_PUBLIC_API_URL` env var, defaults to `http://localhost:8001`
- Tailwind v4 uses the new `@tailwindcss/postcss` plugin pattern (not the v3 config approach)
- All frontend pages are `"use client"` components
- Container width on events page is `max-w-5xl`
