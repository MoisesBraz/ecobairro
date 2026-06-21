import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './_layoutmain.quiz'
import { fetchJson, HttpError } from '@/lib/http/fetch-json'

// Mock react-router: createFileRoute devolve o componente diretamente.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({ component: config.component }),
  }
})

vi.mock('@/lib/env', () => ({
  clientEnv: { apiBaseUrl: 'http://localhost:3000' },
}))

vi.mock('@/lib/auth', () => ({
  getAccessToken: () => 'tok',
  requireRole: () => () => {},
}))

vi.mock('@/lib/http/fetch-json', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/http/fetch-json')>()
  return { ...actual, fetchJson: vi.fn() }
})

const QuizPage = (Route as any).component as React.ComponentType

function makeMe(optedIn: boolean) {
  return {
    hero: { titulo: 'Herói da Reciclagem', bonus_xp: 50, tempo_limite_seconds: 120 },
    userStats: {
      pontos: 250,
      nivel: 'Iniciante',
      proximoNivel: 'Eco-Guerreiro',
      xp: 50,
      faltam_pts: 100,
      streak: 3,
      posicao: 2,
    },
    ranking: [],
    conquistas: [],
    optedIn,
  }
}

const startResponse = {
  sessaoId: 'sess-1',
  tipo: 'SEMANAL',
  tempoLimiteSeconds: 120,
  expiraEm: new Date(Date.now() + 120_000).toISOString(),
  perguntas: [
    {
      id: 'p1',
      ordem: 1,
      texto: 'Onde vai o plástico?',
      categoria: 'RECICLAGEM',
      pontos: 10,
      imagemUrl: null,
      opcoes: [
        { id: 'o1', ordem: 1, texto: 'Amarelo' },
        { id: 'o2', ordem: 2, texto: 'Verde' },
      ],
    },
  ],
}

const resultResponse = {
  sessaoId: 'sess-1',
  scoreObtido: 10,
  pontosGanhos: 10,
  totalPerguntas: 1,
  acertos: 1,
  itens: [
    {
      perguntaId: 'p1',
      texto: 'Onde vai o plástico?',
      opcaoEscolhidaId: 'o1',
      opcaoCorretaId: 'o1',
      correta: true,
      pontos: 10,
      explicacaoEducativa: 'O plástico vai para o contentor amarelo.',
    },
  ],
}

function wireApi(optedIn: boolean) {
  const state = { optedIn }
  vi.mocked(fetchJson).mockImplementation(async (path: string, options?: any) => {
    const method = options?.method ?? 'GET'
    if (path === '/v1/gamification/quiz/me') return makeMe(state.optedIn) as any
    if (path === '/v1/gamification/optin' && method === 'POST') {
      state.optedIn = true
      return { optedIn: true } as any
    }
    if (path === '/v1/gamification/quiz/iniciar') return startResponse as any
    if (path.endsWith('/responder')) return resultResponse as any
    throw new Error(`unexpected ${path}`)
  })
}

describe('QuizPage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchJson).mockReset()
  })

  it('mostra estatísticas e o desafio após carregar', async () => {
    wireApi(true)
    render(<QuizPage />)
    await waitFor(() => {
      expect(screen.getByText('Herói da Reciclagem')).toBeInTheDocument()
    })
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Começar Agora' })).toBeInTheDocument()
  })

  it('mostra CTA de adesão quando o cidadão não aderiu', async () => {
    wireApi(false)
    render(<QuizPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ativar e Jogar' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'A gamificação está desativada' })).toBeInTheDocument()
    })
    expect(screen.getAllByText(/opcional/i).length).toBeGreaterThan(0)
  })

  it('joga o quiz e mostra feedback educativo no resultado', async () => {
    wireApi(true)
    render(<QuizPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Começar Agora' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Começar Agora' }))

    await waitFor(() => {
      expect(screen.getByText('Onde vai o plástico?')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Amarelo' }))
    await user.click(screen.getByRole('button', { name: 'Terminar' }))

    await waitFor(() => {
      expect(screen.getByText('Quiz concluído!')).toBeInTheDocument()
    })
    expect(screen.getByText(/O plástico vai para o contentor amarelo/i)).toBeInTheDocument()
  })

  it('mostra erro quando a API falha', async () => {
    vi.mocked(fetchJson).mockRejectedValue(new HttpError(500, 'Server Error', { message: 'erro' }))
    render(<QuizPage />)
    await waitFor(() => {
      expect(
        screen.getByText('Serviço indisponível neste momento. Tente novamente daqui a pouco.'),
      ).toBeInTheDocument()
    })
  })
})
