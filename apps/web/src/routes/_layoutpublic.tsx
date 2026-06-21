import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import VerticalLayout from '@/@layouts/VerticalLayout'
import Navigation from '@/components/layout/vertical/Navigation'
import Navbar from '@/components/layout/vertical/Navbar'
import Footer from '@/components/layout/vertical/Footer'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getUser } from '@/lib/auth'
import type { User } from '@/types'

export const Route = createFileRoute('/_layoutpublic')({
  beforeLoad: () => {
    // Para rotas públicas, se não houver sessão, criamos um utilizador mock "guest"
    // para que a Navbar e a Sidebar funcionem sem crashar.
    const user = getUser() || { id: 'guest', name: 'Visitante', email: 'guest@eco.pt', role: 'guest' } as User
    return { user }
  },
  component: PublicLayoutRoute,
})

function PublicLayoutRoute() {
  const { user } = Route.useRouteContext() as { user: User }
  const isGuest = user.role === 'guest'

  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Guest: full-bleed — each page controls its own layout/padding
  if (isGuest) {
    return (
      <div className="force-light min-h-svh overflow-y-auto bg-background">
        <Outlet />
      </div>
    )
  }

  return (
    <>
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
