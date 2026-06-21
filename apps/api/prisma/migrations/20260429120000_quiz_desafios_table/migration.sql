-- Tabela de definições do desafio da semana / gamificação.

CREATE TABLE IF NOT EXISTS "quiz_desafios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "titulo" TEXT NOT NULL,
  "bonus_xp" INTEGER NOT NULL,
  "tempo_limite_min" INTEGER NOT NULL,
  "ano" INTEGER NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_desafios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quiz_desafios_ano_idx" ON "quiz_desafios"("ano");

