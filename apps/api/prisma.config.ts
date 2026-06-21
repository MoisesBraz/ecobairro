import { config as loadEnv } from 'dotenv';
import { defineConfig } from "prisma/config";

loadEnv({ path: '../../.env' });
loadEnv({ path: '.env', override: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.POSTGRES_USER ?? 'ecobairro'}:${process.env.POSTGRES_PASSWORD ?? 'ecobairro'}@localhost:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'ecobairro'}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
