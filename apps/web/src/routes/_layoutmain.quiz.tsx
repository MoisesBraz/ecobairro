import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Trophy, Flame, Target, Medal,
  Zap, Sparkles,
  Timer, Users, Brain, Award, Star, X
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { clientEnv } from '@/lib/env'
import { getAccessToken, requireRole } from '@/lib/auth'
import type { GamificationOptInResponse, QuizAchievementKey, QuizMeResponse } from '@ecobairro/contracts'
import { QuizPlay } from '@/components/quiz/quiz-play'

export const Route = createFileRoute('/_layoutmain/quiz')({
  beforeLoad: requireRole(['cidadao', 'admin']),
  component: QuizPage,
})

const achMeta: Record<
  QuizAchievementKey,
  { bg: string; color: string; Icon: (props: { className?: string }) => React.ReactNode }
> = {
  eco_sabio: { bg: 'bg-purple-500/10', color: 'text-purple-500', Icon: Brain },
  olho_vivo: { bg: 'bg-amber-500/10', color: 'text-amber-500', Icon: Zap },
  reciclagem_pro: { bg: 'bg-green-500/10', color: 'text-green-500', Icon: Medal },
  mestre_da_rua: { bg: 'bg-blue-500/10', color: 'text-blue-500', Icon: Target },
  lenda_urbana: {
    bg: 'bg-[var(--primary)]/10',
    color: 'text-[var(--primary)]',
    Icon: Star,
  },
  benfeitor: { bg: 'bg-rose-500/10', color: 'text-rose-500', Icon: Award },
}

function QuizPage() {
  const [me, setMe] = useState<QuizMeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [optingIn, setOptingIn] = useState(false)

  const load = useCallback(() => {
    const token = getAccessToken()
    if (!token) {
      setMe(null)
      setIsLoading(false)
      return
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    return fetchJson<QuizMeResponse>('/v1/gamification/quiz/me', {
      baseUrl: clientEnv.apiBaseUrl,
      headers,
    })
      .then((data) => { setMe(data); setListError(null) })
      .catch((err) => {
        setMe(null)
        setListError(getApiErrorMessage(err, 'Não foi possível carregar o quiz.'))
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const optedIn = me?.optedIn ?? false

  const handleStart = useCallback(async () => {
    if (optedIn) {
      setPlaying(true)
      return
    }
    const token = getAccessToken()
    if (!token) return
    setOptingIn(true)
    try {
      await fetchJson<GamificationOptInResponse>('/v1/gamification/optin', {
        baseUrl: clientEnv.apiBaseUrl,
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      await load()
      setPlaying(true)
    } catch (err) {
      setListError(getApiErrorMessage(err, 'Não foi possível ativar a gamificação.'))
    } finally {
      setOptingIn(false)
    }
  }, [optedIn, load])

  const userStats = useMemo(() => {
    return (
      me?.userStats ?? {
        pontos: 0,
        nivel: 'Iniciante',
        proximoNivel: 'Eco-Guerreiro',
        xp: 0,
        faltam_pts: 0,
        streak: 0,
        posicao: 0,
      }
    )
  }, [me])

  const ranking = me?.ranking ?? []
  const conquistas = me?.conquistas ?? []

  const hero = me?.hero ?? {
    titulo: 'Herói da Reciclagem 2026',
    bonus_xp: 50,
    tempo_limite_seconds: 120,
  }

  const tempoLabel = `${Math.floor(hero.tempo_limite_seconds / 60)}:${String(hero.tempo_limite_seconds % 60).padStart(2, '0')}`

  return (
    <div className="flex w-full max-w-full flex-col gap-10 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">
      {listError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed right-4 top-4 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-lg backdrop-blur"
        >
          <span className="flex-1">{listError}</span>
          <button
            type="button"
            onClick={() => setListError(null)}
            aria-label="Fechar aviso"
            className="shrink-0 rounded-md p-0.5 text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── 1. Hero: Desafio Semanal ── */}
      <Card className="relative overflow-hidden border border-border/70 shadow-sm bg-card rounded-xl">
        {/* Subtil acento de cor à esquerda */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[var(--primary)]" />
        
        <CardContent className="p-6 sm:p-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-lg text-center md:text-left">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 w-fit mx-auto md:mx-0">
                <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">Desafio da Semana</span>
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {isLoading ? '…' : hero.titulo}
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                  Teste o seu conhecimento ambiental e ganhe pontos extra para o seu nível.
                </p>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-8 pt-1">
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-foreground">+{hero.bonus_xp}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Pontos XP</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-foreground flex items-center gap-2">
                     <Timer className="w-4 h-4 text-[var(--primary)]" /> {tempoLabel}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Tempo Limite</span>
                </div>
              </div>
              <Button
                onClick={() => { void handleStart() }}
                disabled={optingIn || isLoading}
                className="gap-2 bg-[var(--primary)] hover:opacity-90 transition-opacity rounded-xl hover:scale-[1.02] active:scale-[0.98] mt-2 w-full sm:w-auto"
              >
                {optingIn ? 'A ativar…' : optedIn ? 'Começar Agora' : 'Ativar e Jogar'}
              </Button>
              {!optedIn && !isLoading && (
                <p className="text-[11px] text-muted-foreground">
                  A gamificação é opcional. Ao jogar, ativa o ranking e as conquistas.
                </p>
              )}
            </div>

            <div className="relative shrink-0 flex items-center justify-center p-4">
               <div className="relative z-10 animate-in zoom-in duration-700">
                  <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 shadow-inner">
                    <Trophy className="w-16 h-16 text-amber-500/80" />
                  </div>
               </div>
               {/* Decorative background circle */}
               <div className="absolute inset-0 bg-[var(--primary)]/5 rounded-full blur-3xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Portão de adesão: enquanto não aderir, não mostramos o painel de jogador ── */}
      {!isLoading && !optedIn && (
        <Card className="border border-[var(--primary)]/30 bg-[var(--primary)]/[0.04] shadow-sm rounded-xl">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10">
              <Award className="h-7 w-7 text-[var(--primary)]" />
            </span>
            <div className="max-w-md space-y-1">
              <h2 className="text-lg font-bold text-foreground">A gamificação está desativada</h2>
              <p className="text-sm text-muted-foreground">
                Para participar no quiz, ganhar pontos e entrar no ranking do bairro, precisa de
                ativar a gamificação. A adesão é opcional e só então é criado o seu perfil de jogador.
              </p>
            </div>
            <Button
              onClick={() => { void handleStart() }}
              disabled={optingIn || isLoading}
              className="gap-2 rounded-xl bg-[var(--primary)] transition-opacity hover:opacity-90"
            >
              {optingIn ? 'A ativar…' : 'Ativar e participar'}
            </Button>
            <p className="text-[11px] text-muted-foreground">Pode desativar a qualquer momento.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Painel de jogador — só visível depois de aderir ── */}
      {optedIn && (
        <>
      {/* ── 2. Cards de Estatísticas Profissionais ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Os Meus Pontos', value: userStats.pontos, icon: Zap, color: '#fb923c', desc: 'Saldo total acumulado' },
          { label: 'Dias Seguidos', value: userStats.streak, icon: Flame, color: '#f87171', desc: 'Atividade consecutiva' },
          { label: 'Ranking Bairro', value: `#${userStats.posicao}`, icon: Users, color: '#60a5fa', desc: 'Lugar na sua zona' },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</CardTitle>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}>
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{stat.desc}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* ── 3. Ranking de Vizinhos ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Top Vizinhos</h2>
          </div>
          <Card className="border border-border/70 shadow-sm rounded-xl overflow-hidden bg-card">
            <div className="flex flex-col divide-y divide-border">
              {ranking.map((r, i) => (
                <div key={r.id} className={`flex items-center gap-4 p-4 transition-colors ${r.isMe ? 'bg-[var(--primary)]/5' : 'hover:bg-muted/30'}`}>
                  <div className="flex items-center justify-center w-6 text-xs font-bold text-muted-foreground">
                    {i === 0 && <Medal className="w-5 h-5 text-amber-500" />}
                    {i === 1 && <Medal className="w-5 h-5 text-slate-400" />}
                    {i === 2 && <Medal className="w-5 h-5 text-amber-700" />}
                    {i > 2 && `${i + 1}º`}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-xs ring-2 ring-background shrink-0">
                    {r.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${r.isMe ? 'text-[var(--primary)]' : 'text-foreground'}`}>
                      {r.nome} {r.isMe && '(Você)'}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.pontos.toLocaleString()} pts</p>
                  </div>
                  {i === 0 && <Badge className="bg-amber-100 text-amber-700 border-none text-[9px] font-black uppercase">Elite</Badge>}
                </div>
              ))}
            </div>
            <button className="w-full py-3 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors border-t border-border bg-muted/20">
              Ver Ranking Completo
            </button>
          </Card>
        </div>

        {/* ── 4. Conquistas e Progresso de Nível ── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Nível Atual */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--primary)]" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">O Seu Progresso</h2>
              </div>
              <span className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">{userStats.nivel}</span>
            </div>
            <Card className="border border-border/70 shadow-sm rounded-xl p-5 bg-card">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground pr-4">
                    Faltam <span className="text-foreground font-bold">{userStats.faltam_pts}</span> pts para tornar-se{' '}
                    <span className="text-[var(--primary)] font-bold">{userStats.proximoNivel}</span>
                  </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-foreground">{userStats.xp}%</p>
                  </div>
                </div>
                <Progress value={userStats.xp} className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-[var(--primary)] [&>div]:to-emerald-400" />
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  <span>Iniciante</span>
                  <span>Eco-Guerreiro</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Medals Grid */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Medal className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Conquistas Desbloqueadas</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {conquistas.map((c) => {
                const meta = achMeta[c.key]
                return (
                  <Card 
                    key={c.key} 
                    className={`group transition-all duration-300 border border-border/70 shadow-sm rounded-xl ${
                      c.unlocked 
                        ? 'bg-card hover:shadow-md cursor-pointer hover:border-[var(--primary)]/30' 
                        : 'bg-muted/30 opacity-60'
                    }`}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${c.unlocked ? meta.bg : 'bg-muted'}`}>
                        <meta.Icon className={`w-6 h-6 ${c.unlocked ? meta.color : 'text-muted-foreground'}`} />
                      </div>
                      <div className="space-y-1">
                        <p className={`text-xs font-bold ${c.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>{c.nome}</p>
                        <p className="text-[9px] leading-tight text-muted-foreground">{c.desc}</p>
                      </div>
                      {!c.unlocked && <Badge variant="secondary" className="text-[8px] h-4">Bloqueado</Badge>}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

        </div>
      </div>
        </>
      )}

      {playing && (
        <QuizPlay
          onClose={(completed) => {
            setPlaying(false)
            if (completed) void load()
          }}
        />
      )}
    </div>
  )
}
