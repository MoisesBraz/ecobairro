-- Quiz jogável (RF-19): banco/pool de perguntas, opções, sessões.
-- As perguntas são sorteadas do pool por sessão; feedback educativo obrigatório;
-- regra "exatamente 1 opção correta" apoiada por índice parcial.

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE "QuizTipo" AS ENUM ('SEMANAL', 'DIARIO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "QuizCategoria" AS ENUM ('ORGANICOS', 'RECICLAGEM', 'LEGISLACAO', 'GERAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Pool de quizzes
CREATE TABLE IF NOT EXISTS "quizzes" (
  "id"               UUID            NOT NULL DEFAULT gen_random_uuid(),
  "titulo"           TEXT            NOT NULL,
  "descricao"        TEXT,
  "tipo"             "QuizTipo"      NOT NULL DEFAULT 'SEMANAL',
  "disponivel_de"    TIMESTAMPTZ(6)  NOT NULL,
  "disponivel_ate"   TIMESTAMPTZ(6)  NOT NULL,
  "numero_perguntas" INTEGER         NOT NULL,
  "pontos_maximo"    INTEGER         NOT NULL DEFAULT 0,
  "categoria_tema"   "QuizCategoria",
  "ativo"            BOOLEAN         NOT NULL DEFAULT true,
  "criado_por"       UUID,
  "criado_em"        TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quizzes_tipo_ativo_idx" ON "quizzes"("tipo", "ativo");

-- 3) Perguntas
CREATE TABLE IF NOT EXISTS "quiz_perguntas" (
  "id"                   UUID            NOT NULL DEFAULT gen_random_uuid(),
  "quiz_id"              UUID            NOT NULL,
  "ordem"                INTEGER         NOT NULL,
  "texto_pergunta"       TEXT            NOT NULL,
  "explicacao_educativa" TEXT            NOT NULL,
  "categoria"            "QuizCategoria" NOT NULL DEFAULT 'GERAL',
  "pontos"               INTEGER         NOT NULL DEFAULT 10,
  "imagem_url"           TEXT,
  "criado_em"            TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_perguntas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quiz_perguntas_quiz_id_ordem_key" ON "quiz_perguntas"("quiz_id", "ordem");
CREATE INDEX IF NOT EXISTS "quiz_perguntas_categoria_idx" ON "quiz_perguntas"("categoria");

ALTER TABLE "quiz_perguntas"
ADD CONSTRAINT "quiz_perguntas_quiz_id_fkey"
FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Opções
CREATE TABLE IF NOT EXISTS "quiz_opcoes" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "pergunta_id" UUID           NOT NULL,
  "ordem"       INTEGER        NOT NULL,
  "texto"       TEXT           NOT NULL,
  "correta"     BOOLEAN        NOT NULL DEFAULT false,
  "criado_em"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_opcoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quiz_opcoes_pergunta_id_ordem_key" ON "quiz_opcoes"("pergunta_id", "ordem");
CREATE INDEX IF NOT EXISTS "quiz_opcoes_pergunta_id_idx" ON "quiz_opcoes"("pergunta_id");

-- Índice parcial: scoring O(1) da opção correta sem expor `correta` ao cliente.
CREATE INDEX IF NOT EXISTS "quiz_opcoes_correta_idx" ON "quiz_opcoes"("pergunta_id") WHERE "correta" = true;

ALTER TABLE "quiz_opcoes"
ADD CONSTRAINT "quiz_opcoes_pergunta_id_fkey"
FOREIGN KEY ("pergunta_id") REFERENCES "quiz_perguntas"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Sessões concluídas
CREATE TABLE IF NOT EXISTS "quiz_sessoes" (
  "id"              UUID           NOT NULL DEFAULT gen_random_uuid(),
  "cidadao_id"      UUID           NOT NULL,
  "quiz_id"         UUID           NOT NULL,
  "tipo"            "QuizTipo"     NOT NULL DEFAULT 'SEMANAL',
  "respostas"       JSONB          NOT NULL,
  "score_obtido"    INTEGER        NOT NULL,
  "total_perguntas" INTEGER        NOT NULL,
  "concluido_em"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_sessoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quiz_sessoes_cidadao_id_concluido_em_idx" ON "quiz_sessoes"("cidadao_id", "concluido_em");
CREATE INDEX IF NOT EXISTS "quiz_sessoes_cidadao_id_tipo_concluido_em_idx" ON "quiz_sessoes"("cidadao_id", "tipo", "concluido_em");
CREATE INDEX IF NOT EXISTS "quiz_sessoes_quiz_id_concluido_em_idx" ON "quiz_sessoes"("quiz_id", "concluido_em");
