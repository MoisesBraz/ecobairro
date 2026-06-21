import type { AddFavoritoRequest, ListFavoritosResponse } from '@ecobairro/contracts'
import { fetchJson } from '@/lib/http/fetch-json'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function listFavoritos(): Promise<ListFavoritosResponse> {
  return fetchJson<ListFavoritosResponse>('/v1/cidadaos/me/favoritos', {
    baseUrl: clientEnv.apiBaseUrl,
    headers: authHeaders(),
  })
}

export async function addFavorito(ecopontoId: string): Promise<ListFavoritosResponse> {
  const body: AddFavoritoRequest = { ecoponto_id: ecopontoId }
  return fetchJson<ListFavoritosResponse>('/v1/cidadaos/me/favoritos', {
    baseUrl: clientEnv.apiBaseUrl,
    headers: authHeaders(),
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function removeFavorito(ecopontoId: string): Promise<ListFavoritosResponse> {
  return fetchJson<ListFavoritosResponse>(
    `/v1/cidadaos/me/favoritos/${encodeURIComponent(ecopontoId)}`,
    {
      baseUrl: clientEnv.apiBaseUrl,
      headers: authHeaders(),
      method: 'DELETE',
    },
  )
}
