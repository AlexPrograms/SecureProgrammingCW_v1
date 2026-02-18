from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.audit import write_audit_event
from app.db import get_db_session
from app.errors import AppError
from app.models import SettingsRecord
from app.schemas import SettingsModel
from app.security import SESSION_COOKIE_NAME
from app.sessions import session_store

router = APIRouter(prefix="/settings", tags=["settings"])


def _require_unlocked(request: Request) -> None:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    session = session_store.get_session(token)
    if session is None:
        raise AppError(code="UNAUTHORIZED", message="Authentication required.", status_code=401)


def _get_or_create_settings(db: Session) -> SettingsRecord:
    record = db.get(SettingsRecord, 1)
    if record is None:
        record = SettingsRecord(
            id=1,
            auto_lock_minutes=5,
            clipboard_clear_seconds=15,
            require_reauth_for_copy=True,
        )
        db.add(record)
        db.flush()
    return record


@router.get("", response_model=SettingsModel)
def get_settings(request: Request, db: Session = Depends(get_db_session)) -> SettingsModel:
    _require_unlocked(request)

    record = _get_or_create_settings(db)
    db.commit()

    return SettingsModel(
        autoLockMinutes=record.auto_lock_minutes,
        clipboardClearSeconds=record.clipboard_clear_seconds,
        requireReauthForCopy=record.require_reauth_for_copy,
    )


@router.put("", response_model=SettingsModel)
def update_settings(
    payload: SettingsModel,
    request: Request,
    db: Session = Depends(get_db_session),
) -> SettingsModel:
    _require_unlocked(request)

    record = _get_or_create_settings(db)
    record.auto_lock_minutes = payload.autoLockMinutes
    record.clipboard_clear_seconds = payload.clipboardClearSeconds
    record.require_reauth_for_copy = payload.requireReauthForCopy

    db.add(record)
    write_audit_event(db, "SETTINGS_UPDATE", "SUCCESS")
    db.commit()

    return SettingsModel(
        autoLockMinutes=record.auto_lock_minutes,
        clipboardClearSeconds=record.clipboard_clear_seconds,
        requireReauthForCopy=record.require_reauth_for_copy,
    )
