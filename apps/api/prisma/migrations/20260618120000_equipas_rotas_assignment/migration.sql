-- Equipas + atribuição de rotas a operador/equipa.
-- O operador passa a ver apenas as rotas atribuídas a si (diretamente ou via
-- equipa); o gestor gere equipas e distribui as rotas.

-- 1) Equipas
CREATE TABLE IF NOT EXISTS "equipas" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "nome"          TEXT        NOT NULL,
  "criado_em"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "equipas_pkey" PRIMARY KEY ("id")
);

-- 2) Membros (colaboradores/operadores) de cada equipa
CREATE TABLE IF NOT EXISTS "equipa_membros" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "equipa_id" UUID        NOT NULL,
  "user_id"   UUID        NOT NULL,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "equipa_membros_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipa_membros_equipa_id_user_id_key" ON "equipa_membros"("equipa_id", "user_id");
CREATE INDEX "equipa_membros_user_id_idx" ON "equipa_membros"("user_id");

ALTER TABLE "equipa_membros"
ADD CONSTRAINT "equipa_membros_equipa_id_fkey"
FOREIGN KEY ("equipa_id")
REFERENCES "equipas"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "equipa_membros"
ADD CONSTRAINT "equipa_membros_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- 3) Atribuição de rotas a equipa/operador
ALTER TABLE "rotas" ADD COLUMN "equipa_id"   UUID;
ALTER TABLE "rotas" ADD COLUMN "operador_id" UUID;

CREATE INDEX "rotas_equipa_id_idx"   ON "rotas"("equipa_id");
CREATE INDEX "rotas_operador_id_idx" ON "rotas"("operador_id");

ALTER TABLE "rotas"
ADD CONSTRAINT "rotas_equipa_id_fkey"
FOREIGN KEY ("equipa_id")
REFERENCES "equipas"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "rotas"
ADD CONSTRAINT "rotas_operador_id_fkey"
FOREIGN KEY ("operador_id")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
