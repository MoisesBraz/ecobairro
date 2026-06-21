from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

import psycopg
from fastapi import FastAPI, status
from fastapi.responses import JSONResponse

from . import db
from .config import get_settings
from .routers import ecopontos, operacional, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.database_url:
        db.init_pool(settings.database_url)
    try:
        yield
    finally:
        db.close_pool()


app = FastAPI(
    title="EcoBairro Analytics",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

app.include_router(ecopontos.router)
app.include_router(reports.router)
app.include_router(operacional.router)


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def build_payload(
    status_value: str,
    dependencies: list[dict[str, str | None]] | None = None,
) -> dict[str, object]:
    return {
        "service": "analytics",
        "status": status_value,
        "timestamp": utc_timestamp(),
        "dependencies": dependencies or [],
    }


def check_postgres() -> dict[str, str | None]:
    settings = get_settings()

    if not settings.database_url:
        return {
            "name": "postgres",
            "status": "down",
            "details": "DATABASE_URL is not set",
        }

    try:
        pool = db.get_pool()
    except RuntimeError:
        pool = None

    try:
        if pool is not None:
            with pool.connection(timeout=2.0) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()
        else:
            with psycopg.connect(settings.database_url, connect_timeout=2) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1")
                    cursor.fetchone()

        return {"name": "postgres", "status": "up", "details": None}
    except Exception as error:  # pragma: no cover - surface de saúde
        return {"name": "postgres", "status": "down", "details": str(error)}


@app.get("/health")
def health() -> dict[str, object]:
    return build_payload("ok")


@app.get("/ready")
def ready():
    dependency = check_postgres()
    payload = build_payload(
        "ok" if dependency["status"] == "up" else "error",
        [dependency],
    )

    if dependency["status"] != "up":
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=payload,
        )

    return payload
