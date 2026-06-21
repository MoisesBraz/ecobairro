import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Route } from './register'
import { HttpError } from '@/lib/http/fetch-json'
import { registerRequest } from '@/lib/api/auth'

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

// Mock Auth APIs
vi.mock('@/lib/api/auth', () => ({
  registerRequest: vi.fn(),
}))

const RegisterPage = Route as unknown as React.ComponentType

describe('RegisterPage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders register form correctly', () => {
    render(<RegisterPage />)
    expect(screen.getByLabelText(/Nome completo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Confirmar password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Criar conta/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    render(<RegisterPage />)
    const submitBtn = screen.getByRole('button', { name: /Criar conta/i })
    await user.click(submitBtn)

    expect(await screen.findByText('O nome deve ter pelo menos 2 caracteres')).toBeInTheDocument()
    expect(await screen.findByText('O email é obrigatório')).toBeInTheDocument()
    expect(await screen.findByText('A palavra-passe deve ter pelo menos 8 caracteres')).toBeInTheDocument()
    expect(await screen.findByText('Tem de aceitar os termos e condições')).toBeInTheDocument()
  })

  it('shows validation error for password mismatch', async () => {
    render(<RegisterPage />)
    
    await user.type(screen.getByLabelText(/Nome completo/i), 'João Silva')
    await user.type(screen.getByLabelText(/Email/i), 'joao@exemplo.pt')
    await user.type(screen.getByLabelText(/^Password$/i), 'Password123!')
    await user.type(screen.getByLabelText(/Confirmar password/i), 'Password456!')
    await user.click(screen.getByRole('checkbox'))
    
    const submitBtn = screen.getByRole('button', { name: /Criar conta/i })
    await user.click(submitBtn)

    expect(await screen.findByText('As passwords não coincidem')).toBeInTheDocument()
  })

  it('submits form successfully and navigates to login', async () => {
    vi.mocked(registerRequest).mockResolvedValueOnce({
      id: '123',
      email: 'joao@exemplo.pt',
      role: 'CIDADAO',
    } as any)

    render(<RegisterPage />)
    
    await user.type(screen.getByLabelText(/Nome completo/i), 'João Silva')
    await user.type(screen.getByLabelText(/Email/i), 'joao@exemplo.pt')
    await user.type(screen.getByLabelText(/^Password$/i), 'Password123!')
    await user.type(screen.getByLabelText(/Confirmar password/i), 'Password123!')
    await user.click(screen.getByRole('checkbox'))
    
    const submitBtn = screen.getByRole('button', { name: /Criar conta/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(registerRequest).toHaveBeenCalledWith({
        email: 'joao@exemplo.pt',
        password: 'Password123!',
        nome_completo: 'João Silva',
        rgpd_accepted: true,
      })
    })

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', search: { registered: '1' } })
  })

  it('shows error message on API failure', async () => {
    const error = new HttpError(409, 'Conflict', { message: 'Já existe uma conta com este email' })
    vi.mocked(registerRequest).mockRejectedValueOnce(error)

    render(<RegisterPage />)
    
    await user.type(screen.getByLabelText(/Nome completo/i), 'João Silva')
    await user.type(screen.getByLabelText(/Email/i), 'joao@exemplo.pt')
    await user.type(screen.getByLabelText(/^Password$/i), 'Password123!')
    await user.type(screen.getByLabelText(/Confirmar password/i), 'Password123!')
    await user.click(screen.getByRole('checkbox'))
    
    const submitBtn = screen.getByRole('button', { name: /Criar conta/i })
    await user.click(submitBtn)

    expect(await screen.findByText('Já existe uma conta com este email')).toBeInTheDocument()
  })

  it('can toggle password visibility', async () => {
    render(<RegisterPage />)
    const passwordInput = screen.getByLabelText(/^Password$/i)
    const confirmInput = screen.getByLabelText(/Confirmar password/i)
    
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(confirmInput).toHaveAttribute('type', 'password')
    
    const toggleBtns = screen.getAllByRole('button', { name: /Mostrar password/i })
    
    // Toggle first password
    await user.click(toggleBtns[0])
    expect(passwordInput).toHaveAttribute('type', 'text')
    
    // Toggle confirm password
    await user.click(toggleBtns[1])
    expect(confirmInput).toHaveAttribute('type', 'text')
    
    // Hide them again
    const hideBtns = screen.getAllByRole('button', { name: /Ocultar password/i })
    await user.click(hideBtns[0])
    await user.click(hideBtns[1])
    
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(confirmInput).toHaveAttribute('type', 'password')
  })
})
