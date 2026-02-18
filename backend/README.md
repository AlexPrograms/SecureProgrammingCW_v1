# Backend Folder

This folder contains the API service under `backend/api`.

- API source: `backend/api/app`
- API tests: `backend/api/tests`
- DB file: `backend/api/data/vault.db`

Run the backend from `backend/api`:

```bash
cd api
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
