# QC Application - Development Plan

## Architecture Overview

- **Frontend**: Next.js (static export) served by the backend
- **Backend**: Python FastAPI
- **Database**: SQLite (local persistence, simple, no extra services)
- **Packaging**: Single Docker container using `uv` for Python dependencies
- **Auth**: SQLite user store with bcrypt password hashing + JWT tokens (24h expiry). Admin can add/delete users with granular permissions
- **Hosting**: Fly.io (free tier), deployed at `https://qc-inspector-vbp.fly.dev`

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

## Step 5: Spreadsheet Integration -- COMPLETE

**Goal**: Generate and maintain a spreadsheet that reflects all Events and Master List data, integrated with Google Drive.

### Completed
- Google Sheets API via `gspread` library with service account authentication
- Service account: `qc-inspector@qc-inspector-490421.iam.gserviceaccount.com`
- Connected to user-created Google Sheet (ID: `1UGkWVxGPviinHZCspemdirrVHOxscDbmsvsPi-yRwqo`)
- Full-overwrite sync strategy: clear tab + rewrite all rows on every mutation
- Lazy connection via `ensure_connected()` on first use
- 8 Spanish-named tabs synced automatically:
  - **Lista Maestra**: Products from Master List (ID, Nombre, Nivel de Inspeccion, Nivel AQL, Proveedor, Empresa, Creado Por, Fecha de Alta, Detalles de Prueba)
  - **Inspecciones Pendientes**: Pending inspections (ID, Producto, Direccion, Tamano de Lote, Cant. Sugerida, Fecha Est., Empresa, Creado Por, Asignado A)
  - **Eventos Fallidos**: Failed events without suggested action
  - **En Espera de Correccion**: Failed events with suggested action, not yet addressed
  - **Eventos Aprobados**: Passed events + addressed fails
  - **Productos Liberados**: Released products with release date/user
  - **Acciones Sugeridas**: Configurable suggested actions list
  - **Proveedores**: Configurable suppliers list
- All tab names, column headers, and data values always in Spanish (independent of web app language setting)
- Events automatically move between tabs as status changes (including reversions)
- Manual edits to the sheet are overwritten on next web app sync
- Sync hooks added to all relevant backend endpoints (create/update/delete products, pending, events, actions, addressing, assigning, releasing)
- New endpoints: `GET /api/sheets/status`, `POST /api/sheets/connect`

### Sub-plan status
- 5.1 Master List sync: COMPLETE
- 5.2 Pending Inspections sync: COMPLETE
- 5.3 Event tabs sync (4 tabs): COMPLETE
- 5.4 Formatting & Polish (frozen headers, column widths, conditional formatting): NOT STARTED (optional)

---

## Step 6: Persistence and Authentication -- COMPLETE

**Goal**: Data survives restarts. User login is enforced.

### Completed
- Replaced in-memory storage with SQLite database (`backend/database.py`, 6 tables: users, products, events, pending_inspections, suggested_actions, suppliers)
- Added JWT-based auth (`backend/auth.py`): bcrypt password hashing, 24h token expiry, `Authorization: Bearer` header on all API calls
- All `/api/*` routes protected with `Depends(auth.require_auth)` except `/api/auth/login`
- Token also accepted via `?token=` query parameter (for PDF download links, file preview iframes, img src)
- Frontend `apiFetch()` wrapper (`frontend/app/api.ts`) auto-injects Authorization header + redirects to login on 401
- Frontend `apiUrl()` helper appends token as query param for href/iframe/img elements
- Seed database with default admin user (`user` / `password`) on first run
- Dockerized: multi-stage build (Node 20 + Python 3.12-slim with uv), FastAPI serves static Next.js export at `/`
- Docker volumes for SQLite DB and uploads persistence
- Start/stop scripts: `scripts/start.sh`, `scripts/stop.sh` (Mac/Linux), `scripts/start.bat`, `scripts/stop.bat` (Windows)
- `companies` list stored as JSON string column in SQLite
- WAL mode enabled for better read performance
- `UPLOADS_DIR` and `DB_PATH` configurable via environment variables

### Tests (all verified)
- Create data, restart backend, verify data persists
- Access API without token -> 401
- Login with wrong credentials -> 401
- Login with correct credentials -> JWT returned, access granted
- Token via query param works for file/PDF access
- TypeScript compiles cleanly, Next.js static export builds
- All 5 AQL unit tests pass

---

## Step 7: Cloud Deployment (Fly.io) -- COMPLETE

**Goal**: App accessible online without running locally.

### Completed
- Deployed to Fly.io free tier at `https://qc-inspector-vbp.fly.dev`
- `fly.toml` config: app `qc-inspector-vbp`, region `dfw`, 1GB shared VM
- Persistent volume `qc_data` mounted at `/data` (holds SQLite DB + uploads)
- `DB_PATH=/data/qc.db` and `UPLOADS_DIR=/data/uploads` set via env vars
- `JWT_SECRET` set via `flyctl secrets set`
- Auto-stop/start machines enabled (sleeps when idle, wakes on request)
- Redeploy with `flyctl deploy` from project root
