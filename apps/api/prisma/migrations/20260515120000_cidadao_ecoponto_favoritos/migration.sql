CREATE TABLE "cidadao_ecopontos_favoritos" (
    "user_id" UUID NOT NULL,
    "ecoponto_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cidadao_ecopontos_favoritos_pkey" PRIMARY KEY ("user_id","ecoponto_id")
);

CREATE INDEX "cidadao_ecopontos_favoritos_user_id_idx" ON "cidadao_ecopontos_favoritos"("user_id");

ALTER TABLE "cidadao_ecopontos_favoritos" ADD CONSTRAINT "cidadao_ecopontos_favoritos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cidadao_ecopontos_favoritos" ADD CONSTRAINT "cidadao_ecopontos_favoritos_ecoponto_id_fkey" FOREIGN KEY ("ecoponto_id") REFERENCES "ecopontos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
