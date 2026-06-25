CREATE TABLE IF NOT EXISTS "contentores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ecoponto_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "ocupacao" INTEGER NOT NULL DEFAULT 0,
    "sensor_estado" TEXT NOT NULL DEFAULT 'online',
    "bateria" INTEGER,
    "ultima_recolha" TEXT,

    CONSTRAINT "contentores_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "contentores_ecoponto_id_idx" ON "contentores"("ecoponto_id");
-- Try adding constraint, ignore if it already exists
ALTER TABLE "contentores" DROP CONSTRAINT IF EXISTS "contentores_ecoponto_id_fkey";
ALTER TABLE "contentores" ADD CONSTRAINT "contentores_ecoponto_id_fkey" FOREIGN KEY ("ecoponto_id") REFERENCES "ecopontos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
