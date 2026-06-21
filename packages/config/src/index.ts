export function requireEnv(name: string, source: NodeJS.ProcessEnv = process.env): string {
  const value = source[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readNumberEnv(
  name: string,
  fallback: number,
  source: NodeJS.ProcessEnv = process.env,
): number {
  const value = source[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsed;
}

