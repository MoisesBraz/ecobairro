import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './_layoutmain.prioridades'
import { fetchJson } from '@/lib/http/fetch-json'
import type { PrioridadeRecord } from '@ecobairro/contracts'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({ component: config.component }),
  }
})

vi.mock('@/lib/env', () => ({
  clientEnv: { analyticsBaseUrl: '/analytics', apiBaseUrl: '/api' },
}))

vi.mock('@/lib/auth', () => ({
  getAccessToken: () => 'tok',
  requireRole: () => () => {},
}))

vi.mock('@/lib/http/fetch-json', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http/fetch-json')>()
  return { ...actual, fetchJson: vi.fn() }
})

const PrioridadesPage = (Route as any).component as React.ComponentType
const mockFetch = vi.mocked(fetchJson)

function item(over: Partial<PrioridadeRecord>): PrioridadeRecord {
  return {
    id: over.id ?? 'e1',
    nome: over.nome ?? 'Ecoponto X',
    zona: over.zona ?? 'Centro',
    ocupacao: over.ocupacao ?? 50,
    sensor_estado: over.sensor_estado ?? 'online',
    bateria: over.bateria ?? null,
    lat: over.lat ?? null,
    lng: over.lng ?? null,
    score_prioridade: over.score_prioridade ?? 50,
    motivo: over.motivo ?? 'normal',
  }
}

describe('Ecopontos Prioritários (OP3)', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('carrega a fila do serviço analytics e mostra as linhas pela ordem recebida', async () => {
    mockFetch.mockResolvedValueOnce([
      item({ id: 'a', nome: 'Mercado', score_prioridade: 110, sensor_estado: 'alerta', motivo: 'sensor em alerta' }),
      item({ id: 'b', nome: 'Rossio', score_prioridade: 60, motivo: 'normal' }),
    ])

    render(<PrioridadesPage />)

    await waitFor(() => {
      expect(screen.getByText('Mercado')).toBeInTheDocument()
    })
    expect(screen.getByText('Rossio')).toBeInTheDocument()
    expect(screen.getByText('110')).toBeInTheDocument()

    // Chamou o FastAPI (analyticsBaseUrl), não a API NestJS.
    expect(mockFetch).toHaveBeenCalledWith(
      '/operacional/fila-prioridades',
      expect.objectContaining({ baseUrl: '/analytics' }),
    )
  })

  it('refaz o pedido com o filtro de zona', async () => {
    mockFetch.mockResolvedValue([item({ nome: 'Mercado' })])
    render(<PrioridadesPage />)
    await waitFor(() => expect(screen.getByText('Mercado')).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText('Filtrar por zona'), 'Norte')

    await waitFor(() => {
      const last = mockFetch.mock.calls.at(-1)
      expect(last?.[1]).toEqual(
        expect.objectContaining({ params: expect.objectContaining({ zona: 'Norte' }) }),
      )
    })
  })

  it('mostra erro quando o pedido falha', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'))
    render(<PrioridadesPage />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
