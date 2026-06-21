CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "UserRole" AS ENUM (
  'CIDADAO',
  'OPERADOR_VEOLIA',
  'TECNICO_AUTARQUIA',
  'TECNICO_CCDR',
  'ADMIN'
);

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "phone" TEXT,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "role" "UserRole" NOT NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
  "eliminado_em" TIMESTAMPTZ(6),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cidadao_perfis" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "nome_completo" TEXT,
  "gamification_opt_in" BOOLEAN NOT NULL DEFAULT false,
  "notificacao_prefs" JSONB,
  "dashboard_widgets" JSONB,
  "rgpd_accepted" BOOLEAN NOT NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "cidadao_perfis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE INDEX "users_role_idx" ON "users"("role");

CREATE INDEX "users_eliminado_em_not_null_idx"
ON "users"("eliminado_em")
WHERE "eliminado_em" IS NOT NULL;

CREATE UNIQUE INDEX "cidadao_perfis_user_id_key" ON "cidadao_perfis"("user_id");

ALTER TABLE "cidadao_perfis"
ADD CONSTRAINT "cidadao_perfis_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
