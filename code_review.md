# QC Inspector - Comprehensive Code Review

**Date:** 2026-03-24
**Scope:** Full repository review
**Priority:** Stability first, then Efficiency

---

## Executive Summary

The codebase is functional and feature-complete for its current scale. However, there are several stability and security issues that should be addressed before the app handles more users or data. The most critical issues are: SQLite thread safety, missing backend authorization checks, zero error handling on frontend API calls, and unpinned dependencies.

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 5 | Will cause data loss, crashes, or security breaches |
| High | 14 | Likely to cause problems under normal usage |
| Medium | 19 | Should be fixed but unlikely to cause immediate harm |
| Low | 15 | Minor quality/consistency improvements |

---

## Critical Issues

### C1. SQLite shared connection is not thread-safe
**Files:** `backend/database.py:9-20`, used throughout `backend/main.py`
**Category:** Stability

A single global `sqlite3.Connection` with `check_same_thread=False` is shared across all FastAPI worker threads. Concurrent writes will cause `database is locked` errors or data corruption. Every mutation endpoint triggers both a DB write and a full-table read for sheets sync, widening the race window.

**Fix:** Add a `threading.Lock` around all write operations. Use `with conn:` context manager for automatic rollback on errors. Long-term, consider `aiosqlite` or connection-per-request.

---

### C2. No admin authorization on backend routes
**Files:** `backend/main.py:154, 174, 184-191, 201, 230, 243`
**Category:** Security

User CRUD, suggested action management, and supplier management routes only check `require_auth` (is user logged in?) but never check `is_admin`. Any authenticated user can create admin accounts, delete other users, or modify settings.

**Fix:** Create a `require_admin` dependency that checks `database.get_user(username)["is_admin"]` and apply it to user/settings routes.

---

### C3. `created_by` field trusted from client -- user impersonation
**Files:** `backend/main.py:86, 94, 106, 288, 392, 461`
**Category:** Security

`created_by` is accepted from the request body and stored directly. A malicious client can set `created_by` to any username. The JWT-authenticated username (`_user`) is available in every route but unused for this purpose.

**Fix:** Ignore the `created_by` from the body; use the `_user` value from the JWT dependency.

---

### C4. JWT_SECRET has a hardcoded default
**Files:** `backend/auth.py:7`, `docker-compose.yml`
**Category:** Security

`JWT_SECRET` defaults to `"qc-inspector-dev-secret-key-change-in-production"`. The docker-compose file also has `JWT_SECRET=change-this-in-production` in plain text. If the env var is not set in production, tokens are trivially forgeable.

**Fix:** Raise an error on startup if `JWT_SECRET` is not set (or equals the default). Remove the hardcoded value from docker-compose.yml and use an `.env` file excluded from git.

---

### C5. No error handling on any frontend API calls
**Files:** `frontend/app/dashboard/events/page.tsx:111-128, 158-371`, `frontend/app/dashboard/products/page.tsx:46-91`, `frontend/app/dashboard/users/page.tsx:70-168`
**Category:** Stability

Every `apiFetch()` call across all three dashboard pages has zero error handling. No try/catch, no `res.ok` check. If the server returns an error or the network fails:
- `.json()` throws on non-JSON responses
- Form state resets as if the operation succeeded
- Users see no feedback that their action failed

**Fix:** Wrap all API calls in try/catch. Check `res.ok` before `.json()`. Show error messages to users. Do not reset form state on failure.

---

## High Issues

### H1. Google Sheets credentials expire after ~1 hour
**File:** `backend/sheets.py:25-35`
**Category:** Stability

The gspread client is cached forever in `_client`. Google OAuth2 service account tokens expire after ~1 hour. After expiry, all sheets sync calls fail silently (errors are caught and logged).

**Fix:** Use `gspread.service_account(filename=...)` which handles token refresh automatically, or check `creds.expired` before each use and re-authorize.

---

### H2. Google Sheets clear-then-update is not atomic
**File:** `backend/sheets.py:148-153`
**Category:** Stability

`_sync_tab` calls `ws.clear()` then `ws.update()` as separate API calls. If the process crashes between them, the tab is left empty (data loss in the sheet). No retry logic exists.

**Fix:** Add retry with exponential backoff around the clear+update pair. Alternatively, update the data range directly without clearing first, then delete excess rows.

---

### H3. Sheets sync failures silently swallowed
**Files:** `backend/sheets.py:162-198, 350-370`, `backend/main.py` (all mutation endpoints)
**Category:** Stability

Every sheets sync catches all exceptions and only logs them. The HTTP response returns 200 even if sync completely failed. The Google Sheet can drift out of sync indefinitely with no user notification.

**Fix:** Return a warning field in mutation responses (`"sheets_sync_ok": false`), or track last successful sync time and expose it in the sheets status endpoint.

---

### H4. No error handling / rollback on database writes
**File:** `backend/database.py` (all write functions)
**Category:** Stability

No write function has try/except with `conn.rollback()`. If an `execute()` raises (constraint violation, disk full), the partial transaction is left open.

**Fix:** Use `with conn:` context manager which auto-commits on success and rolls back on exception.

---

### H5. TOCTOU races in delete operations
**File:** `backend/database.py:271-276, 322-327, 405-410, 501-506, 535-543, 563-571`
**Category:** Stability

All delete functions do a GET then DELETE as separate operations. Under concurrency, another request could modify or delete the same record between the two calls. Index-based deletes (suggested actions, suppliers) are especially fragile.

**Fix:** Use `DELETE ... RETURNING *` (SQLite 3.35+) or perform the delete directly and check `cursor.rowcount`.

---

### H6. Unpinned Python dependencies
**File:** `backend/requirements.txt`
**Category:** Stability

All 8 dependencies are unpinned. A rebuild can pull breaking versions at any time with no warning.

**Fix:** Pin all versions. Run `pip freeze` in the current container to capture exact versions.

---

### H7. No health checks anywhere
**Files:** `Dockerfile`, `docker-compose.yml`, `fly.toml`
**Category:** Stability

Neither Docker, docker-compose, nor Fly.io are configured with health checks. If the app enters a bad state (e.g., hung process), the infrastructure won't know to restart it.

**Fix:** Add a `/api/health` endpoint (returns 200). Add `HEALTHCHECK` to Dockerfile, `healthcheck:` to docker-compose, and `[[http_service.checks]]` to fly.toml.

---

### H8. No restart policy in docker-compose
**File:** `docker-compose.yml`
**Category:** Stability

If the container crashes, it stays down.

**Fix:** Add `restart: unless-stopped`.

---

### H9. Dashboard renders before auth check completes
**File:** `frontend/app/dashboard/layout.tsx:25-29`
**Category:** Stability

The auth guard uses `useEffect` which runs after the first render. Protected content is briefly visible to unauthenticated users before the redirect fires.

**Fix:** Return `null` or a loading spinner when no token is present. Only render children after confirming authentication.

---

### H10. Password fields use `type="text"` -- plaintext on screen
**File:** `frontend/app/dashboard/users/page.tsx:309, 456-459`
**Category:** Security

Both new-user and edit-user password fields display passwords in plaintext, vulnerable to shoulder surfing and screen capture.

**Fix:** Change `type="text"` to `type="password"`.

---

### H11. Login page duplicates API base URL
**File:** `frontend/app/page.tsx:7`
**Category:** Stability

Login page defines its own `API` constant instead of using `apiFetch` from `api.ts`. If the API URL configuration changes, the login page will diverge.

**Fix:** Use the centralized `apiFetch` or at minimum import the shared constant.

---

### H12. No confirmation on destructive actions
**Files:** `frontend/app/dashboard/events/page.tsx:250-253, 283-286`, `frontend/app/dashboard/products/page.tsx:385`, `frontend/app/dashboard/users/page.tsx:513`
**Category:** Stability

Delete operations (pending, events, products, users) fire immediately with no confirmation dialog. A misclick permanently removes data.

**Fix:** Add `if (!confirm(...)) return;` before delete API calls.

---

### H13. `delete_user` leaks password hash in response
**File:** `backend/main.py:191`
**Category:** Security

`database.delete_user()` returns the full user dict including `password_hash`. Other user endpoints strip this field.

**Fix:** Filter out `password_hash` from the delete response.

---

### H14. File upload has no size limit
**File:** `backend/main.py:329-334`
**Category:** Stability / Security

File uploads have extension validation but no size limit. A client can upload arbitrarily large files, filling the disk.

**Fix:** Add a max file size check (e.g., 10 MB) before saving.

---

## Medium Issues

### M1. CORS allows all origins with credentials
**File:** `backend/main.py:29-35`

`allow_origins=["*"]` with `allow_credentials=True`. Set `allow_origins` to actual frontend origins.

### M2. No input validation on string lengths
**File:** `backend/main.py:49-115` (Pydantic models)

No `max_length` constraints on any string fields. Add `Field(max_length=...)` to prevent abuse.

### M3. Synchronous Google Sheets calls block worker threads
**File:** `backend/main.py` (all mutation endpoints)

Sheets sync takes 1-5 seconds and blocks the thread. Move to FastAPI `BackgroundTasks`.

### M4. Company filtering done in Python, not SQL
**File:** `backend/database.py:281-286, 350-355, 457-462`

All rows fetched and filtered in Python. Use SQL `WHERE companies LIKE '%"VBC"%'` as data grows.

### M5. No database indexes beyond primary keys
**File:** `backend/database.py:23-106`

Add indexes on `events.pass_fail`, `events.addressed`, `events.released`, `products.supplier`.

### M6. No foreign keys on `product_id` columns
**File:** `backend/database.py:56-95`

Deleting a product leaves orphaned events/pending inspections. Add `REFERENCES products(id)`.

### M7. `login` endpoint accepts raw `dict` instead of Pydantic model
**File:** `backend/main.py:120`

No request validation on login. Create a `LoginRequest` model.

### M8. No rate limiting on login endpoint
**File:** `backend/main.py:119-141`

Unlimited brute-force attempts. Add rate limiting (e.g., `slowapi`).

### M9. Context providers cause unnecessary re-renders
**File:** `frontend/app/i18n.tsx:197-199, 234-237, 304-307`

Context `value` objects are new references every render. Wrap in `useMemo`.

### M10. Language/company flash on page load
**File:** `frontend/app/i18n.tsx:185-187`

Initial state is `"en"`, then `useEffect` reads localStorage and switches. Use lazy `useState` initializer.

### M11. `releasedEvents` variable is misleadingly named
**File:** `frontend/app/dashboard/events/page.tsx:386`

`releasedEvents` actually contains un-released passed events. Rename to `passedSectionEvents`.

### M12. Double `loadData()` call in event workflow
**File:** `frontend/app/dashboard/events/page.tsx:354-371`

`setSuggestedAction` calls `loadData()`, and its caller `saveEditAddressed` also calls `loadData()`. Remove the inner one.

### M13. Events page is 1522 lines in a single file
**File:** `frontend/app/dashboard/events/page.tsx`

~30 `useState` calls, 5 table sections, forms, pagination, sorting all in one component. Extract sub-components.

### M14. `SortArrow` and `PaginationControls` defined inside component
**File:** `frontend/app/dashboard/events/page.tsx:453-504`

Recreated every render, causing unmount/remount cycles. Move outside the component.

### M15. Container runs as root
**File:** `Dockerfile`

Add a non-root user with `USER appuser`.

### M16. `npm install` instead of `npm ci` in Dockerfile
**File:** `Dockerfile`

`npm ci` is faster and more reproducible for Docker builds.

### M17. Missing `aiofiles` explicit dependency
**File:** `backend/requirements.txt`

FastAPI's `StaticFiles` requires `aiofiles`. Add it explicitly.

### M18. Users page fires 3 API calls before checking admin permission
**File:** `frontend/app/dashboard/users/page.tsx:205`

Non-admin users trigger unauthorized API calls before seeing "Access denied." Guard earlier.

### M19. Username in URL not encoded
**File:** `frontend/app/dashboard/users/page.tsx:157, 167`

`/api/users/${editingUser}` -- special characters in usernames break the URL. Use `encodeURIComponent()`.

---

## Low Issues

### L1. No `iat` claim in JWT tokens
**File:** `backend/auth.py:20-25`

### L2. `verify_password` crashes on malformed hash
**File:** `backend/auth.py:16-17`

### L3. Token via query param logged in access logs/browser history
**File:** `backend/auth.py:40`

### L4. AQL JSON loaded at import with no error handling
**File:** `backend/aql.py:4`

### L5. `_row_to_*` functions crash on malformed JSON in `companies`
**File:** `backend/database.py:153, 174, 197`

### L6. `product_name` denormalized in events (stale on rename)
**File:** `backend/database.py:59, 86`

### L7. `update_event` does not update `companies` field
**File:** `backend/database.py:386-402`

### L8. Trivial alias functions `get_all_suggested_actions` / `get_all_suppliers`
**File:** `backend/database.py:546-547, 574-575`

### L9. `passedEvents` filter includes null `pass_fail` events
**File:** `frontend/app/dashboard/events/page.tsx:374-376`

Use `ev.pass_fail === "pass"` instead of `!== "fail"`.

### L10. No loading states on any page
**Files:** All dashboard pages

### L11. SVG icons repeated inline ~6 times
**File:** `frontend/app/dashboard/events/page.tsx`

### L12. `new Date()` called multiple times per render
**File:** `frontend/app/dashboard/events/page.tsx:1154, 1162, 1373, 1380`

### L13. Raw `<img>` instead of Next.js `<Image>`
**File:** `frontend/app/dashboard/layout.tsx:43-47`

### L14. Base Docker images not pinned to minor version
**File:** `Dockerfile`

### L15. Supplier/action deletion uses array index instead of unique ID
**File:** `frontend/app/dashboard/users/page.tsx:236-246, 273-286`

---

## Recommended Action Plan (Priority Order)

### Phase 1: Critical Stability & Security (do first)
1. **C2** -- Add `require_admin` backend check on admin routes
2. **C3** -- Use JWT username as `created_by` server-side
3. **C4** -- Require `JWT_SECRET` env var, remove hardcoded defaults
4. **C1** -- Add `threading.Lock` + `with conn:` for SQLite safety
5. **C5** -- Add error handling to all frontend API calls
6. **H10** -- Change password fields to `type="password"`
7. **H13** -- Strip `password_hash` from delete user response

### Phase 2: Resilience & Data Integrity
8. **H1** -- Fix Google Sheets credential refresh
9. **H4** -- Add `with conn:` context manager for DB rollback
10. **H6** -- Pin all Python dependency versions
11. **H7** -- Add health checks to Dockerfile, docker-compose, fly.toml
12. **H8** -- Add `restart: unless-stopped` to docker-compose
13. **H12** -- Add delete confirmation dialogs
14. **H14** -- Add file upload size limit

### Phase 3: Efficiency & Code Quality
15. **M3** -- Move sheets sync to BackgroundTasks
16. **M9/M10** -- Memoize context providers, fix language flash
17. **M13/M14** -- Break up 1522-line events page into sub-components
18. **M4/M5** -- Add SQL filtering and database indexes
19. **M1** -- Restrict CORS origins
20. **M2** -- Add input length validation to Pydantic models
