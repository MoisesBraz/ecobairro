-- Add categoria and imagem_url fields to partilhas table
ALTER TABLE "partilhas"
  ADD COLUMN IF NOT EXISTS "categoria"  TEXT NOT NULL DEFAULT 'moveis',
  ADD COLUMN IF NOT EXISTS "imagem_url" TEXT;
