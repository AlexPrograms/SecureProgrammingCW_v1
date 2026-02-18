from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import write_audit_event
from app.crypto import CryptoIntegrityError, decrypt_json, encrypt_json
from app.db import get_db_session
from app.errors import AppError
from app.models import EntryRecord
from app.schemas import Entry, EntryCreateRequest, EntrySummary, EntryUpdateRequest
from app.security import SESSION_COOKIE_NAME
from app.sessions import SessionData, session_store

router = APIRouter(prefix="/entries", tags=["entries"])


def _require_unlocked_session(request: Request) -> SessionData:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    session = session_store.get_session(session_token)

    if session is None:
        raise AppError(code="UNAUTHORIZED", message="Authentication required.", status_code=401)

    return session


def _decrypt_entry(row: EntryRecord, enc_key: bytes) -> Entry:
    try:
        payload = decrypt_json(enc_key, row.nonce, row.ciphertext)
    except CryptoIntegrityError as exc:
        raise AppError(code="ENTRY_UNAVAILABLE", message="Entry unavailable.", status_code=500) from exc

    try:
        return Entry.model_validate(payload)
    except Exception as exc:
        raise AppError(code="ENTRY_UNAVAILABLE", message="Entry unavailable.", status_code=500) from exc


def _to_summary(entry: Entry) -> EntrySummary:
    return EntrySummary(
        id=entry.id,
        title=entry.title,
        username=entry.username,
        url=entry.url,
        favorite=entry.favorite,
        updatedAt=entry.updatedAt,
    )


@router.get("", response_model=list[EntrySummary])
def list_entries(request: Request, db: Session = Depends(get_db_session)) -> list[EntrySummary]:
    session = _require_unlocked_session(request)

    rows = db.execute(select(EntryRecord)).scalars().all()
    entries: list[Entry] = []

    for row in rows:
        entries.append(_decrypt_entry(row, session.enc_key))

    entries.sort(key=lambda item: item.updatedAt, reverse=True)
    summaries = [_to_summary(entry) for entry in entries]

    write_audit_event(db, "ENTRY_LIST", "SUCCESS", {"count": len(summaries)})
    db.commit()

    return summaries


@router.post("", response_model=Entry, status_code=status.HTTP_201_CREATED)
def create_entry(
    payload: EntryCreateRequest,
    request: Request,
    db: Session = Depends(get_db_session),
) -> Entry:
    session = _require_unlocked_session(request)

    now = datetime.now(UTC)
    entry = Entry(
        id=uuid4(),
        title=payload.title,
        url=payload.url,
        username=payload.username,
        password=payload.password,
        notes=payload.notes,
        tags=payload.tags,
        favorite=payload.favorite,
        updatedAt=now,
    )

    encrypted = encrypt_json(session.enc_key, entry.model_dump(mode="json"))

    db.add(
        EntryRecord(
            id=str(entry.id),
            nonce=encrypted["nonce"],
            ciphertext=encrypted["ciphertext"],
            updated_at=now,
        )
    )

    write_audit_event(db, "ENTRY_CREATE", "SUCCESS", {"entry_id": str(entry.id)})
    db.commit()

    return entry


@router.get("/{entry_id}", response_model=Entry)
def get_entry(entry_id: UUID, request: Request, db: Session = Depends(get_db_session)) -> Entry:
    session = _require_unlocked_session(request)

    row = db.get(EntryRecord, str(entry_id))
    if row is None:
        write_audit_event(db, "ENTRY_GET", "FAILURE", {"entry_id": str(entry_id), "reason": "not_found"})
        db.commit()
        raise AppError(code="ENTRY_NOT_FOUND", message="Entry not found.", status_code=404)

    entry = _decrypt_entry(row, session.enc_key)

    write_audit_event(db, "ENTRY_GET", "SUCCESS", {"entry_id": str(entry_id)})
    db.commit()

    return entry


@router.put("/{entry_id}", response_model=Entry)
def update_entry(
    entry_id: UUID,
    payload: EntryUpdateRequest,
    request: Request,
    db: Session = Depends(get_db_session),
) -> Entry:
    session = _require_unlocked_session(request)

    row = db.get(EntryRecord, str(entry_id))
    if row is None:
        write_audit_event(db, "ENTRY_UPDATE", "FAILURE", {"entry_id": str(entry_id), "reason": "not_found"})
        db.commit()
        raise AppError(code="ENTRY_NOT_FOUND", message="Entry not found.", status_code=404)

    now = datetime.now(UTC)
    entry = Entry(
        id=entry_id,
        title=payload.title,
        url=payload.url,
        username=payload.username,
        password=payload.password,
        notes=payload.notes,
        tags=payload.tags,
        favorite=payload.favorite,
        updatedAt=now,
    )

    encrypted = encrypt_json(session.enc_key, entry.model_dump(mode="json"))
    row.nonce = encrypted["nonce"]
    row.ciphertext = encrypted["ciphertext"]
    row.updated_at = now

    db.add(row)
    write_audit_event(db, "ENTRY_UPDATE", "SUCCESS", {"entry_id": str(entry_id)})
    db.commit()

    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: UUID, request: Request, db: Session = Depends(get_db_session)) -> None:
    _require_unlocked_session(request)

    row = db.get(EntryRecord, str(entry_id))
    if row is None:
        write_audit_event(db, "ENTRY_DELETE", "FAILURE", {"entry_id": str(entry_id), "reason": "not_found"})
        db.commit()
        raise AppError(code="ENTRY_NOT_FOUND", message="Entry not found.", status_code=404)

    db.delete(row)
    write_audit_event(db, "ENTRY_DELETE", "SUCCESS", {"entry_id": str(entry_id)})
    db.commit()

    return None
