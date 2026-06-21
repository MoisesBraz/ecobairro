import { useCookieConsent } from './CookieConsentProvider';
import { CookieSettingsModal } from './CookieSettingsModal';

export function CookieBanner() {
  const { hasAnswered, acceptAll, rejectAll, setIsSettingsOpen } = useCookieConsent();

  if (hasAnswered) return <CookieSettingsModal />;

  return (
    <>
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[100] pointer-events-none flex justify-end">
        <div className="pointer-events-auto max-w-[340px] w-full bg-background/95 backdrop-blur-sm border shadow-xl rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="space-y-1.5">
            <h3 className="font-semibold text-sm flex items-center gap-2">🍪 Uso de Cookies</h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Utilizamos cookies para personalizar conteúdo e analisar o tráfego. Ao aceitar, concorda com a nossa política.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full shrink-0">
            <button 
              onClick={acceptAll}
              className="col-span-2 px-3 py-2 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
            >
              Aceitar Todos
            </button>
            <button 
              onClick={rejectAll}
              className="px-3 py-2 text-[12px] font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
            >
              Rejeitar
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="px-3 py-2 text-[12px] font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
            >
              Personalizar
            </button>
          </div>
        </div>
      </div>
      <CookieSettingsModal />
    </>
  );
}
