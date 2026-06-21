import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Eye, EyeOff, Leaf, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPasswordRequest } from '@/lib/api/auth'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { cn } from '@/lib/utils'

const searchSchema = z.object({
  token: z.string().optional(),
})

const schema = z
  .object({
    token: z.string().min(10, 'Token inválido'),
    newPassword: z
      .string()
      .min(8, 'A palavra-passe deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'A palavra-passe deve incluir pelo menos uma letra maiúscula')
      .regex(/[a-z]/, 'A palavra-passe deve incluir pelo menos uma letra minúscula')
      .regex(/[0-9]/, 'A palavra-passe deve incluir pelo menos um número')
      .regex(/[^A-Za-z0-9]/, 'A palavra-passe deve incluir pelo menos um carácter especial'),
    confirmPassword: z.string().min(6, 'A confirmação deve ter pelo menos 6 caracteres'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As passwords não coincidem',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

export const Route = createFileRoute('/reset-password')({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { token: tokenFromUrl } = Route.useSearch()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      token: tokenFromUrl ?? '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setSubmitError(null)
      setLoading(true)
      await resetPasswordRequest(data.token, data.newPassword)
      setSubmitted(true)
    } catch (error) {
      setSubmitError(getApiErrorMessage(error, 'Falha ao redefinir password.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6 py-10">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <button
          type="button"
          onClick={() => navigate({ to: '/home' })}
          aria-label="Voltar à home"
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="mb-6 flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-base tracking-tight">ecoBairro</span>
        </div>

        <h1 className="text-2xl font-bold tracking-tight">Redefinir password</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha a sua nova password.
        </p>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-primary/10 p-4 text-sm">
              Password redefinida com sucesso. Já pode entrar com as novas credenciais.
            </div>
            <Button className="w-full" onClick={() => navigate({ to: '/login' })}>
              Ir para login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-4">
            <input type="hidden" {...register('token')} />
            {errors.token && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Link de recuperação inválido ou expirado. Por favor, solicite uma nova recuperação.
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nova password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  className={cn('pr-10', errors.newPassword && 'border-destructive focus-visible:ring-destructive')}
                  {...register('newPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nova password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  className={cn('pr-10', errors.confirmPassword && 'border-destructive focus-visible:ring-destructive')}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'A atualizar...' : 'Atualizar password'}
            </Button>
            {submitError && <p className="text-xs text-destructive text-center">{submitError}</p>}
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}
