# QC Application - Development Plan

## Architecture Overview

- **Frontend**: Next.js (static export) served by the backend
- **Backend**: Python FastAPI
- **Database**: SQLite (local persistence, simple, no extra services)
- **Packaging**: Single Docker container using `uv` for Python dependencies
- **Auth**: Hardcoded single user for MVP, schema supports multiple users

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

## Step 2: Research and Build AQL Table

**Goal**: Create an accurate AQL reference table based on ANSI/ASQ Z1.4 (ISO 2859-1) standard.

### Tasks
1. Research AQL sampling plans from the standard:
   - Lot size ranges -> Sample size code letters
   - Code letters -> Sample sizes for each inspection level (I, II, III, S-1 through S-4)
   - Accept/Reject numbers for each AQL value (0.065% through 15%) at Normal inspection severity
2. Compile into a structured format for review

### Milestone
- Complete AQL table presented for user approval
- Covers all standard lot size ranges, inspection levels, and AQL percentages

### Tests
- Cross-reference values against published AQL charts

---

## Step 3: Convert AQL Table to Machine-Readable Format

**Goal**: Store the approved AQL table in a file the backend can consume.

### Tasks
1. Convert approved table to JSON (structured, easy for Python to parse)
2. File: `backend/data/aql_table.json`
3. Backend utility to load and query the table

### Milestone
- JSON file passes schema validation
- Backend can answer: given lot size + AQL level + inspection level -> sample size, accept number, reject number

### Tests
- Unit tests: query known lot size / AQL combinations, verify correct sample size and accept/reject numbers

---

## Step 4: Connect AQL to Events

**Goal**: Events form uses AQL data for dropdowns and auto-calculates pass/fail.

### Tasks
1. Add API endpoint: `GET /api/aql/levels` -- returns available inspection levels and AQL values
2. Update Events form:
   - Add "Inspection Level" dropdown (General I, II, III)
   - Add "AQL Level" dropdown (0.065% to 15%)
   - Add "Lot Size" field
   - Auto-calculate: given lot size + inspection level -> sample size code -> sample size
   - Auto-calculate: given sample size + AQL -> accept/reject numbers
   - Compare quantity of non-conforming units against accept number -> Pass or Fail
3. Display calculated values (sample size, accept number, reject number) as read-only fields
4. Pass/Fail shown automatically after form is filled

### Milestone
- Creating an event with AQL parameters auto-determines pass/fail
- All AQL-driven fields populate correctly

### Tests
- Create events with known lot sizes and defect counts, verify pass/fail matches manual AQL lookup

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
