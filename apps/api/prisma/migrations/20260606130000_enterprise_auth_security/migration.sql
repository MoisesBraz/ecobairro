-- Enterprise auth & security: 2FA, account lockout, security logs, active sessions
-- Idempotente onde possível para suportar aplicação manual em dev.

-- Enums
DO $$ BEGIN
  CREATE TYPE "TwoFactorType" AS ENUM ('NONE', 'TOTP_APP', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "SecurityEventType" AS ENUM (
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'PASSWORD_CHANGED',
    'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED', 'ACCOUNT_LOCKED', 'DEVICE_REVOKED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- User: 2FA + lockout
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "two_factor_type" "TwoFactorType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT,
  ADD COLUMN IF NOT EXISTS "backup_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ(6);

-- Ecoponto: código postal (filtros)
ALTER TABLE "ecopontos"
  ADD COLUMN IF NOT EXISTS "codigo_postal" TEXT;

-- SecurityLog
CREATE TABLE IF NOT EXISTS "security_logs" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL,
  "event"      "SecurityEventType" NOT NULL,
  "ip_address" TEXT NOT NULL,
  "user_agent" TEXT,
  "criado_em"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_logs_user_id_criado_em_idx"
  ON "security_logs" ("user_id", "criado_em");

DO $$ BEGIN
  ALTER TABLE "security_logs"
    ADD CONSTRAINT "security_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ActiveSession
CREATE TABLE IF NOT EXISTS "active_sessions" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       UUID NOT NULL,
  "refresh_token" TEXT NOT NULL,
  "ip_address"    TEXT NOT NULL,
  "user_agent"    TEXT,
  "expires_at"    TIMESTAMPTZ(6) NOT NULL,
  "criado_em"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "active_sessions_refresh_token_key"
  ON "active_sessions" ("refresh_token");
CREATE INDEX IF NOT EXISTS "active_sessions_user_id_idx"
  ON "active_sessions" ("user_id");

DO $$ BEGIN
  ALTER TABLE "active_sessions"
    ADD CONSTRAINT "active_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
