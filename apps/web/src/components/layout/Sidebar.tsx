import { Link, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  MapPin,
  FileText,
  Trash2,
  Bell,
  Users,
  HeartHandshake,
  Settings,
  BarChart3,
  Route,
  ShieldCheck,
  Leaf,
  ChevronLeft,
  Award,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { clearAuthSession, getAccessToken } from '@/lib/auth'
import { logoutRequest } from '@/lib/api/auth'
import type { UserRole, NavItem } from '@/types'

const navByRole: Record<UserRole, NavItem[]> = {
  cidadao: [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Mapa Ecopontos', href: '/mapa', icon: 'map' },
    { label: 'Meus Reportes', href: '/reportes', icon: 'file' },
    { label: 'Pedidos Recolha', href: '/recolhas', icon: 'trash' },
    { label: 'Notificações', href: '/notificacoes', icon: 'bell' },
  ],
  operador: [
    { label: 'Dashboard Operador', href: '/dashboard', icon: 'dashboard' },
    { label: 'Reportes', href: '/reportes', icon: 'file' },
    { label: 'Fila Prioridades', href: '/fila', icon: 'file' },
    { label: 'Mapa & Sensores', href: '/mapa-sensores', icon: 'map' },
    { label: 'Rotas', href: '/rotas', icon: 'route' },
    { label: 'Recolhas', href: '/recolhas', icon: 'trash' },
    { label: 'Zonas (auto)', href: '/zonas', icon: 'map' },
    { label: 'Export/KPIs', href: '/analytics', icon: 'chart' },
    { label: 'Campanhas', href: '/campanhas', icon: 'shield' },
  ],
  gestor: [
    { label: 'Dashboard Gestor', href: '/dashboard', icon: 'dashboard' },
    { label: 'Reportes', href: '/reportes', icon: 'file' },
    { label: 'Fila Prioridades', href: '/fila', icon: 'file' },
    { label: 'Ecopontos Prioritários', href: '/prioridades', icon: 'chart' },
    { label: 'Mapa & Sensores', href: '/mapa-sensores', icon: 'map' },
    { label: 'Rotas', href: '/rotas', icon: 'route' },
    { label: 'Recolhas', href: '/recolhas', icon: 'trash' },
    { label: 'Zonas (auto)', href: '/zonas', icon: 'map' },
    { label: 'Export/KPIs', href: '/analytics', icon: 'chart' },
    { label: 'Notícias', href: '/noticias', icon: 'bell' },
    { label: 'Campanhas', href: '/campanhas', icon: 'shield' },
    { label: 'Gestão Quiz', href: '/gestao-quiz', icon: 'award' },
    { label: 'Audit Log', href: '/audit', icon: 'shield' },
  ],
  admin: [
    { label: 'Centro Admin', href: '/admin', icon: 'settings' },
    { label: 'Gerir Perfis', href: '/utilizadores', icon: 'users' },
    { label: 'Gerir Ecopontos', href: '/ecopontos', icon: 'map' },
    { label: 'Ecopontos Prioritários', href: '/prioridades', icon: 'chart' },
    { label: 'Home Cidadão', href: '/home', icon: 'dashboard' },
    { label: 'Notícias', href: '/noticias', icon: 'bell' },
    { label: 'Mapa Cidadão', href: '/mapa', icon: 'map' },
    { label: 'Reportes Cidadão', href: '/reportes', icon: 'file' },
    { label: 'Monos e Entulhos', href: '/recolhas', icon: 'trash' },
    { label: 'Partilhas', href: '/partilhas', icon: 'handshake' },
    { label: 'Quiz e Pontos', href: '/quiz', icon: 'award' },
    { label: 'Gestão Quiz', href: '/gestao-quiz', icon: 'award' },
  ],
  guest: [
    { label: 'Home', href: '/home', icon: 'dashboard' },
  ],
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  map: MapPin,
  file: FileText,
  trash: Trash2,
  bell: Bell,
  handshake: HeartHandshake,
  users: Users,
  settings: Settings,
  chart: BarChart3,
  route: Route,
  shield: ShieldCheck,
  award: Award,
}

const roleLabels: Record<UserRole, string> = {
  cidadao: 'Cidadão',
  operador: 'Operador',
  gestor: 'Gestor',
  admin: 'Administrador',
  guest: 'Visitante',
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  role: UserRole
}

export function Sidebar({ collapsed, onToggle, role }: SidebarProps) {
  const router = useRouterState()
  const currentPath = router.location.pathname
  const navItems = navByRole[role] ?? navByRole.cidadao
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

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex border-b border-sidebar-border shrink-0 transition-all',
        collapsed ? 'flex-col items-center py-4 gap-4 h-auto' : 'items-center h-16 px-4 justify-between'
      )}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">ecoBairro</span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors shrink-0"
          title={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          <ChevronLeft className={cn("w-5 h-5 shrink-0 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <Badge variant="secondary" className="text-xs w-full justify-center">
            {roleLabels[role]}
          </Badge>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon] ?? LayoutDashboard
          const isActive = currentPath === item.href || (item.href !== '/dashboard' && currentPath.startsWith(item.href))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                collapsed ? 'justify-center w-[42px] h-[42px] mx-auto px-0' : '',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer / Definições + Logout */}
      <div className="p-3 mt-auto shrink-0 border-t border-sidebar-border">
        <div className={cn('flex', collapsed ? 'flex-col items-center gap-2' : 'gap-2')}>
          <Link
            to="/configuracoes"
            className={cn(
              'flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              currentPath.startsWith('/configuracoes')
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              collapsed ? 'justify-center w-[42px] h-[42px] mx-auto px-0' : 'flex-1',
            )}
            title="Definições"
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="truncate">Definições</span>}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'flex h-[42px] shrink-0 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
              collapsed ? 'w-[42px] mx-auto' : 'w-[42px]',
            )}
            title="Terminar sessão"
            aria-label="Terminar sessão"
          >
            <LogOut className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </div>
    </aside>
  )
}
