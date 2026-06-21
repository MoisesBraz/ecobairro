import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './_layoutmain.analytics'
import { fetchJson } from '@/lib/http/fetch-json'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, createFileRoute: () => (config: any) => ({ component: config.component }) }
})

vi.mock('@/lib/env', () => ({
  clientEnv: { apiBaseUrl: '/api', analyticsBaseUrl: '/analytics' },
}))

vi.mock('@/lib/auth', () => ({
  getAccessToken: () => 'tok',
  requireRole: () => () => {},
}))

vi.mock('@/lib/http/fetch-json', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http/fetch-json')>()
  return { ...actual, fetchJson: vi.fn() }
})

const AnalyticsPage = (Route as any).component as React.ComponentType
const mockFetch = vi.mocked(fetchJson)

const ANALYTICS = {
  kpis: { reports_total: 10, reports_mes: 3, taxa_resolucao: 50, ecopontos_ativos: 5, users_total: 20 },
  reports_mensais: [{ label: 'Jun', value: 3 }],
  resolucao_mensais: [{ label: 'Jun', value: 1 }],
  tipos: [],
  zonas: [],
}
const KPIS = {
  periodo: { de: null, ate: null },
  kpis: { total: 8, por_estado: { pendente: 5, analise: 1, resolvido: 2, rejeitado: 0 }, taxa_resolucao: 25, tempo_medio_resolucao_horas: 10 },
  por_categoria: [{ categoria: 'Ecoponto Cheio', total: 7, resolvidos: 2, tempo_medio_horas: 10 }],
  por_zona: [{ zona: 'Centro', total: 7, resolvidos: 2 }],
}
const HEAT = {
  pontos: [],
  resumo: { total: 3, faixas: { baixo: 1, medio: 1, alto: 1 }, centro: { lat: 40.6, lng: -8.6 }, bbox: null },
}

describe('AnalyticsPage — KPIs do FastAPI', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation((path: string) => {
      if (path === '/v1/analytics') return Promise.resolve(ANALYTICS) as any
      if (path === '/operacional/reports/kpis') return Promise.resolve(KPIS) as any
      if (path === '/operacional/heatmap') return Promise.resolve(HEAT) as any
      return Promise.reject(new Error(`unexpected ${path}`))
    })
  })

  it('mostra o tempo médio de resolução e a tabela por categoria (FastAPI)', async () => {
    render(<AnalyticsPage />)

    await waitFor(() => expect(screen.getByText('Tempo médio de resolução')).toBeInTheDocument())
    // "10 h" aparece no card de KPI e na tabela por categoria.
    expect(screen.getAllByText('10 h').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Resolução por categoria')).toBeInTheDocument()
    expect(screen.getByText('Ecoponto Cheio')).toBeInTheDocument()

    // Chamou o serviço analytics, não só a API NestJS.
    expect(mockFetch).toHaveBeenCalledWith('/operacional/reports/kpis', expect.objectContaining({ baseUrl: '/analytics' }))
    expect(mockFetch).toHaveBeenCalledWith('/operacional/heatmap', expect.objectContaining({ baseUrl: '/analytics' }))
  })

  it('mostra a distribuição de enchimento (heatmap)', async () => {
    render(<AnalyticsPage />)
    await waitFor(() => expect(screen.getByText('Distribuição de enchimento dos ecopontos')).toBeInTheDocument())
    expect(screen.getByText('Cheio (≥80%)')).toBeInTheDocument()
  })

  it('a página principal aguenta falha do serviço analytics', async () => {
    mockFetch.mockImplementation((path: string) => {
      if (path === '/v1/analytics') return Promise.resolve(ANALYTICS) as any
      return Promise.reject(new Error('analytics down')) as any
    })
    render(<AnalyticsPage />)
    // KPIs do NestJS continuam visíveis mesmo sem o FastAPI.
    await waitFor(() => expect(screen.getByText('Exportar Dados e KPIs')).toBeInTheDocument())
    expect(screen.queryByText('Resolução por categoria')).not.toBeInTheDocument()
  })
})
