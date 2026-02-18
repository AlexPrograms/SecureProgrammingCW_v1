# Local Vault Backend

FastAPI backend for a local-first password manager with:
- cookie-based server sessions (`httpOnly`)
- CSRF double-submit protection (`csrf_token` cookie + `X-CSRF-Token` header)
- encrypted-at-rest entries in SQLite (AES-GCM payloads)
- Argon2id/HKDF key derivation flow

## Prerequisites

- Python 3.12
- Network access for first dependency install

## Setup

```bash
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -e ".[dev]"
```

## Environment

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

Default development values:
- API: `http://127.0.0.1:8000`
- CORS origin: `http://localhost:5173`
- Session idle timeout: `15` minutes

## Run

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Database

- SQLite path (from this folder): `data/vault.db`
- Main tables:
  - `vault_metadata` (Argon2 verifier/salt/params, no plaintext master password)
  - `entries` (encrypted blobs only: nonce + ciphertext)
  - `settings`
  - `audit`
  - `unlock_throttle`
- Security model:
  - Entry payloads are encrypted with AES-GCM.
  - Vault key is derived via Argon2id + HKDF and held in memory only while unlocked.
  - On lock/restart, sessions are cleared and re-unlock is required.
- Alembic migration commands:

```bash
alembic upgrade head
alembic revision --autogenerate -m "message"
```

## Security/Test Commands

```bash
./scripts/run_tests.sh
./scripts/run_bandit.sh
./scripts/run_audit.sh
```

If `.venv` does not exist, scripts fall back to `python3`.

## Security Testing Reference

See `SECURITY_TEST_MATRIX.md` for:
- threat/control matrix
- evidence commands
- ZAP scan notes for authenticated + CSRF-protected endpoints
