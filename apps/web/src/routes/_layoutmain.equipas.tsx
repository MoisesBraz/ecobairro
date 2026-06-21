import { createFileRoute } from '@tanstack/react-router'
import { requireRole, getAccessToken } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, UserPlus, Trash2, Plus, Loader2, Pencil, Check, X, Route as RouteIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import type {
  EquipaRecord,
  ListEquipasResponse,
  ListOperadoresResponse,
  ListRotasResponse,
  OperadorOption,
  RotaRecord,
} from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/equipas')({
  beforeLoad: requireRole(['gestor', 'admin']),
  component: EquipasPage,
})

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

const estadoColor: Record<RotaRecord['estado'], string> = {
  ativa: '#22c55e',
  concluida: '#60a5fa',
  pendente: '#fb923c',
}

function EquipasPage() {
  const [equipas, setEquipas] = useState<EquipaRecord[]>([])
  const [operadores, setOperadores] = useState<OperadorOption[]>([])
  const [rotas, setRotas] = useState<RotaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  const headers = useMemo(() => authHeaders(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const [eq, ops, rt] = await Promise.all([
        fetchJson<ListEquipasResponse>('/v1/equipas', { baseUrl: clientEnv.apiBaseUrl, headers }),
        fetchJson<ListOperadoresResponse>('/v1/equipas/operadores', { baseUrl: clientEnv.apiBaseUrl, headers }),
        fetchJson<ListRotasResponse>('/v1/rotas', { baseUrl: clientEnv.apiBaseUrl, headers }),
      ])
      setEquipas(eq.equipas)
      setOperadores(ops.operadores)
      setRotas(rt.rotas)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Não foi possível carregar as equipas.'))
    } finally {
      setLoading(false)
    }
  }, [headers])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setActionError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, fallback))
    }
  }

  async function criarEquipa() {
    const nome = novoNome.trim()
    if (!nome) return
    setCriando(true)
    await run(
      () => fetchJson('/v1/equipas', { baseUrl: clientEnv.apiBaseUrl, headers, method: 'POST', body: JSON.stringify({ nome }) }),
      'Não foi possível criar a equipa.',
    )
    setNovoNome('')
    setCriando(false)
  }

  function startEdit(eq: EquipaRecord) {
    setEditId(eq.id)
    setEditNome(eq.nome)
  }

  async function guardarNome(id: string) {
    const nome = editNome.trim()
    if (!nome) return
    await run(
      () => fetchJson(`/v1/equipas/${id}`, { baseUrl: clientEnv.apiBaseUrl, headers, method: 'PATCH', body: JSON.stringify({ nome }) }),
      'Não foi possível renomear a equipa.',
    )
    setEditId(null)
  }

  async function eliminarEquipa(id: string) {
    if (!window.confirm('Eliminar esta equipa? As rotas atribuídas ficam sem equipa.')) return
    await run(
      () => fetchJson(`/v1/equipas/${id}`, { baseUrl: clientEnv.apiBaseUrl, headers, method: 'DELETE' }),
      'Não foi possível eliminar a equipa.',
    )
  }

  async function adicionarMembro(equipaId: string, userId: string) {
    if (!userId) return
    await run(
      () => fetchJson(`/v1/equipas/${equipaId}/membros`, { baseUrl: clientEnv.apiBaseUrl, headers, method: 'POST', body: JSON.stringify({ userId }) }),
      'Não foi possível adicionar o colaborador.',
    )
  }

  async function removerMembro(equipaId: string, userId: string) {
    await run(
      () => fetchJson(`/v1/equipas/${equipaId}/membros/${userId}`, { baseUrl: clientEnv.apiBaseUrl, headers, method: 'DELETE' }),
      'Não foi possível remover o colaborador.',
    )
  }

  async function atribuirRota(rotaId: string, patch: { equipaId?: string | null; operadorId?: string | null }) {
    await run(
      () => fetchJson(`/v1/rotas/${rotaId}`, { baseUrl: clientEnv.apiBaseUrl, headers, method: 'PATCH', body: JSON.stringify(patch) }),
      'Não foi possível atribuir a rota.',
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div>
        <h1 className="text-xl font-bold text-foreground">Gestão de Equipas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Crie equipas, atribua colaboradores e distribua as rotas.</p>
      </div>

      {listError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive hover:text-white">Tentar novamente</button>
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{actionError}</div>
      )}

      {/* Criar equipa */}
      <Card className="border border-border/70 shadow-sm rounded-xl">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Nova equipa</label>
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome da equipa"
              onKeyDown={(e) => { if (e.key === 'Enter') void criarEquipa() }}
              className="mt-1"
            />
          </div>
          <Button onClick={() => void criarEquipa()} disabled={criando || !novoNome.trim()} className="gap-1.5">
            {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar
          </Button>
        </CardContent>
      </Card>

      {/* Lista de equipas */}
      <div className="grid gap-3 lg:grid-cols-2">
        {equipas.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda não existem equipas.</p>
        )}
        {equipas.map((eq) => {
          const memberIds = new Set(eq.membros.map((m) => m.userId))
          const disponiveis = operadores.filter((o) => !memberIds.has(o.id))
          return (
            <Card key={eq.id} className="border border-border/70 shadow-sm rounded-xl">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  {editId === eq.id ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-8" autoFocus />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => void guardarNome(eq.id)}><Check className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-4 h-4 text-[var(--primary)] shrink-0" />
                      <span className="font-semibold text-foreground truncate">{eq.nome}</span>
                      <span className="text-[11px] text-muted-foreground">({eq.membros.length})</span>
                    </div>
                  )}
                  {editId !== eq.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(eq)} aria-label="Renomear"><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void eliminarEquipa(eq.id)} aria-label="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>

                {/* Membros */}
                <div className="flex flex-col gap-1.5">
                  {eq.membros.length === 0 && <p className="text-xs text-muted-foreground">Sem colaboradores.</p>}
                  {eq.membros.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
                      <span className="text-sm text-foreground truncate">{m.email}</span>
                      <button onClick={() => void removerMembro(eq.id, m.userId)} className="shrink-0 text-destructive hover:text-destructive/70" aria-label="Remover colaborador">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Adicionar membro */}
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-muted-foreground shrink-0" />
                  <select
                    value=""
                    onChange={(e) => void adicionarMembro(eq.id, e.target.value)}
                    disabled={disponiveis.length === 0}
                    className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="" disabled>{disponiveis.length ? 'Adicionar colaborador…' : 'Todos os operadores já estão nesta equipa'}</option>
                    {disponiveis.map((o) => <option key={o.id} value={o.id}>{o.email}</option>)}
                  </select>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Atribuição de rotas */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5"><RouteIcon className="w-4 h-4" /> Atribuição de rotas</h2>
        <div className="grid gap-2">
          {rotas.map((r) => (
            <Card key={r.id} className="border border-border/70 shadow-sm rounded-xl">
              <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2 min-w-0 sm:w-56">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                  <span className="text-sm font-medium text-foreground truncate">{r.nome}</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ color: estadoColor[r.estado], backgroundColor: `color-mix(in srgb, ${estadoColor[r.estado]} 12%, transparent)` }}>{r.estado}</span>
                </div>
                <div className="flex flex-1 flex-col sm:flex-row gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1">
                    Equipa
                    <select
                      value={r.equipaId ?? ''}
                      onChange={(e) => void atribuirRota(r.id, { equipaId: e.target.value || null })}
                      className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">— sem equipa —</option>
                      {equipas.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1">
                    Operador
                    <select
                      value={r.operadorId ?? ''}
                      onChange={(e) => void atribuirRota(r.id, { operadorId: e.target.value || null })}
                      className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">— sem operador —</option>
                      {operadores.map((o) => <option key={o.id} value={o.id}>{o.email}</option>)}
                    </select>
                  </label>
                </div>
              </CardContent>
            </Card>
          ))}
          {rotas.length === 0 && <p className="text-sm text-muted-foreground">Sem rotas configuradas.</p>}
        </div>
      </div>
    </div>
  )
}
