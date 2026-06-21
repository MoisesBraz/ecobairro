import { CheckCircle2, XCircle, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { QuizResultResponse } from '@ecobairro/contracts'

interface QuizResultProps {
  result: QuizResultResponse
  onClose: () => void
}

/** Ecrã de resultado do quiz com feedback educativo por pergunta (RF-19). */
export function QuizResult({ result, onClose }: QuizResultProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
          <Trophy className="h-8 w-8 text-[var(--primary)]" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Quiz concluído!</h2>
        <p className="text-sm text-muted-foreground">
          Acertou <span className="font-bold text-foreground">{result.acertos}</span> de{' '}
          <span className="font-bold text-foreground">{result.totalPerguntas}</span> · ganhou{' '}
          <span className="font-bold text-[var(--primary)]">+{result.pontosGanhos}</span> pontos
        </p>
      </div>

      <div className="space-y-3">
        {result.itens.map((item, idx) => (
          <Card
            key={item.perguntaId}
            className={`border shadow-sm rounded-xl ${
              item.correta ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5'
            }`}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                {item.correta ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                )}
                <p className="text-sm font-semibold text-foreground">
                  {idx + 1}. {item.texto}
                </p>
              </div>
              <p className="pl-7 text-xs leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">Sabia que?</span> {item.explicacaoEducativa}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={onClose} className="w-full rounded-xl bg-[var(--primary)] hover:opacity-90">
        Concluir
      </Button>
    </div>
  )
}
