-- Adiciona campos geográficos e operacionais ao modelo Ecoponto para eliminar dados mock.

ALTER TABLE "ecopontos"
  ADD COLUMN IF NOT EXISTS "codigo"             TEXT,
  ADD COLUMN IF NOT EXISTS "morada"             TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "zona"               TEXT,
  ADD COLUMN IF NOT EXISTS "tipos"              JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "sensor_estado"      TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS "ultima_recolha"     TEXT,
  ADD COLUMN IF NOT EXISTS "ultima_atualizacao" TEXT,
  ADD COLUMN IF NOT EXISTS "lat"                DOUBLE PRECISION NOT NULL DEFAULT 40.6409,
  ADD COLUMN IF NOT EXISTS "lng"                DOUBLE PRECISION NOT NULL DEFAULT -8.6537;

-- distancia_label e map_tile_url podem ficar NULL agora que temos lat/lng reais
ALTER TABLE "ecopontos"
  ALTER COLUMN "distancia_label" SET DEFAULT '',
  ALTER COLUMN "map_tile_url"    DROP NOT NULL;
