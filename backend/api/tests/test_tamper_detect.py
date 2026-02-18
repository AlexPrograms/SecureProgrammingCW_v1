from __future__ import annotations

import pytest

from app.crypto import (
    CryptoIntegrityError,
    DEFAULT_ARGON2_PARAMS,
    decrypt_json,
    derive_enc_key,
    derive_master_key_raw,
    encrypt_json,
    generate_argon2_salt,
    hash_password_verifier,
    verify_password,
)


def test_encrypt_decrypt_roundtrip() -> None:
    payload = {
        "id": "96d95816-8f40-4e34-a50c-f286f7d0f2f0",
        "title": "Email",
        "username": "alice@example.com",
        "password": "P@ssw0rd",
        "tags": ["mail", "personal"],
    }
    salt = generate_argon2_salt(DEFAULT_ARGON2_PARAMS.salt_len)
    master_key = derive_master_key_raw("CorrectHorseBatteryStaple!", salt, DEFAULT_ARGON2_PARAMS)
    enc_key = derive_enc_key(master_key)

    encrypted = encrypt_json(enc_key, payload)
    decrypted = decrypt_json(enc_key, encrypted["nonce"], encrypted["ciphertext"])

    assert decrypted == payload


def test_decrypt_detects_ciphertext_tamper() -> None:
    payload = {"x": "y"}
    salt = generate_argon2_salt()
    master_key = derive_master_key_raw("CorrectHorseBatteryStaple!", salt)
    enc_key = derive_enc_key(master_key)
    encrypted = encrypt_json(enc_key, payload)

    tampered = bytearray(encrypted["ciphertext"])
    tampered[-1] ^= 0x01

    with pytest.raises(CryptoIntegrityError):
        decrypt_json(enc_key, encrypted["nonce"], bytes(tampered))


def test_password_verifier() -> None:
    verifier = hash_password_verifier("CorrectHorseBatteryStaple!")

    assert verify_password("CorrectHorseBatteryStaple!", verifier) is True
    assert verify_password("incorrect-password", verifier) is False
