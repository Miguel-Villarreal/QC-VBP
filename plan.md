# QC Application - Development Plan

## Architecture Overview

- **Frontend**: Next.js (static export) served by the backend
- **Backend**: Python FastAPI
- **Database**: SQLite (local persistence, simple, no extra services)
- **Packaging**: Single Docker container using `uv` for Python dependencies
- **Auth**: SQLite user store with bcrypt password hashing + JWT tokens (24h expiry). Admin can add/delete/edit users with granular permissions
- **Hosting**: Fly.io (pay-as-you-go, ~$2-3/month), deployed at `https://qc-inspector-vbp.fly.dev` and `https://calidad.vbc.mx`
- **Backups**: Nightly automated DB backup via Windows Task Scheduler + `scripts/backup.ps1`

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
- **Edit User**: Admin can inline-edit any user's username, password, company access, and all permissions via PATCH endpoint. Edit form appears in-row with blue background.
- **Custom Domain**: `calidad.vbc.mx` points to Fly.io deployment via A/AAAA DNS records.

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
- Custom domain `calidad.vbc.mx` configured with A/AAAA DNS records (via InMotion Hosting nameservers)
- Redeploy with `flyctl deploy` from project root
- **NOTE**: Fly.io trial ended. Credit card added, app back online as pay-as-you-go (~$2-3/month). Oracle Cloud migration (Step 8) on hold due to ARM capacity issues in Monterrey region.

---

## Step 8: Migrate to Oracle Cloud Free Tier -- ON HOLD

**Goal**: Move hosting from Fly.io to Oracle Cloud Always Free tier with Coolify for git-push-to-deploy. Zero monthly cost, better reliability (no cold starts, no spin-downs).

**Current Status**: ON HOLD. Oracle Cloud account created (Monterrey region) but ARM instances (VM.Standard.A1.Flex) are out of capacity. AMD micro (VM.Standard.E2.1.Micro) not available in Monterrey. Cannot create a second Oracle account (one per person). Fly.io is running with credit card (~$2-3/month) as interim solution. Periodically retry ARM instance creation in Monterrey.

### Why
- Fly.io now costs ~$2-3/month (trial ended, credit card added)
- Oracle Cloud Always Free would eliminate this cost
- 24/7 uptime (no auto-sleep), persistent storage, full VM control

### Oracle Cloud Account
- **Region**: Mexico Northeast (Monterrey) -- cannot be changed
- **VCN**: `qc-vcn` with public subnet already created
- **Blocker**: "Out of Host Capacity" for VM.Standard.A1.Flex in AD-1. ARM capacity limited in smaller regions.
- **Retry strategy**: Periodically try creating the instance; capacity frees up when other users delete VMs

### Architecture (when capacity available)
- **VM**: Oracle Cloud ARM (Ampere A1.Flex), 1 OCPU, 6 GB RAM, Ubuntu 24.04
- **PaaS**: Coolify (free, open-source) installed on the VM -- provides git-push-to-deploy, SSL, reverse proxy
- **Storage**: Block storage (200 GB free) for SQLite DB + uploads -- real disk, not ephemeral
- **Region**: Mexico Northeast (Monterrey)

### Tasks
1. ~~Create Oracle Cloud account~~ DONE (Monterrey region)
2. ~~Create VCN with internet connectivity~~ DONE (`qc-vcn` + public subnet)
3. Provision Always Free ARM VM (1 OCPU, 6 GB RAM, Ubuntu 24.04) -- BLOCKED (capacity)
4. Configure Oracle Cloud firewall (Security List): open ports 80, 443, 8000
5. SSH into VM, open OS-level firewall (iptables), install Coolify
6. Set up Coolify: create admin account, configure local server
7. Connect GitHub repo, configure Dockerfile deployment:
   - Environment variables: `DB_PATH=/data/qc.db`, `UPLOADS_DIR=/data/uploads`, `JWT_SECRET`, `NEXT_PUBLIC_API_URL=""`
   - Persistent volume: host `/data` -> container `/data`
   - Exposed port: 8001
8. Deploy app via Coolify
9. Configure custom domain `calidad.vbc.mx` in Coolify (auto-SSL via Let's Encrypt)
10. Update DNS at InMotion Hosting: change A record for `calidad` to Oracle VM IP, remove AAAA record
11. Set up GitHub webhook for auto-deploy on push
12. Verify app works at `https://calidad.vbc.mx`

### Deployment Workflow (after migration)
- Local: `/test` (same as before)
- Commit: `/commit` (same as before)
- Deploy: `git push` triggers auto-deploy via Coolify webhook (no manual step needed)

### Maintenance (after migration)
- Monthly (~5 min): SSH in, `sudo apt update && sudo apt upgrade -y`
- Monthly: Click "Update" in Coolify UI when updates available
- Quarterly: `sudo reboot` after kernel updates (app auto-restarts)
- Automatic: SSL cert renewal (Coolify handles via Let's Encrypt)

---

## Step 9: Code Review & Stability Fixes -- COMPLETE

**Goal**: Address stability, security, and efficiency issues identified in a comprehensive code review. Prioritized: stability first, then efficiency.

**Current Status**: All 20 of 20 fixes completed. 27 backend tests passing (5 AQL + 9 database + 13 API integration). Frontend build clean. Changes committed locally, NOT yet pushed to GitHub or deployed to Fly.io.

### Reference Documents
- Full review: `code_review.md` (53 issues: 5 Critical, 14 High, 19 Medium, 15 Low)
- Fix plan: `code_review_fix_plan.md` (20 discrete fixes with test plans)

### Completed Fixes
- **Fix 1**: Pin all Python dependencies to exact versions in `requirements.txt`
- **Fix 2**: Add `threading.Lock` + `with conn:` transactions to all database write operations. Add `test_database.py` (9 tests including concurrent write safety)
- **Fix 3**: Add database indexes on `events.pass_fail`, `events.addressed`, `events.released`, `products.supplier`
- **Fix 4**: Enforce `created_by`/`addressed_by`/`released_by` from JWT token instead of trusting client-supplied values. Fix `lastrowid` race in create functions.
- **Fix 5**: Add `require_admin` dependency in `auth.py`. Applied to user CRUD, suggested action, and supplier write routes. GET endpoints remain auth-only for dropdown population.
- **Fix 6**: Login endpoint uses `LoginRequest` Pydantic model (422 on invalid input). Delete user response strips `password_hash`.
- **Fix 7**: File upload endpoint checks size, rejects files > 10 MB with 413.
- **Fix 8**: `auth.py` prints stderr warning when JWT_SECRET uses default. `docker-compose.yml` requires `JWT_SECRET` via env var.
- **Fix 9**: CORS restricted to `CORS_ORIGINS` env var (defaults to `calidad.vbc.mx`, `localhost:3000`, `localhost:8001`).
- **Backend integration checkpoint**: Server started on localhost, curl tests verified Fixes 4-9 end-to-end. Frontend `npm run build` baseline established.
- **Fix 10**: Login page imports shared `API_BASE` from `api.ts` instead of duplicating env var logic.
- **Fix 11**: Dashboard auth guard returns `null` until token verified (prevents flash of dashboard content before redirect).
- **Fix 12**: Password fields use `type="password"` on both new-user and edit-user forms.
- **Fix 13**: Delete confirmation dialogs (`confirm()`) added before every delete action across all 3 pages (products, users, events). i18n key: `confirmDelete`.
- **Fix 14**: Error handling (try/catch + `res.ok` check) on all `apiFetch` mutation calls across all 3 pages. i18n keys: `errorSaving`, `errorDeleting`, `errorLoading`.
- **Fix 15**: Renamed misleading `releasedEvents` variable to `passedSectionEvents` in events page. Removed duplicate `loadData()` from `setSuggestedAction`.
- **Fix 16**: Memoized all 3 context providers (`useMemo`/`useCallback`). Lazy `useState` initializers read localStorage synchronously (eliminates language/company flash on load). Removed `useEffect`-based localStorage reads.
- **Fix 17**: Added `GET /api/health` endpoint (no auth). Dockerfile: `npm ci` instead of `npm install`, non-root `appuser`, `HEALTHCHECK`. docker-compose: `restart: unless-stopped`, healthcheck. fly.toml: `[[http_service.checks]]` for `/api/health`, removed redundant `memory = '1gb'`. .dockerignore: added `backend/credentials/`, `backups/`, WAL files.
- **Fix 18**: Pydantic `Field()` constraints on all models: `min_length`/`max_length` on strings, `gt=0` on lot_size, `ge=0` on quantities.
- **Fix 19**: Login rate limiting: 10 attempts per minute per IP, in-memory dict + threading lock, returns 429 on excess.
- **Fix 20**: Test infrastructure: `conftest.py` (shared fixtures: fresh_db, TestClient, admin/non-admin tokens), `test_api.py` (13 integration tests covering health, login, auth, admin, validation, rate limiting). `test_database.py` simplified to use shared conftest.

### Testing
- 27 backend tests total: 5 AQL + 9 database + 13 API integration, all passing
- Frontend `npm run build` passes cleanly after all fixes

---

## Database Backup System

### Automated Nightly Backup (Current -- Fly.io)
- **Script**: `scripts/backup.ps1` -- downloads DB via `flyctl sftp get`, keeps last 30 backups
- **Schedule**: Windows Task Scheduler, daily at 11 PM (`QC-Inspector-Backup` task)
- **Location**: `C:\AI\QC\backups\qc_backup_YYYY-MM-DD_HHMMSS.db`
- **Missed runs**: `-StartWhenAvailable` flag runs backup when computer wakes up if it was off at 11 PM
- **Skill**: `/backupfly` for manual on-demand backups
- **Backup command**: `flyctl sftp get /data/qc.db <path> -a qc-inspector-vbp`
- **Restore command**: `flyctl sftp shell -a qc-inspector-vbp` then `put qc_backup.db /data/qc.db`, then restart machine
