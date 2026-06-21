import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './login'
import { HttpError } from '@/lib/http/fetch-json'

// Mock react-router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
    createFileRoute: () => (config: any) => config.component,
  }
})

// Mock Google OAuth
const mockGoogleLoginFn = vi.fn()
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: vi.fn(() => mockGoogleLoginFn),
}))

// Mock env
vi.mock('@/lib/env', () => ({
  clientEnv: {
    googleClientId: 'mock-client-id',
    apiBaseUrl: 'http://localhost:3000',
  },
}))

// Mock Auth APIs
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    setAuthSession: vi.fn(),
  }
})

vi.mock('@/lib/api/auth', () => ({
  loginRequest: vi.fn(),
  verifyTwoFactorRequest: vi.fn(),
  getMe: vi.fn(),
  getCitizenProfile: vi.fn(),
  toUiRole: vi.fn((role) => role.toLowerCase()),
}))

import { loginRequest, getMe, getCitizenProfile, verifyTwoFactorRequest } from '@/lib/api/auth'
import { setAuthSession } from '@/lib/auth'

const LoginPage = Route as unknown as React.ComponentType
Route.useSearch = vi.fn(() => ({ registered: false, verified: false })) as any

describe('LoginPage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful fetch for public stats in the background to avoid unhandled promises
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ecopontos_ativos: 250,
        cidadaos_total: 1500,
        taxa_resolucao: 99,
      }),
    })
  })

  it('renders login form correctly', () => {
    render(<LoginPage />)
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/i, { selector: 'input' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entrar$/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    render(<LoginPage />)
    const submitBtn = screen.getByRole('button', { name: /Entrar$/i })
    await user.click(submitBtn)

    expect(await screen.findByText('O email é obrigatório')).toBeInTheDocument()
    expect(await screen.findByText('A password é obrigatória')).toBeInTheDocument()
  })

  it('shows validation error for invalid email and short password', async () => {
    render(<LoginPage />)
    const emailInput = screen.getByLabelText(/Email/i)
    const passwordInput = screen.getByLabelText(/Password/i, { selector: 'input' })
    const submitBtn = screen.getByRole('button', { name: /Entrar$/i })

    await user.type(emailInput, 'invalid-email')
    await user.type(passwordInput, '123')
    await user.click(submitBtn)

    expect(await screen.findByText('Introduza um email válido')).toBeInTheDocument()
    expect(await screen.findByText('A password deve ter pelo menos 6 caracteres')).toBeInTheDocument()
  })

  it('submits form successfully for cidadao and navigates to /home', async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce({
      access_token: 'mock-access',
      refresh_token: 'mock-refresh',
    } as any)
    vi.mocked(getMe).mockResolvedValueOnce({
      id: 'user1',
      email: 'user@exemplo.pt',
      role: 'CIDADAO',
    } as any)
    vi.mocked(getCitizenProfile).mockResolvedValueOnce({
      nome_completo: 'Nome Completo',
    } as any)

    render(<LoginPage />)
    const emailInput = screen.getByLabelText(/Email/i)
    const passwordInput = screen.getByLabelText(/Password/i, { selector: 'input' })
    const rememberMeCheck = screen.getByRole('checkbox')
    const submitBtn = screen.getByRole('button', { name: /Entrar$/i })

    await user.type(emailInput, 'user@exemplo.pt')
    await user.type(passwordInput, 'password123')
    await user.click(rememberMeCheck) // Check remember me
    await user.click(submitBtn)

    await waitFor(() => {
      expect(loginRequest).toHaveBeenCalledWith({
        email: 'user@exemplo.pt',
        password: 'password123',
      })
    })
    
    expect(getMe).toHaveBeenCalledWith('mock-access')
    expect(getCitizenProfile).toHaveBeenCalledWith('mock-access')

    expect(setAuthSession).toHaveBeenCalledWith({
      user: {
        id: 'user1',
        name: 'Nome Completo',
        email: 'user@exemplo.pt',
        role: 'cidadao',
      },
      accessToken: 'mock-access',
      refreshToken: 'mock-refresh',
      rememberMe: true,
    })

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home' })
  })

  it('submits form successfully for admin and navigates to /admin', async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce({
      access_token: 'mock-access-admin',
      refresh_token: 'mock-refresh-admin',
    } as any)
    vi.mocked(getMe).mockResolvedValueOnce({
      id: 'admin1',
      email: 'admin@ecobairro.pt',
      role: 'ADMIN',
    } as any)

    render(<LoginPage />)
    const emailInput = screen.getByLabelText(/Email/i)
    const passwordInput = screen.getByLabelText(/Password/i, { selector: 'input' })
    const submitBtn = screen.getByRole('button', { name: /Entrar$/i })

    await user.type(emailInput, 'admin@ecobairro.pt')
    await user.type(passwordInput, 'adminpass')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/admin' })
    })

    expect(setAuthSession).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: 'admin' }),
      rememberMe: false, // Default is false
    }))
  })

  it('submits form successfully for gestor and navigates to /dashboard', async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce({
      access_token: 'mock-access-gestor',
      refresh_token: 'mock-refresh-gestor',
    } as any)
    vi.mocked(getMe).mockResolvedValueOnce({
      id: 'gestor1',
      email: 'gestor@ecobairro.pt',
      role: 'GESTOR',
    } as any)

    render(<LoginPage />)
    await user.type(screen.getByLabelText(/Email/i), 'gestor@ecobairro.pt')
    await user.type(screen.getByLabelText(/Password/i, { selector: 'input' }), 'gestorpass')
    await user.click(screen.getByRole('button', { name: /Entrar$/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/dashboard' })
    })

    expect(setAuthSession).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ role: 'gestor' }),
      rememberMe: false,
    }))
  })

  it('handles profile fetch failure gracefully for cidadao', async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce({
      access_token: 'mock-access',
      refresh_token: 'mock-refresh',
    } as any)
    vi.mocked(getMe).mockResolvedValueOnce({
      id: 'user1',
      email: 'user@exemplo.pt',
      role: 'CIDADAO',
    } as any)
    vi.mocked(getCitizenProfile).mockRejectedValueOnce(new Error('Failed profile fetch'))

    render(<LoginPage />)
    await user.type(screen.getByLabelText(/Email/i), 'user@exemplo.pt')
    await user.type(screen.getByLabelText(/Password/i, { selector: 'input' }), 'password123')
    await user.click(screen.getByRole('button', { name: /Entrar$/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/home' })
    })

    // It should fallback to email if profile fetch fails
    expect(setAuthSession).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ name: 'user@exemplo.pt' })
    }))
  })

  it('shows error message on API failure (HttpError with body.message)', async () => {
    const error = new HttpError(401, 'Unauthorized', { message: 'Credenciais inválidas' })
    vi.mocked(loginRequest).mockRejectedValueOnce(error)

    render(<LoginPage />)
    await user.type(screen.getByLabelText(/Email/i), 'user@exemplo.pt')
    await user.type(screen.getByLabelText(/Password/i, { selector: 'input' }), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /Entrar$/i }))

    expect(await screen.findByText('Credenciais inválidas')).toBeInTheDocument()
  })

  it('shows error message on network failure (generic error)', async () => {
    vi.mocked(loginRequest).mockRejectedValueOnce(new Error('Network offline'))

    render(<LoginPage />)
    await user.type(screen.getByLabelText(/Email/i), 'user@exemplo.pt')
    await user.type(screen.getByLabelText(/Password/i, { selector: 'input' }), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /Entrar$/i }))

    expect(await screen.findByText('Falha ao autenticar. Tente novamente.')).toBeInTheDocument()
  })

  it('handles 2FA required flow correctly on success', async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce({
      requires_2fa: true,
      pre_auth_token: 'pre-auth-mock',
    } as any)
    vi.mocked(verifyTwoFactorRequest).mockResolvedValueOnce({
      access_token: 'mock-access',
      refresh_token: 'mock-refresh',
    } as any)
    vi.mocked(getMe).mockResolvedValueOnce({
      id: 'user1',
      email: 'user@exemplo.pt',
      role: 'ADMIN',
    } as any)

    render(<LoginPage />)
    await user.type(screen.getByLabelText(/Email/i), 'admin@exemplo.pt')
    await user.type(screen.getByLabelText(/Password/i, { selector: 'input' }), 'password123')
    await user.click(screen.getByRole('button', { name: /Entrar$/i }))

    // Should show 2FA form
    expect(await screen.findByText('Verificação em dois fatores')).toBeInTheDocument()

    const codeInput = screen.getByLabelText(/Código de verificação/i)
    await user.type(codeInput, '123456')
    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i })
    await user.click(confirmBtn)

    await waitFor(() => {
      expect(verifyTwoFactorRequest).toHaveBeenCalledWith({
        pre_auth_token: 'pre-auth-mock',
        code: '123456',
      })
    })
    
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/admin' })
  })

  it('handles 2FA invalid code error', async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce({
      requires_2fa: true,
      pre_auth_token: 'pre-auth-mock',
    } as any)
    vi.mocked(verifyTwoFactorRequest).mockRejectedValueOnce(new Error('Invalid code'))

    render(<LoginPage />)
    await user.type(screen.getByLabelText(/Email/i), 'admin@exemplo.pt')
    await user.type(screen.getByLabelText(/Password/i, { selector: 'input' }), 'password123')
    await user.click(screen.getByRole('button', { name: /Entrar$/i }))

    // Wait for 2FA form
    expect(await screen.findByText('Verificação em dois fatores')).toBeInTheDocument()

    const codeInput = screen.getByLabelText(/Código de verificação/i)
    await user.type(codeInput, '000000')
    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i })
    await user.click(confirmBtn)

    expect(await screen.findByText('Código inválido ou expirado.')).toBeInTheDocument()
  })

  it('can go back from 2FA form to login form', async () => {
    vi.mocked(loginRequest).mockResolvedValueOnce({
      requires_2fa: true,
      pre_auth_token: 'pre-auth-mock',
    } as any)

    render(<LoginPage />)
    await user.type(screen.getByLabelText(/Email/i), 'admin@exemplo.pt')
    await user.type(screen.getByLabelText(/Password/i, { selector: 'input' }), 'password123')
    await user.click(screen.getByRole('button', { name: /Entrar$/i }))

    expect(await screen.findByText('Verificação em dois fatores')).toBeInTheDocument()

    const backBtn = screen.getByRole('button', { name: /Voltar ao login/i })
    await user.click(backBtn)

    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
  })

  it('navigates to /home when clicking the close button', async () => {
    render(<LoginPage />)
    const closeBtn = screen.getByRole('button', { name: /Voltar à home/i })
    await user.click(closeBtn)
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/home' })
  })

  it('triggers Google login when clicking Google button', async () => {
    render(<LoginPage />)
    const googleBtn = screen.getByRole('button', { name: /Entrar com Google/i })
    await user.click(googleBtn)
    expect(mockGoogleLoginFn).toHaveBeenCalled()
  })

  it('can toggle password visibility', async () => {
    render(<LoginPage />)
    const passwordInput = screen.getByLabelText(/Password/i, { selector: 'input' })
    
    expect(passwordInput).toHaveAttribute('type', 'password')
    
    const toggleBtn = screen.getByRole('button', { name: /Mostrar password/i })
    await user.click(toggleBtn)
    
    expect(passwordInput).toHaveAttribute('type', 'text')
    
    const hideBtn = screen.getByRole('button', { name: /Ocultar password/i })
    await user.click(hideBtn)
    
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
