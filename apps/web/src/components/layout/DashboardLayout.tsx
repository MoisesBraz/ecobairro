import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { User } from '@/types'

interface DashboardLayoutProps {
  children: React.ReactNode
  user: User
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} role={user.role} />
      </div>

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-60">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="h-full">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} role={user.role} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar user={user} showMenuButton onMenuToggle={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
