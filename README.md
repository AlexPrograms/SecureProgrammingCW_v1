# Password Manager (Frontend + Backend API)

## Folder Structure

```text
password-manager-ui/
├─ frontend/              # Vite React TypeScript app
│  ├─ src/
│  ├─ package.json
│  └─ .env.local
├─ backend/
│  └─ api/                # FastAPI service
│     ├─ app/
│     ├─ alembic/
│     ├─ tests/
│     ├─ scripts/
│     ├─ data/
│     └─ pyproject.toml
└─ README.md
```

## Stack

- Frontend: Vite, React, TypeScript, TailwindCSS, Radix UI, Zustand, RHF + Zod
- Backend API: FastAPI, SQLAlchemy 2.0, Alembic, SQLite, Argon2, Cryptography (AES-GCM + HKDF)

## Quick Start

### Backend API

```bash
cd backend/api
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Sometimes there may be an issue with the register page (/setup) not popping up when the app is first loaded. In that case, run migrations using the following comand. 
```bash
alembic upgrade head
```
And reload the backend.

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

## Database

- Type: SQLite (file-based, local-only)
- Location: `backend/api/data/vault.db`
- Access: SQLAlchemy ORM + Alembic migrations

### How It Is Secured

- Entry data is encrypted at rest using AES-GCM; DB stores `nonce` + `ciphertext`, not plaintext secrets.
- Master password is not stored; backend stores only Argon2 verifier + KDF parameters/salt.
- Encryption key is derived after unlock and held in server memory only (session store), not persisted.
- Unlock attempts are throttled with persisted backoff (`unlock_throttle` table).
- Session is cookie-based (`httpOnly`, `SameSite=Lax`) with idle expiry.
- CSRF double-submit is enforced for state-changing routes.
- Audit log metadata is sanitized and designed to avoid secret leakage.

## Validation and Security Checks

```bash
# frontend
cd frontend && npm run build

# backend syntax/tests/security
cd backend/api
./scripts/run_tests.sh
./scripts/run_bandit.sh
./scripts/run_audit.sh
```
