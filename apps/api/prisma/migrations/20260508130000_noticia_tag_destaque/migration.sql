-- Add tag and destaque fields to noticias table
ALTER TABLE "noticias"
  ADD COLUMN IF NOT EXISTS "tag"      TEXT NOT NULL DEFAULT 'Geral',
  ADD COLUMN IF NOT EXISTS "destaque" BOOLEAN NOT NULL DEFAULT false;
