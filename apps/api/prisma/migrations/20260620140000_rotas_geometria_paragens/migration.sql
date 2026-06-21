-- Persiste o resultado do cálculo de rotas real (OP4): traçado por estradas (OSRM),
-- paragens enriquecidas (ordem/ocupação) e a zona de recolha. Colunas com default para
-- as rotas existentes (seed) continuarem válidas.
ALTER TABLE "rotas"
  ADD COLUMN IF NOT EXISTS "geometria" jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "paragens" jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "zona" text;
