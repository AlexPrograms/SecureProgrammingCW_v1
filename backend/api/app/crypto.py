from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from typing import Any, TypedDict

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from argon2.low_level import Type, hash_secret_raw
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

AES_GCM_NONCE_BYTES = 12
AES_GCM_AAD = b"local-vault-entry-v1"


@dataclass(frozen=True)
class Argon2Params:
    memory_cost: int
    time_cost: int
    parallelism: int
    hash_len: int = 32
    salt_len: int = 16

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


DEFAULT_ARGON2_PARAMS = Argon2Params(
    memory_cost=65536,
    time_cost=3,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


class EncryptedPayload(TypedDict):
    nonce: bytes
    ciphertext: bytes


class CryptoIntegrityError(ValueError):
    """Raised when ciphertext integrity/authentication checks fail."""


def generate_argon2_salt(length: int = DEFAULT_ARGON2_PARAMS.salt_len) -> bytes:
    if length < 16:
        raise ValueError("Salt length must be at least 16 bytes.")
    return os.urandom(length)


def hash_password_verifier(password: str, params: Argon2Params = DEFAULT_ARGON2_PARAMS) -> str:
    hasher = PasswordHasher(
        time_cost=params.time_cost,
        memory_cost=params.memory_cost,
        parallelism=params.parallelism,
        hash_len=params.hash_len,
        salt_len=params.salt_len,
        type=Type.ID,
    )
    return hasher.hash(password)


def verify_password(password: str, verifier_hash: str) -> bool:
    try:
        return PasswordHasher().verify(verifier_hash, password)
    except (VerifyMismatchError, VerificationError):
        return False


def derive_master_key_raw(password: str, salt: bytes, params: Argon2Params = DEFAULT_ARGON2_PARAMS) -> bytes:
    if not (12 <= len(password) <= 128):
        raise ValueError("Master password must be between 12 and 128 characters.")
    if len(salt) < 16:
        raise ValueError("Argon2 salt must be at least 16 bytes.")

    return hash_secret_raw(
        secret=password.encode("utf-8"),
        salt=salt,
        time_cost=params.time_cost,
        memory_cost=params.memory_cost,
        parallelism=params.parallelism,
        hash_len=32,
        type=Type.ID,
    )


def _derive_key(master_key: bytes, context: bytes) -> bytes:
    if len(master_key) != 32:
        raise ValueError("Master key must be 32 bytes.")

    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=context,
    )
    return hkdf.derive(master_key)


def derive_enc_key(master_key: bytes) -> bytes:
    return _derive_key(master_key, b"vault/enc_key/v1")


def derive_audit_key(master_key: bytes) -> bytes:
    return _derive_key(master_key, b"vault/audit_key/v1")


def derive_backup_key(master_key: bytes) -> bytes:
    return _derive_key(master_key, b"vault/backup_key/v1")


def _canonical_json(data: Any) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def encrypt_json(enc_key: bytes, obj: Any) -> EncryptedPayload:
    if len(enc_key) != 32:
        raise ValueError("Encryption key must be 32 bytes.")

    aesgcm = AESGCM(enc_key)
    nonce = os.urandom(AES_GCM_NONCE_BYTES)
    plaintext = _canonical_json(obj)
    ciphertext = aesgcm.encrypt(nonce, plaintext, AES_GCM_AAD)

    return {"nonce": nonce, "ciphertext": ciphertext}


def decrypt_json(enc_key: bytes, nonce: bytes, ciphertext: bytes) -> Any:
    if len(enc_key) != 32:
        raise ValueError("Encryption key must be 32 bytes.")
    if len(nonce) != AES_GCM_NONCE_BYTES:
        raise ValueError("AES-GCM nonce must be 12 bytes.")

    aesgcm = AESGCM(enc_key)

    try:
        plaintext = aesgcm.decrypt(nonce, ciphertext, AES_GCM_AAD)
    except InvalidTag as exc:
        raise CryptoIntegrityError("Ciphertext integrity check failed.") from exc

    try:
        return json.loads(plaintext.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise CryptoIntegrityError("Decrypted payload is invalid.") from exc
