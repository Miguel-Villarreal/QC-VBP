# QC Inspector — Code Review Fix Plan

## Context

A comprehensive code review identified 53 issues (5 Critical, 14 High, 19 Medium, 15 Low) across the QC Inspector codebase. This plan addresses them as 20 discrete fixes, ordered by priority (stability first, then efficiency). Each fix gets its own commit after verification. No paid tools or subscriptions required.

## Constraints
- One fix at a time, commit after each passes testing
- No paid tools/subscriptions
- Tests run on localhost (backend :8001, frontend :3000)
- Existing AQL tests (`backend/test_aql.py`) must keep passing throughout

---

## Fix 1: Pin Python Dependencies
**Files:** `backend/requirements.txt`
**What:** Get current installed versions via `pip freeze`, pin all 8 deps with `==`.
**Test:** `pip install -r requirements.txt` in clean venv succeeds. `python -m pytest backend/test_aql.py` passes. Backend starts.
**Complexity:** Small

## Fix 2: Database Connection Safety — Threading Lock + Transactions
**Files:** `backend/database.py`
**What:**
- Add `import threading` and `_lock = threading.Lock()` at module level
- Wrap all write functions in `with _lock:` + `with conn:` (context manager for auto-commit/rollback)
- Remove all explicit `conn.commit()` calls inside write functions
- Fix TOCTOU in delete functions: do DELETE directly, check `cursor.rowcount` instead of GET-then-DELETE
**Test:** Create `backend/test_database.py`:
- Roundtrip test: add_product + get_product
- Concurrent writes: 10 threads adding products simultaneously, all succeed
- Delete nonexistent item returns None gracefully
- `python -m pytest backend/test_aql.py` still passes
**Complexity:** Medium

## Fix 3: Add Database Indexes
**Files:** `backend/database.py`
**What:** In `init_db()`, after CREATE TABLE statements, add:
```sql
CREATE INDEX IF NOT EXISTS idx_events_pass_fail ON events(pass_fail);
CREATE INDEX IF NOT EXISTS idx_events_addressed ON events(addressed);
CREATE INDEX IF NOT EXISTS idx_events_released ON events(released);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier);
```
**Test:** Backend starts without errors. `init_db()` is idempotent (can run twice). Existing tests pass.
**Complexity:** Small

## Fix 4: Enforce `created_by` from JWT Token
**Files:** `backend/main.py`
**What:** In `create_product`, `create_pending`, `create_event` routes: ignore body's `created_by`, use `_user` from `Depends(auth.require_auth)` instead. Same for `addressed_by` in address endpoint and `released_by` in release endpoint.
**Test:** curl POST an event with `created_by: "hacker"` using a valid token — verify stored `created_by` equals the token's username, not "hacker". Manual via localhost.
**Complexity:** Small

## Fix 5: Add Admin Authorization on Backend Routes
**Files:** `backend/auth.py`, `backend/main.py`, `backend/database.py`
**What:**
- Add `require_admin(request: Request) -> str` dependency in `auth.py` that calls `require_auth`, then checks `database.get_user(username)["is_admin"]`, raises 403 if not admin
- Apply `Depends(auth.require_admin)` to: POST/PATCH/DELETE `/api/users/*`, POST/DELETE `/api/suggested-actions/*`, POST/DELETE `/api/suppliers/*`
- Keep `GET /api/users` as admin-only too
**Test:** curl with non-admin token to `POST /api/users` — expect 403. Same call with admin token — expect success. Manual via localhost.
**Complexity:** Medium

## Fix 6: Fix Login Endpoint + Don't Leak Password Hash
**Files:** `backend/main.py`
**What:**
- Create `LoginRequest(BaseModel)` with `username: str` and `password: str`. Replace `data: dict` in login route.
- In `DELETE /api/users/{username}` response: strip `password_hash` before returning.
**Test:** curl POST `/api/auth/login` with empty body — expect 422 (not 500). curl DELETE a user — response has no `password_hash` field.
**Complexity:** Small

## Fix 7: File Upload Size Limit
**Files:** `backend/main.py`
**What:** In the file upload endpoint, read file content and check size. If > 10 MB, raise `HTTPException(413, "File too large. Maximum 10 MB.")`. Read in chunks to avoid loading huge files into memory.
**Test:** curl upload a small file — succeeds. curl upload >10MB — returns 413. Manual via localhost.
**Complexity:** Small

## Fix 8: JWT Secret Warning on Default Value
**Files:** `backend/auth.py`, `docker-compose.yml`
**What:**
- In `auth.py`: if `JWT_SECRET` equals the default, print a warning to stderr on import
- In `docker-compose.yml`: remove the hardcoded default, add comment to use `.env` file
**Test:** Start backend without JWT_SECRET env var — warning appears in console. Set JWT_SECRET — no warning. Existing tests pass.
**Complexity:** Small

## Fix 9: CORS Restriction
**Files:** `backend/main.py`
**What:** Replace `allow_origins=["*"]` with a list from `CORS_ORIGINS` env var, defaulting to `"https://calidad.vbc.mx,http://localhost:3000,http://localhost:8001"`.
**Test:** curl with `Origin: https://calidad.vbc.mx` — CORS headers present. curl with `Origin: https://evil.com` — no CORS headers. Frontend still works on localhost:3000.
**Complexity:** Small

## Fix 10: Fix Login Page — Use Shared API Constant
**Files:** `frontend/app/page.tsx`, `frontend/app/api.ts`
**What:**
- Export `API_BASE` from `api.ts`
- In login `page.tsx`: import and use `API_BASE` instead of duplicating the env var logic
- Add try/catch around the fetch for network error handling
**Test:** Login works normally. Stop backend, try login — error message shown (not blank).
**Complexity:** Small

## Fix 11: Fix Dashboard Auth Guard Flash
**Files:** `frontend/app/dashboard/layout.tsx`
**What:** Add `const [ready, setReady] = useState(false)`. In useEffect: if no token, redirect; else `setReady(true)`. Return `null` while `!ready`.
**Test:** Clear localStorage, navigate to `/dashboard` — no flash of dashboard content, redirects to login.
**Complexity:** Small

## Fix 12: Password Fields — `type="password"`
**Files:** `frontend/app/dashboard/users/page.tsx`
**What:** Change `type="text"` to `type="password"` on both password input fields (new user form ~line 309, edit user form ~line 455).
**Test:** Add/edit user — password field shows dots, not cleartext.
**Complexity:** Small

## Fix 13: Add Delete Confirmation Dialogs
**Files:** `frontend/app/dashboard/users/page.tsx`, `frontend/app/dashboard/products/page.tsx`, `frontend/app/dashboard/events/page.tsx`, `frontend/app/i18n.tsx`
**What:**
- Add i18n keys: `confirmDelete` (EN: "Are you sure you want to delete this?", ES: "¿Seguro que desea eliminar esto?")
- Add `if (!confirm(t('confirmDelete'))) return;` before every delete API call across all three pages
**Test:** Try deleting a product — dialog appears. Cancel — nothing deleted. Confirm — deleted.
**Complexity:** Small

## Fix 14: Add Error Handling to All Frontend API Calls
**Files:** `frontend/app/dashboard/events/page.tsx`, `frontend/app/dashboard/products/page.tsx`, `frontend/app/dashboard/users/page.tsx`, `frontend/app/i18n.tsx`
**What:**
- Add i18n keys: `errorSaving`, `errorDeleting`, `errorLoading`
- Wrap every `apiFetch` call in try/catch + `res.ok` check
- On failure: `alert(t('errorSaving'))` (or appropriate key), do NOT reset form state
- Pattern per call:
  ```ts
  try {
    const res = await apiFetch(url, opts);
    if (!res.ok) { alert(t('errorSaving')); return; }
    // success path
  } catch { alert(t('errorSaving')); }
  ```
**Test:** Stop backend, try saving a product — error alert shown. Start backend — normal operation.
**Complexity:** Large (many call sites, repetitive pattern)

## Fix 15: Fix `releasedEvents` Naming + Double `loadData()`
**Files:** `frontend/app/dashboard/events/page.tsx`
**What:**
- Rename `releasedEvents` (line ~386) to `passedSectionEvents` since it contains passed+addressed events for the "Passed Events" table, NOT released events
- Remove duplicate `loadData()` call in `setSuggestedAction` — let callers manage reload
**Test:** Events page loads correctly. All 5 sections show correct data. No duplicate network requests in browser DevTools.
**Complexity:** Small

## Fix 16: Memoize Context Provider Values
**Files:** `frontend/app/i18n.tsx`
**What:** Wrap each provider's `value` in `useMemo`:
- I18nProvider: `useMemo(() => ({ lang, setLang, t }), [lang])`
- CompanyProvider: `useMemo(() => ({ company, setCompany }), [company])`
- AuthProvider: `useMemo(() => ({ perms, setPerms }), [perms])`
Also use lazy `useState` initializers to read localStorage synchronously (prevents language/company flash on load).
**Test:** App works normally. Language switch works. Company switch works. No visible flash on page load.
**Complexity:** Small

## Fix 17: Dockerfile Hardening + Health Checks
**Files:** `Dockerfile`, `docker-compose.yml`, `fly.toml`, `backend/main.py`
**What:**
- `main.py`: Add `GET /api/health` endpoint (no auth): `return {"status": "ok"}`
- `Dockerfile`: Replace `npm install` with `npm ci`. Add non-root user. Add HEALTHCHECK.
- `docker-compose.yml`: Add `restart: unless-stopped` and `healthcheck`
- `fly.toml`: Add `[[http_service.checks]]` for `/api/health`. Remove redundant `memory = '1gb'` line.
- `.dockerignore`: Add `backend/credentials/`, `backups/`, `backend/data/qc.db-*`
**Test:** `docker build` succeeds. `curl /api/health` returns 200. Fly deploy passes health check.
**Complexity:** Medium

## Fix 18: Add Pydantic Field Constraints
**Files:** `backend/main.py`
**What:** Add `Field()` constraints to all Pydantic models:
- `name: str = Field(min_length=1, max_length=200)`
- `username: str = Field(min_length=1, max_length=100)`
- `password: str = Field(min_length=1, max_length=200)`
- `lot_size: int = Field(gt=0)`
- `quantity_inspected: int = Field(ge=0)`
- `quantity_non_conforming: int = Field(ge=0)`
- String fields: `max_length=500` where appropriate
**Test:** curl with empty product name — 422. curl with lot_size=-1 — 422. Normal payloads still work.
**Complexity:** Medium

## Fix 19: Add Login Rate Limiting (Simple, No Dependencies)
**Files:** `backend/main.py`
**What:** Add a simple in-memory rate limiter for the login endpoint using a dict of `{ip: [timestamps]}`. Limit to 10 attempts per minute per IP. No external dependencies needed — just a dict + time check.
**Test:** curl login 11 times rapidly — 11th returns 429. Wait 60s — login works again.
**Complexity:** Small

## Fix 20: Backend Test Infrastructure
**Files:** `backend/conftest.py` (new), `backend/test_database.py` (from Fix 2), `backend/test_api.py` (new)
**What:**
- `conftest.py`: Shared fixtures — in-memory test DB, FastAPI TestClient, admin/non-admin user tokens
- `test_api.py`: Integration tests covering fixes 4-7 (created_by enforcement, admin checks, login validation, password hash leak)
- Verify all test files pass together: `python -m pytest backend/ -v`
**Test:** `python -m pytest backend/ -v` — all tests green.
**Complexity:** Medium

---

## Execution Summary

| Phase | Fixes | Focus |
|-------|-------|-------|
| Backend stability | 1-3 | Dependencies, DB safety |
| Backend security | 4-9 | Auth, authorization, input validation |
| **CHECKPOINT: Backend integration test** | -- | Start server on localhost, run curl tests against all modified API routes |
| Frontend stability | 10-16 | Auth guard, error handling, UX safety |
| Infrastructure | 17 | Docker, health checks |
| Hardening | 18-20 | Input validation, rate limiting, tests |

Each fix is committed individually after passing its test plan.

## Testing Strategy (Compounding Breakage Prevention)

1. **After every fix:** Run ALL backend tests (`python -m pytest backend/`), not just the new test
2. **After Fix 9 (end of backend fixes):** Start the actual server on localhost:8001 and run curl-based integration tests against the real API to verify all backend fixes work together end-to-end
3. **Before Fix 10 (first frontend fix):** Run `npm run build` to establish a clean baseline
4. **After each frontend fix:** Run `npm run build` to catch compile errors immediately
5. **Fix 20:** Adds a proper `TestClient`-based integration test suite covering the full route -> database -> response chain
