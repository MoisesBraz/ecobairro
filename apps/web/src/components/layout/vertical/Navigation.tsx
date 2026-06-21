import { useRef, useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Home, Newspaper, MapPin, FileText, Truck, HeartHandshake, Award,
  LayoutDashboard, ListOrdered, Route, Trash2, BarChart3, Map as MapIcon,
  FileSearch, Megaphone, ShieldCheck, Users, Radio, Settings, SlidersHorizontal, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Logo from '@/components/layout/shared/Logo'
import { clearAuthSession, getAccessToken } from '@/lib/auth'
import { logoutRequest } from '@/lib/api/auth'
import type { UserRole, NavItem } from '@/types'

/* ── Icon mapping ── */
const iconMap: Record<string, React.ElementType> = {
  home: Home,
  newspaper: Newspaper,
  map: MapPin,
  file: FileText,
  truck: Truck,
  handshake: HeartHandshake,
  award: Award,
  dashboard: LayoutDashboard,
  list: ListOrdered,
  route: Route,
  trash: Trash2,
  chart: BarChart3,
  map_alt: MapIcon,
  search: FileSearch,
  megaphone: Megaphone,
  shield: ShieldCheck,
  users: Users,
  sensor: Radio,
  settings: Settings,
  admin: SlidersHorizontal,
}

/* ── Collapse toggle SVG (same as reference theme NavCollapseIcons) ── */
const CollapseIcon = () => (
  <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' className='shrink-0'>
    <path d='M8.47365 11.7183C8.11707 12.0749 8.11707 12.6531 8.47365 13.0097L12.071 16.607C12.4615 16.9975 12.4615 17.6305 12.071 18.021C11.6805 18.4115 11.0475 18.4115 10.657 18.021L5.83009 13.1941C5.37164 12.7356 5.37164 11.9924 5.83009 11.5339L10.657 6.707C11.0475 6.31653 11.6805 6.31653 12.071 6.707C12.4615 7.09747 12.4615 7.73053 12.071 8.121L8.47365 11.7183Z' fill='currentColor' />
    <path d='M14.3584 11.8336C14.0654 12.1266 14.0654 12.6014 14.3584 12.8944L18.071 16.607C18.4615 16.9975 18.4615 17.6305 18.071 18.021C17.6805 18.4115 17.0475 18.4115 16.657 18.021L11.6819 13.0459C11.3053 12.6693 11.3053 12.0587 11.6819 11.6821L16.657 6.707C17.0475 6.31653 17.6805 6.31653 18.071 6.707C18.4615 7.09747 18.4615 7.73053 18.071 8.121L14.3584 11.8336Z' fill='currentColor' className='opacity-50' />
  </svg>
)

/* ── Nav data ── */
const navByRole: Record<UserRole, { section?: string; items: NavItem[] }[]> = {
  guest: [{
    items: [
      { label: 'Home', href: '/home', icon: 'home' },
    ],
  }],
  cidadao: [{
    items: [
      { label: 'Home', href: '/home', icon: 'home' },
      { label: 'Notícias e Eventos', href: '/noticias', icon: 'newspaper' },
      { label: 'Mapa de Ecopontos', href: '/mapa', icon: 'map' },
      { label: 'Os Meus Reportes', href: '/reportes', icon: 'file' },
      { label: 'Monos e Entulhos', href: '/recolhas', icon: 'truck' },
      { label: 'Partilhas Locais', href: '/partilhas', icon: 'handshake' },
      { label: 'Quiz e Pontos', href: '/quiz', icon: 'award' },
    ],
  }],
  operador: [{
    // O operador só vê/usa as rotas que lhe estão atribuídas.
    items: [
      { label: 'As Minhas Rotas', href: '/rotas', icon: 'route' },
    ],
  }],
  gestor: [
    {
      section: 'Gestão Operacional',
      items: [
        { label: 'Dashboard Gestor', href: '/dashboard', icon: 'dashboard' },
        { label: 'Análise Reportes', href: '/reportes', icon: 'search' },
        { label: 'Fila Prioridades', href: '/fila', icon: 'list' },
        { label: 'Mapa & Sensores', href: '/mapa-sensores', icon: 'map' },
        { label: 'Gestão de Rotas', href: '/rotas', icon: 'route' },
        { label: 'Gestão de Equipas', href: '/equipas', icon: 'users' },
        { label: 'Recolhas Monos', href: '/recolhas', icon: 'trash' },
        { label: 'Zonas (auto)', href: '/zonas', icon: 'map_alt' },
        { label: 'Export/KPIs', href: '/analytics', icon: 'chart' },
        { label: 'Notícias e Eventos', href: '/noticias', icon: 'newspaper' },
        { label: 'Campanhas Benefício', href: '/campanhas', icon: 'megaphone' },
      ],
    },
    {
      section: 'Auditoria',
      items: [
        { label: 'Auditoria e Logs', href: '/audit', icon: 'shield' },
      ],
    },
  ],
  admin: [
    {
      section: 'Administração',
      items: [
        { label: 'Centro Admin', href: '/admin', icon: 'admin' },
        { label: 'Gerir Perfis', href: '/utilizadores', icon: 'users' },
        { label: 'Gerir Ecopontos', href: '/ecopontos', icon: 'sensor' },
        { label: 'Gestão de Rotas', href: '/rotas', icon: 'route' },
        { label: 'Gestão de Equipas', href: '/equipas', icon: 'users' },
      ],
    },
    {
      section: 'Visão Cidadão',
      items: [
        { label: 'Home Cidadão', href: '/home', icon: 'home' },
        { label: 'Notícias e Eventos', href: '/noticias', icon: 'newspaper' },
        { label: 'Mapa de Ecopontos', href: '/mapa', icon: 'map' },
        { label: 'Reportes do Cidadão', href: '/reportes', icon: 'file' },
        { label: 'Monos e Entulhos', href: '/recolhas', icon: 'truck' },
        { label: 'Partilhas Locais', href: '/partilhas', icon: 'handshake' },
        { label: 'Quiz e Pontos', href: '/quiz', icon: 'award' },
      ],
    },
  ],
}

interface NavigationProps {
  collapsed: boolean
  onToggle: () => void
  role: UserRole
}

function Navigation({ collapsed, onToggle, role }: NavigationProps) {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const sections = navByRole[role] ?? navByRole.cidadao
  const shadowRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const logoHref =
    role === 'admin' ? '/admin'
    : role === 'cidadao' ? '/home'
    : role === 'operador' ? '/rotas'
    : '/dashboard'

  const handleLogout = async () => {
    try {
      const token = getAccessToken()
      if (token) await logoutRequest(token)
    } catch (err) {
      // Ignorar erro do servidor; limpar sessão local de qualquer forma
    } finally {
      clearAuthSession()
      window.location.assign('/login')
    }
  }
 
  const isExpanded = !collapsed || isHovered

  const scrollMenu = (e: React.UIEvent<HTMLDivElement>) => {
    const shadow = shadowRef.current
    if (!shadow) return
    if ((e.target as HTMLDivElement).scrollTop > 0) {
      shadow.classList.add('opacity-100')
      shadow.classList.remove('opacity-0')
    } else {
      shadow.classList.add('opacity-0')
      shadow.classList.remove('opacity-100')
    }
  }

  return (
    <aside 
      className={cn(
        'relative flex flex-col h-svh sticky top-0 bg-[var(--background)] border-r border-[var(--border)] transition-all duration-300 ease-in-out shrink-0 overflow-hidden',
        isExpanded ? 'w-[260px]' : 'w-[71px]',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* NavHeader — logo + collapse icon */}
      <div className={cn(
        'flex shrink-0 pt-[22px] pb-[6px] transition-all duration-300',
        isExpanded ? 'items-center justify-between pl-[23px] pr-4 h-[60px]' : 'items-center justify-center h-[60px]',
      )}>
        <div className={cn('flex items-center', !isExpanded && 'justify-center w-[42px] h-[42px] mx-auto w-full')}>
          <Link to={logoHref} className={cn('flex items-center h-full', !isExpanded && 'justify-center w-full')}>
            <Logo collapsed={!isExpanded} />
          </Link>
        </div>
        <button
          onClick={onToggle}
          className={cn(
            'text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-all duration-300 cursor-pointer',
            collapsed && 'rotate-180',
            collapsed && !isHovered ? 'opacity-0 max-w-0 overflow-hidden scale-50' : 'opacity-100 max-w-[24px] scale-100'
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
        >
          <CollapseIcon />
        </button>
      </div>

      {/* Shadow overlay on scroll */}
      <div
        ref={shadowRef}
        className='opacity-0 pointer-events-none absolute left-0 top-[60px] z-[2] w-full h-16 transition-opacity duration-150'
        style={{
          background: 'linear-gradient(var(--background) 5%, rgb(from var(--background) r g b / 0.85) 30%, rgb(from var(--background) r g b / 0.5) 65%, rgb(from var(--background) r g b / 0.3) 75%, transparent)',
        }}
      />

      {/* Scrollable menu */}
      <div
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden pb-4 transition-all duration-300',
          isExpanded ? 'px-4 pt-8' : 'px-3 pt-6'
        )}
        onScroll={scrollMenu}
      >
        <div className="flex flex-col w-full">
          {sections.map((section, si) => (
            <div key={si} className={cn(si > 0 && 'mt-[54px]')}>
              {section.section && isExpanded && (
                <p className='mb-2 px-1 text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--muted-foreground)] leading-[1.38] transition-opacity duration-300'>
                  {section.section}
                </p>
              )}
              {section.section && !isExpanded && (
                <div className='my-2 mx-auto w-[22px] h-px bg-[var(--border)]' />
              )}
              <ul className='space-y-1.5'>
                {section.items.map((item) => {
                  const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))
                  const Icon = iconMap[item.icon] || Home
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        title={!isExpanded ? item.label : undefined}
                        className={cn(
                          'flex items-center rounded-[var(--radius-md)] px-3 py-2 text-[0.9375rem] font-medium transition-all duration-200',
                          isExpanded ? 'gap-4' : 'gap-0',
                          isActive
                            ? 'bg-[var(--primary)] text-white shadow-[var(--shadow-primary-md)] [&>svg]:text-white [&>span]:text-white'
                            : 'text-[var(--foreground)]/70 hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
                          !isExpanded && 'justify-center px-0 w-[42px] h-[42px] mx-auto',
                        )}
                      >
                        <Icon className="w-[22px] h-[22px] shrink-0" strokeWidth={1.5} />
                        <span className={cn(
                          "transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden",
                          isExpanded ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0"
                        )}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Definições + Logout */}
      <div className={cn(
        'shrink-0 border-t border-[var(--border)] transition-all duration-300',
        isExpanded ? 'p-4' : 'p-3 py-4'
      )}>
        <div className={cn('flex', isExpanded ? 'gap-2' : 'flex-col gap-2 items-center')}>
          <Link
            to="/configuracoes"
            title={!isExpanded ? "Definições" : undefined}
            className={cn(
              'flex min-w-0 items-center rounded-[var(--radius-md)] px-3 py-2 text-[0.9375rem] font-medium transition-all duration-200',
              isExpanded ? 'flex-1 gap-4' : 'gap-0',
              currentPath.startsWith('/configuracoes')
                ? 'bg-[var(--primary)] text-white shadow-[var(--shadow-primary-md)] [&>svg]:text-white [&>span]:text-white'
                : 'text-[var(--foreground)]/70 hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
              !isExpanded && 'justify-center px-0 w-[42px] h-[42px] mx-auto'
            )}
          >
            <Settings className="w-[22px] h-[22px] shrink-0" strokeWidth={1.5} />
            <span className={cn(
              "transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden",
              isExpanded ? "opacity-100 max-w-[140px]" : "opacity-0 max-w-0"
            )}>
              Definições
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title="Terminar sessão"
            aria-label="Terminar sessão"
            className={cn(
              'flex h-[42px] shrink-0 items-center justify-center rounded-[var(--radius-md)] text-destructive transition-all duration-200 hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
              isExpanded ? 'w-[46px]' : 'w-[42px] mx-auto'
            )}
          >
            <LogOut className="w-[22px] h-[22px] shrink-0" strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Navigation
