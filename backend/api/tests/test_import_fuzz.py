from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient
from hypothesis import given, settings
from hypothesis import strategies as st
import pytest

from app.backup import build_backup_envelope, envelope_from_any, envelope_to_json_bytes, load_backup_bundle
from app.db import Base, engine
from app.main import app
from app.schemas import Entry
from app.security import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME
from app.sessions import session_store

MASTER_PASSWORD = "CorrectHorseBatteryStaple!"


def _reset_db_state() -> None:
    session_store.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def reset_state() -> None:
    _reset_db_state()
    yield
    session_store.clear()


def _setup_and_unlock(client: TestClient) -> str:
    assert client.post("/vault/setup", json={"masterPassword": MASTER_PASSWORD}).status_code == 201
    assert client.post("/vault/unlock", json={"masterPassword": MASTER_PASSWORD}).status_code == 200
    csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
    assert csrf_token
    return csrf_token


def _create_entry(client: TestClient, csrf_token: str, title: str) -> str:
    response = client.post(
        "/entries",
        headers={CSRF_HEADER_NAME: csrf_token},
        json={
            "title": title,
            "url": "https://mail.example.com",
            "username": "alice@example.com",
            "password": "S3cur3!P4ss",
            "notes": "MFA enabled",
            "tags": ["mail", "personal"],
            "favorite": True,
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_backup_import_preview_vs_apply() -> None:
    client = TestClient(app)
    csrf_token = _setup_and_unlock(client)

    _create_entry(client, csrf_token, "Email")

    export_response = client.post(
        "/backup/export",
        headers={CSRF_HEADER_NAME: csrf_token},
        json={},
    )
    assert export_response.status_code == 200

    session = session_store.peek_session(client.cookies.get(SESSION_COOKIE_NAME))
    assert session is not None

    envelope = envelope_from_any(export_response.json())
    bundle = load_backup_bundle(envelope, session.enc_key, None)

    bundle.entries.append(
        Entry(
            id=uuid4(),
            title="Bank",
            url="https://bank.example.com",
            username="bob",
            password="N3wS3cur3!",
            notes="imported",
            tags=["finance"],
            favorite=False,
            updatedAt=datetime.now(UTC),
        )
    )

    modified_envelope = build_backup_envelope(
        entries=bundle.entries,
        settings=bundle.settings,
        session_enc_key=session.enc_key,
        export_password=None,
    )
    backup_bytes = envelope_to_json_bytes(modified_envelope)

    preview_response = client.post(
        "/backup/import/preview",
        headers={CSRF_HEADER_NAME: csrf_token},
        files={"file": ("backup.json", backup_bytes, "application/json")},
    )
    assert preview_response.status_code == 200

    preview = preview_response.json()
    assert preview["added"] == 1
    assert preview["errors"] == []

    before_apply = client.get("/entries")
    assert before_apply.status_code == 200
    assert len(before_apply.json()) == 1

    apply_response = client.post(
        "/backup/import/apply",
        headers={CSRF_HEADER_NAME: csrf_token},
        files={"file": ("backup.json", backup_bytes, "application/json")},
    )
    assert apply_response.status_code == 200

    applied = apply_response.json()
    assert applied["added"] == 1
    assert applied["errors"] == []

    after_apply = client.get("/entries")
    assert after_apply.status_code == 200
    assert len(after_apply.json()) == 2


@settings(max_examples=30, deadline=None)
@given(st.binary(min_size=0, max_size=512))
def test_import_preview_fuzz_malformed_json_files(blob: bytes) -> None:
    _reset_db_state()

    client = TestClient(app)
    csrf_token = _setup_and_unlock(client)

    response = client.post(
        "/backup/import/preview",
        headers={CSRF_HEADER_NAME: csrf_token},
        files={"file": ("fuzz.json", blob, "application/json")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"added", "updated", "skipped", "errors"}
    assert isinstance(payload["errors"], list)
