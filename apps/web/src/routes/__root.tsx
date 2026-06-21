import { createRootRoute, Outlet, Link } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { MapPin } from 'lucide-react'

import { clientEnv } from '@/lib/env'
import { CookieConsentProvider } from '@/components/cookie-consent/CookieConsentProvider'
import { CookieBanner } from '@/components/cookie-consent/CookieBanner'

const GOOGLE_CLIENT_ID = clientEnv.googleClientId

function NotFound() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 px-4 text-center bg-[var(--background)]">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        <MapPin className="w-9 h-9" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h1 className="text-6xl font-bold text-[var(--foreground)]">404</h1>
        <p className="text-xl font-semibold text-[var(--foreground)]">Página não encontrada</p>
        <p className="text-[var(--muted-foreground)] max-w-sm">
          A página que procura não existe ou foi movida.
        </p>
      </div>
      <Link
        to="/home"
        className="px-6 py-2.5 rounded-[var(--radius-md)] bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Voltar ao início
      </Link>
    </div>
  )
}

export const Route = createRootRoute({
  notFoundComponent: NotFound,
  component: () => {
    const content = (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <CookieConsentProvider>
          <Outlet />
          <CookieBanner />
        </CookieConsentProvider>
      </ThemeProvider>
    )

    if (GOOGLE_CLIENT_ID) {
      return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{content}</GoogleOAuthProvider>
    }

    return content
  },
})
