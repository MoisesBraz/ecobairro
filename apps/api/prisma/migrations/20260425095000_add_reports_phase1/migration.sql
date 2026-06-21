CREATE TYPE "ReportStatus" AS ENUM (
  'PENDENTE',
  'ANALISE',
  'RESOLVIDO',
  'REJEITADO'
);

CREATE TABLE "reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "titulo" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "local" TEXT NOT NULL,
  "imagem_url" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'PENDENTE',
  "user_id" UUID NOT NULL,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reports_status_idx" ON "reports"("status");

CREATE INDEX "reports_criado_em_idx" ON "reports"("criado_em");

CREATE INDEX "reports_user_id_idx" ON "reports"("user_id");

ALTER TABLE "reports"
ADD CONSTRAINT "reports_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
