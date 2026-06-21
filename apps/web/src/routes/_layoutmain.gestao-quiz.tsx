import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle2,
  HelpCircle,
  Loader,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type {
  AdminQuizOptionInput,
  AdminQuizQuestion,
  CreateQuizQuestionRequest,
  ListAdminQuizQuestionsResponse,
  QuizCategoria,
} from '@ecobairro/contracts'
import { requireRole, getAccessToken } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useModalA11y } from '@/lib/use-modal-a11y'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'

export const Route = createFileRoute('/_layoutmain/gestao-quiz')({
  beforeLoad: requireRole(['gestor', 'admin']),
  component: GestaoQuizPage,
})

const CATEGORIAS: { value: QuizCategoria; label: string }[] = [
  { value: 'ORGANICOS', label: 'Orgânicos' },
  { value: 'RECICLAGEM', label: 'Reciclagem' },
  { value: 'LEGISLACAO', label: 'Legislação' },
  { value: 'GERAL', label: 'Geral' },
]

const categoriaLabel = (v: QuizCategoria) => CATEGORIAS.find((c) => c.value === v)?.label ?? v

const categoriaCor: Record<QuizCategoria, string> = {
  ORGANICOS: '#a16207',
  RECICLAGEM: 'oklch(0.55 0.18 150)',
  LEGISLACAO: '#6366f1',
  GERAL: '#64748b',
}

type FormOption = { texto: string; correta: boolean }

interface QuestionForm {
  id: string | null
  textoPergunta: string
  explicacaoEducativa: string
  categoria: QuizCategoria
  pontos: number
  opcoes: FormOption[]
}

const emptyForm = (): QuestionForm => ({
  id: null,
  textoPergunta: '',
  explicacaoEducativa: '',
  categoria: 'GERAL',
  pontos: 10,
  opcoes: [
    { texto: '', correta: true },
    { texto: '', correta: false },
  ],
})

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

function GestaoQuizPage() {
  const [itens, setItens] = useState<AdminQuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<'todas' | QuizCategoria>('todas')

  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm] = useState<QuestionForm>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  useModalA11y(modalAberto, modalRef, () => setModalAberto(false))

  const load = useCallback(async () => {
    setLoading(true)
    setListError(null)
    try {
      const resp = await fetchJson<ListAdminQuizQuestionsResponse>('/v1/admin/quiz/perguntas', {
        baseUrl: clientEnv.apiBaseUrl,
        headers: authHeaders(),
      })
      setItens(resp.itens)
    } catch (err) {
      setItens([])
      setListError(getApiErrorMessage(err, 'Não foi possível carregar as perguntas do quiz.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // setTimeout(0) tira o setState do corpo síncrono do effect (evita
    // cascading renders — react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens.filter((p) => {
      if (filtroCategoria !== 'todas' && p.categoria !== filtroCategoria) return false
      if (q && !p.textoPergunta.toLowerCase().includes(q)) return false
      return true
    })
  }, [itens, busca, filtroCategoria])

  function abrirCriar() {
    setForm(emptyForm())
    setFormError(null)
    setModalAberto(true)
  }

  function abrirEditar(p: AdminQuizQuestion) {
    setForm({
      id: p.id,
      textoPergunta: p.textoPergunta,
      explicacaoEducativa: p.explicacaoEducativa,
      categoria: p.categoria,
      pontos: p.pontos,
      opcoes: p.opcoes.map((o) => ({ texto: o.texto, correta: o.correta })),
    })
    setFormError(null)
    setModalAberto(true)
  }

  function setOpcao(idx: number, texto: string) {
    setForm((f) => ({
      ...f,
      opcoes: f.opcoes.map((o, i) => (i === idx ? { ...o, texto } : o)),
    }))
  }

  function marcarCorreta(idx: number) {
    setForm((f) => ({
      ...f,
      opcoes: f.opcoes.map((o, i) => ({ ...o, correta: i === idx })),
    }))
  }

  function adicionarOpcao() {
    setForm((f) => (f.opcoes.length >= 6 ? f : { ...f, opcoes: [...f.opcoes, { texto: '', correta: false }] }))
  }

  function removerOpcao(idx: number) {
    setForm((f) => {
      if (f.opcoes.length <= 2) return f
      const restantes = f.opcoes.filter((_, i) => i !== idx)
      // Garante que continua a haver exatamente uma opção correta.
      if (!restantes.some((o) => o.correta)) restantes[0] = { ...restantes[0]!, correta: true }
      return { ...f, opcoes: restantes }
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const opcoes: AdminQuizOptionInput[] = form.opcoes.map((o) => ({
      texto: o.texto.trim(),
      correta: o.correta,
    }))
    if (opcoes.length < 2 || opcoes.some((o) => !o.texto)) {
      setFormError('Preencha pelo menos 2 opções (sem texto vazio).')
      return
    }
    if (opcoes.filter((o) => o.correta).length !== 1) {
      setFormError('Marque exatamente uma opção como correta.')
      return
    }
    if (!form.textoPergunta.trim() || !form.explicacaoEducativa.trim()) {
      setFormError('Pergunta e explicação educativa são obrigatórias.')
      return
    }

    const body: CreateQuizQuestionRequest = {
      textoPergunta: form.textoPergunta.trim(),
      explicacaoEducativa: form.explicacaoEducativa.trim(),
      categoria: form.categoria,
      pontos: form.pontos,
      opcoes,
    }

    setSaving(true)
    try {
      const editar = form.id !== null
      await fetchJson(editar ? `/v1/admin/quiz/perguntas/${form.id}` : '/v1/admin/quiz/perguntas', {
        baseUrl: clientEnv.apiBaseUrl,
        method: editar ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      setModalAberto(false)
      await load()
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Não foi possível guardar a pergunta.'))
    } finally {
      setSaving(false)
    }
  }

  async function apagar(p: AdminQuizQuestion) {
    setActionError(null)
    if (!confirm(`Apagar a pergunta "${p.textoPergunta}"?`)) return
    try {
      await fetchJson(`/v1/admin/quiz/perguntas/${p.id}`, {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'DELETE',
        headers: authHeaders(),
      })
      await load()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Não foi possível apagar a pergunta.'))
    }
  }

  return (
    <div className="flex w-full max-w-full flex-col gap-8 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">
      {listError && (
        <div role="alert" aria-live="polite" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{listError}</span>
          <button onClick={() => void load()} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white">Tentar novamente</button>
        </div>
      )}
      {actionError && (
        <div role="alert" aria-live="polite" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="shrink-0 rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-white">Fechar</button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gestão de Quiz</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading ? '…' : `${itens.length} pergunta${itens.length !== 1 ? 's' : ''} no banco`}
          </p>
        </div>
        <Button size="sm" className="gap-2 self-start bg-[var(--primary)] transition-opacity hover:opacity-90 sm:self-auto" onClick={abrirCriar}>
          <Plus className="h-4 w-4" />
          Nova pergunta
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar pergunta..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border border-border bg-card py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value as 'todas' | QuizCategoria)}
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        >
          <option value="todas">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <Card className="overflow-hidden rounded-xl border border-border/70 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pergunta</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categoria</th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:table-cell">Opções</th>
                <th className="hidden px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:table-cell">Pontos</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader className="h-5 w-5 animate-spin" />
                      <span className="text-sm">A carregar…</span>
                    </div>
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <HelpCircle className="h-8 w-8 opacity-30" />
                      Nenhuma pergunta encontrada
                    </div>
                  </td>
                </tr>
              ) : filtradas.map((p, i) => {
                const cor = categoriaCor[p.categoria]
                return (
                  <tr key={p.id} className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="max-w-md px-4 py-3">
                      <p className="text-xs font-semibold text-foreground">{p.textoPergunta}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color: cor, backgroundColor: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
                        {categoriaLabel(p.categoria)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{p.opcoes.length} opções</td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <Badge variant="secondary" className="text-[10px]">{p.pontos} pts</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => abrirEditar(p)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                          aria-label="Editar pergunta"
                          title="Editar pergunta"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void apagar(p)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Apagar pergunta"
                          title="Apagar pergunta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalAberto(false)} aria-hidden="true" />
          <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="quiz-modal-title" tabIndex={-1} className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 id="quiz-modal-title" className="text-base font-bold text-foreground">
                {form.id ? 'Editar pergunta' : 'Nova pergunta'}
              </h2>
              <button type="button" aria-label="Fechar modal" onClick={() => setModalAberto(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{formError}</div>
            )}

            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Pergunta</label>
                <textarea
                  value={form.textoPergunta}
                  onChange={(e) => setForm((f) => ({ ...f, textoPergunta: e.target.value }))}
                  required
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as QuizCategoria }))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Pontos</label>
                  <input
                    type="number"
                    min={1}
                    value={form.pontos}
                    onChange={(e) => setForm((f) => ({ ...f, pontos: Math.max(1, Number(e.target.value) || 1) }))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Opções (marque a correta)</label>
                  <button
                    type="button"
                    onClick={adicionarOpcao}
                    disabled={form.opcoes.length >= 6}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)] disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {form.opcoes.map((o, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => marcarCorreta(idx)}
                        aria-label={o.correta ? 'Opção correta' : 'Marcar como correta'}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          o.correta
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-border text-transparent hover:border-emerald-400'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <input
                        type="text"
                        value={o.texto}
                        onChange={(e) => setOpcao(idx, e.target.value)}
                        placeholder={`Opção ${idx + 1}`}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                      />
                      <button
                        type="button"
                        onClick={() => removerOpcao(idx)}
                        disabled={form.opcoes.length <= 2}
                        aria-label="Remover opção"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Explicação educativa (mostrada no resultado)</label>
                <textarea
                  value={form.explicacaoEducativa}
                  onChange={(e) => setForm((f) => ({ ...f, explicacaoEducativa: e.target.value }))}
                  required
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
                />
              </div>

              <div className="mt-1 flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setModalAberto(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={saving} className="gap-2 bg-[var(--primary)] hover:opacity-90">
                  {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {form.id ? 'Guardar' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
