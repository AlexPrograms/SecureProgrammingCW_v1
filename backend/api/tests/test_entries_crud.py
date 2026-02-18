from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import EntryRecord
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
    setup = client.post("/vault/setup", json={"masterPassword": MASTER_PASSWORD})
    assert setup.status_code == 201

    unlock = client.post("/vault/unlock", json={"masterPassword": MASTER_PASSWORD})
    assert unlock.status_code == 200

    csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
    assert csrf_token
    return csrf_token


def _entry_payload(title: str = "Email") -> dict:
    return {
        "title": title,
        "url": "https://mail.example.com",
        "username": "alice@example.com",
        "password": "S3cur3!P4ss",
        "notes": "MFA enabled",
        "tags": ["mail", "personal"],
        "favorite": True,
    }


def test_entries_crud_flow_and_encrypted_storage() -> None:
    client = TestClient(app)
    csrf_token = _setup_and_unlock(client)

    create_response = client.post(
        "/entries",
        json=_entry_payload(),
        headers={CSRF_HEADER_NAME: csrf_token},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    entry_id = created["id"]

    with SessionLocal() as db:
        row = db.get(EntryRecord, entry_id)
        assert row is not None
        assert len(row.nonce) == 12
        assert len(row.ciphertext) > 16
        assert b"alice@example.com" not in row.ciphertext

    list_response = client.get("/entries")
    assert list_response.status_code == 200
    entries = list_response.json()
    assert len(entries) == 1
    assert entries[0]["id"] == entry_id
    assert "password" not in entries[0]

    detail_response = client.get(f"/entries/{entry_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["password"] == "S3cur3!P4ss"

    update_payload = _entry_payload(title="Updated Email")
    update_payload["favorite"] = False
    update_response = client.put(
        f"/entries/{entry_id}",
        json=update_payload,
        headers={CSRF_HEADER_NAME: csrf_token},
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated Email"
    assert update_response.json()["favorite"] is False

    delete_response = client.delete(
        f"/entries/{entry_id}",
        headers={CSRF_HEADER_NAME: csrf_token},
    )
    assert delete_response.status_code == 204

    missing_after_delete = client.get(f"/entries/{entry_id}")
    assert missing_after_delete.status_code == 404
    assert missing_after_delete.json()["error"]["code"] == "ENTRY_NOT_FOUND"


def test_entries_require_unlocked_session() -> None:
    client = TestClient(app)

    list_response = client.get("/entries")
    assert list_response.status_code == 401
    assert list_response.json()["error"]["code"] == "UNAUTHORIZED"

    create_response = client.post("/entries", json=_entry_payload())
    assert create_response.status_code == 401
    assert create_response.json()["error"]["code"] == "UNAUTHORIZED"
