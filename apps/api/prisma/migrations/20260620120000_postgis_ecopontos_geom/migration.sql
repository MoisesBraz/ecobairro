-- Ativa a extensão PostGIS e adiciona uma coluna geometry gerada aos ecopontos.
--
-- `geom` é uma coluna GENERATED ALWAYS ... STORED derivada de (lng, lat): lat/lng
-- continuam a ser a fonte de verdade (escrita pelo Prisma/NestJS) e a geometria deriva
-- automaticamente, pelo que nunca dessincroniza nem exige código no caminho de escrita.
-- SRID 4326 (WGS84) para casar com as coordenadas lat/lng existentes.
--
-- O índice GiST suporta as consultas de proximidade (ST_DWithin/ST_Distance) servidas
-- pelo serviço FastAPI de analytics.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "ecopontos"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)) STORED;

CREATE INDEX IF NOT EXISTS "ecopontos_geom_gist" ON "ecopontos" USING GIST ("geom");
