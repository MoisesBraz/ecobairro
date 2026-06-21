import type {
  AuthMeResponse,
  CitizenSelfProfileResponse,
  EnableTwoFactorResponse,
  ForgotPasswordResponse,
  ListActiveSessionsResponse,
  ListSecurityLogsResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegenerateBackupCodesResponse,
  SetupTwoFactorResponse,
  TwoFactorStatusResponse,
  VerifyTwoFactorRequest,
} from '@ecobairro/contracts'
import { clientEnv } from '@/lib/env'
import { fetchJson } from '@/lib/http/fetch-json'
import type { UserRole } from '@/types'

export async function registerRequest(body: RegisterRequest) {
  return fetchJson('/v1/auth/register', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function verifyEmailRequest(token: string): Promise<void> {
  return fetchJson('/v1/auth/verify-email', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function resendVerificationRequest(email: string): Promise<void> {
  return fetchJson('/v1/auth/resend-verification', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function loginRequest(body: LoginRequest): Promise<LoginResponse> {
  return fetchJson('/v1/auth/login', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function googleLoginRequest(token: string): Promise<LoginResponse> {
  return fetchJson('/v1/auth/google', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export async function logoutRequest(accessToken: string): Promise<void> {
  await fetchJson('/v1/auth/logout', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export async function getMe(accessToken: string): Promise<AuthMeResponse> {
  return fetchJson('/v1/auth/me', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export async function getCitizenProfile(accessToken: string): Promise<CitizenSelfProfileResponse> {
  return fetchJson('/v1/cidadaos/me', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
}

export async function updateCitizenProfile(
  accessToken: string,
  payload: { nome_completo?: string },
): Promise<CitizenSelfProfileResponse> {
  return fetchJson('/v1/cidadaos/me', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
}

export async function forgotPasswordRequest(email: string): Promise<ForgotPasswordResponse> {
  return fetchJson('/v1/auth/forgot-password', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<void> {
  await fetchJson('/v1/auth/reset-password', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  })
}

export async function verifyTwoFactorRequest(body: VerifyTwoFactorRequest): Promise<LoginResponse> {
  return fetchJson('/v1/auth/verify-2fa', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ─── 2FA ──────────────────────────────────────────────────────────────────

export async function twoFactorStatus(token: string): Promise<TwoFactorStatusResponse> {
  return fetchJson('/v1/auth/2fa/status', {
    baseUrl: clientEnv.apiBaseUrl,
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function twoFactorSetup(token: string): Promise<SetupTwoFactorResponse> {
  return fetchJson('/v1/auth/2fa/setup', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function twoFactorEnable(token: string, code: string): Promise<EnableTwoFactorResponse> {
  return fetchJson('/v1/auth/2fa/enable', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  })
}

export async function twoFactorDisable(token: string, password: string): Promise<void> {
  await fetchJson('/v1/auth/2fa/disable', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  })
}

export async function twoFactorRevealCodes(token: string, password: string): Promise<RegenerateBackupCodesResponse> {
  return fetchJson('/v1/auth/2fa/backup-codes/reveal', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  })
}

// ─── Sessões ──────────────────────────────────────────────────────────────

export async function listSessions(token: string): Promise<ListActiveSessionsResponse> {
  return fetchJson('/v1/security/sessions', {
    baseUrl: clientEnv.apiBaseUrl,
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function revokeSession(token: string, sessionId: string): Promise<void> {
  await fetchJson(`/v1/security/sessions/${sessionId}`, {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function revokeAllSessions(token: string): Promise<void> {
  await fetchJson('/v1/security/sessions', {
    baseUrl: clientEnv.apiBaseUrl,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ─── Logs de segurança ─────────────────────────────────────────────────────

export async function listSecurityLogs(
  token: string,
  page = 1,
  pageSize = 20,
): Promise<ListSecurityLogsResponse> {
  return fetchJson(`/v1/security/logs?page=${page}&pageSize=${pageSize}`, {
    baseUrl: clientEnv.apiBaseUrl,
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function toUiRole(role: AuthMeResponse['role']): UserRole {
  switch (role) {
    case 'CIDADAO':
      return 'cidadao'
    case 'OPERADOR':
      return 'operador'
    case 'GESTOR':
      return 'gestor'
    case 'ADMIN':
      return 'admin'
    default:
      return 'guest'
  }
}
