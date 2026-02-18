from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app.db import Base, engine
from app.main import app
from app.security import CSRF_COOKIE_NAME, CSRF_HEADER_NAME
from app.sessions import session_store

MASTER_PASSWORD = "CorrectHorseBatteryStaple!"


@pytest.fixture(autouse=True)
def reset_state() -> None:
    session_store.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    session_store.clear()


def _setup_and_unlock(client: TestClient) -> str:
    assert client.post("/vault/setup", json={"masterPassword": MASTER_PASSWORD}).status_code == 201
    assert client.post("/vault/unlock", json={"masterPassword": MASTER_PASSWORD}).status_code == 200

    csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
    assert csrf_token
    return csrf_token


def test_audit_requires_unlocked_session() -> None:
    client = TestClient(app)

    response = client.get("/audit")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_audit_list_has_no_secret_meta_keys() -> None:
    client = TestClient(app)
    csrf_token = _setup_and_unlock(client)

    create_entry_response = client.post(
        "/entries",
        headers={CSRF_HEADER_NAME: csrf_token},
        json={
            "title": "Email",
            "url": "https://mail.example.com",
            "username": "alice@example.com",
            "password": "S3cur3!P4ss",
            "notes": "MFA enabled",
            "tags": ["mail", "personal"],
            "favorite": True,
        },
    )
    assert create_entry_response.status_code == 201

    response = client.get("/audit")
    assert response.status_code == 200

    forbidden_fragments = {"password", "secret", "token", "key", "master"}

    for event in response.json():
        meta = event.get("meta")
        if not isinstance(meta, dict):
            continue

        for key in meta:
            lower = key.lower()
            assert not any(fragment in lower for fragment in forbidden_fragments)
