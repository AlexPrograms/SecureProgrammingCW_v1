from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.crypto import (
    Argon2Params,
    CryptoIntegrityError,
    DEFAULT_ARGON2_PARAMS,
    decrypt_json,
    derive_backup_key,
    derive_master_key_raw,
    encrypt_json,
    generate_argon2_salt,
)
from app.schemas import Entry, SettingsModel


class BackupKDFParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    memoryCost: int = Field(gt=0)
    timeCost: int = Field(gt=0)
    parallelism: int = Field(gt=0)


class BackupCipherPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nonce: str
    ciphertext: str


class BackupEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int = Field(default=1)
    createdAt: datetime
    kdfParams: BackupKDFParams | None = None
    salt: str | None = None
    export: BackupCipherPayload
    note: str = Field(default="encrypted-only")


class BackupBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[Entry]
    settings: SettingsModel
    exportedAt: datetime


def _b64encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _b64decode(value: str) -> bytes:
    try:
        return base64.b64decode(value, validate=True)
    except Exception as exc:
        raise ValueError("Invalid backup encoding.") from exc


def build_backup_envelope(
    entries: list[Entry],
    settings: SettingsModel,
    session_enc_key: bytes,
    export_password: str | None,
) -> BackupEnvelope:
    if len(session_enc_key) != 32:
        raise ValueError("Session key unavailable.")

    bundle = BackupBundle(
        entries=entries,
        settings=settings,
        exportedAt=datetime.now(UTC),
    )

    kdf_params: BackupKDFParams | None = None
    salt_b64: str | None = None

    if export_password:
        salt = generate_argon2_salt(DEFAULT_ARGON2_PARAMS.salt_len)
        master_key = derive_master_key_raw(export_password, salt, DEFAULT_ARGON2_PARAMS)
        backup_key = derive_backup_key(master_key)
        kdf_params = BackupKDFParams(
            memoryCost=DEFAULT_ARGON2_PARAMS.memory_cost,
            timeCost=DEFAULT_ARGON2_PARAMS.time_cost,
            parallelism=DEFAULT_ARGON2_PARAMS.parallelism,
        )
        salt_b64 = _b64encode(salt)
    else:
        backup_key = session_enc_key

    encrypted = encrypt_json(backup_key, bundle.model_dump(mode="json"))

    return BackupEnvelope(
        version=1,
        createdAt=datetime.now(UTC),
        kdfParams=kdf_params,
        salt=salt_b64,
        export=BackupCipherPayload(
            nonce=_b64encode(encrypted["nonce"]),
            ciphertext=_b64encode(encrypted["ciphertext"]),
        ),
        note="encrypted-only",
    )


def parse_backup_json(raw_bytes: bytes) -> BackupEnvelope:
    try:
        raw_text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("Invalid backup file.") from exc

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid backup file.") from exc

    try:
        return BackupEnvelope.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError("Invalid backup file.") from exc


def _resolve_import_key(
    envelope: BackupEnvelope,
    session_enc_key: bytes,
    import_password: str | None,
) -> bytes:
    if envelope.kdfParams is None and envelope.salt is None:
        return session_enc_key

    if envelope.kdfParams is None or envelope.salt is None:
        raise ValueError("Invalid backup file.")

    if not import_password:
        raise ValueError("Import password required.")

    salt = _b64decode(envelope.salt)
    params = Argon2Params(
        memory_cost=envelope.kdfParams.memoryCost,
        time_cost=envelope.kdfParams.timeCost,
        parallelism=envelope.kdfParams.parallelism,
    )

    master_key = derive_master_key_raw(import_password, salt, params)
    return derive_backup_key(master_key)


def load_backup_bundle(
    envelope: BackupEnvelope,
    session_enc_key: bytes,
    import_password: str | None,
) -> BackupBundle:
    key = _resolve_import_key(envelope, session_enc_key, import_password)

    nonce = _b64decode(envelope.export.nonce)
    ciphertext = _b64decode(envelope.export.ciphertext)

    try:
        decrypted = decrypt_json(key, nonce, ciphertext)
    except CryptoIntegrityError as exc:
        raise ValueError("Backup decryption failed.") from exc

    try:
        return BackupBundle.model_validate(decrypted)
    except ValidationError as exc:
        raise ValueError("Invalid backup file.") from exc


def envelope_to_json_bytes(envelope: BackupEnvelope) -> bytes:
    payload = envelope.model_dump(mode="json")
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def envelope_from_any(data: dict[str, Any]) -> BackupEnvelope:
    return BackupEnvelope.model_validate(data)
