from __future__ import annotations

import os

import psycopg
import pytest

from tests.constants import JWT_SECRET, REPORTS_SEED, SEED

# DDL espelha as migrações PostGIS (subconjunto mínimo de ecopontos + reports).
# `status` em reports é text aqui (no schema real é um enum) — as queries comparam por
# texto, pelo que o comportamento é equivalente para os testes.
_DDL = """
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE ecopontos (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          text NOT NULL,
    lat           double precision NOT NULL,
    lng           double precision NOT NULL,
    ativo         boolean NOT NULL DEFAULT true,
    zona          text,
    geom          geometry(Point, 4326)
                  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);
CREATE INDEX ecopontos_geom_gist ON ecopontos USING GIST (geom);

-- Enchimento/estado por contentor (migração 20260621213121_contentores): 1 ecoponto
-- → N contentores. As queries operacionais agregam (MAX ocupacao, pior estado).
CREATE TABLE contentores (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ecoponto_id   uuid NOT NULL REFERENCES ecopontos(id) ON DELETE CASCADE,
    tipo          text NOT NULL,
    ocupacao      integer NOT NULL DEFAULT 0,
    sensor_estado text NOT NULL DEFAULT 'online',
    bateria       integer
);
CREATE INDEX contentores_ecoponto_id_idx ON contentores (ecoponto_id);

CREATE TABLE reports (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo        text NOT NULL,
    tipo          text NOT NULL,
    status        text NOT NULL DEFAULT 'PENDENTE',
    lat           double precision,
    lng           double precision,
    criado_em     timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    geom          geometry(Point, 4326)
                  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED
);
CREATE INDEX reports_geom_gist ON reports USING GIST (geom);
"""

_INSERT_REPORT = """
INSERT INTO reports (titulo, tipo, status, lat, lng, criado_em, atualizado_em)
VALUES (%s, %s, %s, %s, %s,
        now() - make_interval(days => %s),
        now() - make_interval(days => %s) + make_interval(hours => %s))
"""


def _init_schema(url: str) -> None:
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(_DDL)
            for nome, lat, lng, ativo, zona, contentores in SEED:
                cur.execute(
                    "INSERT INTO ecopontos (nome, lat, lng, ativo, zona) "
                    "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (nome, lat, lng, ativo, zona),
                )
                ecoponto_id = cur.fetchone()[0]
                cur.executemany(
                    "INSERT INTO contentores (ecoponto_id, tipo, ocupacao, sensor_estado, bateria) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    [(ecoponto_id, tipo, ocup, sensor, bat) for tipo, ocup, sensor, bat in contentores],
                )
            # Expande (…, dias, horas) → (…, criado_em=dias, atualizado_em=dias+horas).
            report_rows = [
                (titulo, tipo, status, lat, lng, dias, dias, horas)
                for (titulo, tipo, status, lat, lng, dias, horas) in REPORTS_SEED
            ]
            cur.executemany(_INSERT_REPORT, report_rows)
        conn.commit()


@pytest.fixture(scope="session")
def postgis_url() -> str:
    """Sobe um Postgres+PostGIS descartável, cria o schema e semeia os ecopontos."""
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer(
        "postgis/postgis:16-3.4", username="test", password="test", dbname="test"
    ) as pg:
        url = (
            f"postgresql://test:test@"
            f"{pg.get_container_host_ip()}:{pg.get_exposed_port(5432)}/test"
        )
        _init_schema(url)
        yield url


@pytest.fixture()
def client(postgis_url: str):
    """TestClient ligado ao container, com env de auth conhecida."""
    from fastapi.testclient import TestClient

    os.environ["DATABASE_URL"] = postgis_url
    os.environ["JWT_ACCESS_SECRET"] = JWT_SECRET
    os.environ.pop("REDIS_URL", None)  # sem revogação nos testes

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
