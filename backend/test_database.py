"""Tests for database.py -- connection safety, CRUD roundtrips, concurrent writes."""
import os
import sys
import threading
import tempfile

# Use a temporary DB for tests
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DB_PATH"] = _tmp.name

import database


def setup_module():
    database._conn = None  # force fresh connection to temp DB
    database.init_db()


def teardown_module():
    if database._conn:
        database._conn.close()
        database._conn = None
    os.unlink(_tmp.name)


# --- Roundtrip tests ---

def test_create_and_get_product():
    p = database.create_product(
        name="Test Widget", inspection_level="II", aql_level="1.0",
        test_details="visual", supplier="ACME", companies=["VBC"],
        created_by="user", created_at="2026-01-01",
    )
    assert p is not None
    assert p["name"] == "Test Widget"
    fetched = database.get_product(p["id"])
    assert fetched["name"] == "Test Widget"
    assert fetched["companies"] == ["VBC"]


def test_create_and_get_user():
    u = database.create_user("testuser", "pass123", company_access="VBC")
    assert u is not None
    assert u["username"] == "testuser"
    assert u["company_access"] == "VBC"
    fetched = database.get_user("testuser")
    assert fetched["username"] == "testuser"


def test_create_and_get_event():
    p = database.create_product(
        name="Event Product", inspection_level="II", aql_level="1.0",
        test_details="", supplier="", companies=["VBC"],
        created_by="user", created_at="2026-01-01",
    )
    ev = database.create_event(
        product_id=p["id"], product_name=p["name"], direction="incoming",
        lot_size=100, quantity_inspected=13, quantity_non_conforming=0,
        pass_fail="pass", sample_size=13, accept_number=0, reject_number=1,
        code_letter="F", date_inspected="2026-01-01",
        companies=["VBC"], created_by="user", created_at="2026-01-01",
    )
    assert ev is not None
    assert ev["pass_fail"] == "pass"
    fetched = database.get_event(ev["id"])
    assert fetched["lot_size"] == 100


def test_create_and_get_pending():
    p = database.create_product(
        name="Pending Product", inspection_level="I", aql_level="0.65",
        test_details="", supplier="", companies=["VBP"],
        created_by="user", created_at="2026-01-01",
    )
    pend = database.create_pending(
        product_id=p["id"], product_name=p["name"], direction="outgoing",
        lot_size=500, suggested_sample_size=50, estimated_date="2026-02-01",
        companies=["VBP"], created_by="user", assigned_to="", created_at="2026-01-01",
    )
    assert pend is not None
    assert pend["lot_size"] == 500


# --- Delete tests ---

def test_delete_product():
    p = database.create_product(
        name="To Delete", inspection_level="II", aql_level="1.0",
        test_details="", supplier="", companies=["VBC"],
        created_by="user", created_at="2026-01-01",
    )
    result = database.delete_product(p["id"])
    assert result is not None
    assert result["name"] == "To Delete"
    assert database.get_product(p["id"]) is None


def test_delete_nonexistent_product():
    result = database.delete_product(999999)
    assert result is None


def test_delete_nonexistent_user():
    result = database.delete_user("nobody_here")
    assert result is None


# --- Concurrent write tests ---

def test_concurrent_product_creates():
    """10 threads creating products simultaneously should all succeed."""
    errors = []
    results = []

    def create_one(i):
        try:
            p = database.create_product(
                name=f"Concurrent-{i}", inspection_level="II", aql_level="1.0",
                test_details="", supplier="", companies=["VBC"],
                created_by="user", created_at="2026-01-01",
            )
            results.append(p)
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=create_one, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Concurrent writes failed: {errors}"
    assert len(results) == 10
    names = {p["name"] for p in results}
    assert len(names) == 10  # all unique


def test_concurrent_event_creates():
    """10 threads creating events simultaneously should all succeed."""
    p = database.create_product(
        name="ConcurrentEventProd", inspection_level="II", aql_level="1.0",
        test_details="", supplier="", companies=["VBC"],
        created_by="user", created_at="2026-01-01",
    )
    errors = []
    results = []

    def create_one(i):
        try:
            ev = database.create_event(
                product_id=p["id"], product_name=p["name"], direction="incoming",
                lot_size=100 + i, quantity_inspected=13, quantity_non_conforming=0,
                pass_fail="pass", sample_size=13, accept_number=0, reject_number=1,
                code_letter="F", date_inspected="2026-01-01",
                companies=["VBC"], created_by="user", created_at="2026-01-01",
            )
            results.append(ev)
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=create_one, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Concurrent event writes failed: {errors}"
    assert len(results) == 10
