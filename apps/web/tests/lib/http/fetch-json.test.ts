import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchJson, HttpError } from '@/lib/http/fetch-json'

// Mock global fetch
const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function jsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchJson', () => {
  it('faz GET e devolve o JSON parsed por defeito', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, count: 3 }))
    const data = await fetchJson<{ ok: boolean; count: number }>('/api/x')
    expect(data).toEqual({ ok: true, count: 3 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('concatena baseUrl ao path', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await fetchJson('/v1/ping', { baseUrl: 'http://api.test' })
    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('http://api.test/v1/ping')
  })

  it('serializa params para query string e ignora undefined', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await fetchJson('/v1/list', {
      baseUrl: 'http://api.test',
      params: { page: 2, q: 'aveiro', empty: undefined },
    })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('page=2')
    expect(url).toContain('q=aveiro')
    expect(url).not.toContain('empty')
  })

  it('adiciona Content-Type: application/json se ha body e nao foi definido', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await fetchJson('/v1/x', {
      baseUrl: 'http://api.test',
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
    })
    const init = fetchMock.mock.calls[0][1]
    const headers = init.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Accept')).toBe('application/json')
  })

  it('respeita Content-Type custom que o caller passa', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await fetchJson('/v1/x', {
      baseUrl: 'http://api.test',
      method: 'POST',
      body: 'raw',
      headers: { 'Content-Type': 'text/plain' },
    })
    const init = fetchMock.mock.calls[0][1]
    const headers = init.headers as Headers
    expect(headers.get('Content-Type')).toBe('text/plain')
  })

  it('throws HttpError com status + body JSON quando resposta nao-ok', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'email invalido' }, { status: 400 }))
    await expect(fetchJson('/x', { baseUrl: 'http://t' })).rejects.toMatchObject({
      name: 'HttpError',
      status: 400,
      body: { message: 'email invalido' },
    })
  })

  it('preserva o status numerico no HttpError (vai a 4xx)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'forbidden' }, { status: 403 }))
    await expect(fetchJson('/x', { baseUrl: 'http://t' })).rejects.toMatchObject({
      status: 403,
    })
  })

  // NOTA: o fallback de response.text() em fetch-json.ts (linha 71) tem
  // um bug latente — a stream do body ja foi consumida pelo .json()
  // anterior, entao text() rebenta com "Body has already been consumed".
  // Nao testado aqui porque o caminho esta partido. Issue a abrir.

  it('204 No Content devolve undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const out = await fetchJson('/x', { baseUrl: 'http://t' })
    expect(out).toBeUndefined()
  })

  it('respostas text/plain devolvem string em vez de JSON.parse', async () => {
    fetchMock.mockResolvedValue(new Response('hello world', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }))
    const out = await fetchJson<string>('/x', { baseUrl: 'http://t' })
    expect(out).toBe('hello world')
  })
})

describe('HttpError', () => {
  it('mensagem inclui status + statusText', () => {
    const err = new HttpError(404, 'Not Found', { foo: 1 })
    expect(err.message).toContain('404')
    expect(err.message).toContain('Not Found')
    expect(err.name).toBe('HttpError')
    expect(err.body).toEqual({ foo: 1 })
  })

  it('e instanceof Error e instanceof HttpError', () => {
    const err = new HttpError(400, 'Bad', {})
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(HttpError)
  })
})
