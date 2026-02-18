from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import AuditRecord

FORBIDDEN_META_HINTS = ("password", "secret", "token", "key", "master")


def _sanitize_meta(meta: dict[str, object] | None) -> dict[str, str | int | float | bool] | None:
    if not meta:
        return None

    sanitized: dict[str, str | int | float | bool] = {}

    for key, value in meta.items():
        lowered = key.lower()
        if any(hint in lowered for hint in FORBIDDEN_META_HINTS):
            continue
        if isinstance(value, bool | str | int | float):
            sanitized[key] = value

    return sanitized or None


def write_audit_event(
    db: Session,
    event_type: str,
    outcome: str,
    meta: dict[str, object] | None = None,
) -> None:
    record = AuditRecord(
        id=str(uuid4()),
        ts=datetime.now(UTC),
        type=event_type,
        outcome=outcome,
        meta=_sanitize_meta(meta),
    )
    db.add(record)
