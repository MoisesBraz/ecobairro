/*
  Warnings:

  - You are about to drop the column `bateria` on the `ecopontos` table. All the data in the column will be lost.
  - You are about to drop the column `ocupacao` on the `ecopontos` table. All the data in the column will be lost.
  - You are about to drop the column `sensor_estado` on the `ecopontos` table. All the data in the column will be lost.
  - You are about to drop the column `tipos` on the `ecopontos` table. All the data in the column will be lost.
  - You are about to drop the column `ultima_recolha` on the `ecopontos` table. All the data in the column will be lost.
  - You are about to drop the column `failed_login_attempts` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `locked_until` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "recolhas" DROP CONSTRAINT "recolhas_user_id_fkey";

-- DropIndex
DROP INDEX "ecopontos_geom_gist";

-- DropIndex
DROP INDEX "quiz_desafios_ano_idx";

-- DropIndex
DROP INDEX "reports_geom_gist";

-- AlterTable
ALTER TABLE "ecopontos" DROP COLUMN "bateria",
DROP COLUMN "ocupacao",
DROP COLUMN "sensor_estado",
DROP COLUMN "tipos",
DROP COLUMN "ultima_recolha";

-- AlterTable
-- removed ALTER TABLE "reports" ALTER COLUMN "geom" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "failed_login_attempts",
DROP COLUMN "locked_until";

-- CreateTable
CREATE TABLE "contentores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ecoponto_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "ocupacao" INTEGER NOT NULL DEFAULT 0,
    "sensor_estado" TEXT NOT NULL DEFAULT 'online',
    "bateria" INTEGER,
    "ultima_recolha" TEXT,

    CONSTRAINT "contentores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cookie_consent_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" TEXT NOT NULL,
    "user_id" UUID,
    "analytics" BOOLEAN NOT NULL,
    "marketing" BOOLEAN NOT NULL,
    "preferences" BOOLEAN NOT NULL,
    "ip_hash" TEXT,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cookie_consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contentores_ecoponto_id_idx" ON "contentores"("ecoponto_id");

-- CreateIndex
CREATE INDEX "cookie_consent_logs_device_id_idx" ON "cookie_consent_logs"("device_id");

-- CreateIndex
CREATE INDEX "cookie_consent_logs_user_id_idx" ON "cookie_consent_logs"("user_id");

-- AddForeignKey
ALTER TABLE "contentores" ADD CONSTRAINT "contentores_ecoponto_id_fkey" FOREIGN KEY ("ecoponto_id") REFERENCES "ecopontos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recolhas" ADD CONSTRAINT "recolhas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
