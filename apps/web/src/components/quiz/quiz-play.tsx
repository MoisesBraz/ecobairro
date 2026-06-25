import { useCallback, useEffect, useRef, useState } from 'react'
import { Timer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken } from '@/lib/auth'
import type {
  StartQuizResponse,
  QuizResultResponse,
  SubmitQuizAnswer,
} from '@ecobairro/contracts'
import { QuizResult } from './quiz-result'

interface QuizPlayProps {
  /** Chamado ao fechar; `completed` indica se houve submissão (para refrescar stats). */
  onClose: (completed: boolean) => void
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Diálogo de jogo: inicia o quiz, apresenta perguntas com tempo limite e submete. */
export function QuizPlay({ onClose }: QuizPlayProps) {
  const [quiz, setQuiz] = useState<StartQuizResponse | null>(null)
  const [result, setResult] = useState<QuizResultResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const submittedRef = useRef(false)

  const submit = useCallback(
    async (started: StartQuizResponse, chosen: Record<string, string>) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      try {
        const respostas: SubmitQuizAnswer[] = started.perguntas
          .filter((p) => chosen[p.id])
          .map((p) => ({ perguntaId: p.id, opcaoId: chosen[p.id]! }))
        const res = await fetchJson<QuizResultResponse>(
          `/v1/gamification/quiz/sessao/${started.sessaoId}/responder`,
          {
            baseUrl: clientEnv.apiBaseUrl,
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ respostas }),
          },
        )
        setResult(res)
      } catch (err) {
        setError(getApiErrorMessage(err, 'Não foi possível submeter as respostas.'))
        submittedRef.current = false
      } finally {
        setSubmitting(false)
      }
    },
    [],
  )

  // Iniciar o quiz ao montar.
  useEffect(() => {
    let cancelled = false
    fetchJson<StartQuizResponse>('/v1/gamification/quiz/iniciar', {
      baseUrl: clientEnv.apiBaseUrl,
      method: 'POST',
      headers: authHeaders(),
    })
      .then((data) => {
        if (cancelled) return
        setQuiz(data)
        setSecondsLeft(data.tempoLimiteSeconds)
      })
      .catch((err) => {
        if (cancelled) return
        setError(getApiErrorMessage(err, 'Não foi possível iniciar o quiz.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Contador regressivo: ao chegar a 0, submete automaticamente.
  useEffect(() => {
    if (quiz == null || result != null || secondsLeft == null) return
    if (secondsLeft <= 0) {
      // Adiado para fora do corpo do efeito (evita setState síncrono).
      const t = window.setTimeout(() => { void submit(quiz, answers) }, 0)
      return () => window.clearTimeout(t)
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [quiz, result, secondsLeft, answers, submit])

  const tempoLabel =
    secondsLeft == null
      ? '--:--'
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`

  const pergunta = quiz?.perguntas[current]
  const total = quiz?.perguntas.length ?? 0
  const isLast = current >= total - 1
  const canAdvance = pergunta != null && Boolean(answers[pergunta.id])

  function choose(perguntaId: string, opcaoId: string) {
    setAnswers((prev) => ({ ...prev, [perguntaId]: opcaoId }))
  }

  function next() {
    if (!quiz) return
    if (isLast) {
      void submit(quiz, answers)
    } else {
      setCurrent((c) => c + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => onClose(result != null)}
          className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {loading && <p className="py-12 text-center text-sm text-muted-foreground">A preparar o quiz…</p>}

        {error && (
          <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && <QuizResult result={result} onClose={() => onClose(true)} />}

        {!loading && !error && !result && quiz && pergunta && (
          <div className="mt-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 pr-8">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pergunta {current + 1} de {total}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Timer className="h-4 w-4 text-[var(--primary)]" /> {tempoLabel}
                </span>
              </div>
              <Progress value={((current + 1) / total) * 100} className="h-2" />
            </div>

            <h2 className="text-lg font-bold text-foreground">{pergunta.texto}</h2>

            <div className="flex flex-col gap-2">
              {pergunta.opcoes.map((o) => {
                const selected = answers[pergunta.id] === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => choose(pergunta.id, o.id)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      selected
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 font-semibold text-foreground'
                        : 'border-border bg-background hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    {o.texto}
                  </button>
                )
              })}
            </div>

            <Button
              onClick={next}
              disabled={!canAdvance || submitting}
              className="w-full rounded-xl bg-[var(--primary)] hover:opacity-90"
            >
              {submitting ? 'A submeter…' : isLast ? 'Terminar' : 'Próxima'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
