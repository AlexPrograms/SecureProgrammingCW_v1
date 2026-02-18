from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.audit import write_audit_event
from app.config import get_settings
from app.crypto import (
    Argon2Params,
    DEFAULT_ARGON2_PARAMS,
    derive_enc_key,
    derive_master_key_raw,
    generate_argon2_salt,
    hash_password_verifier,
    verify_password,
)
from app.db import get_db_session
from app.errors import AppError
from app.models import SettingsRecord, UnlockThrottleRecord, VaultMetadata
from app.schemas import GenericOkResponse, VaultSetupRequest, VaultStatus, VaultStatusResponse, VaultUnlockRequest
from app.security import (
    SESSION_COOKIE_NAME,
    clear_session_cookies,
    set_session_cookies,
)
from app.sessions import session_store

router = APIRouter(prefix="/vault", tags=["vault"])

settings = get_settings()


def _get_vault_metadata(db: Session) -> VaultMetadata | None:
    return db.get(VaultMetadata, 1)


def _get_or_create_unlock_throttle(db: Session) -> UnlockThrottleRecord:
    throttle = db.get(UnlockThrottleRecord, 1)
    if throttle is None:
        throttle = UnlockThrottleRecord(id=1, failed_attempts=0, next_allowed_at=None)
        db.add(throttle)
        db.flush()
    return throttle


def _get_or_create_settings(db: Session) -> SettingsRecord:
    app_settings = db.get(SettingsRecord, 1)
    if app_settings is None:
        app_settings = SettingsRecord(
            id=1,
            auto_lock_minutes=5,
            clipboard_clear_seconds=15,
            require_reauth_for_copy=True,
        )
        db.add(app_settings)
        db.flush()
    return app_settings


@router.get("/status", response_model=VaultStatusResponse)
def vault_status(request: Request, db: Session = Depends(get_db_session)) -> VaultStatusResponse:
    metadata = _get_vault_metadata(db)

    if metadata is None or not metadata.pw_verifier:
        return VaultStatusResponse(status=VaultStatus.NO_VAULT)

    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    current_session = session_store.peek_session(session_token)

    if current_session is None:
        return VaultStatusResponse(status=VaultStatus.LOCKED)

    return VaultStatusResponse(status=VaultStatus.UNLOCKED)


@router.post("/setup", status_code=201, response_model=GenericOkResponse)
def vault_setup(payload: VaultSetupRequest, db: Session = Depends(get_db_session)) -> GenericOkResponse:
    metadata = _get_vault_metadata(db)
    if metadata is not None and metadata.pw_verifier:
        write_audit_event(db, "VAULT_SETUP", "FAILURE", {"reason": "already_initialized"})
        db.commit()
        raise AppError(code="VAULT_EXISTS", message="Vault already initialized.", status_code=409)

    salt = generate_argon2_salt(DEFAULT_ARGON2_PARAMS.salt_len)
    verifier = hash_password_verifier(payload.masterPassword, DEFAULT_ARGON2_PARAMS)

    if metadata is None:
        metadata = VaultMetadata(id=1)

    metadata.schema_version = 1
    metadata.hint = payload.hint
    metadata.argon2_salt = salt
    metadata.argon2_memory_cost = DEFAULT_ARGON2_PARAMS.memory_cost
    metadata.argon2_time_cost = DEFAULT_ARGON2_PARAMS.time_cost
    metadata.argon2_parallelism = DEFAULT_ARGON2_PARAMS.parallelism
    metadata.pw_verifier = verifier

    db.add(metadata)
    _get_or_create_settings(db)
    _get_or_create_unlock_throttle(db)

    write_audit_event(db, "VAULT_SETUP", "SUCCESS", {"hint_set": bool(payload.hint)})
    db.commit()

    return GenericOkResponse(ok=True)


@router.post("/unlock", response_model=GenericOkResponse)
def vault_unlock(
    payload: VaultUnlockRequest,
    response: Response,
    db: Session = Depends(get_db_session),
) -> GenericOkResponse:
    metadata = _get_vault_metadata(db)
    if metadata is None or not metadata.pw_verifier:
        write_audit_event(db, "VAULT_UNLOCK", "FAILURE", {"reason": "vault_missing"})
        db.commit()
        raise AppError(code="VAULT_NOT_INITIALIZED", message="Vault not initialized.", status_code=400)

    if (
        metadata.argon2_salt is None
        or metadata.argon2_memory_cost is None
        or metadata.argon2_time_cost is None
        or metadata.argon2_parallelism is None
    ):
        raise AppError(code="VAULT_INVALID", message="Vault unavailable.", status_code=500)

    throttle = _get_or_create_unlock_throttle(db)
    now = datetime.now(UTC)

    if throttle.next_allowed_at and now < throttle.next_allowed_at:
        retry_after_seconds = max(1, int((throttle.next_allowed_at - now).total_seconds()))
        write_audit_event(
            db,
            "VAULT_UNLOCK",
            "FAILURE",
            {"reason": "throttled", "retry_after_seconds": retry_after_seconds},
        )
        db.commit()
        raise AppError(code="RATE_LIMITED", message="Too many attempts. Try again later.", status_code=429)

    verified = verify_password(payload.masterPassword, metadata.pw_verifier)
    if not verified:
        throttle.failed_attempts += 1
        delay_seconds = min(300, 2 ** min(throttle.failed_attempts, 8))
        throttle.next_allowed_at = now + timedelta(seconds=delay_seconds)
        db.add(throttle)

        write_audit_event(
            db,
            "VAULT_UNLOCK",
            "FAILURE",
            {
                "failed_attempts": throttle.failed_attempts,
                "delay_seconds": delay_seconds,
            },
        )
        db.commit()
        raise AppError(code="UNAUTHORIZED", message="Unlock failed.", status_code=401)

    params = Argon2Params(
        memory_cost=metadata.argon2_memory_cost,
        time_cost=metadata.argon2_time_cost,
        parallelism=metadata.argon2_parallelism,
    )

    master_key = derive_master_key_raw(payload.masterPassword, metadata.argon2_salt, params)
    enc_key = derive_enc_key(master_key)

    throttle.failed_attempts = 0
    throttle.next_allowed_at = None
    db.add(throttle)

    active_session = session_store.create_session(enc_key)
    set_session_cookies(response, active_session, max_age_seconds=settings.app_session_idle_minutes * 60)

    write_audit_event(db, "VAULT_UNLOCK", "SUCCESS")
    db.commit()

    return GenericOkResponse(ok=True)


@router.post("/lock", status_code=204)
def vault_lock(request: Request, response: Response, db: Session = Depends(get_db_session)) -> None:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_store.destroy_session(session_token)
    clear_session_cookies(response)

    write_audit_event(db, "VAULT_LOCK", "SUCCESS")
    db.commit()

    response.status_code = 204
    return None
