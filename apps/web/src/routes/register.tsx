import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Leaf, Recycle, MapPin, BarChart3, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerRequest } from '@/lib/api/auth'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { cn } from '@/lib/utils'
import { clientEnv } from '@/lib/env'
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton'
import { getCitizenProfile, getMe, googleLoginRequest, toUiRole } from '@/lib/api/auth'
import { getDefaultRouteForRole, setAuthSession } from '@/lib/auth'

const hasGoogleClientId = !!clientEnv.googleClientId

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

const schema = z
  .object({
    name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
    email: z.string().min(1, 'O email é obrigatório').email('Introduza um email válido'),
    password: z
      .string()
      .min(8, 'A palavra-passe deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'A palavra-passe deve incluir pelo menos uma letra maiúscula')
      .regex(/[a-z]/, 'A palavra-passe deve incluir pelo menos uma letra minúscula')
      .regex(/[0-9]/, 'A palavra-passe deve incluir pelo menos um número')
      .regex(/[^A-Za-z0-9]/, 'A palavra-passe deve incluir pelo menos um carácter especial'),
    confirmPassword: z.string().min(1, 'Confirme a sua password'),
    terms: z.boolean().refine((val) => val === true, {
      message: 'Tem de aceitar os termos e condições',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As passwords não coincidem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      setSubmitError(null)
      setLoading(true)

      await registerRequest({
        email: data.email,
        password: data.password,
        nome_completo: data.name.trim(),
        rgpd_accepted: data.terms,
      })

      // Redirecionar para o login com mensagem de sucesso — sem auto-login
      navigate({ to: '/login', search: { registered: '1' } as never })
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Falha ao criar conta. Tente novamente.'))
      setLoading(false)
    }
  }

  const finishLogin = async (accessToken: string, refreshToken: string) => {
    const me = await getMe(accessToken)
    const role = toUiRole(me.role)
    let displayName = me.email.split('@')[0]
    if (role === 'cidadao') {
      try {
        const profile = await getCitizenProfile(accessToken)
        if (profile.nome_completo?.trim()) displayName = profile.nome_completo
      } catch { /* non-critical */ }
    }
    setAuthSession({
      user: { id: me.id, name: displayName, email: me.email, role },
      accessToken,
      refreshToken,
      rememberMe: true,
    })
    navigate({ to: getDefaultRouteForRole(role) })
  }

  const handleGoogleLogin = async (token: string) => {
    try {
      setSubmitError(null)
      setLoading(true)
      const login = await googleLoginRequest(token)
      // No 2FA step supported on registration via Google right now
      await finishLogin(login.access_token, login.refresh_token)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Falha ao registar/autenticar com o Google.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = params.get('access_token')
      const error = params.get('error')

      window.history.replaceState(null, '', window.location.pathname + window.location.search)

      const id = setTimeout(() => {
        if (accessToken) {
          void handleGoogleLogin(accessToken)
        } else if (error) {
          setSubmitError('Autenticação com Google falhou ou foi cancelada.')
        }
      }, 0)

      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-svh">
      {/* Left panel — illustration */}
      <div className="relative hidden md:flex flex-1 flex-col items-center justify-center bg-primary/5 dark:bg-primary/10 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 dark:bg-primary/5" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-primary/10 dark:bg-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5" />

        <div className="relative z-10 flex flex-col items-center gap-8 px-12 max-w-md text-center">
          <div className="relative flex items-center justify-center w-52 h-52">
            <div className="absolute inset-0 rounded-full bg-primary/10 dark:bg-primary/15 animate-pulse" />
            <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-primary/20 dark:bg-primary/25">
              <Leaf className="w-20 h-20 text-primary" />
            </div>
            <div className="absolute top-2 right-0 flex items-center justify-center w-12 h-12 rounded-xl bg-background shadow-lg border border-border">
              <Recycle className="w-6 h-6 text-primary" />
            </div>
            <div className="absolute bottom-2 left-0 flex items-center justify-center w-12 h-12 rounded-xl bg-background shadow-lg border border-border">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div className="absolute top-1/2 -right-2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-xl bg-background shadow-lg border border-border">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-foreground">Junte-se à Revolução Verde</h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Crie a sua conta na plataforma ecoBairro e comece a contribuir para uma cidade mais sustentável hoje mesmo.
            </p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-col justify-center w-full md:w-[480px] bg-[var(--background)] px-8 py-12 md:px-12">
        {/* Logo */}
        <div className="absolute top-6 left-8 md:left-12 flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-base tracking-tight">ecoBairro</span>
        </div>

        {/* Close — voltar à home */}
        <button
          type="button"
          onClick={() => navigate({ to: '/home' })}
          aria-label="Voltar à home"
          className="absolute top-6 right-6 flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col gap-5 w-full max-w-sm mx-auto">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Criar Conta </h1>
            <p className="text-sm text-muted-foreground mt-1">Preencha os seus dados para começar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4 mt-2">
            {hasGoogleClientId && (
              <>
                <GoogleLoginButton onSuccess={handleGoogleLogin} onError={() => setSubmitError('Falha ao comunicar com o Google.')} text="Registar com Google" disabled={loading} />
                <div className="relative flex items-center my-1">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink-0 px-3 text-xs text-muted-foreground uppercase">Ou registe-se com email</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>
              </>
            )}

            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="João Silva"
                autoComplete="name"
                autoFocus
                className={cn(errors.name && 'border-destructive focus-visible:ring-destructive')}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.pt"
                autoComplete="email"
                className={cn(errors.email && 'border-destructive focus-visible:ring-destructive')}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={cn('pr-10', errors.password && 'border-destructive focus-visible:ring-destructive')}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar password' : 'Mostrar password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {/* Confirmar Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={cn('pr-10', errors.confirmPassword && 'border-destructive focus-visible:ring-destructive')}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? 'Ocultar password' : 'Mostrar password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Terms and conditions */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className={cn(
                    "w-4 h-4 mt-0.5 rounded border-border accent-primary shrink-0",
                    errors.terms && "ring-1 ring-destructive border-transparent"
                  )}
                  {...register('terms')}
                />
                <span className="text-sm text-muted-foreground leading-snug">
                  Concordo com os <a href="#" className="text-primary hover:underline">Termos de Serviço</a> e a <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
                </span>
              </label>
              {errors.terms && (
                <p className="text-xs text-destructive">{errors.terms.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'A criar...' : 'Criar conta'}
            </Button>

            {submitError && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{submitError}</span>
              </div>
            )}

            <p className="text-center text-sm text-muted-foreground mt-2">
              Já tem conta?{' '}
              <Link to="/login" className="text-primary hover:underline underline-offset-4 font-medium">
                Entrar
              </Link>
            </p>
          </form>
        </div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-muted-foreground md:block hidden">
          ecoBairro &copy; {new Date().getFullYear()} &mdash; Gestão de Resíduos Urbanos
        </p>
      </div>
    </div>
  )
}
