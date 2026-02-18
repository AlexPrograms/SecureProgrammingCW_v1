from __future__ import annotations

from datetime import UTC

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import write_audit_event
from app.backup import build_backup_envelope, load_backup_bundle, parse_backup_json
from app.db import get_db_session
from app.errors import AppError
from app.models import EntryRecord, SettingsRecord
from app.schemas import BackupExportRequest, BackupExportResponse, BackupImportPreviewResponse, Entry, SettingsModel
from app.security import SESSION_COOKIE_NAME
from app.sessions import SessionData, session_store
from app.crypto import CryptoIntegrityError, decrypt_json, encrypt_json

router = APIRouter(prefix="/backup", tags=["backup"])


def _require_unlocked_session(request: Request) -> SessionData:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    session = session_store.get_session(token)
    if session is None:
        raise AppError(code="UNAUTHORIZED", message="Authentication required.", status_code=401)
    return session


def _load_settings(db: Session) -> SettingsModel:
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

    return SettingsModel(
        autoLockMinutes=record.auto_lock_minutes,
        clipboardClearSeconds=record.clipboard_clear_seconds,
        requireReauthForCopy=record.require_reauth_for_copy,
    )


def _decrypt_rows_as_entries(rows: list[EntryRecord], enc_key: bytes) -> list[Entry]:
    entries: list[Entry] = []

    for row in rows:
        try:
            payload = decrypt_json(enc_key, row.nonce, row.ciphertext)
        except CryptoIntegrityError as exc:
            raise AppError(code="ENTRY_UNAVAILABLE", message="Entry unavailable.", status_code=500) from exc

        entry = Entry.model_validate(payload)
        entries.append(entry)

    return entries


def _compute_import_summary(
    db: Session,
    incoming_entries: list[Entry],
) -> tuple[int, int, int, list[str], dict[str, EntryRecord]]:
    existing_rows = db.execute(select(EntryRecord)).scalars().all()
    existing_map = {row.id: row for row in existing_rows}

    added = 0
    updated = 0
    skipped = 0
    errors: list[str] = []

    for incoming in incoming_entries:
        existing = existing_map.get(str(incoming.id))
        if existing is None:
            added += 1
            continue

        existing_updated = existing.updated_at
        if existing_updated.tzinfo is None:
            existing_updated = existing_updated.replace(tzinfo=UTC)

        incoming_updated = incoming.updatedAt
        if incoming_updated.tzinfo is None:
            incoming_updated = incoming_updated.replace(tzinfo=UTC)

        if incoming_updated > existing_updated:
            updated += 1
        else:
            skipped += 1

    return added, updated, skipped, errors, existing_map


@router.post("/export", response_model=BackupExportResponse)
def export_backup(
    payload: BackupExportRequest,
    request: Request,
    db: Session = Depends(get_db_session),
) -> dict:
    session = _require_unlocked_session(request)

    rows = db.execute(select(EntryRecord)).scalars().all()
    entries = _decrypt_rows_as_entries(rows, session.enc_key)
    app_settings = _load_settings(db)

    envelope = build_backup_envelope(
        entries=entries,
        settings=app_settings,
        session_enc_key=session.enc_key,
        export_password=payload.exportPassword,
    )

    write_audit_event(
        db,
        "BACKUP_EXPORT",
        "SUCCESS",
        {"entry_count": len(entries), "password_protected": bool(payload.exportPassword)},
    )
    db.commit()

    return BackupExportResponse.model_validate(envelope.model_dump(mode="json"))


@router.post("/import/preview", response_model=BackupImportPreviewResponse)
async def preview_import_backup(
    request: Request,
    file: UploadFile = File(...),
    password: str | None = Form(default=None),
    db: Session = Depends(get_db_session),
) -> BackupImportPreviewResponse:
    session = _require_unlocked_session(request)

    if not file.filename or not file.filename.lower().endswith(".json"):
        write_audit_event(db, "BACKUP_IMPORT_PREVIEW", "FAILURE", {"reason": "invalid_file_extension"})
        db.commit()
        return BackupImportPreviewResponse(added=0, updated=0, skipped=0, errors=["Invalid backup file."])

    raw_bytes = await file.read()

    try:
        envelope = parse_backup_json(raw_bytes)
    except ValueError:
        write_audit_event(db, "BACKUP_IMPORT_PREVIEW", "FAILURE", {"reason": "invalid_file"})
        db.commit()
        return BackupImportPreviewResponse(added=0, updated=0, skipped=0, errors=["Invalid backup file."])

    try:
        bundle = load_backup_bundle(envelope, session.enc_key, password)
    except ValueError:
        write_audit_event(db, "BACKUP_IMPORT_PREVIEW", "FAILURE", {"reason": "decrypt_failed"})
        db.commit()
        return BackupImportPreviewResponse(added=0, updated=0, skipped=0, errors=["Invalid backup file."])

    added, updated, skipped, errors, _ = _compute_import_summary(db, bundle.entries)

    write_audit_event(
        db,
        "BACKUP_IMPORT_PREVIEW",
        "SUCCESS" if not errors else "FAILURE",
        {"added": added, "updated": updated, "skipped": skipped, "errors": len(errors)},
    )
    db.commit()

    return BackupImportPreviewResponse(
        added=added,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )


@router.post("/import/apply", response_model=BackupImportPreviewResponse)
async def apply_import_backup(
    request: Request,
    file: UploadFile = File(...),
    password: str | None = Form(default=None),
    db: Session = Depends(get_db_session),
) -> BackupImportPreviewResponse:
    session = _require_unlocked_session(request)

    if not file.filename or not file.filename.lower().endswith(".json"):
        write_audit_event(db, "BACKUP_IMPORT_APPLY", "FAILURE", {"reason": "invalid_file_extension"})
        db.commit()
        return BackupImportPreviewResponse(added=0, updated=0, skipped=0, errors=["Invalid backup file."])

    raw_bytes = await file.read()

    try:
        envelope = parse_backup_json(raw_bytes)
        bundle = load_backup_bundle(envelope, session.enc_key, password)
    except ValueError:
        write_audit_event(db, "BACKUP_IMPORT_APPLY", "FAILURE", {"reason": "invalid_file"})
        db.commit()
        return BackupImportPreviewResponse(added=0, updated=0, skipped=0, errors=["Invalid backup file."])

    added, updated, skipped, errors, existing_map = _compute_import_summary(db, bundle.entries)

    if errors:
        write_audit_event(
            db,
            "BACKUP_IMPORT_APPLY",
            "FAILURE",
            {"added": added, "updated": updated, "skipped": skipped, "errors": len(errors)},
        )
        db.commit()
        return BackupImportPreviewResponse(added=added, updated=updated, skipped=skipped, errors=errors)

    try:
        for incoming in bundle.entries:
            row = existing_map.get(str(incoming.id))
            encrypted = encrypt_json(session.enc_key, incoming.model_dump(mode="json"))

            if row is None:
                db.add(
                    EntryRecord(
                        id=str(incoming.id),
                        nonce=encrypted["nonce"],
                        ciphertext=encrypted["ciphertext"],
                        updated_at=incoming.updatedAt,
                    )
                )
                continue

            existing_updated = row.updated_at
            if existing_updated.tzinfo is None:
                existing_updated = existing_updated.replace(tzinfo=UTC)

            incoming_updated = incoming.updatedAt
            if incoming_updated.tzinfo is None:
                incoming_updated = incoming_updated.replace(tzinfo=UTC)

            if incoming_updated > existing_updated:
                row.nonce = encrypted["nonce"]
                row.ciphertext = encrypted["ciphertext"]
                row.updated_at = incoming.updatedAt
                db.add(row)

        settings_row = db.get(SettingsRecord, 1)
        if settings_row is None:
            settings_row = SettingsRecord(id=1)

        settings_row.auto_lock_minutes = bundle.settings.autoLockMinutes
        settings_row.clipboard_clear_seconds = bundle.settings.clipboardClearSeconds
        settings_row.require_reauth_for_copy = bundle.settings.requireReauthForCopy
        db.add(settings_row)

        write_audit_event(
            db,
            "BACKUP_IMPORT_APPLY",
            "SUCCESS",
            {"added": added, "updated": updated, "skipped": skipped, "errors": 0},
        )
        db.commit()
    except Exception:
        db.rollback()
        write_audit_event(db, "BACKUP_IMPORT_APPLY", "FAILURE", {"reason": "transaction_failed"})
        db.commit()
        raise AppError(code="IMPORT_FAILED", message="Import failed.", status_code=400)

    return BackupImportPreviewResponse(added=added, updated=updated, skipped=skipped, errors=[])
