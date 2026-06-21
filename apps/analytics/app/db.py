from __future__ import annotations

from psycopg_pool import ConnectionPool

# Pool partilhado, aberto no startup (lifespan) e fechado no shutdown.
# `open(wait=False)` para o arranque não falhar se a BD estiver momentaneamente
# em baixo — as ligações estabelecem-se sob procura e o /ready reporta o estado.
_pool: ConnectionPool | None = None


def init_pool(database_url: str) -> ConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    _pool = ConnectionPool(conninfo=database_url, min_size=1, max_size=10, open=False)
    _pool.open(wait=False)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_pool() -> ConnectionPool:
    if _pool is None:
        raise RuntimeError("connection pool not initialised")
    return _pool
