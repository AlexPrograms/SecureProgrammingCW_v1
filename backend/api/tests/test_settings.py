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


def test_settings_requires_unlocked_session() -> None:
    client = TestClient(app)

    response = client.get("/settings")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_settings_get_put_and_bounds_validation() -> None:
    client = TestClient(app)
    csrf_token = _setup_and_unlock(client)

    get_response = client.get("/settings")
    assert get_response.status_code == 200
    assert get_response.json() == {
        "autoLockMinutes": 5,
        "clipboardClearSeconds": 15,
        "requireReauthForCopy": True,
    }

    update_response = client.put(
        "/settings",
        headers={CSRF_HEADER_NAME: csrf_token},
        json={
            "autoLockMinutes": 10,
            "clipboardClearSeconds": 20,
            "requireReauthForCopy": False,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json() == {
        "autoLockMinutes": 10,
        "clipboardClearSeconds": 20,
        "requireReauthForCopy": False,
    }

    invalid_auto_lock = client.put(
        "/settings",
        headers={CSRF_HEADER_NAME: csrf_token},
        json={
            "autoLockMinutes": 0,
            "clipboardClearSeconds": 20,
            "requireReauthForCopy": False,
        },
    )
    assert invalid_auto_lock.status_code == 422
    assert invalid_auto_lock.json()["error"]["code"] == "VALIDATION_ERROR"

    invalid_clipboard = client.put(
        "/settings",
        headers={CSRF_HEADER_NAME: csrf_token},
        json={
            "autoLockMinutes": 10,
            "clipboardClearSeconds": 121,
            "requireReauthForCopy": False,
        },
    )
    assert invalid_clipboard.status_code == 422
    assert invalid_clipboard.json()["error"]["code"] == "VALIDATION_ERROR"
