from __future__ import annotations

from functools import lru_cache

import jwt
import redis as redis_lib
from fastapi import Depends, Header, HTTPException

from .config import Settings, get_settings


class AuthContext:
    """Identidade extraída do access token (paridade com o JwtAuthGuard do NestJS)."""

    def __init__(self, sub: str, role: str) -> None:
        self.sub = sub
        self.role = role


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="missing bearer token")
    return token


@lru_cache(maxsize=4)
def _redis_client(url: str) -> redis_lib.Redis:
    return redis_lib.Redis.from_url(
        url, socket_connect_timeout=0.5, socket_timeout=0.5
    )


def is_revoked(sub: str, settings: Settings) -> bool:
    """Revogação imediata: o NestJS escreve `revoked_user:{id}` no Redis ao revogar.

    Sem REDIS_URL (ex.: testes) ou com Redis indisponível devolve False — o
    JwtAuthGuard do NestJS continua a ser o gate primário; isto é defesa em
    profundidade, não deve derrubar o serviço de leitura.
    """
    if not settings.redis_url:
        return False
    try:
        return _redis_client(settings.redis_url).exists(f"revoked_user:{sub}") == 1
    except Exception:
        return False


async def current_user(authorization: str | None = Header(default=None)) -> AuthContext:
    token = _extract_bearer(authorization)
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_access_secret,
            algorithms=list(settings.jwt_algorithms),
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")

    sub = payload.get("sub")
    role = payload.get("role")
    if not sub or not role:
        raise HTTPException(status_code=401, detail="invalid token claims")

    if is_revoked(sub, settings):
        raise HTTPException(status_code=401, detail="token revoked")

    return AuthContext(sub=str(sub), role=str(role))


def require_roles(*roles: str):
    """Dependency factory: exige que o papel do utilizador esteja em `roles`."""
    allowed = {r.upper() for r in roles}

    async def dependency(user: AuthContext = Depends(current_user)) -> AuthContext:
        if user.role.upper() not in allowed:
            raise HTTPException(status_code=403, detail="forbidden")
        return user

    return dependency
