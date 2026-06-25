import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './_layoutmain.rotas'
import { fetchJson } from '@/lib/http/fetch-json'
import { getUser } from '@/lib/auth'
import type { RotaRecord } from '@ecobairro/contracts'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({ component: config.component }),
  }
})

vi.mock('@/lib/http/fetch-json', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http/fetch-json')>()
  return { ...actual, fetchJson: vi.fn() }
})

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    requireRole: () => () => undefined,
    getUser: vi.fn(),
    getAccessToken: () => 'token',
  }
})

// Mapa + markers dependem de maplibre — passthrough no teste.
vi.mock('@/components/mapa/mapa', () => ({
  Mapa: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-mapa">{children}</div>,
}))
vi.mock('@/components/mapa/rota-stop-marker', () => ({
  RotaStopMarker: () => <div data-testid="mock-stop" />,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Source: () => <div data-testid="mock-source" />,
  Layer: () => <div data-testid="mock-layer" />,
}))

const RotasPage = (Route as any).component as React.ComponentType

function buildRota(overrides: Partial<RotaRecord> = {}): RotaRecord {
  return {
    id: 'r1',
    nome: 'Rota Centro',
    operador: 'op@x',
    operadorId: null,
    equipaId: null,
    estado: 'pendente',
    ecopontos: 2,
    distancia: '3 km',
    duracao: '20 min',
    waypoints: [[40.64, -8.65]],
    geometria: [],
    paragens: [],
    zona: 'Centro',
    cor: '#22c55e',
    ...overrides,
  }
}

describe('RotasPage — eliminar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getUser).mockReturnValue({ role: 'gestor' } as any)
    vi.mocked(fetchJson).mockImplementation(async (path: string) => {
      if (path === '/v1/rotas') {
        return { rotas: [buildRota({ id: 'r1', nome: 'Rota Centro' }), buildRota({ id: 'r2', nome: 'Rota Norte' })], total: 2 } as any
      }
      return undefined as any
    })
  })

  it('gestor: confirma e elimina a rota (DELETE + sai da lista)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RotasPage />)

    const botoes = await screen.findAllByText('Eliminar')
    fireEvent.click(botoes[0]!)

    expect(confirmSpy).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(fetchJson).toHaveBeenCalledWith('/v1/rotas/r1', expect.objectContaining({ method: 'DELETE' })),
    )
    await waitFor(() => expect(screen.queryByText('Rota Centro')).not.toBeInTheDocument())
    expect(screen.getByText('Rota Norte')).toBeInTheDocument()
  })

  it('gestor: cancela o confirm → não chama DELETE', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RotasPage />)

    const botoes = await screen.findAllByText('Eliminar')
    fireEvent.click(botoes[0]!)

    expect(fetchJson).not.toHaveBeenCalledWith('/v1/rotas/r1', expect.objectContaining({ method: 'DELETE' }))
    expect(screen.getByText('Rota Centro')).toBeInTheDocument()
  })

  it('operador: não vê o botão Eliminar', async () => {
    vi.mocked(getUser).mockReturnValue({ role: 'operador' } as any)
    render(<RotasPage />)

    await screen.findByText('Rota Centro')
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
  })
})
