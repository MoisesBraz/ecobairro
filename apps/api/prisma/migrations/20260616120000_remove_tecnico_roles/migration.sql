-- Consolida os papéis técnicos no GESTOR (que passa a englobar Autarquia/CCDR).
-- Tem de correr enquanto o enum antigo ainda contém os valores.
UPDATE "users" SET "role" = 'GESTOR'
WHERE "role" IN ('TECNICO_AUTARQUIA', 'TECNICO_CCDR');

-- Recria o enum UserRole sem TECNICO_AUTARQUIA / TECNICO_CCDR.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('CIDADAO', 'OPERADOR', 'GESTOR', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
DROP TYPE "UserRole_old";
