import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '@/lib/auth'
import { getAccessToken } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Shield, CheckCircle, XCircle, Loader, UserPlus, Save, X, Trash2, RotateCcw } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { FormEvent } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { useListQuery, parseAsString } from '@/lib/use-list-query'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import type { AdminRoleOption, ListRolesResponse, ListUsersResponse, UserRecord } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/utilizadores')({
  beforeLoad: requireRole(['admin']),
  component: UtilizadoresPage,
})

// Os papéis são servidos por GET /v1/admin/roles (derivados do enum UserRole da
// BD). Esta lista é apenas um fallback caso o pedido falhe, garantindo que os
// selects nunca ficam vazios e incluem sempre todos os papéis do schema.
const FALLBACK_ROLES: AdminRoleOption[] = [
  { value: 'cidadao',  label: 'Cidadão'       },
  { value: 'operador', label: 'Operador'      },
  { value: 'gestor',   label: 'Gestor'        },
  { value: 'admin',    label: 'Administrador' },
]

// Cores por papel (apenas apresentação); as labels vêm do endpoint.
const roleColors: Record<string, string> = {
  cidadao:  '#60a5fa',
  operador: '#fb923c',
  gestor:   '#f59e0b',
  admin:    'oklch(0.55 0.18 150)',
}

const roleColor = (value: string) => roleColors[value] ?? '#94a3b8'

type FrontRole = string

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function UtilizadoresPage() {
  const [users, setUsers]           = useState<UserRecord[]>([])
  const [total, setTotal]           = useState(0)
  const [counts, setCounts]         = useState<ListUsersResponse['counts'] | null>(null)
  const [loading, setLoading]       = useState(true)
  const [listError, setListError]   = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  // page + pesquisa + filtros vivem na URL (nuqs).
  const { params, setPage, setFilters, pageSize } = useListQuery(
    { q: parseAsString.withDefault(''), role: parseAsString.withDefault('todos'), ativo: parseAsString.withDefault('todos') },
    10,
  )
  const { page, q, role: filtroPapel, ativo: filtroAtivo } = params
  const [busca, setBusca]           = useState(q)
  const [modalAberto, setModalAberto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', role: 'operador' as FrontRole })
  const [papeis, setPapeis] = useState<AdminRoleOption[]>(FALLBACK_ROLES)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modalAberto, modalRef, () => setModalAberto(false))

  // Papéis derivados do schema da BD (GET /v1/admin/roles). Fallback local
  // mantém os selects funcionais caso o pedido falhe.
  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetchJson<ListRolesResponse>('/v1/admin/roles', {
          baseUrl: clientEnv.apiBaseUrl,
          headers: authHeaders(),
        })
        if (resp.roles?.length) setPapeis(resp.roles)
      } catch {
        // Mantém FALLBACK_ROLES — não bloqueia a página.
      }
    })()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const reqParams: Record<string, string | number> = { page, pageSize }
      if (q.trim())                reqParams['q']     = q.trim()
      if (filtroPapel !== 'todos') reqParams['role']  = filtroPapel
      if (filtroAtivo !== 'todos') reqParams['ativo'] = filtroAtivo === 'ativo' ? 'true' : 'false'

      const resp = await fetchJson<ListUsersResponse>('/v1/users', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
        params: reqParams,
      })
      setUsers(resp.users)
      setTotal(resp.total)
      setCounts(resp.counts ?? null)
    } catch (err) {
      setUsers([])
      setTotal(0)
      setCounts(null)
      setListError(getApiErrorMessage(err, 'Não foi possível carregar os utilizadores.'))
    } finally {
      setLoading(false)
    }
  }, [page, q, filtroPapel, filtroAtivo, pageSize])

  // Empurra a pesquisa para a URL com debounce (setFilters volta à página 1).
  useEffect(() => {
    if (busca === q) return
    const t = setTimeout(() => setFilters({ q: busca }), 350)
    return () => clearTimeout(t)
  }, [busca, q, setFilters])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const pageCount = Math.ceil(total / pageSize)

  // Contagens globais vindas da API; fallback para a página atual se ausentes.
  const ativos   = counts?.ativos   ?? users.filter(u => u.ativo).length
  const inativos = counts?.inativos ?? users.filter(u => !u.ativo).length
  const admins   = counts?.admins   ?? users.filter(u => u.role === 'admin').length
  const totalRegistados = counts ? counts.ativos + counts.inativos : total

  function displayName(u: UserRecord) {
    return u.nome ?? u.email.split('@')[0] ?? '—'
  }

  function initials(u: UserRecord) {
    const name = u.nome ?? u.email
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  async function criarUtilizador(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setActionError(null)
    try {
      await fetchJson('/v1/admin/users', {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          nome: novoUser.nome,
          email: novoUser.email,
          role: novoUser.role,
        }),
      })
      setModalAberto(false)
      setNovoUser({ nome: '', email: '', role: 'operador' })
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Não foi possível criar o utilizador.'))
    } finally {
      setSaving(false)
    }
  }

  async function alterarPapel(userId: string, role: FrontRole) {
    setActionError(null)
    try {
      await fetchJson(`/v1/admin/users/${userId}/role`, {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ role }),
      })
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Não foi possível alterar o papel do utilizador.'))
    }
  }

  async function alterarEstado(u: UserRecord) {
    setActionError(null)
    const remover = u.ativo
    if (remover && !confirm(`Desativar a conta de ${displayName(u)}?`)) return

    try {
      await fetchJson(remover ? `/v1/admin/users/${u.id}` : `/v1/admin/users/${u.id}/reativar`, {
        baseUrl: clientEnv.apiBaseUrl,
        method: remover ? 'DELETE' : 'PATCH',
        headers: authHeaders(),
      })
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, remover ? 'Não foi possível desativar o utilizador.' : 'Não foi possível reativar o utilizador.'))
    }
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-8 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">
      {listError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Tentar novamente</button>
        </div>
      )}
      {actionError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40">Fechar</button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gestão de Utilizadores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? '…' : `${totalRegistados} utilizador${totalRegistados !== 1 ? 'es' : ''} registado${totalRegistados !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity self-start sm:self-auto" onClick={() => setModalAberto(true)}>
          <UserPlus className="w-4 h-4" />
          Novo utilizador
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    value: totalRegistados, color: '#60a5fa'        },
          { label: 'Ativos',   value: ativos,   color: 'oklch(0.55 0.18 150)' },
          { label: 'Inativos', value: inativos, color: '#f87171'               },
          { label: 'Admins',   value: admins,   color: '#a78bfa'               },
        ].map((s) => (
          <Card key={s.label} className="border border-border/70 shadow-sm rounded-xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar nome ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filtroPapel}
            onChange={(e) => setFilters({ role: e.target.value })}
            className="px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          >
            <option value="todos">Todos os papéis</option>
            {papeis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select
            value={filtroAtivo}
            onChange={(e) => setFilters({ ativo: e.target.value })}
            className="px-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          >
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Utilizador</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Papel</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Desde</th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Estado</th>
                <th className="text-right px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader className="w-5 h-5 animate-spin" />
                      <span className="text-sm">A carregar…</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <Shield className="w-8 h-8 opacity-30" />
                      Nenhum utilizador encontrado
                    </div>
                  </td>
                </tr>
              ) : users.map((u, i) => {
                const cor = roleColor(u.role)
                const papelDesconhecido = !papeis.some(p => p.value === u.role)
                return (
                  <tr key={u.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {initials(u)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{displayName(u)}</p>
                          <p className="text-[10px] text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role as FrontRole}
                        onChange={(event) => void alterarPapel(u.id, event.target.value as FrontRole)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                        style={{ color: cor, backgroundColor: `color-mix(in srgb, ${cor} 10%, transparent)` }}
                      >
                        {papelDesconhecido && <option value={u.role}>{u.role}</option>}
                        {papeis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-muted-foreground">{formatDate(u.criado_em)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 text-[10px] font-medium w-fit px-2 py-0.5 rounded-full ${u.ativo ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-muted-foreground bg-muted'}`}>
                        {u.ativo ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void alterarEstado(u)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            u.ativo
                              ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                              : 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600'
                          }`}
                          aria-label={u.ativo ? 'Desativar utilizador' : 'Reativar utilizador'}
                          title={u.ativo ? 'Desativar utilizador' : 'Reativar utilizador'}
                        >
                          {u.ativo ? <Trash2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {!loading && total > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{total} utilizador{total !== 1 ? 'es' : ''}</span>
            <span>Página {page} de {pageCount}</span>
          </div>
          <PaginationBar page={page} pageCount={pageCount} onPage={setPage} />
        </>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalAberto(false)} aria-hidden="true" />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="utilizadores-modal-title" tabIndex={-1} className="relative z-10 w-full max-w-md bg-card rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="utilizadores-modal-title" className="text-base font-bold text-foreground">Novo utilizador</h2>
              <button type="button" aria-label="Fechar modal" onClick={() => setModalAberto(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={criarUtilizador} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
                <input
                  type="text"
                  value={novoUser.nome}
                  onChange={(event) => setNovoUser((current) => ({ ...current, nome: event.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={novoUser.email}
                  onChange={(event) => setNovoUser((current) => ({ ...current, email: event.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Papel</label>
                <select
                  value={novoUser.role}
                  onChange={(event) => setNovoUser((current) => ({ ...current, role: event.target.value as FrontRole }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                >
                  {papeis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalAberto(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={saving} className="gap-1.5 bg-[var(--primary)] hover:opacity-90 transition-opacity">
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'A criar…' : 'Criar utilizador'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
