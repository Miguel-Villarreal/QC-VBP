import os
import tempfile
import pytest

# Set DB_PATH to a temp file before importing anything
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DB_PATH"] = _tmp.name

import database
import auth
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(autouse=True)
def fresh_db():
    """Re-initialize the database before each test."""
    database._conn = None
    database.init_db()
    yield
    # Cleanup connection after test
    if database._conn:
        database._conn.close()
        database._conn = None


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token():
    """JWT token for the default admin user (user/password)."""
    return auth.create_token("user")


@pytest.fixture
def non_admin_token():
    """Create a non-admin user and return their JWT token."""
    database.create_user(
        username="regular",
        password="pass123",
        is_admin=False,
        company_access="All",
    )
    return auth.create_token("regular")
