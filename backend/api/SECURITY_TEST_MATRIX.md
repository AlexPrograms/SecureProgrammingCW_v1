# Security Test Matrix

## Scope

Backend API for local-first password manager (`http://localhost:8000`), session cookie auth, CSRF double-submit, encrypted-at-rest entries.

## Matrix

| Area | Threat | Control | Test Type | Evidence Command |
|---|---|---|---|---|
| Input validation | Injection / unsafe payloads | Pydantic strict schemas + URL/tag validators + safe error envelope | Unit/integration | `./scripts/run_tests.sh` |
| Auth/session | Unauthorized access | Server-side session store, httpOnly cookie, idle expiry | Integration | `./scripts/run_tests.sh` |
| CSRF | Cross-site state change | `csrf_token` cookie + `X-CSRF-Token` header match + session binding | Integration | `./scripts/run_tests.sh` |
| Crypto integrity | Ciphertext tamper | AES-GCM AEAD reject on tamper | Unit | `./scripts/run_tests.sh` |
| Secrets exposure | Data leak in logs/errors/meta | Generic errors, audit sanitization, no secret meta fields | Unit/integration | `./scripts/run_tests.sh` |
| Dependency risk | Known CVEs | `pip-audit` in CI/local checks | SCA | `./scripts/run_audit.sh` |
| Static code risk | Unsafe Python patterns | `bandit -r app` | SAST | `./scripts/run_bandit.sh` |

## ZAP Quick Run Notes

Use ZAP only against local dev environment.

1. Start backend (`uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`) and frontend (`npm run dev`).
2. Unlock once in browser so `session_token` and `csrf_token` are issued.
3. In ZAP:
   - Set context include regex: `http://localhost:8000/.*`
   - Add `session_token` and `csrf_token` from browser cookie jar.
   - Configure anti-CSRF token name: `csrf_token`.
   - For state-changing requests, include header `X-CSRF-Token: <csrf_token>`.
4. Active-scan priority endpoints:
   - `POST /vault/unlock`
   - `POST /vault/lock`
   - `GET/POST /entries`
   - `GET/PUT/DELETE /entries/{id}`
   - `GET/PUT /settings`
   - `GET /audit`
   - `POST /backup/export`
   - `POST /backup/import/preview`
   - `POST /backup/import/apply`
5. Validate expected behavior:
   - Missing/invalid CSRF rejected on `POST/PUT/DELETE`.
   - Unauthorized access returns safe `401` envelope.
   - No stack traces or secret material in responses.
