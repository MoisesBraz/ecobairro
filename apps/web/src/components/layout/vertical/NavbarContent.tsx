import { useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useNavigate } from '@tanstack/react-router'
import { Sun, Moon, Monitor, Menu, User as UserIcon, Settings, LogOut } from 'lucide-react'
import type { User } from '@/types'
import { clearAuthSession } from '@/lib/auth'

/* ── ModeDropdown ── */
function ModeDropdown() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div className='relative' ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className='flex items-center justify-center w-9 h-9 rounded-full text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors'
        aria-label='Tema'
      >
        {theme === 'dark' ? <Moon className="w-5 h-5" /> : theme === 'light' ? <Sun className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
      </button>
      {open && (
        <>
          <div className='fixed inset-0 z-[1500]' onClick={() => setOpen(false)} />
          <div className='absolute left-0 top-11 z-[1510] min-w-[160px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-lg py-1'>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setTheme(m); setOpen(false) }}
                className={`flex items-center gap-3 w-full px-4 py-2 text-sm capitalize transition-colors
                  ${theme === m ? 'text-[var(--primary)] bg-[var(--accent)]' : 'text-[var(--foreground)] hover:bg-[var(--muted)]'}`}
              >
                {m === 'light' ? <Sun className="w-4 h-4" /> : m === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                {m === 'light' ? 'Claro' : m === 'dark' ? 'Escuro' : 'Sistema'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── UserDropdown ── */
function UserDropdown({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  // TODO (Backend):
  // Esta lógica de identificação do "Visitante" (Guest) é atualmente um placeholder visual (mock)
  // baseado no email "demo@eco.pt".
  // Quando a integração com a API estiver pronta, esta flag deverá ser derivada diretamente 
  // do payload de autenticação. Por exemplo: `const isGuest = user.role === 'guest'` ou 
  // caso o JWT/Sessão não exista.
  const isGuest = user.role === 'cidadao' && user.email === 'demo@eco.pt'
  const initials = user.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  const handleLogout = () => {
    clearAuthSession()
    navigate({ to: '/login' })
  }

  const handleLogin = () => {
    navigate({ to: '/login' })
  }

  return (
    <div className='relative ms-2'>
      {/* Avatar with green online badge */}
      <button 
        className='relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-full' 
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Menu do utilizador"
      >
        <div className='flex items-center justify-center w-[38px] h-[38px] rounded-full bg-[var(--primary)] text-white text-sm font-semibold select-none'>
          {initials}
        </div>
        {!isGuest && <span className='absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 ring-2 ring-[var(--card)]' />}
      </button>

      {open && (
        <>
          <div className='fixed inset-0 z-[1500]' onClick={() => setOpen(false)} aria-hidden="true" />
          <div className='absolute right-0 top-12 z-[1510] min-w-[240px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-lg'>
            {/* User info */}
            <div className='flex items-center gap-3 px-4 py-3'>
              <div className='flex items-center justify-center w-10 h-10 rounded-full bg-[var(--primary)] text-white text-sm font-semibold shrink-0'>
                {initials}
              </div>
              <div>
                <p className='text-sm font-semibold text-[var(--foreground)]'>{isGuest ? 'Visitante' : user.name}</p>
                <p className='text-xs text-[var(--muted-foreground)]'>{isGuest ? 'Sem conta ativa' : user.email}</p>
              </div>
            </div>
            
            {!isGuest && (
              <>
                <div className='h-px bg-[var(--border)]' />
                <div className='py-1'>
                  <button
                    onClick={() => { setOpen(false); navigate({ to: '/configuracoes' }) }}
                    className='flex items-center gap-3 w-full px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors'
                  >
                    <UserIcon className='w-4 h-4' /> Perfil
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate({ to: '/configuracoes' }) }}
                    className='flex items-center gap-3 w-full px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors'
                  >
                    <Settings className='w-4 h-4' /> Definições
                  </button>
                </div>
              </>
            )}

            <div className='h-px bg-[var(--border)]' />
            <div className='p-2'>
              {isGuest ? (
                <button
                  onClick={handleLogin}
                  className='flex items-center justify-center gap-2 w-full px-4 py-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity'
                >
                  Fazer Login <UserIcon className='w-4 h-4' />
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className='flex items-center justify-center gap-2 w-full px-4 py-1.5 rounded-[var(--radius-md)] bg-[var(--destructive)] text-white text-sm font-medium hover:opacity-90 transition-opacity'
                >
                  Terminar sessão <LogOut className='w-4 h-4' />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── NavbarContent ── */
interface NavbarContentProps {
  user: User
  onMenuToggle?: () => void
}

const NavbarContent = ({ user, onMenuToggle }: NavbarContentProps) => {
  const navigate = useNavigate()
  // TODO (Backend): Mesma lógica de mock para visitante que usamos acima
  const isGuest = user.role === 'guest' || (user.role === 'cidadao' && user.email === 'demo@eco.pt')

  return (
    <div className='flex items-center justify-between gap-4 w-full'>
      {/* Left — hamburger only on mobile */}
      <div className='flex items-center'>
        <button
          onClick={onMenuToggle}
          className='flex md:hidden items-center justify-center w-9 h-9 rounded-full text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors'
          aria-label='Menu'
        >
          <Menu className='w-5 h-5' />
        </button>
      </div>

      {/* Right — mode + user/auth */}
      <div className='flex items-center gap-2 ml-auto'>
        <ModeDropdown />
        
        {isGuest ? (
          <div className="flex items-center gap-2 ml-2">
            <button 
              onClick={() => navigate({ to: '/register' })}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] rounded-[var(--radius-md)] transition-colors hidden sm:block"
            >
              Criar conta
            </button>
            <button 
              onClick={() => navigate({ to: '/login' })}
              className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white hover:opacity-90 rounded-[var(--radius-md)] transition-opacity"
            >
              Login
            </button>
          </div>
        ) : (
          <UserDropdown user={user} />
        )}
      </div>
    </div>
  )
}

export default NavbarContent
