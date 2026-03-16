# QC Application - Development Plan

## Architecture Overview

- **Frontend**: Next.js (static export) served by the backend
- **Backend**: Python FastAPI
- **Database**: SQLite (local persistence, simple, no extra services)
- **Packaging**: Single Docker container using `uv` for Python dependencies
- **Auth**: In-memory user store with admin user. Admin can add/delete users with granular permissions

## Step 1: Build Initial Testable Instance (No Persistence)

**Goal**: Get a working UI with Master List and Events screens. AQL logic is deferred. No database -- use in-memory state on the backend.

**Format**: Run directly via `python` + `npm` locally (no Docker yet). This lets us iterate on look/feel quickly.

### Tasks
1. Scaffold FastAPI backend with in-memory storage (Python dicts)
   - `POST/GET/DELETE /api/products` -- Master List CRUD
   - `POST/GET /api/events` -- Events CRUD (pass/fail hardcoded to null for now)
2. Scaffold Next.js frontend
   - Login page (hardcoded user/password check)
   - Master List page: table of products, add/remove functionality
   - Events page: form with dropdowns (product, incoming/outgoing), quantity fields, results table
3. Wire frontend to backend API calls
4. Basic styling -- clean, functional, no frills

### Milestone
- User can log in, add/remove products, create events (without AQL calculation)
- UI is reviewable for look and feel

### Tests
- Manual: login flow, add product, remove product, create event, verify event appears in list

---

## Step 2: Research and Build AQL Table -- COMPLETE

**Goal**: Create an accurate AQL reference table based on ANSI/ASQ Z1.4 (ISO 2859-1) standard.

### Completed
- AQL table compiled from standard and verified against user-provided spreadsheet (`AQL Chart.xlsx`)
- Arrow cells resolved (every cell has Ac/Re pair)
- AQL range: 0.065 through 6.5 (11 values)
- Accept number sequence: 0, 1, 2, 3, 5, 7, 10, 14, 21
- Human-readable reference: `AQL_TABLES.md`

---

## Step 3: Convert AQL Table to Machine-Readable Format -- COMPLETE

**Goal**: Store the approved AQL table in a file the backend can consume.

### Completed
- `backend/data/aql_table.json` with lot ranges, sample sizes, and accept/reject table
- `backend/aql.py` utility: `get_code_letter()`, `get_sample_size()`, `get_accept_reject()`, `lookup()`
- `backend/test_aql.py` with 5 unit tests (all passing)

---

## Step 4: Connect AQL to Events -- COMPLETE

**Goal**: Events form uses AQL data for dropdowns and auto-calculates pass/fail.

### Completed
- Products have inspection_level and aql_level fields (set in master list)
- `GET /api/aql-levels` and `GET /api/inspection-levels` endpoints
- `GET /api/aql/lookup` endpoint (lot_size + inspection_level + aql_level -> code letter, sample size, Ac/Re)
- Pending inspections show auto-calculated suggested sample size
- Complete Inspection panel shows live AQL preview (code letter, Ac/Re, pass/fail) based on lot size
- Events auto-calculate pass/fail on creation and update
- Completed events table shows Sample, Ac/Re, and Pass/Fail columns

### Additional Features (added post Step 4)
- **PDF Export**: Single-event branded PDF + all-events table PDF via reportlab. Layout follows `Event Display Output Template.pdf`.
- **i18n**: English/Spanish toggle (React Context + localStorage). PDFs also generated in selected language.
- **Multi-company**: VBC / VBP / All company selector. Products, events, and pending inspections are tagged with companies and filtered accordingly.
- **User tracking**: `created_by` field on events and pending inspections, shown in tables.
- **User management**: Admin-only Users tab. Super admin can add/delete users with per-user permissions (company access, manage products, delete pending, delete events). Permissions enforced on frontend by hiding/showing UI elements.
- **Failed Events workflow**: Failed inspections go through a lifecycle: Failed Events (assign suggested action) -> Awaiting Fix (mark as addressed with date) -> released into Passed Events (with wrench icon indicator). Suggested actions are configurable in Settings.
- **Event sections**: Events page is split into: Failed Events (needs suggested action, orange title), Awaiting Fix (has action, needs addressing, red title, shown above Passed Events), and Passed Events (passed + addressed fails merged, with status icons: green checkmark for first-pass, orange wrench for fixed).
- **Number formatting**: All displayed numbers use comma formatting (toLocaleString).
- **Company logos**: VBC and VBP logos shown in nav bar, conditional on selected company.
- **Supplier field**: Products have a supplier field selected from an admin-configurable supplier list. Suppliers managed in Settings. Cascade on delete sets supplier to "pending". Marked as REPORT VARIABLE for future reporting dashboard.
- **Pagination**: All event sections (Pending, Failed Events, Awaiting Fix, Passed Events, Released Products) paginated with 10/20/50 per-page selector and Previous/Next navigation. Pagination controls hidden when 10 or fewer items.
- **Sortable columns**: All event section tables have clickable column headers that toggle ascending/descending sort. Sort indicator arrows shown on active column.
- **QC Technical Doc**: Product file upload field renamed from "File" to "QC Technical Doc" (EN/ES). File preview serves inline with proper MIME type instead of auto-downloading. Download opens in new browser tab.
- **Assigned To**: Dropdown column in Pending Inspections and Awaiting Fix sections, populated with registered users. Permission-gated by `can_assign` permission.
- **Resolved By**: Column in Passed Events showing who completed/resolved each event (`created_by` for first-pass passes, `addressed_by` for addressed fails).
- **Released Products**: Button in Passed Events to release products (mark as shipped). Released events move to a dedicated "Released Products" section with purple header, tracking release date and releasing user. Unrelease available.

---

## Step 5: Spreadsheet Integration

**Goal**: Generate and maintain a spreadsheet that reflects all Events and Master List data, integrated with Google Drive.

### Tasks
1. Evaluate approach: generate `.xlsx` file on each change using `openpyxl`, upload via Google Drive API
   - Alternative: use Google Sheets API directly to write cells
   - Decision: Use Google Sheets API for true dynamic updating
2. Set up Google Cloud service account with Sheets API access
3. On every event creation or master list change, update the Google Sheet:
   - Sheet 1: Master List (product names, date added)
   - Sheet 2: Events log (all event fields including pass/fail result)
4. Provide configuration for the Google Sheet ID and service account credentials

### Milestone
- Changes in the app are reflected in the Google Sheet within seconds
- Sheet is readable and well-formatted

### Tests
- Add product -> verify it appears in Sheet 1
- Create event -> verify it appears in Sheet 2 with correct pass/fail

---

## Step 6: Persistence and Authentication

**Goal**: Data survives restarts. User login is enforced.

### Tasks
1. Replace in-memory storage with SQLite database
   - Tables: `users`, `products`, `events`
   - Schema supports multiple users (MVP uses one hardcoded)
2. Add JWT-based auth:
   - `POST /api/auth/login` -- validates credentials, returns JWT
   - Middleware protects all `/api/*` routes
3. Seed database with default user (`user` / `password`)
4. Dockerize everything:
   - Multi-stage build: build Next.js static files, then copy into Python image
   - FastAPI serves static files at `/`
   - SQLite database stored in a Docker volume for persistence
5. Create start/stop scripts in `scripts/` for Mac, PC, Linux

### Milestone
- App runs in Docker, data persists across container restarts
- Login required to access any functionality
- Start/stop scripts work on all three platforms

### Tests
- Create data, restart container, verify data persists
- Access API without token -> 401
- Login with wrong credentials -> rejected
- Login with correct credentials -> access granted
