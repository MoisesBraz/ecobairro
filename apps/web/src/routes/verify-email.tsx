import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Leaf, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { verifyEmailRequest, resendVerificationRequest } from '@/lib/api/auth'
import { getApiErrorMessage } from '@/lib/http/api-error'

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
})

type State = 'loading' | 'success' | 'error' | 'no-token'

function VerifyEmailPage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  const [state, setState] = useState<State>(token ? 'loading' : 'no-token')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  useEffect(() => {
    if (!token) return
    verifyEmailRequest(token)
      .then(() => setState('success'))
      .catch((err) => {
        setErrorMsg(getApiErrorMessage(err, 'Link inválido ou expirado.'))
        setState('error')
      })
  }, [token])

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    if (!resendEmail.trim()) return
    try {
      setResendLoading(true)
      await resendVerificationRequest(resendEmail.trim())
      setResendDone(true)
    } catch {
      // silencioso — não revelar se o email existe
      setResendDone(true)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight">ecoBairro</span>
        </div>

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground">A verificar o seu email…</p>
          </div>
        )}

        {state === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h1 className="text-2xl font-bold">Email verificado!</h1>
            <p className="text-muted-foreground">
              A sua conta está ativa. Já pode iniciar sessão.
            </p>
            <Button className="w-full mt-2" onClick={() => navigate({ to: '/login', search: { verified: '1' } as never })}>
              Ir para o login
            </Button>
          </div>
        )}

        {(state === 'error' || state === 'no-token') && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-16 h-16 text-destructive" />
            <h1 className="text-2xl font-bold">Link inválido</h1>
            <p className="text-muted-foreground">
              {errorMsg ?? 'Este link de verificação não é válido ou já expirou.'}
            </p>

            {/* Reenviar email */}
            {resendDone ? (
              <div className="w-full rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400">
                ✓ Se o email estiver registado, receberás um novo link em breve.
              </div>
            ) : (
              <form onSubmit={handleResend} className="w-full flex flex-col gap-2 mt-2">
                <p className="text-sm text-muted-foreground">Pede um novo link de verificação:</p>
                <input
                  type="email"
                  placeholder="O seu email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
                <Button type="submit" variant="outline" className="w-full" disabled={resendLoading}>
                  {resendLoading ? 'A enviar…' : 'Reenviar email de verificação'}
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={() => navigate({ to: '/login' })}
              className="text-sm text-primary hover:underline mt-1"
            >
              Voltar ao login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
