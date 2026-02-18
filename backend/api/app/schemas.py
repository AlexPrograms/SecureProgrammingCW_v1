from __future__ import annotations

import re
from datetime import datetime
from enum import Enum
from typing import Annotated
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

TAG_PATTERN = re.compile(r"^[A-Za-z0-9 _-]+$")
FORBIDDEN_META_HINTS = ("password", "secret", "token", "key", "master")


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, validate_assignment=True)


class ErrorDetail(StrictSchema):
    code: str = Field(min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=256)


class ErrorResponse(StrictSchema):
    error: ErrorDetail


class HealthResponse(StrictSchema):
    status: str = Field(default="ok")


class VaultStatus(str, Enum):
    NO_VAULT = "NO_VAULT"
    LOCKED = "LOCKED"
    UNLOCKED = "UNLOCKED"


class VaultStatusResponse(StrictSchema):
    status: VaultStatus


MasterPassword = Annotated[str, StringConstraints(min_length=12, max_length=128)]
HintText = Annotated[str, StringConstraints(min_length=0, max_length=64)]


class VaultSetupRequest(StrictSchema):
    masterPassword: MasterPassword
    hint: HintText | None = None


class VaultUnlockRequest(StrictSchema):
    masterPassword: MasterPassword


class GenericOkResponse(StrictSchema):
    ok: bool = True


EntryTitle = Annotated[str, StringConstraints(min_length=1, max_length=128)]
EntryUsername = Annotated[str, StringConstraints(min_length=1, max_length=128)]
EntryPassword = Annotated[str, StringConstraints(min_length=1, max_length=256)]
EntryNotes = Annotated[str, StringConstraints(min_length=0, max_length=2000)]
EntryTag = Annotated[str, StringConstraints(min_length=1, max_length=24)]


class EntryBase(StrictSchema):
    title: EntryTitle
    url: str | None = Field(default=None)
    username: EntryUsername
    password: EntryPassword
    notes: EntryNotes | None = None
    tags: list[EntryTag] = Field(default_factory=list, max_length=10)
    favorite: bool = False

    @field_validator("url")
    @classmethod
    def validate_url_scheme(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None

        parts = urlsplit(value)
        if parts.scheme.lower() not in {"http", "https"}:
            raise ValueError("URL must be http(s).")
        if not parts.netloc:
            raise ValueError("URL must include host.")

        return value

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []

        for tag in values:
            if not TAG_PATTERN.fullmatch(tag):
                raise ValueError("Tags may only contain letters, numbers, spaces, '-' or '_'.")
            cleaned.append(tag)

        return cleaned


class EntryCreateRequest(EntryBase):
    pass


class EntryUpdateRequest(EntryBase):
    pass


class Entry(EntryBase):
    id: UUID
    updatedAt: datetime


class EntrySummary(StrictSchema):
    id: UUID
    title: EntryTitle
    username: EntryUsername
    url: str | None = None
    favorite: bool
    updatedAt: datetime


class SettingsModel(StrictSchema):
    autoLockMinutes: int = Field(ge=1, le=120)
    clipboardClearSeconds: int = Field(ge=5, le=120)
    requireReauthForCopy: bool


MetaValue = str | int | float | bool | None


class AuditEvent(StrictSchema):
    id: UUID
    ts: datetime
    type: str = Field(min_length=1, max_length=64)
    outcome: str = Field(min_length=1, max_length=32)
    meta: dict[str, MetaValue] | None = None

    @field_validator("meta")
    @classmethod
    def validate_meta_keys(cls, value: dict[str, MetaValue] | None) -> dict[str, MetaValue] | None:
        if value is None:
            return None

        for key in value:
            lowered = key.lower()
            if any(hint in lowered for hint in FORBIDDEN_META_HINTS):
                raise ValueError("Audit meta contains disallowed key.")

        return value


class BackupExportRequest(StrictSchema):
    exportPassword: Annotated[str, StringConstraints(min_length=1, max_length=128)] | None = None


class BackupKDFParams(StrictSchema):
    memoryCost: int = Field(gt=0)
    timeCost: int = Field(gt=0)
    parallelism: int = Field(gt=0)


class BackupExportBlob(StrictSchema):
    nonce: str
    ciphertext: str


class BackupExportResponse(StrictSchema):
    version: int = Field(default=1)
    createdAt: datetime
    kdfParams: BackupKDFParams | None = None
    salt: str | None = None
    export: BackupExportBlob
    note: str = Field(default="encrypted-only")


class BackupImportPreviewResponse(StrictSchema):
    added: int = Field(ge=0)
    updated: int = Field(ge=0)
    skipped: int = Field(ge=0)
    errors: list[str] = Field(default_factory=list)
