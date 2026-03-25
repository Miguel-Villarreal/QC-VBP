"""Integration tests covering API fixes 4-9, 17-19."""


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_login_success(client):
    res = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["username"] == "user"
    assert data["is_admin"] is True


def test_login_invalid_credentials(client):
    res = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert res.status_code == 401


def test_login_missing_fields(client):
    res = client.post("/api/auth/login", json={})
    assert res.status_code == 422


def test_login_empty_username(client):
    res = client.post("/api/auth/login", json={"username": "", "password": "x"})
    assert res.status_code == 422


def test_created_by_enforced_from_token(client, admin_token):
    """Fix 4: created_by should come from JWT, not request body."""
    res = client.post(
        "/api/products",
        json={
            "name": "Test Product",
            "inspection_level": "II",
            "aql_level": "1.0",
            "created_by": "hacker",
            "company": "VBC",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.json()["created_by"] == "user"  # from token, not "hacker"


def test_admin_route_requires_admin(client, non_admin_token):
    """Fix 5: non-admin user should get 403 on admin routes."""
    res = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {non_admin_token}"},
    )
    assert res.status_code == 403


def test_admin_route_succeeds_for_admin(client, admin_token):
    res = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200


def test_delete_user_no_password_hash(client, admin_token):
    """Fix 6: delete user response must not leak password_hash."""
    # Create a user first
    client.post(
        "/api/users",
        json={"username": "delme", "password": "pass123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    res = client.delete(
        "/api/users/delme",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert "password_hash" not in res.json()


def test_unauthenticated_request(client):
    res = client.get("/api/products")
    assert res.status_code == 401


def test_product_name_empty_rejected(client, admin_token):
    """Fix 18: empty product name should be rejected by Pydantic validation."""
    res = client.post(
        "/api/products",
        json={"name": "", "inspection_level": "II", "aql_level": "1.0"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 422


def test_negative_lot_size_rejected(client, admin_token):
    """Fix 18: lot_size must be > 0."""
    res = client.post(
        "/api/pending",
        json={"product_id": 1, "direction": "incoming", "lot_size": -1, "estimated_date": "2026-04-01"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 422


def test_login_rate_limiting(client):
    """Fix 19: 11th login attempt within 60s should return 429."""
    for _ in range(10):
        client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    res = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert res.status_code == 429
