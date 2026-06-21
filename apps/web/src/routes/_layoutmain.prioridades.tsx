import { createFileRoute } from '@tanstack/react-router'
import { requireRole, getAccessToken } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { AlertTriangle, BatteryLow, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import type { PrioridadeRecord } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/prioridades')({
  beforeLoad: requireRole(['gestor', 'admin']),
  component: PrioridadesPage,
})

// Cor do badge de estado do sensor.
const estadoConfig: Record<string, { label: string; color: string }> = {
  online:  { label: 'Online',  color: 'oklch(0.55 0.18 150)' },
  alerta:  { label: 'Alerta',  color: '#fb923c' },
  offline: { label: 'Offline', color: '#94a3b8' },
}

// Cor do score por severidade (faixas alinhadas com o heatmap).
function scoreColor(score: number): string {
  if (score >= 100) return '#f87171'
  if (score >= 70) return '#fb923c'
  return '#60a5fa'
}

function PrioridadesPage() {
  const [itens, setItens] = useState<PrioridadeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zona, setZona] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { limit: 50 }
      if (zona.trim()) params.zona = zona.trim()
      // Servido pelo FastAPI (analyticsBaseUrl), não pela API NestJS.
      const res = await fetchJson<PrioridadeRecord[]>('/operacional/fila-prioridades', {
        baseUrl: clientEnv.analyticsBaseUrl,
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        params,
      })
      setItens(res)
    } catch (err) {
      setItens([])
      setError(getApiErrorMessage(err, 'Não foi possível carregar a fila de prioridades.'))
    } finally {
      setLoading(false)
    }
  }, [zona])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const criticos = itens.filter(i => i.sensor_estado !== 'online' || i.ocupacao >= 80).length

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Ecopontos Prioritários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {itens.length} ecopontos · {criticos} a precisar de atenção
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={zona}
          onChange={e => setZona(e.target.value)}
          placeholder="Filtrar por zona…"
          aria-label="Filtrar por zona"
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
        />
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm hover:bg-destructive hover:text-white">Tentar novamente</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : itens.length === 0 && !error ? (
        <Card className="border border-border/70 shadow-sm rounded-xl p-8 text-center text-sm text-muted-foreground">
          Sem ecopontos para mostrar.
        </Card>
      ) : (
        <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-bold">#</th>
                <th className="px-4 py-3 font-bold">Ecoponto</th>
                <th className="px-4 py-3 font-bold">Zona</th>
                <th className="px-4 py-3 font-bold">Enchimento</th>
                <th className="px-4 py-3 font-bold">Sensor</th>
                <th className="px-4 py-3 font-bold">Motivo</th>
                <th className="px-4 py-3 font-bold text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => {
                const estado = estadoConfig[item.sensor_estado] ?? { label: item.sensor_estado, color: '#94a3b8' }
                return (
                  <tr key={item.id} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-3 font-bold text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{item.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.zona}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.ocupacao}%`, background: scoreColor(item.score_prioridade) }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{item.ocupacao}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${estado.color}22`, color: estado.color }}>
                        {item.sensor_estado === 'offline' && <WifiOff className="w-3 h-3" />}
                        {item.sensor_estado === 'alerta' && <AlertTriangle className="w-3 h-3" />}
                        {estado.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {item.bateria != null && item.bateria < 20 && <BatteryLow className="w-3.5 h-3.5 text-destructive" />}
                        {item.motivo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold tabular-nums" style={{ color: scoreColor(item.score_prioridade) }}>{item.score_prioridade}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
