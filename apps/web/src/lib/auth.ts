import { redirect } from '@tanstack/react-router'
import type { User, UserRole } from '@/types'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export function getUser(): User | null {
  const stored = sessionStorage.getItem('user') || localStorage.getItem('user')
  if (!stored) return null
  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

export function setAuthSession(input: {
  user: User
  accessToken: string
  refreshToken: string
  rememberMe?: boolean
}) {
  const storage = input.rememberMe ? localStorage : sessionStorage
  storage.setItem('user', JSON.stringify(input.user))
  storage.setItem(ACCESS_TOKEN_KEY, input.accessToken)
  storage.setItem(REFRESH_TOKEN_KEY, input.refreshToken)
}

export function clearAuthSession() {
  sessionStorage.removeItem('user')
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem('user')
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY)
}

/**
 * Atualiza apenas o access token após um refresh silencioso, preservando a
 * storage onde a sessão vive (localStorage se "lembrar-me", senão sessionStorage).
 */
export function updateAccessToken(token: string) {
  if (localStorage.getItem(ACCESS_TOKEN_KEY) !== null) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  } else {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  }
}

/** Há uma sessão local (pelo menos um access token guardado)? */
export function hasStoredSession(): boolean {
  return getAccessToken() !== null
}

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'operador':
      return '/rotas'
    case 'gestor':
      return '/dashboard'
    case 'cidadao':
    case 'guest':
    default:
      return '/home'
  }
}

/**
 * Páginas que o operador pode aceder. O operador está restrito à visualização
 * das suas rotas; tudo o resto é da responsabilidade do gestor/admin.
 */
const OPERADOR_ALLOWED_PREFIXES = ['/rotas', '/configuracoes']

export function isOperadorAllowedPath(pathname: string): boolean {
  return OPERADOR_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export function requireAuth() {
  const user = getUser()
  if (!user || user.role === 'guest') {
    throw redirect({ to: '/login' })
  }
  return { user }
}

export function requireRole(allowed: UserRole[]) {
  return () => {
    const user = getUser()
    if (!user || user.role === 'guest') {
      throw redirect({ to: '/login' })
    }
    if (!allowed.includes(user.role)) {
      throw redirect({ to: getDefaultRouteForRole(user.role) })
    }
    return { user }
  }
}
