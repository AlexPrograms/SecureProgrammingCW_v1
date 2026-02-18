"""Initial schema

Revision ID: 20260211_0001
Revises:
Create Date: 2026-02-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260211_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vault_metadata",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("hint", sa.String(length=64), nullable=True),
        sa.Column("argon2_salt", sa.LargeBinary(), nullable=True),
        sa.Column("argon2_memory_cost", sa.Integer(), nullable=True),
        sa.Column("argon2_time_cost", sa.Integer(), nullable=True),
        sa.Column("argon2_parallelism", sa.Integer(), nullable=True),
        sa.Column("pw_verifier", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_vault_metadata_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("nonce", sa.LargeBinary(), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("auto_lock_minutes", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("clipboard_clear_seconds", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("require_reauth_for_copy", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_settings_singleton"),
        sa.CheckConstraint("auto_lock_minutes >= 1 AND auto_lock_minutes <= 120", name="ck_settings_auto_lock_range"),
        sa.CheckConstraint(
            "clipboard_clear_seconds >= 5 AND clipboard_clear_seconds <= 120",
            name="ck_settings_clipboard_range",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "audit",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("outcome", sa.String(length=32), nullable=False),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_ts", "audit", ["ts"], unique=False)
    op.create_index("ix_audit_type", "audit", ["type"], unique=False)
    op.create_index("ix_audit_outcome", "audit", ["outcome"], unique=False)

    op.create_table(
        "unlock_throttle",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_allowed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_unlock_throttle_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("unlock_throttle")
    op.drop_index("ix_audit_outcome", table_name="audit")
    op.drop_index("ix_audit_type", table_name="audit")
    op.drop_index("ix_audit_ts", table_name="audit")
    op.drop_table("audit")
    op.drop_table("settings")
    op.drop_table("entries")
    op.drop_table("vault_metadata")
