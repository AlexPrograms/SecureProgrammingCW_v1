from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
import pytest

from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import UnlockThrottleRecord
from app.security import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME
from app.sessions import session_store

MASTER_PASSWORD = "CorrectHorseBatteryStaple!"


@pytest.fixture(autouse=True)
def reset_state() -> None:
    session_store.clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    session_store.clear()


def test_vault_state_transitions() -> None:
    client = TestClient(app)

    assert client.get("/vault/status").status_code == 200
    assert client.get("/vault/status").json() == {"status": "NO_VAULT"}

    setup_response = client.post(
        "/vault/setup",
        json={"masterPassword": MASTER_PASSWORD, "hint": "memorable words"},
    )
    assert setup_response.status_code == 201

    assert client.get("/vault/status").json() == {"status": "LOCKED"}

    unlock_response = client.post("/vault/unlock", json={"masterPassword": MASTER_PASSWORD})
    assert unlock_response.status_code == 200
    assert unlock_response.json() == {"ok": True}

    assert session_cookie_exists(client) is True
    assert client.cookies.get(CSRF_COOKIE_NAME)

    assert client.get("/vault/status").json() == {"status": "UNLOCKED"}

    csrf_token = client.cookies.get(CSRF_COOKIE_NAME)
    lock_response = client.post("/vault/lock", headers={CSRF_HEADER_NAME: csrf_token})
    assert lock_response.status_code == 204

    assert client.get("/vault/status").json() == {"status": "LOCKED"}


def test_unlock_backoff_persists_and_resets_on_success() -> None:
    client = TestClient(app)
    client.post("/vault/setup", json={"masterPassword": MASTER_PASSWORD})

    first_fail = client.post("/vault/unlock", json={"masterPassword": "wrong-password-1"})
    assert first_fail.status_code == 401
    assert first_fail.json()["error"]["code"] == "UNAUTHORIZED"

    blocked_attempt = client.post("/vault/unlock", json={"masterPassword": "wrong-password-2"})
    assert blocked_attempt.status_code == 429
    assert blocked_attempt.json()["error"]["code"] == "RATE_LIMITED"

    with SessionLocal() as db:
        throttle = db.get(UnlockThrottleRecord, 1)
        assert throttle is not None
        assert throttle.failed_attempts == 1
        assert throttle.next_allowed_at is not None

        throttle.next_allowed_at = datetime.now(UTC) - timedelta(seconds=1)
        db.add(throttle)
        db.commit()

    second_fail = client.post("/vault/unlock", json={"masterPassword": "wrong-password-3"})
    assert second_fail.status_code == 401

    with SessionLocal() as db:
        throttle = db.get(UnlockThrottleRecord, 1)
        assert throttle is not None
        assert throttle.failed_attempts == 2
        assert throttle.next_allowed_at is not None

        throttle.next_allowed_at = datetime.now(UTC) - timedelta(seconds=1)
        db.add(throttle)
        db.commit()

    success = client.post("/vault/unlock", json={"masterPassword": MASTER_PASSWORD})
    assert success.status_code == 200

    with SessionLocal() as db:
        throttle = db.get(UnlockThrottleRecord, 1)
        assert throttle is not None
        assert throttle.failed_attempts == 0
        assert throttle.next_allowed_at is None


def session_cookie_exists(client: TestClient) -> bool:
    return any(cookie.name == SESSION_COOKIE_NAME for cookie in client.cookies.jar)
