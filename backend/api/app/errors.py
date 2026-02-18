from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def build_error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
    )


def _safe_http_message(status_code: int) -> tuple[str, str]:
    mapping = {
        status.HTTP_400_BAD_REQUEST: ("BAD_REQUEST", "Request failed."),
        status.HTTP_401_UNAUTHORIZED: ("UNAUTHORIZED", "Authentication required."),
        status.HTTP_403_FORBIDDEN: ("FORBIDDEN", "Request not allowed."),
        status.HTTP_404_NOT_FOUND: ("NOT_FOUND", "Resource not found."),
        status.HTTP_405_METHOD_NOT_ALLOWED: ("METHOD_NOT_ALLOWED", "Method not allowed."),
        status.HTTP_409_CONFLICT: ("CONFLICT", "Request conflict."),
        status.HTTP_429_TOO_MANY_REQUESTS: ("RATE_LIMITED", "Too many attempts. Try again later."),
    }
    return mapping.get(status_code, ("REQUEST_FAILED", "Request failed."))


async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return build_error_response(status_code=exc.status_code, code=exc.code, message=exc.message)


async def validation_error_handler(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    return build_error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="VALIDATION_ERROR",
        message="Invalid request data.",
    )


async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    code, message = _safe_http_message(exc.status_code)
    return build_error_response(status_code=exc.status_code, code=code, message=message)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API exception on path=%s", request.url.path)
    return build_error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="INTERNAL_ERROR",
        message="Unexpected error.",
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
