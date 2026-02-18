from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.security import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME
from app.sessions import session_store


def test_state_changing_route_requires_csrf_header() -> None:
    session_store.clear()
    client = TestClient(app)

    session = session_store.create_session(enc_key=b"0" * 32)
    client.cookies.set(SESSION_COOKIE_NAME, session.token)
    client.cookies.set(CSRF_COOKIE_NAME, session.csrf_token)

    response = client.post("/_internal/csrf-probe")

    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "CSRF_INVALID",
            "message": "Request not allowed.",
        }
    }


def test_state_changing_route_requires_session() -> None:
    session_store.clear()
    client = TestClient(app)

    response = client.post("/_internal/csrf-probe")

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Authentication required.",
        }
    }


def test_state_changing_route_rejects_mismatched_csrf() -> None:
    session_store.clear()
    client = TestClient(app)

    session = session_store.create_session(enc_key=b"1" * 32)
    client.cookies.set(SESSION_COOKIE_NAME, session.token)
    client.cookies.set(CSRF_COOKIE_NAME, session.csrf_token)

    response = client.post("/_internal/csrf-probe", headers={CSRF_HEADER_NAME: "bad-token"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_INVALID"


def test_state_changing_route_allows_valid_double_submit_csrf() -> None:
    session_store.clear()
    client = TestClient(app)

    session = session_store.create_session(enc_key=b"2" * 32)
    client.cookies.set(SESSION_COOKIE_NAME, session.token)
    client.cookies.set(CSRF_COOKIE_NAME, session.csrf_token)

    response = client.post("/_internal/csrf-probe", headers={CSRF_HEADER_NAME: session.csrf_token})

    assert response.status_code == 200
    assert response.json() == {"ok": True}
