import json
import os
import sqlite3
from pathlib import Path
import auth

DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).parent / "data" / "qc.db"))

_conn: sqlite3.Connection | None = None


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA foreign_keys=ON")
        _conn.row_factory = sqlite3.Row
    return _conn


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            company_access TEXT NOT NULL DEFAULT 'All',
            can_manage_products INTEGER DEFAULT 1,
            can_edit_pending INTEGER DEFAULT 1,
            can_delete_pending INTEGER DEFAULT 1,
            can_edit_events INTEGER DEFAULT 1,
            can_delete_events INTEGER DEFAULT 1,
            can_set_suggested_action INTEGER DEFAULT 1,
            can_mark_addressed INTEGER DEFAULT 1,
            can_edit_addressed INTEGER DEFAULT 1,
            can_delete_addressed INTEGER DEFAULT 1,
            can_assign INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            inspection_level TEXT NOT NULL,
            aql_level TEXT NOT NULL,
            test_details TEXT DEFAULT '',
            supplier TEXT DEFAULT '',
            file TEXT DEFAULT '',
            companies TEXT DEFAULT '[]',
            created_by TEXT DEFAULT 'user',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            direction TEXT NOT NULL,
            lot_size INTEGER NOT NULL,
            quantity_inspected INTEGER NOT NULL,
            quantity_non_conforming INTEGER NOT NULL,
            pass_fail TEXT,
            sample_size INTEGER,
            accept_number INTEGER,
            reject_number INTEGER,
            code_letter TEXT,
            date_inspected TEXT NOT NULL,
            companies TEXT DEFAULT '[]',
            suggested_action TEXT DEFAULT '',
            addressed INTEGER DEFAULT 0,
            addressed_date TEXT DEFAULT '',
            addressed_by TEXT DEFAULT '',
            assigned_to TEXT DEFAULT '',
            released INTEGER DEFAULT 0,
            released_date TEXT DEFAULT '',
            released_by TEXT DEFAULT '',
            created_by TEXT DEFAULT 'user',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pending_inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            direction TEXT NOT NULL,
            lot_size INTEGER NOT NULL,
            suggested_sample_size INTEGER,
            estimated_date TEXT NOT NULL,
            companies TEXT DEFAULT '[]',
            created_by TEXT DEFAULT 'user',
            assigned_to TEXT DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS suggested_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
    """)
    conn.commit()

    # Seed admin user if no users exist
    row = conn.execute("SELECT COUNT(*) FROM users").fetchone()
    if row[0] == 0:
        conn.execute(
            """INSERT INTO users (username, password_hash, is_admin, company_access,
               can_manage_products, can_edit_pending, can_delete_pending,
               can_edit_events, can_delete_events, can_set_suggested_action,
               can_mark_addressed, can_edit_addressed, can_delete_addressed, can_assign)
               VALUES (?, ?, 1, 'All', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)""",
            ("user", auth.hash_password("password")),
        )
        conn.commit()


# --- Helpers ---

def _row_to_user(row: sqlite3.Row) -> dict:
    return {
        "username": row["username"],
        "password_hash": row["password_hash"],
        "is_admin": bool(row["is_admin"]),
        "company_access": row["company_access"],
        "can_manage_products": bool(row["can_manage_products"]),
        "can_edit_pending": bool(row["can_edit_pending"]),
        "can_delete_pending": bool(row["can_delete_pending"]),
        "can_edit_events": bool(row["can_edit_events"]),
        "can_delete_events": bool(row["can_delete_events"]),
        "can_set_suggested_action": bool(row["can_set_suggested_action"]),
        "can_mark_addressed": bool(row["can_mark_addressed"]),
        "can_edit_addressed": bool(row["can_edit_addressed"]),
        "can_delete_addressed": bool(row["can_delete_addressed"]),
        "can_assign": bool(row["can_assign"]),
    }


def _row_to_product(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "inspection_level": row["inspection_level"],
        "aql_level": row["aql_level"],
        "test_details": row["test_details"],
        "supplier": row["supplier"],
        "file": row["file"],
        "companies": json.loads(row["companies"]),
        "created_by": row["created_by"],
        "created_at": row["created_at"],
    }


def _row_to_event(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "product_id": row["product_id"],
        "product_name": row["product_name"],
        "direction": row["direction"],
        "lot_size": row["lot_size"],
        "quantity_inspected": row["quantity_inspected"],
        "quantity_non_conforming": row["quantity_non_conforming"],
        "pass_fail": row["pass_fail"],
        "sample_size": row["sample_size"],
        "accept_number": row["accept_number"],
        "reject_number": row["reject_number"],
        "code_letter": row["code_letter"],
        "date_inspected": row["date_inspected"],
        "companies": json.loads(row["companies"]),
        "suggested_action": row["suggested_action"],
        "addressed": bool(row["addressed"]),
        "addressed_date": row["addressed_date"],
        "addressed_by": row["addressed_by"],
        "assigned_to": row["assigned_to"],
        "released": bool(row["released"]),
        "released_date": row["released_date"],
        "released_by": row["released_by"],
        "created_by": row["created_by"],
        "created_at": row["created_at"],
    }


def _row_to_pending(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "product_id": row["product_id"],
        "product_name": row["product_name"],
        "direction": row["direction"],
        "lot_size": row["lot_size"],
        "suggested_sample_size": row["suggested_sample_size"],
        "estimated_date": row["estimated_date"],
        "companies": json.loads(row["companies"]),
        "created_by": row["created_by"],
        "assigned_to": row["assigned_to"],
        "created_at": row["created_at"],
    }


# --- Users ---

def get_user(username: str) -> dict | None:
    row = get_conn().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return _row_to_user(row) if row else None


def list_users() -> list[dict]:
    rows = get_conn().execute("SELECT * FROM users").fetchall()
    return [_row_to_user(r) for r in rows]


def create_user(username: str, password: str, is_admin: bool = False, **perms) -> dict:
    conn = get_conn()
    conn.execute(
        """INSERT INTO users (username, password_hash, is_admin, company_access,
           can_manage_products, can_edit_pending, can_delete_pending,
           can_edit_events, can_delete_events, can_set_suggested_action,
           can_mark_addressed, can_edit_addressed, can_delete_addressed, can_assign)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            username, auth.hash_password(password), int(is_admin),
            perms.get("company_access", "All"),
            int(perms.get("can_manage_products", True)),
            int(perms.get("can_edit_pending", True)),
            int(perms.get("can_delete_pending", True)),
            int(perms.get("can_edit_events", True)),
            int(perms.get("can_delete_events", True)),
            int(perms.get("can_set_suggested_action", True)),
            int(perms.get("can_mark_addressed", True)),
            int(perms.get("can_edit_addressed", True)),
            int(perms.get("can_delete_addressed", True)),
            int(perms.get("can_assign", True)),
        ),
    )
    conn.commit()
    return get_user(username)


def update_user(username: str, new_username: str | None = None, new_password: str | None = None,
                 **perms) -> dict | None:
    user = get_user(username)
    if not user:
        return None
    conn = get_conn()
    updates = []
    values = []
    if new_username and new_username != username:
        updates.append("username = ?")
        values.append(new_username)
    if new_password:
        updates.append("password_hash = ?")
        values.append(auth.hash_password(new_password))
    for field in ("company_access", "can_manage_products", "can_edit_pending", "can_delete_pending",
                  "can_edit_events", "can_delete_events", "can_set_suggested_action",
                  "can_mark_addressed", "can_edit_addressed", "can_delete_addressed", "can_assign"):
        if field in perms:
            updates.append(f"{field} = ?")
            values.append(int(perms[field]) if isinstance(perms[field], bool) else perms[field])
    if not updates:
        return user
    values.append(username)
    conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE username = ?", values)
    conn.commit()
    return get_user(new_username if new_username and new_username != username else username)


def delete_user(username: str) -> dict | None:
    user = get_user(username)
    if user:
        get_conn().execute("DELETE FROM users WHERE username = ?", (username,))
        get_conn().commit()
    return user


# --- Products ---

def list_products(company: str = "All") -> list[dict]:
    rows = get_conn().execute("SELECT * FROM products").fetchall()
    products = [_row_to_product(r) for r in rows]
    if company != "All":
        products = [p for p in products if company in p["companies"]]
    return products


def get_product(product_id: int) -> dict | None:
    row = get_conn().execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return _row_to_product(row) if row else None


def create_product(name: str, inspection_level: str, aql_level: str,
                   test_details: str, supplier: str, companies: list[str],
                   created_by: str, created_at: str) -> dict:
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO products (name, inspection_level, aql_level, test_details,
           supplier, file, companies, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)""",
        (name, inspection_level, aql_level, test_details, supplier,
         json.dumps(companies), created_by, created_at),
    )
    conn.commit()
    return get_product(cur.lastrowid)


def update_product(product_id: int, name: str, inspection_level: str, aql_level: str,
                   test_details: str, supplier: str, companies: list[str]) -> dict:
    conn = get_conn()
    conn.execute(
        """UPDATE products SET name=?, inspection_level=?, aql_level=?,
           test_details=?, supplier=?, companies=? WHERE id=?""",
        (name, inspection_level, aql_level, test_details, supplier,
         json.dumps(companies), product_id),
    )
    conn.commit()
    return get_product(product_id)


def delete_product(product_id: int) -> dict | None:
    product = get_product(product_id)
    if product:
        get_conn().execute("DELETE FROM products WHERE id = ?", (product_id,))
        get_conn().commit()
    return product


def set_product_file(product_id: int, filename: str):
    conn = get_conn()
    conn.execute("UPDATE products SET file=? WHERE id=?", (filename, product_id))
    conn.commit()


def get_all_products() -> dict:
    """Returns dict[int, dict] keyed by ID -- for sheets.py compatibility."""
    rows = get_conn().execute("SELECT * FROM products").fetchall()
    return {r["id"]: _row_to_product(r) for r in rows}


def cascade_supplier_delete(supplier_name: str):
    conn = get_conn()
    conn.execute("UPDATE products SET supplier='pending' WHERE supplier=?", (supplier_name,))
    conn.commit()


# --- Events ---

def list_events(company: str = "All") -> list[dict]:
    rows = get_conn().execute("SELECT * FROM events").fetchall()
    events = [_row_to_event(r) for r in rows]
    if company != "All":
        events = [e for e in events if company in e["companies"]]
    return events


def get_event(event_id: int) -> dict | None:
    row = get_conn().execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    return _row_to_event(row) if row else None


def create_event(product_id: int, product_name: str, direction: str, lot_size: int,
                 quantity_inspected: int, quantity_non_conforming: int,
                 pass_fail: str | None, sample_size: int | None,
                 accept_number: int | None, reject_number: int | None,
                 code_letter: str | None, date_inspected: str,
                 companies: list[str], created_by: str, created_at: str) -> dict:
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO events (product_id, product_name, direction, lot_size,
           quantity_inspected, quantity_non_conforming, pass_fail, sample_size,
           accept_number, reject_number, code_letter, date_inspected,
           companies, suggested_action, addressed, addressed_date, addressed_by,
           assigned_to, released, released_date, released_by, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, '', '', '', 0, '', '', ?, ?)""",
        (product_id, product_name, direction, lot_size,
         quantity_inspected, quantity_non_conforming, pass_fail, sample_size,
         accept_number, reject_number, code_letter, date_inspected,
         json.dumps(companies), created_by, created_at),
    )
    conn.commit()
    return get_event(cur.lastrowid)


def update_event(event_id: int, product_id: int, product_name: str, direction: str,
                 lot_size: int, quantity_inspected: int, quantity_non_conforming: int,
                 pass_fail: str | None, sample_size: int | None,
                 accept_number: int | None, reject_number: int | None,
                 code_letter: str | None, date_inspected: str) -> dict:
    conn = get_conn()
    conn.execute(
        """UPDATE events SET product_id=?, product_name=?, direction=?, lot_size=?,
           quantity_inspected=?, quantity_non_conforming=?, pass_fail=?, sample_size=?,
           accept_number=?, reject_number=?, code_letter=?, date_inspected=?
           WHERE id=?""",
        (product_id, product_name, direction, lot_size,
         quantity_inspected, quantity_non_conforming, pass_fail, sample_size,
         accept_number, reject_number, code_letter, date_inspected, event_id),
    )
    conn.commit()
    return get_event(event_id)


def delete_event(event_id: int) -> dict | None:
    event = get_event(event_id)
    if event:
        get_conn().execute("DELETE FROM events WHERE id = ?", (event_id,))
        get_conn().commit()
    return event


def set_suggested_action(event_id: int, action: str) -> dict:
    conn = get_conn()
    conn.execute("UPDATE events SET suggested_action=? WHERE id=?", (action, event_id))
    conn.commit()
    return get_event(event_id)


def set_addressed(event_id: int, addressed: bool, addressed_date: str = "",
                  addressed_by: str = "") -> dict:
    conn = get_conn()
    conn.execute(
        "UPDATE events SET addressed=?, addressed_date=?, addressed_by=? WHERE id=?",
        (int(addressed), addressed_date, addressed_by, event_id),
    )
    conn.commit()
    return get_event(event_id)


def set_event_assigned(event_id: int, assigned_to: str) -> dict:
    conn = get_conn()
    conn.execute("UPDATE events SET assigned_to=? WHERE id=?", (assigned_to, event_id))
    conn.commit()
    return get_event(event_id)


def set_released(event_id: int, released: bool, released_date: str = "",
                 released_by: str = "") -> dict:
    conn = get_conn()
    conn.execute(
        "UPDATE events SET released=?, released_date=?, released_by=? WHERE id=?",
        (int(released), released_date, released_by, event_id),
    )
    conn.commit()
    return get_event(event_id)


def get_all_events() -> dict:
    """Returns dict[int, dict] keyed by ID -- for sheets.py compatibility."""
    rows = get_conn().execute("SELECT * FROM events").fetchall()
    return {r["id"]: _row_to_event(r) for r in rows}


# --- Pending Inspections ---

def list_pending(company: str = "All") -> list[dict]:
    rows = get_conn().execute("SELECT * FROM pending_inspections").fetchall()
    pending = [_row_to_pending(r) for r in rows]
    if company != "All":
        pending = [p for p in pending if company in p["companies"]]
    return pending


def get_pending(pending_id: int) -> dict | None:
    row = get_conn().execute("SELECT * FROM pending_inspections WHERE id = ?", (pending_id,)).fetchone()
    return _row_to_pending(row) if row else None


def create_pending(product_id: int, product_name: str, direction: str, lot_size: int,
                   suggested_sample_size: int, estimated_date: str,
                   companies: list[str], created_by: str, assigned_to: str,
                   created_at: str) -> dict:
    conn = get_conn()
    cur = conn.execute(
        """INSERT INTO pending_inspections (product_id, product_name, direction, lot_size,
           suggested_sample_size, estimated_date, companies, created_by, assigned_to, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (product_id, product_name, direction, lot_size, suggested_sample_size,
         estimated_date, json.dumps(companies), created_by, assigned_to, created_at),
    )
    conn.commit()
    return get_pending(cur.lastrowid)


def update_pending(pending_id: int, product_id: int, product_name: str, direction: str,
                   lot_size: int, suggested_sample_size: int, estimated_date: str,
                   companies: list[str], assigned_to: str) -> dict:
    conn = get_conn()
    conn.execute(
        """UPDATE pending_inspections SET product_id=?, product_name=?, direction=?,
           lot_size=?, suggested_sample_size=?, estimated_date=?, companies=?, assigned_to=?
           WHERE id=?""",
        (product_id, product_name, direction, lot_size, suggested_sample_size,
         estimated_date, json.dumps(companies), assigned_to, pending_id),
    )
    conn.commit()
    return get_pending(pending_id)


def delete_pending(pending_id: int) -> dict | None:
    pending = get_pending(pending_id)
    if pending:
        get_conn().execute("DELETE FROM pending_inspections WHERE id = ?", (pending_id,))
        get_conn().commit()
    return pending


def set_pending_assigned(pending_id: int, assigned_to: str) -> dict:
    conn = get_conn()
    conn.execute("UPDATE pending_inspections SET assigned_to=? WHERE id=?", (assigned_to, pending_id))
    conn.commit()
    return get_pending(pending_id)


def get_all_pending() -> dict:
    """Returns dict[int, dict] keyed by ID -- for sheets.py compatibility."""
    rows = get_conn().execute("SELECT * FROM pending_inspections").fetchall()
    return {r["id"]: _row_to_pending(r) for r in rows}


# --- Suggested Actions ---

def list_suggested_actions() -> list[str]:
    rows = get_conn().execute("SELECT action FROM suggested_actions ORDER BY id").fetchall()
    return [r["action"] for r in rows]


def add_suggested_action(action: str):
    conn = get_conn()
    conn.execute("INSERT INTO suggested_actions (action) VALUES (?)", (action,))
    conn.commit()


def delete_suggested_action_by_index(index: int) -> str | None:
    conn = get_conn()
    rows = conn.execute("SELECT id, action FROM suggested_actions ORDER BY id").fetchall()
    if index < 0 or index >= len(rows):
        return None
    removed = rows[index]["action"]
    conn.execute("DELETE FROM suggested_actions WHERE id = ?", (rows[index]["id"],))
    conn.commit()
    return removed


def get_all_suggested_actions() -> list[str]:
    return list_suggested_actions()


# --- Suppliers ---

def list_suppliers() -> list[str]:
    rows = get_conn().execute("SELECT name FROM suppliers ORDER BY id").fetchall()
    return [r["name"] for r in rows]


def add_supplier(name: str):
    conn = get_conn()
    conn.execute("INSERT INTO suppliers (name) VALUES (?)", (name,))
    conn.commit()


def delete_supplier_by_index(index: int) -> str | None:
    conn = get_conn()
    rows = conn.execute("SELECT id, name FROM suppliers ORDER BY id").fetchall()
    if index < 0 or index >= len(rows):
        return None
    removed = rows[index]["name"]
    conn.execute("DELETE FROM suppliers WHERE id = ?", (rows[index]["id"],))
    conn.commit()
    return removed


def get_all_suppliers() -> list[str]:
    return list_suppliers()
