from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Configuração lida do ambiente.

    Lida a cada chamada (sem cache) porque os testes alteram as variáveis de
    ambiente entre casos. Os defaults espelham o docker-compose de dev.
    """

    database_url: str | None
    jwt_access_secret: str
    jwt_algorithms: tuple[str, ...]
    redis_url: str | None
    osrm_base_url: str


def get_settings() -> Settings:
    return Settings(
        database_url=os.getenv("DATABASE_URL"),
        # Mesmo segredo que o NestJS usa para assinar o access token (HS256).
        jwt_access_secret=os.getenv("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
        jwt_algorithms=("HS256",),
        redis_url=os.getenv("REDIS_URL"),
        # Servidor OSRM para o cálculo de rotas (OP4). Default = motor local (carro).
        osrm_base_url=os.getenv("OSRM_BASE_URL", "http://osrm-car:5000"),
    )
