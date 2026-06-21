import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './_layoutpublic.noticia.$id'
import { fetchJson } from '@/lib/http/fetch-json'

// Mock react-router
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
    createFileRoute: () => (config: any) => config.component,
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

const NoticiaPublicPage = Route as unknown as React.ComponentType
Route.useParams = vi.fn(() => ({ id: 'n1' })) as any

const mockNoticia = {
  id: 'n1',
  titulo: 'Notícia de Teste',
  conteudo: 'Este é o conteúdo detalhado da notícia de teste.',
  resumo: 'Resumo da notícia',
  tag: 'Eventos',
  tempo_leitura_min: 3,
  autor_id: 'admin1',
  autor_nome: 'Autor Teste',
  criado_em: '2026-06-01T10:00:00Z',
  data: '2026-06-01T10:00:00Z',
  atualizado_em: '2026-06-01T10:00:00Z',
  imagem_url: null,
}

describe('NoticiaPublicPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton', () => {
    vi.mocked(fetchJson).mockReturnValueOnce(new Promise(() => {}))
    
    // We cannot use screen.getByText for the spinner, but we can check if it exists via class
    const { container } = render(<NoticiaPublicPage />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders the news details correctly', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      noticia: mockNoticia,
    } as any)

    render(<NoticiaPublicPage />)

    await waitFor(() => {
      expect(screen.getByText('Notícia de Teste')).toBeInTheDocument()
    })

    expect(screen.getByText('Este é o conteúdo detalhado da notícia de teste.')).toBeInTheDocument()
    expect(screen.getByText('3 min de leitura')).toBeInTheDocument()

    expect(fetchJson).toHaveBeenCalledWith('/v1/noticias/n1', expect.objectContaining({}))
  })

  it('renders not found state on API error', async () => {
    vi.mocked(fetchJson).mockRejectedValueOnce(new Error('Not found'))

    render(<NoticiaPublicPage />)

    await waitFor(() => {
      expect(screen.getByText('Oops!')).toBeInTheDocument()
    })

    expect(screen.getByText('Não foi possível carregar a notícia.')).toBeInTheDocument()
    expect(screen.getByText('Voltar à Home')).toBeInTheDocument()
  })

  it('navigates back to the feed', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      noticia: mockNoticia,
    } as any)

    render(<NoticiaPublicPage />)

    await waitFor(() => {
      expect(screen.getByText('Notícia de Teste')).toBeInTheDocument()
    })

    const backLink = screen.getByRole('link', { name: /Voltar/i })
    expect(backLink).toHaveAttribute('href', '/')
  })
})
