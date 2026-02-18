from datetime import datetime

from sqlalchemy import (
    BOOLEAN,
    BLOB,
    JSON,
    CheckConstraint,
    DateTime,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class VaultMetadata(Base):
    __tablename__ = "vault_metadata"
    __table_args__ = (CheckConstraint("id = 1", name="ck_vault_metadata_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    hint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    argon2_salt: Mapped[bytes | None] = mapped_column(BLOB, nullable=True)
    argon2_memory_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    argon2_time_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    argon2_parallelism: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pw_verifier: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class EntryRecord(Base):
    __tablename__ = "entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    nonce: Mapped[bytes] = mapped_column(BLOB, nullable=False)
    ciphertext: Mapped[bytes] = mapped_column(BLOB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SettingsRecord(Base):
    __tablename__ = "settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_settings_singleton"),
        CheckConstraint("auto_lock_minutes >= 1 AND auto_lock_minutes <= 120", name="ck_settings_auto_lock_range"),
        CheckConstraint(
            "clipboard_clear_seconds >= 5 AND clipboard_clear_seconds <= 120",
            name="ck_settings_clipboard_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    auto_lock_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    clipboard_clear_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    require_reauth_for_copy: Mapped[bool] = mapped_column(BOOLEAN, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AuditRecord(Base):
    __tablename__ = "audit"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class UnlockThrottleRecord(Base):
    __tablename__ = "unlock_throttle"
    __table_args__ = (CheckConstraint("id = 1", name="ck_unlock_throttle_singleton"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_allowed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
