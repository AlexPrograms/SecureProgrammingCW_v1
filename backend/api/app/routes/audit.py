from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Request

from app.db import get_db_session
from app.errors import AppError
from app.models import AuditRecord
from app.schemas import AuditEvent
from app.security import SESSION_COOKIE_NAME
from app.sessions import session_store

router = APIRouter(prefix="/audit", tags=["audit"])

FORBIDDEN_META_HINTS = ("password", "secret", "token", "key", "master")


def _require_unlocked(request: Request) -> None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    session = session_store.get_session(token)
    if session is None:
        raise AppError(code="UNAUTHORIZED", message="Authentication required.", status_code=401)


def _sanitize_meta(meta: dict | None) -> dict | None:
    if not meta:
        return None

    sanitized: dict[str, str | int | float | bool | None] = {}

    for key, value in meta.items():
        lowered = key.lower()
        if any(hint in lowered for hint in FORBIDDEN_META_HINTS):
            continue

        if isinstance(value, bool | str | int | float) or value is None:
            sanitized[key] = value

    return sanitized or None


@router.get("", response_model=list[AuditEvent])
def list_audit(request: Request, db: Session = Depends(get_db_session)) -> list[AuditEvent]:
    _require_unlocked(request)

    rows = db.execute(select(AuditRecord).order_by(AuditRecord.ts.desc())).scalars().all()

    output: list[AuditEvent] = []
    for row in rows:
        output.append(
            AuditEvent(
                id=row.id,
                ts=row.ts,
                type=row.type,
                outcome=row.outcome,
                meta=_sanitize_meta(row.meta),
            )
        )

    return output
