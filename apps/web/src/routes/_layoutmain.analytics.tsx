import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import { getAccessToken } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, BarChart3, MapPin, FileText, Users, Recycle, Loader, Clock, Gauge } from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import type { AnalyticsResponse, ReportsKpisResponse, HeatmapResponse } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/analytics')({
  beforeLoad: requireRole(['gestor', 'admin']),
  component: AnalyticsPage,
})

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function BarChart({ data, color = 'var(--primary)' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2 h-32 mt-4">
      {data.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] font-semibold text-foreground">{value}</span>
          <div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${(value / max) * 96}px`, backgroundColor: color, opacity: 0.85 }} />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{label}</span>
        </div>
      ))}
    </div>
  )
}

function DonutSegment({ pct, color, label, value }: { pct: number; color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-foreground flex-1">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  )
}

const TIPO_COLORS: Record<string, string> = {
  'Ecoponto Cheio':      '#60a5fa',
  'Deposição Ilegal':    '#f87171',
  'Dano em Equipamento': '#fb923c',
  'Odores':              '#a78bfa',
  'Vandalismo':          'oklch(0.55 0.18 150)',
}

function AnalyticsPage() {
  const [data, setData]     = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  // Dados servidos pelo serviço FastAPI de analytics (geo/resolução). Carregam à parte:
  // se falharem, a página principal (NestJS) continua a funcionar.
  const [reportKpis, setReportKpis] = useState<ReportsKpisResponse | null>(null)
  const [heat, setHeat] = useState<HeatmapResponse['resumo'] | null>(null)

  useEffect(() => {
    fetchJson<AnalyticsResponse>('/v1/analytics', {
      baseUrl: clientEnv.apiBaseUrl,
      headers: authHeaders(),
    })
      .then(d => { setData(d); setListError(null) })
      .catch((err) => {
        setData(null)
        setListError(getApiErrorMessage(err, 'Não foi possível carregar os dados de analytics.'))
      })
      .finally(() => setLoading(false))

    fetchJson<ReportsKpisResponse>('/operacional/reports/kpis', {
      baseUrl: clientEnv.analyticsBaseUrl,
      headers: authHeaders(),
    }).then(setReportKpis).catch(() => setReportKpis(null))

    fetchJson<HeatmapResponse>('/operacional/heatmap', {
      baseUrl: clientEnv.analyticsBaseUrl,
      headers: authHeaders(),
    }).then(r => setHeat(r.resumo)).catch(() => setHeat(null))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div role="alert" aria-live="polite" className="flex flex-col items-center justify-center py-32 gap-2 text-muted-foreground">
        <p>{listError ?? 'Não foi possível carregar os dados de analytics.'}</p>
      </div>
    )
  }

  const { kpis, reports_mensais, resolucao_mensais, tipos, zonas } = data

  const mesLabel = reports_mensais.at(-1)?.label ?? '—'

  return (
    <div className="flex flex-col gap-8 pb-12">

      <div>
        <h1 className="text-xl font-bold text-foreground">Exportar Dados e KPIs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Visão geral para gestores — KPIs, reportes, resolução e dados operacionais.</p>
      </div>

      {/* KPIs topo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Reportes em ${mesLabel}`, value: String(kpis.reports_mes),      icon: FileText,  color: '#60a5fa',               delta: null },
          { label: 'Taxa de resolução',       value: `${kpis.taxa_resolucao}%`,     icon: TrendingUp, color: 'oklch(0.55 0.18 150)', delta: null },
          { label: 'Ecopontos ativos',        value: String(kpis.ecopontos_ativos), icon: Recycle,   color: '#fb923c',               delta: null },
          { label: 'Utilizadores registados', value: String(kpis.users_total),      icon: Users,     color: '#a78bfa',               delta: null },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-border/70 shadow-sm rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                {kpis.reports_total} reportes no total
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/70 shadow-sm rounded-xl">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="w-4 h-4 text-[var(--primary)]" />
              Reportes submetidos (últimos 7 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={reports_mensais} color="var(--primary)" />
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm rounded-xl">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Reportes resolvidos (últimos 7 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={resolucao_mensais} color="oklch(0.55 0.18 150)" />
          </CardContent>
        </Card>
      </div>

      {/* Gráficos linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/70 shadow-sm rounded-xl">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="w-4 h-4 text-amber-500" />
              Ecopontos por zona
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={zonas.map(z => ({ label: z.zona, value: z.ecopontos }))}
              color="#f59e0b"
            />
          </CardContent>
        </Card>

        <Card className="border border-border/70 shadow-sm rounded-xl">
          <CardHeader className="pb-0">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="w-4 h-4 text-[var(--primary)]" />
              Tipos de reporte
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-4">
            {tipos.map((t, i) => {
              const colors = Object.values(TIPO_COLORS)
              const color = TIPO_COLORS[t.tipo] ?? colors[i % colors.length] ?? '#60a5fa'
              return (
                <DonutSegment
                  key={t.tipo}
                  label={t.tipo}
                  value={String(t.total)}
                  pct={t.pct}
                  color={color}
                />
              )
            })}
            {tipos.length > 0 && (
              <div className="mt-3 h-3 rounded-full overflow-hidden flex">
                {tipos.map((t, i) => {
                  const colors = Object.values(TIPO_COLORS)
                  const color = TIPO_COLORS[t.tipo] ?? colors[i % colors.length] ?? '#60a5fa'
                  return <div key={t.tipo} style={{ width: `${t.pct}%`, backgroundColor: color }} />
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela zonas */}
      <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">Desempenho por zona</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Zona', 'Reportes', 'Resolvidos', 'Taxa', 'Ecopontos'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zonas.map((z, i) => {
                const taxa = z.reportes > 0 ? Math.round((z.resolvidos / z.reportes) * 100) : 0
                return (
                  <tr key={z.zona} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-2.5 text-xs font-medium text-foreground">{z.zona}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{z.reportes}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{z.resolvidos}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
                          <div className="h-full rounded-full" style={{ width: `${taxa}%`, backgroundColor: taxa >= 90 ? 'oklch(0.55 0.18 150)' : taxa >= 75 ? '#fb923c' : '#f87171' }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{taxa}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{z.ecopontos}</td>
                  </tr>
                )
              })}
              {zonas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Sem dados de zonas disponíveis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── Resolução & enchimento (serviço FastAPI / PostGIS) ── */}
      {(reportKpis || heat) && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--primary)]" /> Resolução &amp; enchimento
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Servido pelo serviço de analytics (FastAPI · PostGIS).</p>
          </div>

          {reportKpis &&(
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Tempo médio de resolução', value: reportKpis.kpis.tempo_medio_resolucao_horas != null ? `${reportKpis.kpis.tempo_medio_resolucao_horas} h` : '—', icon: Clock,      color: '#60a5fa' },
                { label: 'Taxa de resolução',         value: `${reportKpis.kpis.taxa_resolucao}%`,                                                                       icon: TrendingUp, color: 'oklch(0.55 0.18 150)' },
                { label: 'Reportes (total)',          value: String(reportKpis.kpis.total),                                                                             icon: FileText,   color: '#fb923c' },
                { label: 'Resolvidos',                value: String(reportKpis.kpis.por_estado.resolvido),                                                              icon: TrendingUp, color: '#a78bfa' },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label} className="border border-border/70 shadow-sm rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {heat && (
            <Card className="border border-border/70 shadow-sm rounded-xl">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Gauge className="w-4 h-4 text-amber-500" /> Distribuição de enchimento dos ecopontos
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 pt-4">
                {[
                  { label: 'Disponível (<50%)', value: heat.faixas.baixo, color: 'oklch(0.55 0.18 150)' },
                  { label: 'Moderado (50-79%)', value: heat.faixas.medio, color: '#fb923c' },
                  { label: 'Cheio (≥80%)',      value: heat.faixas.alto,  color: '#f87171' },
                ].map(f => (
                  <div key={f.label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30">
                    <p className="text-2xl font-bold" style={{ color: f.color }}>{f.value}</p>
                    <p className="text-[10px] text-muted-foreground text-center">{f.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {reportKpis &&reportKpis.por_categoria.length > 0 && (
            <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">Resolução por categoria</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['Categoria', 'Reportes', 'Resolvidos', 'Tempo médio'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportKpis.por_categoria.map((c, i) => (
                      <tr key={c.categoria} className={`border-b border-border/50 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="px-4 py-2.5 text-xs font-medium text-foreground">{c.categoria}</td>
                        <td className="px-4 py-2.5 text-xs text-foreground">{c.total}</td>
                        <td className="px-4 py-2.5 text-xs text-foreground">{c.resolvidos}</td>
                        <td className="px-4 py-2.5 text-xs text-foreground">{c.tempo_medio_horas != null ? `${c.tempo_medio_horas} h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
