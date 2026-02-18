from __future__ import annotations

from fastapi import Response

from app.sessions import SessionData

SESSION_COOKIE_NAME = "session_token"
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"


def set_session_cookies(response: Response, session: SessionData, max_age_seconds: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session.token,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
        max_age=max_age_seconds,
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=session.csrf_token,
        httponly=False,
        secure=False,
        samesite="lax",
        path="/",
        max_age=max_age_seconds,
    )


def clear_session_cookies(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
