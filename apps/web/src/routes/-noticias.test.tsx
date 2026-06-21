import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './_layoutmain.noticias'
import { fetchJson, HttpError } from '@/lib/http/fetch-json'
import { useState } from 'react'

// Mock useListQuery to avoid nuqs adapter errors
vi.mock('@/lib/use-list-query', () => {
  return {
    parseAsString: { withDefault: (val: any) => val },
    useListQuery: (_defaultFilters: any, pageSize: number) => {
      const [params, setParams] = useState({ page: 1, q: '' })
      return {
        params,
        setPage: (page: number) => setParams(p => ({ ...p, page })),
        setFilters: (f: any) => setParams(p => ({ ...p, ...f, page: 1 })),
        pageSize
      }
    }
  }
})

// Mock react-router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
    createFileRoute: () => (config: any) => ({
      component: config.component,
      useRouteContext: () => ({ user: { role: 'ADMIN' } })
    }),
  }
})

// Mock env
vi.mock('@/lib/env', () => ({
  clientEnv: {
    apiBaseUrl: 'http://localhost:3000',
  },
}))

// Mock fetchJson
vi.mock('@/lib/http/fetch-json', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http/fetch-json')>()
  return {
    ...actual,
    fetchJson: vi.fn(),
  }
})

const NoticiasPage = (Route as any).component as React.ComponentType

const mockNoticias = [
  {
    id: 'n1',
    titulo: 'Nova Reciclagem no Bairro',
    conteudo: 'Conteúdo longo sobre reciclagem...',
    resumo: 'Resumo da notícia',
    tag: 'Sustentabilidade',
    destaque: true,
    autor_id: 'admin1',
    autor_nome: 'Admin Silva',
    criado_em: '2026-06-01T10:00:00Z',
    data: '2026-06-01T10:00:00Z',
    atualizado_em: '2026-06-01T10:00:00Z',
    imagem_url: 'http://example.com/img1.jpg',
  },
  {
    id: 'n2',
    titulo: 'Resultados do Mês',
    conteudo: 'Os resultados foram ótimos...',
    resumo: 'Resumo',
    tag: 'Geral',
    destaque: false,
    autor_id: 'admin2',
    autor_nome: 'Admin Costa',
    criado_em: '2026-05-20T10:00:00Z',
    data: '2026-05-20T10:00:00Z',
    atualizado_em: '2026-05-20T10:00:00Z',
    imagem_url: null,
  }
]

describe('NoticiasPage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchJson).mockReset()
    vi.mocked(fetchJson).mockImplementation(async (url: string) => String(url).includes('campanhas') ? { campanhas: [], total: 0 } as any : { noticias: [], total: 0 } as any)
  })

  it('renders loading state initially', () => {
    // Return a never-resolving promise to keep it in loading state
    vi.mocked(fetchJson).mockReturnValue(new Promise(() => {}))
    render(<NoticiasPage />)
    
    expect(screen.getByText(/carregar/i)).toBeInTheDocument()
  })

  it('renders list of news correctly and highlights "destaque"', async () => {
    vi.mocked(fetchJson).mockImplementation(async (url: string) => {
      if (String(url).includes('campanhas')) return { campanhas: [], total: 0 } as any;
      return { noticias: mockNoticias, total: 2 } as any;
    })

    render(<NoticiasPage />)

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText(/carregar/i)).not.toBeInTheDocument()
    })

    // Highlight article (n1)
    expect(screen.getByText('Destaque')).toBeInTheDocument()
    expect(screen.getByText('Nova Reciclagem no Bairro')).toBeInTheDocument()

    // Normal article (n2)
    expect(screen.getByText('Resultados do Mês')).toBeInTheDocument()
    // Test that pagination renders correctly
    expect(screen.getByText('2 items')).toBeInTheDocument()

    expect(fetchJson).toHaveBeenCalledWith('/v1/noticias', expect.objectContaining({
      params: { page: 1, pageSize: 6 },
    }))
  })

  it('handles empty state', async () => {
    vi.mocked(fetchJson).mockImplementation(async (url: string) => String(url).includes('campanhas') ? { campanhas: [], total: 0 } as any : { noticias: [], total: 0 } as any)

    render(<NoticiasPage />)

    await waitFor(() => {
      expect(screen.getByText('Sem resultados')).toBeInTheDocument()
    })
  })

  it('handles search functionality', async () => {
    vi.mocked(fetchJson).mockImplementation(async (url: string) => String(url).includes('campanhas') ? { campanhas: [], total: 0 } as any : { noticias: [], total: 0 } as any)

    render(<NoticiasPage />)

    const searchInput = screen.getByPlaceholderText(/Pesquisar\.\.\./i)
    await user.type(searchInput, 'reciclagem{Enter}')

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/v1/noticias', expect.objectContaining({
        params: { page: 1, pageSize: 6, q: 'reciclagem' },
      }))
    })
  })

  it('handles pagination', async () => {
    vi.mocked(fetchJson).mockImplementation(async (url: string, options) => {
      if (String(url).includes('campanhas')) return { campanhas: [], total: 0 } as any;
      if (options?.params?.page === 2) {
        return { noticias: [], total: 10 } as any
      }
      return { noticias: mockNoticias, total: 10 } as any
    })

    render(<NoticiasPage />)

    // Wait for first page to load
    await waitFor(() => {
      expect(screen.getByText('Nova Reciclagem no Bairro')).toBeInTheDocument()
    })

    // Click next page
    const nextBtn = screen.getAllByRole('button').find(b => b.querySelector('svg.lucide-chevron-right'))!
    await user.click(nextBtn)

    await waitFor(() => {
      expect(fetchJson).toHaveBeenCalledWith('/v1/noticias', expect.objectContaining({
        params: { page: 2, pageSize: 6 },
      }))
    })
  })

  it('handles API errors gracefully', async () => {
    const error = new HttpError(500, 'Server Error', { message: 'Internal server error' })
    vi.mocked(fetchJson).mockRejectedValue(error)

    render(<NoticiasPage />)

    await waitFor(() => {
      expect(screen.getByText('Serviço indisponível neste momento. Tente novamente daqui a pouco.')).toBeInTheDocument()
    })
  })
})
