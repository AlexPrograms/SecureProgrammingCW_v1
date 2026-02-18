import logging
import logging.config


class SecretFilter(logging.Filter):
    """Best-effort safeguard against accidental secret logging."""

    BLOCKED_HINTS = ("password", "secret", "token", "key")

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage().lower()
        if any(hint in message for hint in self.BLOCKED_HINTS):
            record.msg = "[REDACTED_SENSITIVE_LOG]"
            record.args = ()
        return True


def configure_logging(level: str) -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {
                "secret_filter": {
                    "()": "app.utils.SecretFilter",
                }
            },
            "formatters": {
                "standard": {
                    "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s"
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "standard",
                    "filters": ["secret_filter"],
                }
            },
            "root": {
                "level": level.upper(),
                "handlers": ["console"],
            },
        }
    )
