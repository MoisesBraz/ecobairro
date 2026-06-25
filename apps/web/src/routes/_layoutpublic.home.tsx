import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useCookieConsent } from '@/components/cookie-consent/CookieConsentProvider'

// import { OrbitalGlobe } from '@/components/ui/orbital-globe'
import FluidCursorEffect from '@/components/ui/fluid-cursor'
import { Spotlight } from '@/components/ui/spotlight'
import {
  MapPin, TrendingUp, ChevronRight, Star, AlertTriangle, Recycle, Users, Leaf,
  FileText, CheckCircle, Package, Gift, Newspaper, Calendar, Clock,
  PlusCircle, Truck, Trophy, LogIn, UserPlus, ArrowRight, ShieldCheck,
  Zap, Mail, ChevronDown, ArrowUp, X
} from 'lucide-react'
import { motion } from 'framer-motion'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'
import { clientEnv } from '@/lib/env'
import { getAccessToken, getDefaultRouteForRole, getUser } from '@/lib/auth'
import { removeFavorito } from '@/lib/api/favoritos'
import type { HomeFeedResponse, HomeNoticia } from '@ecobairro/contracts'

export const Route = createFileRoute('/_layoutpublic/home')({
  beforeLoad: () => {
    const user = getUser()
    if (user && user.role !== 'guest' && user.role !== 'cidadao' && user.role !== 'admin') {
      throw redirect({ to: getDefaultRouteForRole(user.role) })
    }
  },
  component: HomePage,
})

/* ─── Helpers ─── */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX: number;
    let scrollLeft: number;
    let dragged = false;

    const onMouseDown = (e: globalThis.MouseEvent) => {
      isDown = true;
      dragged = false;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
      if (dragged) setIsDragging(false);
    };

    const onMouseUp = () => {
      isDown = false;
      setTimeout(() => setIsDragging(false), 0);
    };

    const onMouseMove = (e: globalThis.MouseEvent) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 2;
      if (Math.abs(walk) > 5) {
        dragged = true;
        setIsDragging(true);
        e.preventDefault();
      }
      el.scrollLeft = scrollLeft - walk;
    };

    const onClick = (e: globalThis.MouseEvent) => {
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('click', onClick, { capture: true });

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('click', onClick, { capture: true });
    };
  }, []);

  return { ref, isDragging };
}
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * ease))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])
  return value
}

function Counter({ to }: { to: number }) {
  const v = useCountUp(to)
  return <>{v.toLocaleString('pt-PT')}</>
}

/* ─── Intersection Observer hook for scroll animations ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

const atalhos = [
  { label: 'Criar Reporte', icon: PlusCircle, to: '/reportes', search: { novo: '1' } as const },
  { label: 'Pedir Recolha', icon: Truck, to: '/recolhas', search: { novo: '1' } as const },
  { label: 'Quiz Semanal', icon: Trophy, to: '/quiz', search: undefined },
] as const

function ecoState(pct: number) {
  if (pct >= 80) return { label: 'Cheio', color: '#f87171', barColor: '#f87171cc' }
  if (pct >= 50) return { label: 'Moderado', color: '#fb923c', barColor: '#fb923ccc' }
  return { label: 'Disponível', color: 'oklch(0.55 0.18 150)', barColor: 'oklch(0.55 0.18 150 / 0.85)' }
}

const COMMUNITY_STATS = {
  cidadaos: 1200,
  reports: 340,
  resolvidos: 89,
  ecopontos: 47,
} as const

const MOCK_NOTICIAS = [
  {
    id: 'n1',
    titulo: 'Campanha de Recolha de Resíduos Elétricos em Lisboa',
    resumo: 'A câmara municipal lança nova iniciativa para recolha gratuita de equipamentos elétricos em todos os bairros durante o mês de junho.',
    imagem: '/news_reciclagem.png',
    categoria: 'Campanha',
    data: '14 Mai 2026',
    tempo_leitura: '3 min',
  },
  {
    id: 'n2',
    titulo: 'Novo Ecoponto Instalado na Rua da Palma — Porto',
    resumo: 'Moradores do Bonfim celebram a instalação de três novos ecopontos fruto de 240 reports enviados pela plataforma ecoBairro.',
    imagem: '/news_ecoponto.png',
    categoria: 'Novidade',
    data: '10 Mai 2026',
    tempo_leitura: '2 min',
  },
  {
    id: 'n3',
    titulo: 'Dia do Ambiente: Plantação de 500 Árvores nas Cidades',
    resumo: 'No próximo dia 5 de junho, voluntários e cidadãos são convidados a participar na maior ação de plantação urbana dos últimos anos.',
    imagem: '/news_voluntarios.png',
    categoria: 'Evento',
    data: '5 Mai 2026',
    tempo_leitura: '4 min',
  },
  {
    id: 'n4',
    titulo: 'Taxa de Reciclagem em Braga Sobe 34% em 2025',
    resumo: 'Os dados do relatório anual confirmam que a participação cidadã em plataformas como o ecoBairro contribuiu diretamente para o aumento da taxa de reciclagem.',
    imagem: '/news_ambiente.png',
    categoria: 'Relatório',
    data: '28 Abr 2026',
    tempo_leitura: '5 min',
  },
]

function getLocalStaticMapUrl(lat?: number, lon?: number, zoom: number = 16) {
  if (lat == null || lon == null) return null;
  // Use local tileserver-gl static image endpoint
  return `/tiles/styles/basic-preview/static/${lon},${lat},${zoom}/400x200@2x.png`;
}

const STEPS = [
  {
    num: '01',
    icon: UserPlus,
    title: 'Crie a sua conta',
    desc: 'Registe-se gratuitamente com o seu email ou conta Google. O processo demora menos de um minuto.',
  },
  {
    num: '02',
    icon: MapPin,
    title: 'Descubra o seu bairro',
    desc: 'Explora o mapa com ecopontos em tempo real, reporta problemas e acompanha a atividade da sua zona.',
  },
  {
    num: '03',
    icon: TrendingUp,
    title: 'Meça o seu impacto',
    desc: 'Ganha pontos, sobe de nível e vê como a sua participação melhora a cidade de forma mensurável.',
  },
]

const FEATURES = [
  {
    icon: FileText,
    title: 'Reportes diretos à câmara',
    desc: 'Fotografa, localiza e envia problemas do seu bairro — lixo acumulado, iluminação avariada, infraestrutura danificada — diretamente para os serviços municipais. Acompanha o estado de cada reporte em tempo real.',
    highlight: 'Resposta média em 48h',
    color: '#60a5fa',
  },
  {
    icon: Recycle,
    title: 'Ecopontos com disponibilidade em tempo real',
    desc: 'Mapa interativo com todos os pontos de reciclagem da sua zona. Consulta a ocupação atual, tipos de resíduos aceites e recebe alertas quando o seu ecoponto favorito está quase cheio.',
    highlight: 'Sensores IoT integrados',
    color: 'oklch(0.55 0.18 150)',
  },
  {
    icon: Package,
    title: 'Partilha de recursos locais',
    desc: 'Dá nova vida a objetos que já não usas. Publica artigos para doação ou troca com vizinhos da sua zona. Reduz o desperdício e fortalece os laços comunitários.',
    highlight: 'Economia circular local',
    color: '#f59e0b',
  },
]

const TESTIMONIALS = [
  {
    quote: 'Reportei um ecoponto cheio e em 2 dias estava resolvido. Nunca pensei que fosse tão simples influenciar a minha câmara.',
    name: 'Ana Sofia M.',
    role: 'Moradora de Cascais',
    avatar: 'A',
    color: 'oklch(0.55 0.18 150)',
  },
  {
    quote: 'A plataforma criou uma comunidade no nosso bairro. Agora conhecemos os vizinhos e partilhamos coisas que antes íamos deitar fora.',
    name: 'Miguel F.',
    role: 'Residente do Bonfim, Porto',
    avatar: 'M',
    color: '#60a5fa',
  },
  {
    quote: 'Como responsável municipal, o ecoBairro mudou a forma como recebemos e gerimos as queixas dos cidadãos. Tudo mais transparente.',
    name: 'Dra. Carla R.',
    role: 'Técnica Municipal, Lisboa',
    avatar: 'C',
    color: '#a78bfa',
  },
]


/* ─── Public Navbar ─── */
export function PublicNavbar({ alwaysSolid = false }: { alwaysSolid?: boolean } = {}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isSolid = alwaysSolid || scrolled

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isSolid ? 'rgba(8,12,11,0.65)' : 'transparent',
        backdropFilter: isSolid ? 'blur(16px)' : 'none',
        borderBottom: isSolid ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
      }}
    >
      {/* Usa o mesmo padding do hero para o logo ficar alinhado com o título */}
      <div className="w-full px-8 md:px-14 lg:px-20 xl:px-28 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link 
          to="/home"
          onClick={(e) => {
             if (window.location.pathname === '/home' || window.location.pathname === '/') {
               e.preventDefault()
               window.scrollTo({ top: 0, behavior: 'smooth' })
             }
          }}
          className="flex items-center gap-2.5 group shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/20 border border-[var(--primary)]/30 flex items-center justify-center group-hover:bg-[var(--primary)]/30 transition-colors">
            <Leaf className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight select-none">
            eco<span className="text-[var(--primary)]">Bairro</span>
          </span>
        </Link>

        {/* Nav links — direita, sem CTAs (hero já tem Começar + Já tenho conta) */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: 'Como funciona', href: '#como-funciona' },
            { label: 'Funcionalidades', href: '#funcionalidades' },
            { label: 'Notícias', href: '#noticias' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.href.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-sm text-white font-semibold hover:text-[var(--primary)] transition-colors"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  )
}


/* ─── Hero ─── */
function GuestHero() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.9

    let isIntersecting = false;

    const handleVisibility = () => {
      if (!videoRef.current) return
      if (document.hidden) {
        videoRef.current.pause()
      } else if (isIntersecting) {
        videoRef.current.play().catch(() => {})
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return
        isIntersecting = entry.isIntersecting;
        if (entry.isIntersecting && !document.hidden) {
          videoRef.current.play().catch(() => {})
        } else {
          videoRef.current.pause()
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) observer.observe(containerRef.current)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100svh] md:h-auto md:aspect-video overflow-hidden flex items-center"
      style={{ background: 'linear-gradient(135deg, #080c0b 0%, #0d1117 45%, #0b0d1a 100%)' }}
    >
      {/* Background video */}
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ opacity: 0.80, zIndex: 0 }}
      >
        <source src="/videopromocional-v2.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: 'linear-gradient(135deg, rgba(8,12,11,0.85) 0%, rgba(13,17,23,0.60) 40%, rgba(11,13,26,0.70) 100%)',
        }}
        aria-hidden="true"
      />

      {/* Spotlight */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="oklch(0.65 0.18 150)"
      />

      {/* Ambient glow */}
      <div
        className="absolute -top-40 -left-40 w-[700px] h-[700px] pointer-events-none"
        style={{
          zIndex: 2,
          background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 55%)',
        }}
        aria-hidden="true"
      />

      {/* ── Left: text ── */}
      <div className="relative flex flex-col gap-6 md:gap-8 flex-1 px-6 sm:px-8 md:px-14 lg:px-20 xl:px-28 pt-24 md:pt-20" style={{ zIndex: 10 }}>
        {/* Category badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-4 py-1.5 w-fit">
          <span
            className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold tracking-widest text-[var(--primary)] uppercase">
            Plataforma de Cidadania Ativa
          </span>
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.04] tracking-tight text-white">
            O seu bairro<br />
            mais{' '}
            <span
              className="text-[var(--primary)]"
              style={{ textShadow: '0 0 40px color-mix(in srgb, var(--primary) 50%, transparent)' }}
            >
              sustentável
            </span>
          </h1>
          <p className="text-base text-white/55 max-w-sm leading-relaxed">
            Reporta problemas, partilha recursos e mede o impacto real da sua comunidade.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            asChild
            className="gap-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white min-h-[48px] px-8 font-semibold text-sm rounded-xl"
            style={{ boxShadow: '0 0 32px color-mix(in srgb, var(--primary) 40%, transparent)' }}
          >
            <Link to="/register">
              <UserPlus className="w-4 h-4" />
              Começar gratuitamente
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="gap-2 min-h-[48px] px-8 border-white/20 text-white hover:bg-white/15 bg-white/5 backdrop-blur-md font-semibold text-sm rounded-xl"
          >
            <Link to="/login">
              <LogIn className="w-4 h-4" />
              Já tenho conta
            </Link>
          </Button>
        </div>


      </div>

      {/* ── Right: Globe (Scaled down & Bottom-Right) ── */}
      {/* 
      <div
        className="hidden md:block absolute bottom-0 right-0 w-[600px] h-[600px] scale-[0.60] lg:scale-[0.70] xl:scale-[0.75] origin-bottom-right"
        style={{ zIndex: 10 }}
      >
        <OrbitalGlobe />
      </div>
      */}

      {/* Scroll indicator */}
      <a
        href="#como-funciona"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
        style={{ zIndex: 16 }}
        aria-label="Descobre mais"
      >
        <span className="text-[10px] text-white/60 uppercase tracking-widest group-hover:text-white transition-colors">Descobre mais</span>
        <ChevronDown className="w-4 h-4 text-white/60 animate-bounce group-hover:text-white transition-colors" />
      </a>

      {/* Bottom fade — funde para preto para não chocar com o fundo claro */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{ zIndex: 15, background: 'linear-gradient(to bottom, transparent 0%, #080c0b 100%)' }}
        aria-hidden="true"
      />
    </div>
  )
}

/* ─── Stats Bar ─── */
function StatsBar({ cidadaos }: { cidadaos: number }) {
  const { ref, inView } = useInView()
  const stats = [
    { value: cidadaos, suffix: '+', label: 'Cidadãos registados', icon: Users },
    { value: COMMUNITY_STATS.reports, suffix: '', label: 'Reports enviados', icon: FileText },
    { value: COMMUNITY_STATS.resolvidos, suffix: '%', label: 'Taxa de resolução', icon: CheckCircle },
    { value: COMMUNITY_STATS.ecopontos, suffix: '', label: 'Ecopontos mapeados', icon: MapPin },
  ]
  return (
    <div
      ref={ref}
      className="w-full relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, #080c0b 0%, #0d1117 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <FluidCursorEffect />
      <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-10 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0">
        {stats.map((s, i) => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="flex flex-col items-center text-center px-6 md:border-r md:last:border-r-0"
              style={{
                borderColor: 'rgba(255,255,255,0.07)',
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(16px)',
                transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[var(--primary)]" />
              </div>
              <div className="text-3xl font-black text-white tabular-nums">
                {inView ? <Counter to={s.value} /> : '0'}{s.suffix}
              </div>
              <div className="text-xs mt-1 font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Como Funciona ─── */
function HowItWorks() {
  const { ref, inView } = useInView()
  return (
    <section id="como-funciona" className="w-full py-20 md:py-24">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-4 py-1.5">
            <span className="text-xs font-semibold tracking-widest text-[var(--primary)] uppercase">Em 3 passos simples</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Como funciona
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            Juntar-se ao ecoBairro e começar a fazer a diferença é mais simples do que parece.
          </p>
        </div>

        {/* Steps */}
        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden="true" />

          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <div
                key={step.num}
                className="flex flex-col items-center text-center gap-5 relative"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity 0.6s ease ${i * 0.18}s, transform 0.6s ease ${i * 0.18}s`,
                }}
              >
                {/* Number + icon */}
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center border border-[var(--primary)]/20"
                    style={{
                      background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--card)), var(--card))',
                      boxShadow: '0 8px 32px color-mix(in srgb, var(--primary) 12%, transparent)',
                    }}
                  >
                    <Icon className="w-8 h-8 text-[var(--primary)]" />
                  </div>
                  <span
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    {i + 1}
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── Features ─── */
function FeaturesSection() {
  const { ref, inView } = useInView()
  return (
    <section id="funcionalidades" className="w-full py-20 md:py-24">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="text-center mb-14 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-4 py-1.5">
            <span className="text-xs font-semibold tracking-widest text-[var(--primary)] uppercase">Plataforma completa</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Tudo o que precisas
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            Uma plataforma construída para cidadãos exigentes que querem ver resultados reais no seu bairro.
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-border/70 bg-card p-7 flex flex-col gap-5 hover:border-[var(--primary)]/30 hover:shadow-lg transition-all duration-300 overflow-hidden"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(32px)',
                  transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s, box-shadow 0.3s ease, border-color 0.3s ease`,
                }}
              >
                {/* Subtle gradient bg on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at top left, color-mix(in srgb, ${f.color} 6%, transparent), transparent 60%)` }}
                  aria-hidden="true"
                />

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${f.color} 14%, transparent)` }}
                >
                  <Icon className="w-6 h-6" style={{ color: f.color }} />
                </div>

                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-bold text-foreground leading-snug">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>

                <div
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full w-fit"
                  style={{
                    color: f.color,
                    backgroundColor: `color-mix(in srgb, ${f.color} 12%, transparent)`,
                  }}
                >
                  <Zap className="w-3 h-3" />
                  {f.highlight}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── Social Proof / Testimonials ─── */
function SocialProof({ cidadaos }: { cidadaos: number }) {
  const { ref, inView } = useInView()
  return (
    <section
      className="w-full py-20 md:py-28 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #080c0b 0%, #0d1117 50%, #0b0d1a 100%)',
      }}
    >
      {/* Efeito interativo de fumo */}
      <FluidCursorEffect />

      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, color-mix(in srgb, var(--primary) 10%, transparent) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="max-w-[1280px] mx-auto px-6 md:px-10 relative z-10">
        {/* Big number highlight */}
        <div className="text-center mb-16 space-y-4" ref={ref}>
          <div
            className="text-[6rem] md:text-[9rem] font-black leading-none text-transparent"
            style={{
              WebkitTextStroke: '1px color-mix(in srgb, var(--primary) 40%, transparent)',
              opacity: inView ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }}
          >
            {inView ? <Counter to={cidadaos} /> : '0'}+
          </div>
          <p className="text-xl md:text-2xl font-bold text-white">
            cidadãos já estão a mudar os seus bairros
          </p>
          <p className="text-white/40 max-w-sm mx-auto text-sm leading-relaxed">
            Junta-te a uma comunidade que acredita que a participação cidadã é a melhor ferramenta de mudança urbana.
          </p>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.name}
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                opacity: inView ? 1 : 0,
                transform: inView ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.6s ease ${0.2 + i * 0.15}s, transform 0.6s ease ${0.2 + i * 0.15}s`,
              }}
            >
              <div className="flex gap-1">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-white/70 text-sm leading-relaxed flex-1">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-white/8">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: `color-mix(in srgb, ${t.color} 25%, #1a1a2e)` }}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{t.name}</p>
                  <p className="text-white/35 text-xs mt-0.5">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Notícias ─── */
function NoticiasSection({ noticias }: { noticias?: HomeNoticia[] }) {
  const { ref, inView } = useInView()
  const [selectedNoticia, setSelectedNoticia] = useState<HomeNoticia | null>(null)
  const BADGE_COLORS: Record<string, string> = {
    Campanha: '#60a5fa',
    Novidade: 'oklch(0.55 0.18 150)',
    Evento: '#f59e0b',
    Relatório: '#a78bfa',
  }

  const items = noticias?.length ? noticias : MOCK_NOTICIAS.map(m => ({
    id: m.id,
    titulo: m.titulo,
    resumo: m.resumo,
    conteudo: m.resumo + '\n\n' + 'Para ler o conteúdo completo, crie uma conta no ecoBairro.',
    imagem_url: m.imagem,
    data: m.data,
    tempo_leitura: m.tempo_leitura,
    tag: m.categoria
  }))

  return (
    <section id="noticias" className="w-full py-20 md:py-24">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/8 px-4 py-1.5">
              <span className="text-xs font-semibold tracking-widest text-[var(--primary)] uppercase">Acontece agora</span>
            </div>
            <h2 className="text-4xl font-black text-foreground tracking-tight">
              Notícias e Campanhas
            </h2>
          </div>
          <Link
            to="/register"
            className="flex items-center gap-1.5 text-sm text-[var(--primary)] font-semibold hover:opacity-75 transition-opacity"
          >
            Criar conta para ler mais <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((n, i) => {
            const badgeColor = BADGE_COLORS[n.tag ?? 'Geral'] ?? '#8A93A4'
            return (
              <button
                key={n.id}
                onClick={() => setSelectedNoticia(n as HomeNoticia)}
                className="group block text-left"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(24px)',
                  transition: `opacity 0.6s ease ${i * 0.12}s, transform 0.6s ease ${i * 0.12}s`,
                }}
              >
                <article className="relative rounded-2xl overflow-hidden border border-border/70 bg-card hover:border-[var(--primary)]/30 hover:shadow-lg transition-all duration-300 h-full flex flex-col">
                  {/* Subtle gradient bg on hover (same as features section) */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10"
                    style={{ background: 'radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 6%, transparent), transparent 60%)' }}
                    aria-hidden="true"
                  />

                  {/* Image */}
                  <div className="h-44 w-full overflow-hidden relative bg-muted z-0">
                    <img
                      src={n.imagem_url}
                      alt={n.titulo}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                    {/* Category badge */}
                    <span
                      className="absolute top-3 left-3 text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: badgeColor }}
                    >
                      {n.tag ?? 'Geral'}
                    </span>
                  </div>

                  <div className="p-5 flex flex-col gap-2.5 flex-1">
                    <h3 className="font-bold text-sm text-foreground leading-snug group-hover:text-[var(--primary)] transition-colors line-clamp-2">
                      {n.titulo}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                      {n.resumo}
                    </p>
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground border-t border-border/50">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {n.data}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {n.tempo_leitura}
                      </span>
                    </div>
                  </div>
                </article>
              </button>
            )
          })}
        </div>
      </div>

      {/* Modal Popup */}
      {selectedNoticia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedNoticia(null)}>
          <div 
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl shadow-2xl border border-border/50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md transition-colors"
              onClick={() => setSelectedNoticia(null)}
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="w-full h-64 sm:h-80 relative shrink-0">
              <img src={selectedNoticia.imagem_url} alt={selectedNoticia.titulo} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6">
                <span className="inline-block px-3 py-1 mb-3 text-xs font-bold text-white rounded-full bg-primary/90">
                  {selectedNoticia.tag ?? 'Geral'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {selectedNoticia.titulo}
                </h2>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium border-b border-border/50 pb-4">
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {selectedNoticia.data}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {selectedNoticia.tempo_leitura}</span>
              </div>
              
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {selectedNoticia.conteudo || selectedNoticia.resumo}
              </div>

              <div className="pt-6 mt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm font-medium text-foreground">Gostou desta novidade? Junte-se a nós!</p>
                <Link to="/register" className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Criar Conta Gratuita
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ─── CTA Final ─── */
function CTASection() {
  const { ref, inView } = useInView()
  return (
    <section className="w-full py-20 md:py-24 px-6 md:px-10">
      <div className="max-w-[1280px] mx-auto">
        <div
          ref={ref}
          className="relative overflow-hidden rounded-3xl px-8 md:px-14 py-14 md:py-16 flex flex-col md:flex-row items-center justify-between gap-8"
          style={{
            background: 'linear-gradient(135deg, #0a2e1c 0%, #0d1a2e 50%, #130a2e 100%)',
            border: '1px solid rgba(255,255,255,0.07)',
            opacity: inView ? 1 : 0,
            transform: inView ? 'scale(1)' : 'scale(0.97)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          {/* Efeito interativo de fumo */}
          <FluidCursorEffect />

          {/* Blob decoration */}
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 15%, transparent) 0%, transparent 70%)', filter: 'blur(40px)' }}
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-16 left-20 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.10) 0%, transparent 70%)', filter: 'blur(30px)' }}
            aria-hidden="true"
          />

          <div className="relative z-10 space-y-3 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-[var(--primary)] text-xs font-semibold uppercase tracking-widest">Gratuito</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
              Começa hoje.<br />
              <span style={{ color: 'oklch(0.70 0.18 150)' }}>O seu bairro agradece.</span>
            </h2>
            <p className="text-white/45 text-sm leading-relaxed max-w-sm">
              Junta-te a mais de {COMMUNITY_STATS.cidadaos.toLocaleString('pt-PT')} cidadãos que já estão a fazer a diferença nas suas comunidades.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-3 shrink-0">
            <Button
              asChild
              className="gap-2 min-h-[52px] px-8 font-bold text-sm rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white"
              style={{ boxShadow: '0 0 36px color-mix(in srgb, var(--primary) 40%, transparent)' }}
            >
              <Link to="/register">
                <UserPlus className="w-4 h-4" />
                Criar conta gratuita
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="gap-2 min-h-[52px] px-8 font-semibold text-sm rounded-xl border-white/15 text-white hover:bg-white/8 bg-transparent"
            >
              <Link to="/login">
                <LogIn className="w-4 h-4" />
                Entrar
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer Público ─── */
export function PublicFooter() {
  const year = new Date().getFullYear()
  const { setIsSettingsOpen } = useCookieConsent()
  return (
    <footer className="w-full border-t border-border/60 bg-card">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/15 border border-[var(--primary)]/25 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-[var(--primary)]" />
              </div>
              <span className="text-foreground font-bold text-lg tracking-tight">
                eco<span className="text-[var(--primary)]">Bairro</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plataforma de cidadania ativa para uma cidade mais sustentável e participativa.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a href="mailto:ola@ecobairro.pt" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[var(--primary)] transition-colors">
                <Mail className="w-3.5 h-3.5" />
                ola@ecobairro.pt
              </a>
            </div>
          </div>

          {/* Links */}
          {[
            {
              title: 'Plataforma',
              links: [
                { label: 'Como funciona', href: '#como-funciona' },
                { label: 'Ecopontos', href: '#funcionalidades' },
                { label: 'Reportes', href: '#funcionalidades' },
                { label: 'Notícias', href: '#noticias' },
              ],
            },
            {
              title: 'Comunidade',
              links: [
                { label: 'Registar', href: '/register' },
                { label: 'Entrar', href: '/login' },
                { label: 'Quiz Semanal', href: '/login' },
                { label: 'Partilhas Locais', href: '/login' },
              ],
            },
            {
              title: 'Legal',
              links: [
                { label: 'Termos de Uso', href: '/termos' },
                { label: 'Privacidade', href: '/privacidade' },
                { label: 'Cookies', href: '#' },
                { label: 'Acessibilidade', href: '/acessibilidade' },
              ],
            },
          ].map((col) => (
            <div key={col.title} className="space-y-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.label === 'Cookies' ? (
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="text-sm text-muted-foreground hover:text-[var(--primary)] transition-colors cursor-pointer text-left"
                      >
                        {l.label}
                      </button>
                    ) : (
                      <a
                        href={l.href}
                        className="text-sm text-muted-foreground hover:text-[var(--primary)] transition-colors"
                      >
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {year} ecoBairro. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground">
            Feito em Portugal para cidadãos ativos
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ─── Section header helper (auth view) ─── */
function SectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: ElementType
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-[var(--primary)]" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  )
}

/* ─── Organic blob hero decoration (auth view) ─── */
function HeroBlob() {
  return (
    <div className="absolute right-0 top-0 h-full w-52 pointer-events-none overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 208 200" className="absolute right-0 top-0 h-full w-full text-[var(--primary)]" fill="none">
        <path d="M170 -30 Q230 50 190 115 Q150 180 90 162 Q30 144 48 82 Q66 20 130 -5 Q155 -18 170 -30Z" fill="currentColor" opacity="0.08" />
        <path d="M200 30 Q240 90 210 145 Q180 200 140 188 Q100 176 112 136 Q124 96 162 76 Q188 62 200 30Z" fill="currentColor" opacity="0.05" />
        <circle cx="195" cy="22" r="50" fill="currentColor" opacity="0.04" />
      </svg>
    </div>
  )
}

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-[var(--primary)] text-white shadow-xl hover:bg-[var(--primary)]/90 hover:scale-105 active:scale-95 transition-all duration-300"
      aria-label="Voltar ao topo"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  )
}

/* ─── Página ─── */
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ''}`} />
}

function HomePage() {
  const token = getAccessToken()
  const sessionUser = getUser()
  const greeting = getGreeting()
  const [feed, setFeed] = useState<HomeFeedResponse | null>(null)
  const [feedLoading, setFeedLoading] = useState(true)
  const [favToRemove, setFavToRemove] = useState<string | null>(null)
  const { ref: dragScrollRef, isDragging } = useDragScroll<HTMLDivElement>()
  
  // isGuest decidido pelo sessionStorage (síncrono no 1º render) — não pelo
  // feed que só chega depois do fetch resolver. Sem isto havia flash da
  // landing pública entre o mount e o setFeed.
  const isGuest = !token || !sessionUser || (sessionUser.role !== 'cidadao' && sessionUser.role !== 'admin')
  const userDisplayName = feed?.viewer?.nome ?? feed?.viewer?.email ?? sessionUser?.name ?? 'ecoBairro'
  const firstName = isGuest ? 'ecoBairro' : userDisplayName.split(' ')[0]

  useEffect(() => {
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const load = async () => {
      try {
        const data = await fetchJson<HomeFeedResponse>('/v1/home', {
          baseUrl: clientEnv.apiBaseUrl,
          headers,
        })
        setFeed(data)
      } catch {
        setFeed(null)
      } finally {
        setFeedLoading(false)
      }
    }

    void load()
  }, [token])

  async function handleRemoveFavorito(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    setFavToRemove(id)
  }

  async function confirmRemoveFavorito() {
    if (!favToRemove) return
    try {
      await removeFavorito(favToRemove)
      setFeed((prev) => prev ? { ...prev, ecopontos: prev.ecopontos.filter(x => x.id !== favToRemove) } : null)
    } catch (err) {
      console.error('Erro ao remover favorito:', err)
    } finally {
      setFavToRemove(null)
    }
  }

  const gamification = feed?.gamification ?? {
    nivel: 'Reciclador',
    pontos: 0,
    pontos_proximo: 500,
  }
  const pontosRestantes = Math.max(0, gamification.pontos_proximo - gamification.pontos)
  const progressoGamificacao = Math.round(
    (gamification.pontos / Math.max(gamification.pontos_proximo, 1)) * 100,
  )

  const reportStats = !isGuest && feed
    ? {
      ativos: feed.reports.ativos,
      resolvidos: feed.reports.resolvidos,
      total: feed.reports.total,
      progresso: feed.reports.progresso,
      proximoNivel: feed.reports.proximo_nivel,
    }
    : {
      ativos: 0,
      resolvidos: 0,
      total: 0,
      progresso: 0,
      proximoNivel: 'Reciclador Avançado',
    }

  const ecopontos = feed?.ecopontos ?? []
  const partilhas = feed?.partilhas ?? []
  const noticias = feed?.noticias ?? []
  const alertaCritico = feed?.alerta
  const impacto = feed?.impacto
  const cidadaosCount = feed?.impacto?.comunidade_pax || COMMUNITY_STATS.cidadaos

  /* ── Guest: landing page completa ── */
  if (isGuest) {
    return (
      <>
        <PublicNavbar />
        <GuestHero />
        <StatsBar cidadaos={cidadaosCount} />
        <HowItWorks />
        <FeaturesSection />
        <SocialProof cidadaos={cidadaosCount} />
        <NoticiasSection noticias={noticias} />
        <CTASection />
        <PublicFooter />
        <ScrollToTopButton />
      </>
    )
  }

  /* ── Authenticated view ── */
  return (
    <div className="flex w-full max-w-full flex-col gap-8 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">

      {/* ── Auth: banner com gamificação ── */}
      <Card
        className="relative overflow-hidden border-none shadow-sm"
        style={{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--primary) 10%, var(--card)) 0%, var(--card) 65%)' }}
      >
        <HeroBlob />
        <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
          {feedLoading ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 justify-between w-full">
              <div className="space-y-2 flex-1">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-8 w-48" />
                <SkeletonBlock className="h-4 w-64" />
              </div>
              <div className="flex flex-col gap-2 sm:items-end min-w-[200px]">
                <SkeletonBlock className="h-6 w-32" />
                <SkeletonBlock className="h-2 w-full" />
                <SkeletonBlock className="h-3 w-40" />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{greeting} 👋</p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Olá, <span className="text-[var(--primary)]">{firstName}</span>!
                </h1>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  Aqui está o resumo da sua atividade no ecoBairro.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end min-w-[200px]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[var(--primary)]/10 rounded-full px-2.5 py-1">
                    <Star className="w-3 h-3 text-[var(--primary)]" fill="currentColor" />
                    <span className="text-xs font-semibold text-[var(--primary)]">{gamification.nivel}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    <Counter to={gamification.pontos} /> pts
                  </span>
                </div>
                <Progress value={progressoGamificacao} className="h-2 w-full [&>div]:bg-[var(--primary)]" />
                <p className="text-[11px] text-muted-foreground">
                  Faltam <span className="font-semibold text-foreground">{pontosRestantes} pts</span> para{' '}
                  <span className="font-medium">{reportStats.proximoNivel}</span>
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Auth sections ── */}
      <>
        {/* ── 2. Atalhos Rápidos ── */}
        <div className="grid grid-cols-3 gap-3">
          {atalhos.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.label}
                to={a.to}
                search={a.search}
                className="flex flex-col items-center gap-3 p-5 rounded-xl bg-card border border-border hover:border-[var(--primary)]/40 hover:shadow-md transition-all active:scale-[0.97] cursor-pointer"
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--primary)]/10">
                  <Icon className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <span className="text-xs font-semibold text-foreground leading-tight text-center">{a.label}</span>
              </Link>
            )
          })}
        </div>

        {/* ── 3. Ecopontos Favoritos ── */}
        <section className="space-y-4">
          <SectionHeader
            icon={MapPin}
            title="Ecopontos Favoritos"
            action={
              <Link to="/mapa" className="flex items-center gap-1 text-xs text-[var(--primary)] font-medium hover:underline cursor-pointer">
                Ver mapa <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
          <div 
            ref={dragScrollRef}
            className={`flex overflow-x-auto hide-scrollbar gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 ${isDragging ? 'cursor-grabbing' : 'snap-x snap-mandatory cursor-grab'}`}
          >
            {feedLoading ? (
              // Skeleton de favoritos enquanto carrega
              [1,2,3].map(i => (
                <div key={i} className="w-[280px] sm:w-[320px] snap-start shrink-0">
                  <div className="rounded-xl border border-border/70 overflow-hidden bg-card h-[220px] flex flex-col">
                    <SkeletonBlock className="h-28 w-full rounded-none" />
                    <div className="p-4 space-y-3 flex-1">
                      <SkeletonBlock className="h-4 w-3/4" />
                      <SkeletonBlock className="h-3 w-1/2" />
                      <SkeletonBlock className="h-2 w-full mt-4" />
                    </div>
                  </div>
                </div>
              ))
            ) : ecopontos.length === 0 ? (
              // Estado vazio
              <div className="flex flex-col items-center justify-center gap-3 py-8 px-6 w-full text-center rounded-xl border border-dashed border-border">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Star className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sem favoritos ainda</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Adicione ecopontos ao mapa para os ver aqui</p>
                </div>
                <Link to="/mapa" className="text-xs font-medium text-[var(--primary)] flex items-center gap-1 hover:underline">
                  Ir ao mapa <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : null}
            {!feedLoading && ecopontos.map((eco) => {
              const state = ecoState(eco.ocupacao)
              const hasMapUrl = eco.map_url && eco.map_url !== 'undefined' && eco.map_url !== 'null' && eco.map_url.trim() !== ''
              const finalImage = hasMapUrl ? eco.map_url : getLocalStaticMapUrl(eco.lat, eco.lng, 16)

              return (
                <Link 
                  to="/mapa"
                  search={{ ecoponto: eco.id }}
                  key={eco.id} 
                  className="block w-[280px] sm:w-[320px] snap-start shrink-0 outline-none group select-none"
                  draggable={false}
                >
                  <Card className="h-full border border-border/70 shadow-sm rounded-xl hover:shadow-md hover:border-[var(--primary)]/40 transition-all cursor-pointer overflow-hidden flex flex-col bg-card">
                    
                    <div className="w-full h-28 relative overflow-hidden shrink-0 border-b border-border/50 flex items-center justify-center bg-[#f8f9fa] dark:bg-[#1a1c1e]">
                      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.08]" 
                           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M54.627 0l.83.83-29.35 29.35c-1.126 1.126-2.95 1.126-4.076 0-1.126-1.125-1.126-2.95 0-4.076L51.382 0h3.245zM14.545 0l-.83.83 29.35 29.35c1.126 1.126 2.95 1.126 4.076 0 1.126-1.125 1.126-2.95 0-4.076L17.79 0h-3.245zM0 14.545l.83-.83 29.35 29.35c1.126 1.126 1.126 2.95 0 4.076-1.125 1.126-2.95 1.126-4.076 0L0 17.79v-3.245zM0 54.627l.83-.83 29.35 29.35c1.126 1.126 1.126 2.95 0 4.076-1.125 1.126-2.95 1.126-4.076 0L0 57.872v-3.245z' fill='%23000000' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />
                      
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-foreground to-transparent" />
                      
                      {finalImage && (
                        <img 
                          draggable={false}
                          src={finalImage} 
                          alt="Mapa" 
                          className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-700 group-hover:scale-110" 
                          onError={(e) => { 
                            const osm = getLocalStaticMapUrl(eco.lat, eco.lng, 16);
                            if (osm && e.currentTarget.src !== osm) {
                              e.currentTarget.src = osm;
                            } else {
                              e.currentTarget.style.display = 'none';
                            }
                          }} 
                        />
                      )}
                      {!finalImage && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center">
                          <MapPin className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <button 
                        onClick={(e) => void handleRemoveFavorito(e, eco.id)}
                        className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-amber-400 transition-colors"
                        title="Remover dos favoritos"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </button>
                      <MapPin className="relative z-20 w-8 h-8 fill-red-500 text-white drop-shadow-md transition-transform duration-300 group-hover:-translate-y-1" strokeWidth={1.5} />
                    </div>

                    <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{eco.nome}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{eco.distancia}</span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center justify-center p-2 rounded-lg bg-muted/10 border shadow-sm transition-colors" style={{ borderColor: state.barColor, backgroundColor: `${state.color}10` }}>
                          <Recycle className="w-4 h-4" style={{ color: state.color }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${eco.ocupacao}%`, backgroundColor: state.barColor }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">{eco.ocupacao}% ocupado</span>
                          <span className="font-semibold" style={{ color: state.color }}>{state.label}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── 4. Alerta ecoponto crítico ── */}
        {alertaCritico && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{alertaCritico.nome}</p>
              <p className="text-xs text-muted-foreground">{alertaCritico.ocupacao}% ocupado — evite depositar resíduos por agora</p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0 border-amber-400/50 text-amber-600 bg-amber-50 dark:bg-amber-900/20">
              Atenção
            </Badge>
          </div>
        )}

        {/* ── 5. Impacto pessoal ── */}
        <section className="space-y-4">
          <SectionHeader icon={TrendingUp} title="O seu impacto este ano" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: 'Reciclagem',
                value: impacto?.reciclagem_kg ?? 0,
                unit: 'kg',
                icon: Recycle,
                color: 'oklch(0.55 0.18 150)',
                desc: 'a partir dos seus reports resolvidos',
              },
              {
                label: 'Comunidade',
                value: impacto?.comunidade_pax ?? 0,
                unit: 'pax',
                icon: Users,
                color: '#60a5fa',
                desc: 'cidadãos registados na plataforma',
              },
              {
                label: 'Ecossistema',
                value: impacto?.arvores_equivalentes ?? 0,
                unit: 'árvores',
                icon: Leaf,
                color: 'oklch(0.55 0.18 150)',
                desc: 'equivalente da sua atividade',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.label} className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</CardTitle>
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ backgroundColor: `color-mix(in srgb, ${item.color} 12%, transparent)` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground">
                      <Counter to={item.value} />{' '}
                      <span className="text-sm font-medium text-muted-foreground">{item.unit}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* ── 6. Resumo Reports ── */}
        <section className="space-y-4">
          <SectionHeader icon={FileText} title="Histórico de Reports" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Ativos', value: reportStats.ativos, icon: TrendingUp, color: '#fb923c', desc: 'Em aberto' },
              { label: 'Resolvidos', value: reportStats.resolvidos, icon: CheckCircle, color: 'oklch(0.55 0.18 150)', desc: 'Concluídos' },
              { label: 'Total', value: reportStats.total, icon: Package, color: '#8A93A4', desc: 'Enviados no total' },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <Card key={stat.label} className="border border-border/70 shadow-sm rounded-xl overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</CardTitle>
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg"
                      style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: stat.color }} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-foreground"><Counter to={stat.value} /></div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stat.desc}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <div className="bg-card border border-border/70 shadow-sm rounded-xl p-4 space-y-2">
            <Progress value={reportStats.progresso} className="h-2 [&>div]:bg-[var(--primary)]" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{reportStats.progresso}% para subir de nível</span>
              <span>
                Próximo nível:{' '}
                <span className="font-medium text-foreground">{reportStats.proximoNivel}</span>
              </span>
            </div>
          </div>
        </section>

        {/* ── 7. Partilhas Locais ── */}
        <section className="space-y-4">
          <SectionHeader
            icon={Package}
            title="Partilhas na sua zona"
            action={
              <Link
                to="/partilhas"
                className="flex items-center gap-1 text-xs text-[var(--primary)] font-medium hover:underline"
              >
                Ver todas <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            }
          />
          <div className="flex flex-col rounded-xl border border-border/70 bg-card overflow-hidden divide-y divide-border">
            {partilhas.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                {(p as any).imagem_url ? (
                  <img
                    src={(p as any).imagem_url}
                    alt={p.titulo}
                    className="w-9 h-9 rounded-lg object-cover shrink-0 border border-border/50"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.removeAttribute('style')
                    }}
                  />
                ) : null}
                <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0" style={(p as any).imagem_url ? { display: 'none' } : {}}>
                  <Package className="w-4 h-4 text-[var(--primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">{p.utilizador} · {p.zona}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </div>
            ))}
            <Link to="/partilhas" search={{ novo: '1' }} className="flex items-center justify-center gap-2 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group">
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-border group-hover:border-[var(--primary)]/50 flex items-center justify-center transition-colors shrink-0">
                <Gift className="w-4 h-4 text-muted-foreground group-hover:text-[var(--primary)] transition-colors" />
              </div>
              <span className="text-sm text-muted-foreground group-hover:text-[var(--primary)] transition-colors font-medium">
                Partilhar algo da minha casa
              </span>
            </Link>
          </div>
        </section>
      </>

      {/* ── 8. Notícias e Campanhas ── */}
      <section className="space-y-4">
        <SectionHeader
          icon={Newspaper}
          title="Notícias e Campanhas"
          action={
            <Link
              to="/noticias"
              className="flex items-center gap-1.5 text-sm text-[var(--primary)] font-semibold hover:opacity-75 transition-opacity"
            >
              Ver todas as notícias <ChevronRight className="w-4 h-4" />
            </Link>
          }
        />
        <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-3 pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3">
          {noticias.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="min-w-[272px] sm:min-w-0 snap-start shrink-0 cursor-pointer"
            >
              <Link to={"/noticia/" + n.id} className="block h-full">
                <Card className="h-full overflow-hidden shadow-sm border border-border/70 group rounded-xl bg-card relative">
                  <div className="h-36 w-full overflow-hidden bg-muted relative flex items-center justify-center">
                    {n.imagem_url ? (
                      <img
                        src={n.imagem_url}
                        alt={n.titulo}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <Newspaper className="w-8 h-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <CardContent className="p-4 space-y-1.5 relative z-10">
                    <p className="font-semibold text-sm text-foreground leading-snug group-hover:text-[var(--primary)] transition-colors">
                      {n.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.resumo}</p>
                    <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{n.data}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{n.tempo_leitura}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <ScrollToTopButton />

      {/* Fav Remove Modal */}
      {favToRemove && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Remover dos Favoritos?</h3>
              <p className="text-sm text-muted-foreground">
                Tem a certeza que deseja remover este ecoponto da sua lista de favoritos?
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={(e) => { e.stopPropagation(); setFavToRemove(null); }}
                  className="flex-1 px-4 py-2 border border-border text-foreground text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void confirmRemoveFavorito(); }}
                  className="flex-1 px-4 py-2 bg-destructive text-white text-sm font-medium rounded-lg hover:bg-destructive/90 transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
