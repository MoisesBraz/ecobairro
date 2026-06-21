/**
 * Typed HTTP helper for JSON API requests.
 * Wraps fetch with URL building, JSON parsing, and typed error handling.
 *
 * Usage:
 *   import { fetchJson } from '@/lib/http/fetch-json'
 *   import { clientEnv } from '@/lib/env'
 *
 *   const data = await fetchJson<MyResponse>('/v1/ecopontos', {
 *     baseUrl: clientEnv.apiBaseUrl,
 *   })
 */

import { clearAuthSession, updateAccessToken } from '@/lib/auth'
import { clientEnv } from '@/lib/env'

export class HttpError extends Error {
  readonly status: number
  readonly statusText: string
  readonly body: unknown

  constructor(
    status: number,
    statusText: string,
    body: unknown,
  ) {
    super(`HTTP ${status}: ${statusText}`)
    this.name = 'HttpError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

export interface FetchJsonOptions extends RequestInit {
  /** Prepended to the path. Defaults to '' (relative). */
  baseUrl?: string
  /** Query string params appended to the URL. */
  params?: Record<string, string | number | boolean | undefined>
  /** Interno: impede uma segunda tentativa de refresh (evita loops). */
  _retried?: boolean
}

/**
 * Refresh silencioso do access token, em single-flight: várias chamadas que
 * apanhem 401 ao mesmo tempo partilham o mesmo pedido de refresh. O refresh
 * token vive num cookie HttpOnly, por isso basta `credentials: 'include'`.
 */
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${clientEnv.apiBaseUrl}/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: '{}',
        })
        if (!res.ok) return null
        const data = (await res.json()) as { access_token?: string }
        if (data.access_token) {
          updateAccessToken(data.access_token)
          return data.access_token
        }
        return null
      } catch {
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

export async function fetchJson<T = unknown>(
  path: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { baseUrl = '', params, _retried, ...init } = options

  // Build URL
  const url = new URL(`${baseUrl}${path}`, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  // Default headers
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const response = await fetch(url.toString(), { credentials: 'include', ...init, headers })

  if (!response.ok) {
    // 401 num pedido autenticado → o access token provavelmente expirou.
    // Tentamos um refresh silencioso (uma única vez) e repetimos o pedido.
    const wasAuthenticated = headers.has('Authorization')
    const isAuthEndpoint = path.includes('/auth/refresh') || path.includes('/auth/login')
    if (response.status === 401 && wasAuthenticated && !isAuthEndpoint && !_retried) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        const retryHeaders = new Headers(init.headers)
        retryHeaders.set('Authorization', `Bearer ${newToken}`)
        return fetchJson<T>(path, {
          ...options,
          headers: retryHeaders,
          _retried: true,
        })
      }
      // Refresh falhou → sessão realmente terminada; limpa para os guards
      // redirecionarem para o login na próxima navegação.
      clearAuthSession()
    }

    let body: unknown
    const rawBody = await response.text()
    try {
      body = rawBody ? JSON.parse(rawBody) : null
    } catch {
      body = rawBody
    }
    throw new HttpError(response.status, response.statusText, body)
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }

  return response.text() as unknown as T
}
