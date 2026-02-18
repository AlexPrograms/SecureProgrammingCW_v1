from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.config import get_settings


@dataclass
class SessionData:
    token: str
    csrf_token: str
    enc_key: bytes
    created_at: datetime
    last_seen: datetime


class SessionStore:
    def __init__(self, idle_timeout_seconds: int) -> None:
        self._idle_timeout = timedelta(seconds=idle_timeout_seconds)
        self._sessions: dict[str, SessionData] = {}
        self._lock = threading.RLock()

    def create_session(self, enc_key: bytes) -> SessionData:
        if len(enc_key) != 32:
            raise ValueError("Session encryption key must be 32 bytes.")

        now = datetime.now(UTC)
        session = SessionData(
            token=secrets.token_urlsafe(32),
            csrf_token=secrets.token_urlsafe(32),
            enc_key=enc_key,
            created_at=now,
            last_seen=now,
        )

        with self._lock:
            self._sessions[session.token] = session

        return session

    def get_session(self, token: str | None) -> SessionData | None:
        if not token:
            return None

        now = datetime.now(UTC)
        with self._lock:
            session = self._sessions.get(token)
            if session is None:
                return None

            if now - session.last_seen > self._idle_timeout:
                self._sessions.pop(token, None)
                return None

            session.last_seen = now
            return session

    def peek_session(self, token: str | None) -> SessionData | None:
        if not token:
            return None

        now = datetime.now(UTC)
        with self._lock:
            session = self._sessions.get(token)
            if session is None:
                return None

            if now - session.last_seen > self._idle_timeout:
                self._sessions.pop(token, None)
                return None

            return session

    def destroy_session(self, token: str | None) -> None:
        if not token:
            return

        with self._lock:
            self._sessions.pop(token, None)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()


settings = get_settings()
session_store = SessionStore(idle_timeout_seconds=settings.app_session_idle_minutes * 60)
