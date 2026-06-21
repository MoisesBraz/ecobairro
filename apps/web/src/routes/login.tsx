import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Leaf, Recycle, MapPin, BarChart3, X, ShieldCheck } from 'lucide-react'
import { GoogleLoginButton, GoogleIcon } from '@/components/auth/GoogleLoginButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDefaultRouteForRole, setAuthSession } from '@/lib/auth'
import { getCitizenProfile, getMe, loginRequest, googleLoginRequest, toUiRole, verifyTwoFactorRequest } from '@/lib/api/auth'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { cn } from '@/lib/utils'

import { clientEnv } from '@/lib/env'
import type { PublicStatsResponse } from '@ecobairro/contracts'


const hasGoogleClientId = !!clientEnv.googleClientId

export const Route = createFileRoute('/login')({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): { registered?: string; verified?: string } => ({
    registered: search.registered === '1' ? '1' : undefined,
    verified: search.verified === '1' ? '1' : undefined,
  }),
})

const schema = z.object({
  email: z.string().min(1, 'O email é obrigatório').email('Introduza um email válido'),
  password: z.string().min(1, 'A password é obrigatória').min(6, 'A password deve ter pelo menos 6 caracteres'),
})

type FormData = z.infer<typeof schema>



function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

function LoginPage() {
  const navigate = useNavigate()
  const { registered, verified } = Route.useSearch()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stats, setStats] = useState<PublicStatsResponse | null>(null)

  // Estado do fluxo 2-step
  const [twoFaStep, setTwoFaStep] = useState(false)
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null)
  const [twoFaCode, setTwoFaCode] = useState('')

  useEffect(() => {
    fetchJson<PublicStatsResponse>('/v1/home/public-stats', {
      baseUrl: clientEnv.apiBaseUrl,
    })
      .then(setStats)
      .catch(() => { /* deixa placeholder durante loading */ })
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const finishLogin = async (accessToken: string, refreshToken: string) => {
    const me = await getMe(accessToken)
    const role = toUiRole(me.role)
    let displayName = me.email
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
      rememberMe,
    })
    navigate({ to: getDefaultRouteForRole(role) })
  }

  const onSubmit = async (data: FormData) => {
    try {
      setSubmitError(null)
      setLoading(true)
      const login = await loginRequest({ email: data.email, password: data.password })

      if (login.requires_2fa && login.pre_auth_token) {
        setPreAuthToken(login.pre_auth_token)
        setTwoFaStep(true)
        return
      }

      await finishLogin(login.access_token, login.refresh_token)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Falha ao autenticar. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async (token: string) => {
    try {
      setSubmitError(null)
      setLoading(true)
      const login = await googleLoginRequest(token)

      if (login.requires_2fa && login.pre_auth_token) {
        setPreAuthToken(login.pre_auth_token)
        setTwoFaStep(true)
        return
      }

      await finishLogin(login.access_token, login.refresh_token)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Falha ao autenticar com o Google.'))
    } finally {
      setLoading(false)
    }
  }

  // Handle Google OAuth redirect return
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

  const onSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preAuthToken) return
    try {
      setSubmitError(null)
      setLoading(true)
      const login = await verifyTwoFactorRequest({ pre_auth_token: preAuthToken, code: twoFaCode.trim() })
      await finishLogin(login.access_token, login.refresh_token)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Código inválido ou expirado.'))
    } finally {
      setLoading(false)
    }
  }

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
            <h2 className="text-3xl font-bold text-foreground">Bem-vindo ao ecoBairro</h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Plataforma inteligente de gestão de ecopontos e resíduos urbanos para uma cidade mais sustentável.
            </p>
          </div>

          <div className="flex items-center gap-8 text-center" aria-busy={stats === null}>
            <div>
              <p className="text-2xl font-bold text-primary">{stats ? stats.ecopontos_ativos : '—'}</p>
              <p className="text-xs text-muted-foreground">Ecopontos</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">{stats ? formatCount(stats.cidadaos_total) : '—'}</p>
              <p className="text-xs text-muted-foreground">Cidadãos</p>
            </div>
            <div className="w-px h-10 bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">{stats ? `${stats.taxa_resolucao}%` : '—'}</p>
              <p className="text-xs text-muted-foreground">Resolução</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      </div>

      {/* Right panel — form */}
      <div className="relative flex flex-col justify-center w-full md:w-[480px] bg-background px-8 py-12 md:px-12">
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

          {twoFaStep ? (
            /* ── Passo 2: Verificação 2FA ─────────────────────────────── */
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Verificação em dois fatores</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Abra a sua app autenticadora e introduza o código de 6 dígitos, ou use um código de recuperação.
                  </p>
                </div>
              </div>

              <form onSubmit={onSubmit2FA} noValidate className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="twofa-code">Código de verificação</Label>
                  <Input
                    id="twofa-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456 ou XXXXX-XXXXX"
                    autoFocus
                    autoComplete="one-time-code"
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                    maxLength={32}
                    className="text-center text-lg tracking-widest font-mono"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading || twoFaCode.trim().length < 6}>
                  {loading ? 'A verificar...' : 'Confirmar'}
                </Button>

                {submitError && (
                  <p className="text-xs text-destructive text-center" role="alert">{submitError}</p>
                )}

                <button
                  type="button"
                  onClick={() => { setTwoFaStep(false); setPreAuthToken(null); setTwoFaCode(''); setSubmitError(null); }}
                  className="text-xs text-muted-foreground hover:underline mx-auto"
                >
                  Voltar ao login
                </button>
              </form>
            </>
          ) : (
            /* ── Passo 1: Email + Password ────────────────────────────── */
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Bem-vindo! </h1>
                <p className="text-sm text-muted-foreground mt-1">Inicie sessão para aceder à plataforma</p>
              </div>

              {/* Banner: registo bem-sucedido — pede verificação de email */}
              {registered === '1' && (
                <div role="status" className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2.5 text-sm text-blue-600 dark:text-blue-400">
                  <span className="mt-0.5 shrink-0">✉</span>
                  <span>Conta criada! Verifique o seu email e clique no link de confirmação antes de entrar.</span>
                </div>
              )}

              {/* Banner: email verificado com sucesso */}
              {verified === '1' && (
                <div role="status" className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400">
                  <span className="mt-0.5 shrink-0">✓</span>
                  <span>Email verificado com sucesso! Já pode iniciar sessão.</span>
                </div>
              )}

              {/* Google login */}
              {hasGoogleClientId ? (
                <GoogleLoginButton onSuccess={handleGoogleLogin} onError={() => setSubmitError('Falha ao comunicar com o Google.')} />
              ) : (
                <Button type="button" variant="outline" className="w-full gap-3" disabled title="Configure VITE_GOOGLE_CLIENT_ID para ativar">
                  <GoogleIcon />
                  Entrar com Google
                </Button>
              )}

              {/* Divider */}
              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@exemplo.pt"
                    autoComplete="email"
                    autoFocus
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
                      autoComplete="current-password"
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

                {/* Remember me + Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">Lembrar-me</span>
                  </label>
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline underline-offset-4">
                    Esqueceu a palavra-passe?
                  </Link>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'A entrar...' : 'Entrar'}
                </Button>
                {submitError && (
                  <p className="text-xs text-destructive text-center" role="alert">{submitError}</p>
                )}

                <p className="text-center text-sm text-muted-foreground">
                  Ainda não tem conta?{' '}
                  <Link to="/register" className="text-primary hover:underline underline-offset-4 font-medium">
                    Crie uma conta
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-muted-foreground">
          ecoBairro &copy; {new Date().getFullYear()} &mdash; Gestão de Resíduos Urbanos
        </p>
      </div>
    </div>
  )
}
