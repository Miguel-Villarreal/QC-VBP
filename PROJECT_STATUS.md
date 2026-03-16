# QC Inspector - Project Status

## Current State: Steps 1-4 Complete + Company, i18n, PDF, User Management, Failed Events Workflow, Suppliers, Pagination, Sorting, Assigned To, Released Products

Steps 1 through 4 from `plan.md` are complete. The app has a working AQL engine based on ANSI/ASQ Z1.4 with corrected values from the official standard. Additional features added: multi-company support (VBC/VBP/All), English/Spanish language toggle, PDF export with Pass/Fail, user tracking on records, user management with granular permissions, failed events lifecycle (suggested actions, awaiting fix, addressed), number formatting with commas, company logos in nav bar, supplier field on products (admin-configurable, REPORT VARIABLE), pagination on all event sections (10/20/50 per page), sortable column headers on all event tables, QC Technical Doc file upload (inline preview, new-tab download), Assigned To dropdowns in Pending/Awaiting Fix (permission-gated), Resolved By column in Passed Events, and Released Products section with release/unrelease workflow. Ready to proceed to Step 5 (Google Sheets integration).

---

## Architecture

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS v4 -- dev server on port 3000
- **Backend**: Python FastAPI with in-memory dicts -- runs on port 8001
- **Auth**: In-memory user store. Default admin: user/password. Admin can add/delete users with granular permissions. Token + permissions stored in localStorage
- **i18n**: English/Spanish toggle via React Context, persisted in localStorage. PDFs also respect language setting.
- **Company**: Multi-company support (VBC, VBP, All). Each product/event/pending inspection is tagged with companies. Dropdown in nav bar filters all views and creates. Users with restricted company_access see only their company (no dropdown).
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
| `AQL_TABLES.md` | Human-readable AQL reference tables (verified against standard) |
| `AQL Chart.xlsx` | User-provided spreadsheet with correct Ac/Re values (source of truth) |
| `Event Display Output Template.pdf` | **Template for single-event PDF export** -- when updated, code must be updated to match (see PDF Export section) |
| `VB Packaging Logo.JPG` | Company logo (copy also at `backend/data/logo.jpg`) |
| `frontend/public/logo_VBC.png` | VBC logo for nav bar |
| `frontend/public/logo_VBP.jpg` | VBP logo for nav bar |

### Backend (`backend/`)
| File | Purpose |
|------|---------|
| `main.py` | FastAPI application (~843 lines) |
| `aql.py` | AQL lookup utility (code letter, sample size, accept/reject) |
| `data/aql_table.json` | Machine-readable AQL tables (from ANSI/ASQ Z1.4) |
| `test_aql.py` | Unit tests for AQL lookups (5 tests) |
| `requirements.txt` | Python deps: `fastapi`, `uvicorn[standard]`, `reportlab` |

### Frontend (`frontend/`)
| File | Purpose |
|------|---------|
| `package.json` | Next.js 15, React 19, Tailwind v4 |
| `tsconfig.json` | TypeScript config (ES2017 target, bundler resolution) |
| `next.config.ts` | Empty config (defaults) |
| `postcss.config.mjs` | Tailwind via `@tailwindcss/postcss` |
| `app/globals.css` | Single line: `@import "tailwindcss"` |
| `app/i18n.tsx` | i18n system (~315 lines, translations, I18nProvider, CompanyProvider, AuthProvider, useI18n, useCompany, useAuth hooks) |
| `app/providers.tsx` | Client wrapper combining I18nProvider + AuthProvider + CompanyProvider |
| `app/layout.tsx` | Root layout, page title "QC Inspector", wraps children with Providers |
| `app/page.tsx` | Login page (username/password form, translated, sets company on login) |
| `app/dashboard/layout.tsx` | Nav bar with tabs, company dropdown (or static label if restricted), language dropdown, auth check, sign out |
| `app/dashboard/page.tsx` | Redirects to `/dashboard/products` |
| `app/dashboard/products/page.tsx` | Master List CRUD (~452 lines) with inspection level, AQL level, supplier, company filter, permission-gated, QC Technical Doc inline preview |
| `app/dashboard/events/page.tsx` | Main events page (~1523 lines, most complex file), permission-gated actions, failed events workflow, pagination, sortable columns, Company column, Assigned To, Released Products |
| `app/dashboard/users/page.tsx` | Admin-only user/settings management page (~426 lines, add/delete users with can_assign permission, suggested actions, suppliers) |

---

## API Endpoints

### Auth
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/auth/login` | `{username, password}` | Returns `{token, username, is_admin, company_access, can_manage_products, can_edit_pending, can_delete_pending, can_edit_events, can_delete_events, can_set_suggested_action, can_mark_addressed, can_edit_addressed, can_delete_addressed, can_assign}` |

### Users (Admin only)
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/users` | -- | Returns all users (password excluded) |
| POST | `/api/users` | `{username, password, company_access, can_manage_products, can_delete_pending, can_delete_events, can_assign, ...}` | Creates non-admin user with granular permissions |
| DELETE | `/api/users/{username}` | -- | Deletes user (admin cannot be deleted) |

### Reference Data
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/aql-levels` | Returns available AQL levels (0.065 through 6.5) |
| GET | `/api/inspection-levels` | Returns inspection levels (I, II, III, S-1 through S-4) |
| GET | `/api/companies` | Returns company list: `["VBC", "VBP"]` |
| GET | `/api/aql/lookup` | Query params: `lot_size`, `inspection_level`, `aql_level`. Returns code letter, sample size, accept, reject |

### Products (Master List)
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/products` | `?company=All\|VBC\|VBP` | Returns products filtered by company |
| POST | `/api/products` | `{name, inspection_level, aql_level, test_details, supplier, company}` | Creates product. `company="All"` assigns to both VBC and VBP |
| PUT | `/api/products/{id}` | `{name, inspection_level, aql_level, test_details, supplier, company}` | Updates product |
| DELETE | `/api/products/{id}` | -- | Removes product |

### Pending Inspections
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/pending` | `?company=All\|VBC\|VBP` | Returns pending inspections filtered by company |
| POST | `/api/pending` | `{product_id, direction, lot_size, estimated_date, company}` | Creates pending inspection, auto-calculates suggested sample size |
| PUT | `/api/pending/{id}` | `{product_id, direction, lot_size, estimated_date, company}` | Updates pending inspection |
| DELETE | `/api/pending/{id}` | -- | Removes pending inspection |

### Events (Completed Inspections)
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/events` | `?company=All\|VBC\|VBP` | Returns events filtered by company |
| POST | `/api/events` | `{product_id, direction, lot_size, quantity_inspected, quantity_non_conforming, date_inspected, pending_id?, company}` | Creates event with auto-calculated pass/fail from AQL. Removes pending if `pending_id` provided |
| PUT | `/api/events/{id}` | `{product_id, direction, lot_size, quantity_inspected, quantity_non_conforming, date_inspected}` | Updates event, recalculates pass/fail |
| DELETE | `/api/events/{id}` | -- | Removes event |

### Suggested Actions
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/suggested-actions` | -- | Returns list of configurable suggested actions |
| POST | `/api/suggested-actions` | `{action}` | Adds a new suggested action |
| DELETE | `/api/suggested-actions/{action}` | -- | Removes a suggested action |

### Suppliers
| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/suppliers` | -- | Returns list of supplier names |
| POST | `/api/suppliers` | `{name}` | Adds a new supplier |
| DELETE | `/api/suppliers/{index}` | -- | Removes supplier; cascades to products (sets their supplier to "pending") |

### Event Actions (Suggested Action & Addressing)
| Method | Path | Body | Notes |
|--------|------|------|-------|
| PUT | `/api/events/{id}/suggested-action` | `{suggested_action}` | Sets suggested action on a failed event |
| PUT | `/api/events/{id}/address` | `{addressed_date}` | Marks a failed event as addressed |
| PUT | `/api/events/{id}/unaddress` | -- | Unmarks an addressed event |

### Assignment & Release
| Method | Path | Body | Notes |
|--------|------|------|-------|
| PATCH | `/api/pending/{id}/assign` | `{assigned_to}` | Assign a user to a pending inspection |
| PATCH | `/api/events/{id}/assign` | `{assigned_to}` | Assign a user to an event (Awaiting Fix) |
| PATCH | `/api/events/{id}/release` | `{released_by}` | Release/unrelease a passed event. Toggle: sets `released=true/false`, `released_date`, `released_by` |

### PDF Export
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/events/export/pdf` | `?lang=en\|es&company=All\|VBC\|VBP` Exports filtered events as a landscape table PDF |
| GET | `/api/events/{id}/export/pdf` | `?lang=en\|es` Exports single event as a branded inspection report PDF |

---

## Data Models

### Product
```python
{
    "id": int,
    "name": str,
    "inspection_level": str,  # "I", "II", "III", "S-1", "S-2", "S-3", "S-4"
    "aql_level": str,         # "0.065" through "6.5"
    "test_details": str,
    "supplier": str,          # from admin-configurable supplier list; "pending" if supplier was deleted
    "companies": list[str],   # ["VBC"], ["VBP"], or ["VBC", "VBP"]
    "created_by": str,
    "created_at": str
}
```

### PendingInspection
```python
{
    "id": int,
    "product_id": int,
    "product_name": str,
    "direction": str,              # "incoming" or "outgoing"
    "lot_size": int,
    "suggested_sample_size": int,  # auto-calculated from AQL tables
    "estimated_date": str,
    "companies": list[str],        # ["VBC"], ["VBP"], or ["VBC", "VBP"]
    "created_by": str,
    "created_at": str,
    "assigned_to": str|None         # user assigned to handle this inspection
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
    "pass_fail": str,           # "pass" or "fail", auto-calculated from AQL
    "sample_size": int,         # from AQL lookup
    "accept_number": int,       # Ac from AQL table
    "reject_number": int,       # Re from AQL table (always Ac+1)
    "code_letter": str,         # AQL code letter (A-R)
    "date_inspected": str,
    "companies": list[str],     # ["VBC"], ["VBP"], or ["VBC", "VBP"]
    "created_by": str,
    "created_at": str,
    "suggested_action": str|None,  # assigned from configurable suggested actions list
    "addressed": bool,             # whether the failed event has been addressed
    "addressed_date": str|None,    # date the fail was addressed
    "addressed_by": str|None,      # user who marked as addressed
    "assigned_to": str|None,       # user assigned to handle this event
    "released": bool,              # whether products have been released/shipped
    "released_date": str|None,     # date of release
    "released_by": str|None        # user who released the products
}
```

---

## AQL Integration (Steps 2-4)

AQL values are sourced from ANSI/ASQ Z1.4-2003 (R2018), verified against user-provided spreadsheet.

- **AQL range**: 0.065, 0.10, 0.15, 0.25, 0.40, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5 (11 values)
- **Inspection levels**: I, II, III, S-1, S-2, S-3, S-4
- **Code letters**: A through R (16 letters, sample sizes 2 to 2000)
- **Accept numbers**: 0, 1, 2, 3, 5, 7, 10, 14, 21 (reject = accept + 1)
- **Arrow cells resolved**: every cell in the table has an Ac/Re pair

### How it works
1. Product has inspection_level and aql_level set in master list
2. When scheduling an inspection, lot_size + product settings -> code letter -> suggested sample size
3. When completing an inspection, lot_size + product settings -> code letter -> Ac/Re -> compare with non-conforming count -> pass/fail
4. Live AQL preview shown in the Complete Inspection panel (updates as lot size changes)

---

## UI Features

### Login Page (`/`)
- Username/password form, validates against backend, stores token + permissions in localStorage
- On login, company is set to user's `company_access` (restricts view for non-All users)

### Navigation (`/dashboard/*`)
- Top nav bar: Company logos (VBC/VBP, conditional on selection) + "QC Inspector" branding, "Master List" tab, "Events" tab, "Users" tab (admin only), Company dropdown (All/VBC/VBP) or static company label if user has restricted access, Language dropdown (English/Espanol), "Sign Out"
- Active tab highlighted in blue
- Auth check on load (redirects to login if no token)
- Company selection filters all product/event/pending views and tags new records accordingly
- Language selection translates all visible UI text and PDF exports

### Users Page (`/dashboard/users`) -- Admin only
- Add user form: username, password, company access dropdown, permission checkboxes (manage products, edit/delete pending, edit/delete events, set suggested action, mark/edit/delete addressed, assign users)
- Suggested Actions management: add/delete configurable actions used in Failed Events workflow
- Suppliers management: add/delete supplier names used in product creation (cascade on delete sets products to "pending")
- Table: Username, Company Access, permissions columns, Delete button
- Admin user has yellow "Admin" badge and cannot be deleted
- Non-admin users see "Access denied" if they navigate to this page

### Master List (`/dashboard/products`)
- Add product form and edit/delete buttons hidden if user lacks `can_manage_products` permission
- Add product form: name, inspection level dropdown, AQL level dropdown, test details textarea, supplier dropdown, QC Technical Doc file upload
- Table: ID, Name, Inspection Level, AQL Level, Test Details (truncated with hover tooltip), QC Technical Doc (inline preview, download opens in new tab), Supplier (orange italic if "pending"), Date Added, Added By, Edit/Delete actions
- Inline edit mode with Save/Cancel

### Events Page (`/dashboard/events`)

**Schedule Inspection** (top form):
- Product dropdown (from Master List), Direction dropdown, Lot Size input, Estimated Date picker

**Pending Inspections** (table, only shown when items exist):
- Columns: Product, Direction, Lot Size, Suggested Qty (auto-calculated), Est. Date, Company, User, Assigned To (all sortable)
- Overdue detection: rows with past dates get red background + "OVERDUE" badge
- Actions: Inspect, Edit, Delete
- Edit mode: inline editing with yellow background, Save/Cancel buttons
- Pagination: 10/20/50 per page with Previous/Next controls

**Complete Inspection** (blue panel, appears when "Inspect" clicked):
- Pre-fills from pending: product, direction, lot size
- Fields: Lot Size, Suggested Inspection Qty (auto-calculated, read-only), Qty Inspected, Qty Non-Conforming, Date Inspected (defaults to today)
- AQL info box: shows Code Letter, Accept/Reject numbers, live Pass/Fail preview
- Complete/Cancel buttons
- On complete: creates event + removes pending inspection

**Failed Events** (table, orange title, shown when failed events without suggested action exist):
- Columns: ID, Product, Direction, Lot Size, Sample, Inspected, Non-Conf., Ac/Re, Suggested Action (dropdown), Date, Company, User (all sortable except Ac/Re)
- Suggested Action dropdown allows assigning a configurable action to failed events
- Actions: PDF, Edit, Delete
- "Export PDF" button exports all events as a landscape table
- Pagination: 10/20/50 per page with Previous/Next controls

**Awaiting Fix** (table, red title, shown above Passed Events when failed events have suggested action but not yet addressed):
- Columns: ID, Product, Direction, Lot Size, Non-Conf., Suggested Action, Date, Company, User, Assigned To, Addressed Date (date picker) (all sortable except Addressed Date)
- "Mark Addressed" button moves event to Passed Events (records `addressed_by`)
- Actions: Mark Addressed, PDF
- Pagination: 10/20/50 per page with Previous/Next controls

**Passed Events** (table, merges first-pass passes + addressed fails, excludes released):
- Columns: Status icon, ID, Product, Direction, Lot Size, Sample, Inspected, Non-Conf., Ac/Re, Date, Company, Resolved By, Release Date (date picker, defaults to today) (all sortable except status icon, Ac/Re, Release Date)
- Status icon column: green checkmark for first-pass passes, orange wrench for fixed (addressed) fails
- "Resolved By" column: shows `created_by` for first-pass passes, `addressed_by` for addressed fails
- Release Date: user-selectable date picker per row (defaults to today, can be changed before releasing)
- Addressed events show Unaddress, Edit, Delete actions; regular events show Edit, Delete
- Actions: Release (purple button, uses selected release date), PDF, Edit, Delete (permission-gated)
- All numbers formatted with commas (toLocaleString)
- Pagination: 10/20/50 per page with Previous/Next controls

**Released Products** (table, purple header, shown when released events exist):
- Columns: Status icon, ID, Product, Direction, Lot Size, Sample, Inspected, Non-Conf., Ac/Re, Date, Company, Resolved By, Released Date, Released By (all sortable except status icon and Ac/Re)
- Status icon column: same as Passed Events (green checkmark / orange wrench)
- Default sort: released_date descending
- Actions: Unrelease (purple button), PDF, Delete (permission-gated)
- Pagination: 10/20/50 per page with Previous/Next controls

### PDF Export (Single Event Inspection Report)

The single-event PDF is generated server-side using `reportlab` and follows the layout defined in `Event Display Output Template.pdf` (root of project). **When the template PDF is updated, the code in `backend/main.py` (`export_single_event_pdf` function) must be updated to match.**

Layout:
- **Header**: VB Packaging logo (`backend/data/logo.jpg`) top-left + company address top-right
- **Title**: "Inspection Report"
- **Data table** (2 columns: Display Label, Value):
  - Product, Inspection Date, Lot Size, Sample Size, Units Inspected, Ac/Re, Non Conforming Units
- **Pass/Fail result**: Centered bold text below the table -- green if PASS, red if FAIL
- **Footer**: Contact info (Miguel Villarreal, email, phone) + decorative wave graphic

---

## Remaining Steps (from plan.md)

| Step | Description | Status |
|------|-------------|--------|
| 1 | Build initial testable instance | COMPLETE |
| 2 | Research AQL levels (ANSI/ASQ Z1.4 / ISO 2859-1) | COMPLETE |
| 3 | Convert AQL table to JSON (`backend/data/aql_table.json`) | COMPLETE |
| 4 | Connect AQL to Events (dropdowns, auto-calculate pass/fail, populate Suggested Qty) | COMPLETE |
| 5 | Google Sheets integration for dynamic spreadsheet updates | NOT STARTED |
| 6 | SQLite persistence, JWT auth, Docker container, start/stop scripts | NOT STARTED |

---

## Technical Notes

- Backend uses port 8001 (port 8000 was occupied by another app)
- Frontend API URL configured via `NEXT_PUBLIC_API_URL` env var, defaults to `http://localhost:8001`
- Tailwind v4 uses the new `@tailwindcss/postcss` plugin pattern (not the v3 config approach)
- All frontend pages are `"use client"` components
- Container width on events page is `max-w-5xl`
- AQL lookup is lot-size-based (lot size + inspection level -> code letter -> sample size + Ac/Re)
- Multi-company: records store `companies` as a list (e.g. `["VBC"]` or `["VBC", "VBP"]`). "All" in the UI means both companies.
- i18n: translations defined in `frontend/app/i18n.tsx`, ~140 keys. Language and company choice persisted in localStorage.
- All displayed numbers on Events page use `.toLocaleString()` for comma formatting
- Failed events lifecycle: Failed Events (no action) -> assign suggested action -> Awaiting Fix -> mark addressed -> Passed Events (with wrench icon)
- Pagination: all event section tables paginated client-side (10/20/50 per page). Pagination controls hidden when <= 10 items. Page resets to 1 on data change or sort change.
- Sortable columns: click column header to toggle asc/desc sort. Sort arrows indicate direction. Implemented via inline `sortItems` + `SortArrow` component in events page.
- Supplier cascade: deleting a supplier sets all products with that supplier to "pending" (shown in orange italic in UI)
- `suppressHydrationWarning` on `<html>` tag in layout.tsx to prevent browser extension hydration mismatches
- File serving: product files served inline with MIME type detection (`content_disposition_type="inline"`) instead of triggering download
- Assigned To: permission-gated dropdown (renders as plain text for users without `can_assign`). Populated from `/api/users` endpoint.
- Released Products: events with `released=true` are excluded from Passed Events and shown in dedicated Released Products section
- GitHub repo: https://github.com/Miguel-Villarreal/QC-VBP
