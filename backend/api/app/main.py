from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import register_exception_handlers
from app.middleware import CSRFMiddleware, SecurityHeadersMiddleware
from app.routes.audit import router as audit_router
from app.routes.backup import router as backup_router
from app.routes.csrf_probe import router as csrf_probe_router
from app.routes.entries import router as entries_router
from app.routes.health import router as health_router
from app.routes.settings import router as settings_router
from app.routes.vault import router as vault_router
from app.utils import configure_logging

settings = get_settings()
configure_logging(settings.app_log_level)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_cors_allowed_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)

register_exception_handlers(app)
app.include_router(health_router)
app.include_router(vault_router)
app.include_router(entries_router)
app.include_router(settings_router)
app.include_router(audit_router)
app.include_router(backup_router)
app.include_router(csrf_probe_router)
