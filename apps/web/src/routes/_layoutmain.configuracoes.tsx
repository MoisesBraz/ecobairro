import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  User, Bell, Shield, Palette, Save, Loader,
  Smartphone, Monitor, LogOut, ChevronRight,
  ShieldCheck, ShieldOff, KeyRound, Copy, Check,
  Clock, RefreshCw,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getUser, getAccessToken } from '@/lib/auth'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import type { CitizenSelfProfileResponse, UpdateCitizenSelfProfileRequest } from '@ecobairro/contracts'
import {
  twoFactorStatus, twoFactorSetup, twoFactorEnable, twoFactorDisable, twoFactorRevealCodes,
  listSessions, revokeSession, revokeAllSessions, listSecurityLogs,
} from '@/lib/api/auth'
import type {
  TwoFactorStatusResponse, ActiveSessionRecord, SecurityLogRecord,
} from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutmain/configuracoes')({
  component: ConfiguracoesPage,
})

const perfilSchema = z.object({
  nome:     z.string().min(2, 'Nome obrigatório (mín. 2 caracteres)'),
  email:    z.string().email('Email inválido'),
  telefone: z.string().optional(),
})

type PerfilForm = z.infer<typeof perfilSchema>
type NotifKey = 'emailReportes' | 'emailNoticias' | 'emailRecolhas' | 'pushAlertas' | 'pushCampanhas'
type NotifState = Record<NotifKey, boolean>

const DEFAULT_NOTIF: NotifState = {
  emailReportes: true,
  emailNoticias: false,
  emailRecolhas: true,
  pushAlertas:   true,
  pushCampanhas: true,
}

function authHeaders(): Record<string, string> {
  const tok = getAccessToken()
  return tok ? { Authorization: `Bearer ${tok}` } : {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal genérico com focus trap
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus() }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="outline-none bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
          <h2 id="modal-title" className="font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal 2FA Setup
// ─────────────────────────────────────────────────────────────────────────────
function TwoFASetupModal({ open, onClose, onEnabled }: {
  open: boolean; onClose: () => void; onEnabled: () => void
}) {
  const [step, setStep] = useState<'qr' | 'codes'>('qr')
  const [qr, setQr] = useState<{ qr_code_data_url: string; secret: string; otpauth_url: string } | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) { setStep('qr'); setQr(null); setCode(''); setError(null); return }
    const tok = getAccessToken()
    if (!tok) return
    setLoading(true)
    twoFactorSetup(tok)
      .then(setQr)
      .catch(e => setError(getApiErrorMessage(e, 'Erro ao iniciar configuração.')))
      .finally(() => setLoading(false))
  }, [open])

  async function handleEnable() {
    const tok = getAccessToken()
    if (!tok) return
    setError(null); setLoading(true)
    try {
      const res = await twoFactorEnable(tok, code.trim())
      setBackupCodes(res.backup_codes)
      setStep('codes')
    } catch (e) {
      setError(getApiErrorMessage(e, 'Código inválido.'))
    } finally { setLoading(false) }
  }

  function copyAll() {
    void navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Ativar Autenticação em Dois Fatores">
      {step === 'qr' ? (
        <div className="flex flex-col gap-4">
          {loading && !qr && (
            <div className="flex justify-center py-8"><Loader className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          )}
          {qr && (
            <>
              <p className="text-sm text-muted-foreground">
                Abra a sua app de autenticação (Google Authenticator, Aegis, etc.) e digitalize o QR code abaixo.
              </p>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <img src={qr.qr_code_data_url} alt="QR code 2FA" className="w-48 h-48" />
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none hover:text-foreground">Não consigo digitalizar — mostrar chave</summary>
                <code className="block mt-2 p-2 bg-muted rounded-lg font-mono text-xs break-all select-all">{qr.secret}</code>
              </details>

              <div>
                <Label htmlFor="totp-code">Código de verificação</Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  maxLength={6}
                  className="mt-1 text-center tracking-widest font-mono text-lg"
                />
              </div>

              {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

              <Button
                onClick={() => void handleEnable()}
                disabled={loading || code.trim().length !== 6}
                className="w-full bg-[var(--primary)] hover:opacity-90"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Ativar 2FA'}
              </Button>
            </>
          )}
          {error && !qr && <p className="text-xs text-destructive" role="alert">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">2FA ativado com sucesso!</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Guarda estes <strong>8 códigos de recuperação</strong> num local seguro. Cada um só pode ser usado uma vez e não serão exibidos novamente.
          </p>
          <div className="bg-muted rounded-xl p-4 font-mono text-sm grid grid-cols-2 gap-2">
            {backupCodes.map(c => (
              <span key={c} className="px-2 py-1 bg-background rounded-lg text-center tracking-widest border border-border">{c}</span>
            ))}
          </div>
          <Button variant="outline" onClick={copyAll} className="gap-2 w-full">
            {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar todos</>}
          </Button>
          <Button onClick={() => { onEnabled(); onClose() }} className="w-full">Concluir</Button>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal Desativar 2FA + revelar códigos
// ─────────────────────────────────────────────────────────────────────────────
function TwoFAActionModal({ open, onClose, mode, onDone }: {
  open: boolean; onClose: () => void; mode: 'disable' | 'reveal'; onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (!open) { setPassword(''); setError(null); setResult(null) } }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const tok = getAccessToken()
    if (!tok) return
    setError(null); setLoading(true)
    try {
      if (mode === 'disable') {
        await twoFactorDisable(tok, password)
        onDone(); onClose()
      } else {
        const res = await twoFactorRevealCodes(tok, password)
        setResult(res.backup_codes)
      }
    } catch (e) {
      setError(getApiErrorMessage(e, 'Password incorrecta.'))
    } finally { setLoading(false) }
  }

  function copyAll() {
    if (!result) return
    void navigator.clipboard.writeText(result.join('\n'))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'disable' ? 'Desativar 2FA' : 'Códigos de Recuperação'}
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Guarda estes códigos num local seguro.</p>
          <div className="bg-muted rounded-xl p-4 font-mono text-sm grid grid-cols-2 gap-2">
            {result.map(c => (
              <span key={c} className="px-2 py-1 bg-background rounded-lg text-center tracking-widest border border-border">{c}</span>
            ))}
          </div>
          <Button variant="outline" onClick={copyAll} className="gap-2 w-full">
            {copied ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar todos</>}
          </Button>
          <Button onClick={onClose} className="w-full">Fechar</Button>
        </div>
      ) : (
        <form onSubmit={e => void handleSubmit(e)} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {mode === 'disable'
              ? 'Confirme a sua password para desativar a autenticação em dois fatores.'
              : 'Confirme a sua password para gerar e ver novos códigos de recuperação.'}
          </p>
          <div>
            <Label htmlFor="confirm-pw">Password</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="mt-1"
            />
          </div>
          {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !password}
            className={mode === 'disable' ? 'w-full bg-destructive hover:bg-destructive/90 text-white' : 'w-full'}
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : mode === 'disable' ? 'Desativar 2FA' : 'Ver códigos'}
          </Button>
        </form>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Secção de Segurança
// ─────────────────────────────────────────────────────────────────────────────
function SecuritySection() {
  const tok = getAccessToken()

  const [tfaStatus, setTfaStatus] = useState<TwoFactorStatusResponse | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [actionMode, setActionMode] = useState<'disable' | 'reveal' | null>(null)

  const [sessions, setSessions] = useState<ActiveSessionRecord[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessError] = useState<string | null>(null)

  const [logs, setLogs] = useState<SecurityLogRecord[]>([])
  const [logsPage, setLogsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)

  const [revokeError, setRevokeError] = useState<string | null>(null)
  const SESSIONS_PAGE_SIZE = 3
  const [sessionsVisible, setSessionsVisible] = useState(SESSIONS_PAGE_SIZE)

  // Carregar status 2FA e sessões
  useEffect(() => {
    if (!tok) return
    twoFactorStatus(tok).then(setTfaStatus).catch(() => undefined)
    loadSessions()
  }, [tok])

  function loadSessions() {
    if (!tok) return
    setSessionsLoading(true); setSessError(null)
    listSessions(tok)
      .then(r => setSessions(r.sessions))
      .catch(e => setSessError(getApiErrorMessage(e, 'Erro ao carregar sessões.')))
      .finally(() => setSessionsLoading(false))
  }

  function loadLogs(page = 1) {
    if (!tok) return
    setLogsLoading(true); setLogsError(null)
    listSecurityLogs(tok, page)
      .then(r => { setLogs(r.logs); setLogsTotal(r.total); setLogsPage(page) })
      .catch(e => setLogsError(getApiErrorMessage(e, 'Não foi possível carregar o histórico. Pode ter de iniciar sessão novamente.')))
      .finally(() => setLogsLoading(false))
  }

  async function handleRevokeSession(id: string) {
    if (!tok) return
    setRevokeError(null)
    try {
      await revokeSession(tok, id)
      setSessions(s => s.filter(x => x.id !== id))
    } catch (e) {
      setRevokeError(getApiErrorMessage(e, 'Erro ao revogar sessão.'))
    }
  }

  async function handleRevokeAll() {
    if (!tok) return
    setRevokeError(null)
    try {
      await revokeAllSessions(tok)
      setSessions([])
    } catch (e) {
      setRevokeError(getApiErrorMessage(e, 'Erro ao revogar sessões.'))
    }
  }

  function eventLabel(event: SecurityLogRecord['event']): string {
    const map: Record<string, string> = {
      LOGIN_SUCCESS: 'Login efectuado',
      LOGIN_FAILED: 'Tentativa de login falhada',
      PASSWORD_CHANGED: 'Password alterada',
      TWO_FACTOR_ENABLED: '2FA ativado',
      TWO_FACTOR_DISABLED: '2FA desativado',
      ACCOUNT_LOCKED: 'Conta bloqueada',
      DEVICE_REVOKED: 'Sessão revogada',
    }
    return map[event] ?? event
  }

  function deviceIcon(ua: string | null) {
    if (!ua) return <Monitor className="w-4 h-4" />
    const l = ua.toLowerCase()
    if (l.includes('mobile') || l.includes('android') || l.includes('iphone'))
      return <Smartphone className="w-4 h-4" />
    return <Monitor className="w-4 h-4" />
  }

  function sessionTitle(session: ActiveSessionRecord): string {
    return session.browser ?? session.device ?? 'Dispositivo desconhecido'
  }

  function sessionDetails(session: ActiveSessionRecord): string {
    const details = [session.device, session.os].filter(Boolean)
    if (details.length === 0 && session.ip_address) details.push(session.ip_address)
    details.push(new Date(session.criado_em).toLocaleDateString('pt-PT'))
    return details.join(' · ')
  }

  return (
    <>
      {/* 2FA */}
      <div className="flex items-center justify-between py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tfaStatus?.enabled ? 'bg-emerald-500/10' : 'bg-muted'}`}>
            {tfaStatus?.enabled
              ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
              : <ShieldOff className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div>
            <p className="text-sm font-medium">Autenticação em Dois Fatores</p>
            <p className="text-xs text-muted-foreground">
              {tfaStatus?.enabled
                ? `Ativo · ${tfaStatus.backup_codes_remaining} códigos de recuperação`
                : 'Desativado — recomendamos que ative'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tfaStatus?.enabled ? (
            <>
              <button
                onClick={() => setActionMode('reveal')}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Códigos
              </button>
              <button
                onClick={() => setActionMode('disable')}
                className="text-xs text-destructive hover:underline"
              >
                Desativar
              </button>
            </>
          ) : (
            <button
              onClick={() => setSetupOpen(true)}
              className="text-xs font-medium text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              Ativar <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Sessões ativas */}
      <div className="pt-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium">Sessões ativas</p>
            {!sessionsLoading && sessions.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {sessions.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSessions}
              disabled={sessionsLoading}
              aria-label="Atualizar sessões"
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
            </button>
            {sessions.length > 0 && (
              <button
                onClick={() => void handleRevokeAll()}
                className="text-xs text-destructive hover:underline"
              >
                Terminar todas
              </button>
            )}
          </div>
        </div>

        {revokeError && (
          <p className="text-xs text-destructive mb-2" role="alert">{revokeError}</p>
        )}

        {sessionsLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : sessionsError ? (
          <p className="text-xs text-destructive">{sessionsError}</p>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">Sem sessões ativas.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.slice(0, sessionsVisible).map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/40">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-background flex items-center justify-center border border-border/60">
                    {deviceIcon(s.user_agent)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium line-clamp-1 max-w-48">{sessionTitle(s)}</p>
                      {s.current && (
                        <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)]">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{sessionDetails(s)}</p>
                  </div>
                </div>
                <button
                  onClick={() => void handleRevokeSession(s.id)}
                  aria-label="Terminar sessão"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Mostrar mais / menos */}
            {sessions.length > SESSIONS_PAGE_SIZE && (
              <button
                onClick={() =>
                  setSessionsVisible(v =>
                    v >= sessions.length ? SESSIONS_PAGE_SIZE : Math.min(v + SESSIONS_PAGE_SIZE, sessions.length)
                  )
                }
                className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1 pt-1 self-start"
              >
                <ChevronRight className={`w-3 h-3 transition-transform ${sessionsVisible >= sessions.length ? 'rotate-90' : ''}`} />
                {sessionsVisible >= sessions.length
                  ? 'Ver menos'
                  : `Ver mais (${sessions.length - sessionsVisible} restante${sessions.length - sessionsVisible !== 1 ? 's' : ''})`
                }
              </button>
            )}
          </div>
        )}
      </div>

      {/* Histórico de segurança */}
      <div className="pt-4 border-t border-border/50 mt-2">
        <button
          onClick={() => { if (!showLogs) loadLogs(1); setShowLogs(v => !v) }}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Clock className="w-4 h-4" />
          Histórico de segurança
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showLogs ? 'rotate-90' : ''}`} />
        </button>

        {showLogs && (
          <div className="mt-3 flex flex-col gap-1">
            {logsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-2">
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">A carregar…</span>
              </div>
            ) : logsError ? (
              <div className="flex items-center justify-between gap-2 py-1">
                <p className="text-xs text-destructive">{logsError}</p>
                <button onClick={() => loadLogs(logsPage)} className="text-xs text-[var(--primary)] hover:underline shrink-0">Tentar novamente</button>
              </div>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">Sem registos.</p>
            ) : (
              <>
                {logs.map(log => (
                  <div key={log.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      log.event === 'LOGIN_SUCCESS' ? 'bg-emerald-500'
                        : log.event === 'LOGIN_FAILED' || log.event === 'ACCOUNT_LOCKED' ? 'bg-destructive'
                          : 'bg-amber-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{eventLabel(log.event)}</p>
                      <p className="text-xs text-muted-foreground truncate">{log.ip_address} · {new Date(log.criado_em).toLocaleString('pt-PT')}</p>
                    </div>
                  </div>
                ))}

                {logsTotal > logsPage * 20 && (
                  <button
                    onClick={() => loadLogs(logsPage + 1)}
                    className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1 pt-1"
                    disabled={logsLoading}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Carregar mais
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modais */}
      <TwoFASetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onEnabled={() => twoFactorStatus(tok ?? '').then(setTfaStatus).catch(() => undefined)}
      />
      <TwoFAActionModal
        open={actionMode !== null}
        onClose={() => setActionMode(null)}
        mode={actionMode ?? 'disable'}
        onDone={() => twoFactorStatus(tok ?? '').then(setTfaStatus).catch(() => undefined)}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
function ConfiguracoesPage() {
  const sessionUser = getUser()
  const isCidadao   = sessionUser?.role === 'cidadao'

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<PerfilForm>({
    resolver: zodResolver(perfilSchema),
    defaultValues: {
      nome:     sessionUser?.name ?? '',
      email:    sessionUser?.email ?? '',
      telefone: '',
    },
  })

  const nomeAtual = watch('nome')

  const [notificacoes, setNotificacoes] = useState<NotifState>(DEFAULT_NOTIF)
  const [loadingPerfil, setLoadingPerfil] = useState(isCidadao)
  const [guardado, setGuardado]   = useState(false)
  const [guardandoNotif, setGuardandoNotif] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCidadao) return
    fetchJson<CitizenSelfProfileResponse>('/v1/cidadaos/me', {
      baseUrl: clientEnv.apiBaseUrl,
      headers: authHeaders(),
    })
      .then(data => {
        reset({
          nome:     data.nome_completo ?? sessionUser?.name ?? '',
          email:    data.email,
          telefone: data.phone ?? '',
        })
        const prefs = data.notificacao_prefs as Partial<NotifState> | null
        if (prefs) setNotificacoes(prev => ({ ...prev, ...prefs }))
      })
      .catch(() => {/* keep defaults */})
      .finally(() => setLoadingPerfil(false))
  }, [isCidadao])

  async function onSavePerfil(data: PerfilForm) {
    setSaveError(null)
    if (isCidadao) {
      const body: UpdateCitizenSelfProfileRequest = {
        nome_completo: data.nome,
        phone:         data.telefone || undefined,
      }
      try {
        await fetchJson('/v1/cidadaos/me', {
          baseUrl: clientEnv.apiBaseUrl,
          method:  'PUT',
          body:    JSON.stringify(body),
          headers: authHeaders(),
        })
      } catch (err) {
        setSaveError(getApiErrorMessage(err, 'Não foi possível guardar o perfil.'))
        return
      }
    }
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  async function saveNotif(next: NotifState) {
    setNotificacoes(next)
    if (!isCidadao) return
    setGuardandoNotif(true); setSaveError(null)
    try {
      await fetchJson('/v1/cidadaos/me', {
        baseUrl: clientEnv.apiBaseUrl,
        method:  'PUT',
        body:    JSON.stringify({ notificacao_prefs: next } satisfies UpdateCitizenSelfProfileRequest),
        headers: authHeaders(),
      })
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Não foi possível guardar as preferências de notificação.'))
    } finally { setGuardandoNotif(false) }
  }

  function toggleNotif(key: NotifKey) {
    void saveNotif({ ...notificacoes, [key]: !notificacoes[key] })
  }

  return (
    <div className="flex flex-col gap-8 pb-12 max-w-2xl">

      {saveError && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerir perfil, notificações e preferências</p>
      </div>

      {/* Perfil */}
      <Card className="border border-border/70 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
              <User className="w-4 h-4 text-[var(--primary)]" />
            </div>
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadingPerfil ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">A carregar perfil…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xl font-bold shrink-0">
                  {(nomeAtual || 'U').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{nomeAtual || 'Utilizador'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{sessionUser?.role ?? 'cidadao'}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSavePerfil)} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo</label>
                    <input
                      type="text"
                      {...register('nome')}
                      placeholder="O seu nome"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
                    />
                    {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                    <input
                      type="email"
                      {...register('email')}
                      disabled
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-muted text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                    <input
                      type="tel"
                      {...register('telefone')}
                      placeholder="+351 9XX XXX XXX"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)]/50 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {guardado && <p className="text-xs text-emerald-600 font-medium">Guardado com sucesso</p>}
                  <Button type="submit" size="sm" className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity ml-auto">
                    <Save className="w-3.5 h-3.5" />
                    Guardar alterações
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notificações */}
      <Card className="border border-border/70 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-500" />
            </div>
            Notificações
            {guardandoNotif && <Loader className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {([
            { key: 'emailReportes' as NotifKey, label: 'Atualizações dos meus reportes',    desc: 'Email quando o estado de um reporte muda'       },
            { key: 'emailNoticias' as NotifKey, label: 'Novidades e eventos do bairro',     desc: 'Email com as últimas notícias'                  },
            { key: 'emailRecolhas' as NotifKey, label: 'Confirmação de recolhas agendadas', desc: 'Email ao agendar ou confirmar recolha'          },
            { key: 'pushAlertas'   as NotifKey, label: 'Alertas de ecopontos cheios',       desc: 'Notificação quando há alertas na sua zona'      },
            { key: 'pushCampanhas' as NotifKey, label: 'Campanhas institucionais',          desc: 'Notificação de novos comunicados da autarquia'  },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <button
                onClick={() => toggleNotif(key)}
                aria-pressed={notificacoes[key]}
                aria-label={label}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${notificacoes[key] ? 'bg-[var(--primary)]' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${notificacoes[key] ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Segurança */}
      <Card className="border border-border/70 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-500" />
            </div>
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          <SecuritySection />
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card className="border border-border/70 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Palette className="w-4 h-4 text-purple-500" />
            </div>
            Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">O tema (claro/escuro/sistema) pode ser alterado através do botão na barra superior.</p>
        </CardContent>
      </Card>
    </div>
  )
}
