import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import VerticalLayout from '@/@layouts/VerticalLayout'
import Navigation from '@/components/layout/vertical/Navigation'
import Navbar from '@/components/layout/vertical/Navbar'
import Footer from '@/components/layout/vertical/Footer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { isOperadorAllowedPath, requireAuth } from '@/lib/auth'
import { AlertTriangle } from 'lucide-react'
import type { User } from '@/types'

function DashboardError({ error }: { error: Error }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
        <AlertTriangle className="w-7 h-7" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Algo correu mal</h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm">{error.message}</p>
      </div>
      <button
        onClick={() => router.invalidate()}
        className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Tentar novamente
      </button>
    </div>
  )
}

export const Route = createFileRoute('/_layoutmain')({
  // Corre ANTES dos beforeLoad dos filhos → garante a restrição do operador
  // mesmo em páginas que só validam autenticação (sem requireRole).
  beforeLoad: ({ location }) => {
    const { user } = requireAuth()
    if (user.role === 'operador' && !isOperadorAllowedPath(location.pathname)) {
      throw redirect({ to: '/rotas' })
    }
    return { user }
  },
  errorComponent: DashboardError,
  component: DashboardRoute,
})

function DashboardRoute() {
  const { user } = Route.useRouteContext() as { user: User }

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Skip link a11y — visível apenas com Tab */}
      <a
        href="#layout-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-[var(--primary)] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Ir para o conteúdo principal
      </a>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side='left' className='p-0 w-[260px]'>
          <SheetHeader className='sr-only'><SheetTitle>Menu</SheetTitle></SheetHeader>
          <Navigation collapsed={false} onToggle={() => setMobileOpen(false)} role={user.role} />
        </SheetContent>
      </Sheet>

      <VerticalLayout
        navigation={
          <div className='hidden md:flex'>
            <Navigation collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} role={user.role} />
          </div>
        }
        navbar={<Navbar user={user} onMenuToggle={() => setMobileOpen(true)} />}
        footer={<Footer />}
      >
        <Outlet />
      </VerticalLayout>
    </>
  )
}
