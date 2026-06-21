-- Ecopontos, partilhas e notícias para o feed da home (dados reais em vez de mocks).

CREATE TABLE "ecopontos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "distancia_label" TEXT NOT NULL,
    "ocupacao" INTEGER NOT NULL,
    "map_tile_url" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecopontos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partilhas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "autor_nome" TEXT NOT NULL,
    "zona" TEXT NOT NULL,
    "user_id" UUID,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "partilhas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "noticias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "titulo" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "imagem_url" TEXT NOT NULL,
    "published_at" TIMESTAMPTZ(6) NOT NULL,
    "tempo_leitura_min" INTEGER NOT NULL DEFAULT 3,
    CONSTRAINT "noticias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partilhas_criado_em_idx" ON "partilhas"("criado_em");
CREATE INDEX "noticias_published_at_idx" ON "noticias"("published_at");

ALTER TABLE "partilhas" ADD CONSTRAINT "partilhas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
