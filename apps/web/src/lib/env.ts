/**
 * Centralized frontend environment variable access.
 * All VITE_* vars must be read through this module — never via import.meta.env directly.
 */

function requireEnv(key: string, fallback?: string): string {
  const value = (import.meta.env[key] as string | undefined) ?? fallback
  if (!value) {
    throw new Error(`[env] Missing required environment variable: ${key}`)
  }
  return value
}

function optionalEnv(key: string): string | undefined {
  return import.meta.env[key] as string | undefined
}

export const clientEnv = {
  /** Base URL for the NestJS API — defaults to /api (via Nginx proxy) */
  apiBaseUrl: requireEnv('VITE_API_BASE_URL', '/api'),

  /** Base URL for the FastAPI analytics service — defaults to /analytics */
  analyticsBaseUrl: requireEnv('VITE_ANALYTICS_BASE_URL', '/analytics'),

  /** Google OAuth client ID — optional, disables Google login when absent */
  googleClientId: optionalEnv('VITE_GOOGLE_CLIENT_ID'),

  /** Application display name */
  appName: requireEnv('VITE_APP_NAME', 'ecoBairro'),
} as const
