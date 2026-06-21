-- Georreferencia os reports (R2 reports/proximos, R8 reports/duplicados).
--
-- lat/lng são opcionais (reports antigos não têm coordenadas → geom NULL → ficam de
-- fora das consultas de proximidade). `geom` é GENERATED ALWAYS ... STORED derivada de
-- (lng, lat) — quando ambas são NULL, ST_MakePoint devolve NULL e geom fica NULL.
-- SRID 4326 (WGS84). Índice GiST para ST_DWithin/ST_Distance servidos pelo FastAPI.

ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;

ALTER TABLE "reports"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)) STORED;

CREATE INDEX IF NOT EXISTS "reports_geom_gist" ON "reports" USING GIST ("geom");
