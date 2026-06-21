-- Add sensor telemetry columns to ecopontos
ALTER TABLE "ecopontos"
  ADD COLUMN IF NOT EXISTS "bateria"     INTEGER,
  ADD COLUMN IF NOT EXISTS "temperatura" DOUBLE PRECISION;

-- Fila de prioridades (tarefas operacionais)
CREATE TABLE IF NOT EXISTS "tarefas" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "titulo"     TEXT        NOT NULL,
  "local"      TEXT        NOT NULL,
  "tipo"       TEXT        NOT NULL,
  "prioridade" TEXT        NOT NULL DEFAULT 'normal',
  "estado"     TEXT        NOT NULL DEFAULT 'pendente',
  "atribuido"  TEXT,
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "tarefas_estado_idx" ON "tarefas"("estado");

-- Pedidos de recolha de monos/entulho
CREATE TABLE IF NOT EXISTS "recolhas" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tipo"           TEXT        NOT NULL,
  "subtipo"        TEXT        NOT NULL,
  "morada"         TEXT        NOT NULL,
  "status"         TEXT        NOT NULL DEFAULT 'pendente',
  "obs"            TEXT,
  "data_prevista"  TEXT,
  "user_id"        UUID,
  "criado_em"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "recolhas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "recolhas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "recolhas_user_id_idx"  ON "recolhas"("user_id");
CREATE INDEX IF NOT EXISTS "recolhas_criado_em_idx" ON "recolhas"("criado_em");

-- Mensagens / campanhas institucionais
CREATE TABLE IF NOT EXISTS "campanhas" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "titulo"         TEXT        NOT NULL,
  "corpo"          TEXT        NOT NULL,
  "estado"         TEXT        NOT NULL DEFAULT 'rascunho',
  "data_validade"  TIMESTAMPTZ NOT NULL,
  "autor"          TEXT        NOT NULL DEFAULT 'Câmara de Aveiro',
  "criado_em"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "campanhas_estado_idx" ON "campanhas"("estado");

-- Audit logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "utilizador" TEXT        NOT NULL,
  "papel"      TEXT        NOT NULL,
  "acao"       TEXT        NOT NULL,
  "descricao"  TEXT        NOT NULL,
  "ip"         TEXT        NOT NULL DEFAULT '0.0.0.0',
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_logs_criado_em_idx" ON "audit_logs"("criado_em");

-- Rotas de recolha
CREATE TABLE IF NOT EXISTS "rotas" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "nome"      TEXT        NOT NULL,
  "operador"  TEXT        NOT NULL,
  "estado"    TEXT        NOT NULL DEFAULT 'pendente',
  "ecopontos" INTEGER     NOT NULL DEFAULT 0,
  "distancia" TEXT        NOT NULL DEFAULT '',
  "duracao"   TEXT        NOT NULL DEFAULT '',
  "waypoints" JSONB       NOT NULL DEFAULT '[]',
  "cor"       TEXT        NOT NULL DEFAULT '#60a5fa',
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "rotas_pkey" PRIMARY KEY ("id")
);
