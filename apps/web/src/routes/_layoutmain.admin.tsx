import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Award,
  BarChart3,
  ClipboardCheck,
  FileSearch,
  Gift,
  ListOrdered,
  Map,
  Megaphone,
  Newspaper,
  Radio,
  Route as RouteIcon,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireRole } from '@/lib/auth'

export const Route = createFileRoute('/_layoutmain/admin')({
  beforeLoad: requireRole(['admin']),
  component: AdminConsolePage,
})

const operationalAreas = [
  {
    title: 'Triagem e reportes',
    href: '/reportes',
    icon: FileSearch,
    scope: 'RF-08, RF-10, RF-11, RF-12',
    summary: 'Listagem operacional, filtros por estado, detalhe, evolução de estado e acompanhamento por zona.',
    status: 'Ligado',
  },
  {
    title: 'Fila de prioridades',
    href: '/fila',
    icon: ListOrdered,
    scope: 'RF-05',
    summary: 'Tarefas ordenadas por criticidade, atribuição a gestor e fecho operacional.',
    status: 'Ligado',
  },
  {
    title: 'Recolhas de monos',
    href: '/recolhas',
    icon: Trash2,
    scope: 'RF-14',
    summary: 'Gestão de pedidos, estados de agendamento, conclusão e histórico de intervenção.',
    status: 'Ligado',
  },
  {
    title: 'Rotas operacionais',
    href: '/rotas',
    icon: RouteIcon,
    scope: 'RF-05',
    summary: 'Sugestões de rota, aceitação, execução e marcação de ecopontos visitados.',
    status: 'Ligado',
  },
] as const

const territoryAreas = [
  {
    title: 'Parque de ecopontos',
    href: '/ecopontos',
    icon: Radio,
    scope: 'E6-E10',
    summary: 'Catálogo, tipologias, localização, acessibilidade, sensor associado e estado operacional.',
    status: 'Ligado',
  },
  {
    title: 'Zonas',
    href: '/zonas',
    icon: Map,
    scope: 'Z6-Z14',
    summary: 'Gestão territorial, parâmetros anti-spam, limiares de alerta e zonas prioritárias IoT.',
    status: 'Ligado',
  },
  {
    title: 'Mapa e sensores',
    href: '/mapa-sensores',
    icon: ClipboardCheck,
    scope: 'D1-D11, OP2',
    summary: 'Leituras, disponibilidade de sensores, alertas e visão espacial para equipas de operação.',
    status: 'Ligado',
  },
] as const

const governanceAreas = [
  {
    title: 'Utilizadores e perfis',
    href: '/utilizadores',
    icon: Users,
    scope: 'Gestor/Admin',
    summary: 'Controlo de utilizadores, perfis operacionais e estado de acesso.',
    status: 'Ligado',
  },
  {
    title: 'Analytics',
    href: '/kpis',
    icon: BarChart3,
    scope: 'RF-23',
    summary: 'KPIs por zona, resolução, volume de reports, atividade e indicadores de território.',
    status: 'Ligado',
  },
  {
    title: 'Auditoria',
    href: '/audit',
    icon: ShieldCheck,
    scope: 'Audit log',
    summary: 'Rastreio de ações administrativas, alterações críticas e exportação de evidência.',
    status: 'Ligado',
  },
] as const

const contentAreas = [
  {
    title: 'Mensagens institucionais',
    href: '/campanhas',
    icon: Megaphone,
    scope: 'RF-17, RF-21',
    summary: 'Rascunhos, publicação, validade temporal e comunicação segmentada por zona.',
    status: 'Ligado',
  },
  {
    title: 'Notícias e eventos',
    href: '/noticias',
    icon: Newspaper,
    scope: 'Comunicação',
    summary: 'Conteúdos públicos e informação editorial para cidadãos.',
    status: 'Ligado',
  },
  {
    title: 'Partilhas e gamificação',
    href: '/partilhas',
    icon: Gift,
    scope: 'RF-15, RF-18-RF-20',
    summary: 'Moderação comunitária, partilhas locais, badges, quiz e mecanismos de participação.',
    status: 'A consolidar',
  },
  {
    title: 'Gestão de Quiz',
    href: '/gestao-quiz',
    icon: Award,
    scope: 'RF-19',
    summary: 'Banco de perguntas do quiz: criar, editar e remover perguntas e opções (gestor/admin).',
    status: 'Ligado',
  },
] as const

const sections = [
  { title: 'Operação Diária', items: operationalAreas },
  { title: 'Território e IoT', items: territoryAreas },
  { title: 'Administração e Evidência', items: governanceAreas },
  { title: 'Comunicação e Comunidade', items: contentAreas },
] as const

function AdminConsolePage() {
  const totalAreas = sections.reduce((acc, section) => acc + section.items.length, 0)
  const readyAreas = sections.reduce(
    (acc, section) => acc + section.items.filter((item) => item.status === 'Ligado').length,
    0,
  )

  return (
    <div className="flex w-full max-w-full flex-col gap-8 pb-12 md:w-[calc(100%_+_(var(--layout-padding)/2))] md:max-w-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-[var(--primary)]">
            <SlidersHorizontal className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-[0.16em]">Backoffice ecoBairro</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Centro Admin</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Consola de entrada para operação, território, comunicação, auditoria e administração da plataforma.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
          <Card className="border border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Áreas</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{totalAreas}</p>
            </CardContent>
          </Card>
          <Card className="border border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Operacionais</p>
              <p className="mt-1 text-2xl font-bold text-[var(--primary)]">{readyAreas}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">{section.title}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {section.items.map((item) => {
              const Icon = item.icon
              const isReady = item.status === 'Ligado'

              return (
                <Link key={item.href} to={item.href} className="group block h-full">
                  <Card className="h-full border border-border/70 shadow-sm transition-all group-hover:border-[var(--primary)]/45 group-hover:shadow-md">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-5">{item.title}</CardTitle>
                          <p className="mt-1 text-[11px] text-muted-foreground">{item.scope}</p>
                        </div>
                      </div>
                      <Badge variant={isReady ? 'secondary' : 'outline'} className="shrink-0">
                        {item.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs leading-5 text-muted-foreground">{item.summary}</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
