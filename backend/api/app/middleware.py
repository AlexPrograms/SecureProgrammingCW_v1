from __future__ import annotations

from starlette.responses import Response
from starlette.types import ASGIApp, Receive, Scope, Send

from app.errors import build_error_response
from app.security import CSRF_COOKIE_NAME, CSRF_HEADER_NAME, SESSION_COOKIE_NAME
from app.sessions import session_store

STATE_CHANGING_METHODS = {"POST", "PUT", "DELETE", "PATCH"}
CSRF_EXEMPT_PATHS = {
    "/vault/setup",
    "/vault/unlock",
    "/health",
    "/openapi.json",
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
}


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: dict) -> None:
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                headers.extend(
                    [
                        (b"x-content-type-options", b"nosniff"),
                        (b"referrer-policy", b"no-referrer"),
                        (b"cache-control", b"no-store"),
                        (b"permissions-policy", b"geolocation=(), microphone=(), camera=()"),
                    ]
                )
            await send(message)

        await self.app(scope, receive, send_with_headers)


class CSRFMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "").upper()
        path = scope.get("path", "")

        if method == "OPTIONS" or method not in STATE_CHANGING_METHODS or path in CSRF_EXEMPT_PATHS:
            await self.app(scope, receive, send)
            return

        headers_raw = scope.get("headers", [])
        headers = {k.decode("latin1").lower(): v.decode("latin1") for k, v in headers_raw}
        cookie_header = headers.get("cookie", "")
        cookies = _parse_cookies(cookie_header)

        session_token = cookies.get(SESSION_COOKIE_NAME)
        csrf_cookie = cookies.get(CSRF_COOKIE_NAME)
        csrf_header = headers.get(CSRF_HEADER_NAME.lower())

        if not session_token:
            response = build_error_response(401, "UNAUTHORIZED", "Authentication required.")
            await response(scope, receive, send)
            return

        session = session_store.get_session(session_token)
        if session is None:
            response = build_error_response(401, "UNAUTHORIZED", "Authentication required.")
            await response(scope, receive, send)
            return

        if not csrf_cookie or not csrf_header:
            response = build_error_response(403, "CSRF_INVALID", "Request not allowed.")
            await response(scope, receive, send)
            return

        if csrf_cookie != csrf_header or session.csrf_token != csrf_header:
            response = build_error_response(403, "CSRF_INVALID", "Request not allowed.")
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)


def _parse_cookies(raw_cookie_header: str) -> dict[str, str]:
    result: dict[str, str] = {}
    if not raw_cookie_header:
        return result

    for item in raw_cookie_header.split(";"):
        chunk = item.strip()
        if not chunk or "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        result[key.strip()] = value.strip()

    return result
