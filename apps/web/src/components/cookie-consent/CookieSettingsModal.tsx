import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { X } from 'lucide-react';
import { useCookieConsent } from './CookieConsentProvider';
import { defaultPreferences } from '../../lib/cookie-consent';
import type { CookiePreferences } from '../../lib/cookie-consent';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={`peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input ${className}`}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0`}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export function CookieSettingsModal() {
  const { isSettingsOpen, setIsSettingsOpen, preferences, savePreferences } = useCookieConsent();
  
  const [localPrefs, setLocalPrefs] = React.useState<CookiePreferences>(
    preferences || defaultPreferences
  );

  React.useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences, isSettingsOpen]);

  const handleSave = () => {
    savePreferences(localPrefs);
  };

  return (
    <Dialog.Root open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-[110] grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
              Preferências de Cookies
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              Faça a gestão das suas preferências de cookies. Algumas funções do site podem não funcionar corretamente sem determinados cookies.
            </Dialog.Description>
          </div>

          <div className="py-4 space-y-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex flex-col space-y-1">
                <span className="font-medium text-sm">Estritamente Necessários</span>
                <span className="text-sm text-muted-foreground">
                  Estes cookies são necessários para o funcionamento do website e não podem ser desativados.
                </span>
              </div>
              <Switch checked={true} disabled />
            </div>

            <div className="flex items-center justify-between space-x-4">
              <div className="flex flex-col space-y-1">
                <span className="font-medium text-sm">Analíticos</span>
                <span className="text-sm text-muted-foreground">
                  Permitem-nos contar visitas e fontes de tráfego para que possamos medir e melhorar o desempenho do nosso site (ex: Google Analytics).
                </span>
              </div>
              <Switch 
                checked={localPrefs.analytics} 
                onCheckedChange={(c) => setLocalPrefs(p => ({ ...p, analytics: c }))} 
              />
            </div>

            <div className="flex items-center justify-between space-x-4">
              <div className="flex flex-col space-y-1">
                <span className="font-medium text-sm">Marketing & Redes Sociais</span>
                <span className="text-sm text-muted-foreground">
                  Usados para apresentar anúncios relevantes para si noutros sites, ou permitir carregar conteúdos de redes sociais (ex: vídeos embebidos).
                </span>
              </div>
              <Switch 
                checked={localPrefs.marketing} 
                onCheckedChange={(c) => setLocalPrefs(p => ({ ...p, marketing: c }))} 
              />
            </div>
            
            <div className="flex items-center justify-between space-x-4">
              <div className="flex flex-col space-y-1">
                <span className="font-medium text-sm">Preferências</span>
                <span className="text-sm text-muted-foreground">
                  Permitem ao site recordar escolhas que fez no passado, como o idioma preferido.
                </span>
              </div>
              <Switch 
                checked={localPrefs.preferences} 
                onCheckedChange={(c) => setLocalPrefs(p => ({ ...p, preferences: c }))} 
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <button
              className="mt-2 sm:mt-0 px-4 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
              onClick={() => setIsSettingsOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              onClick={handleSave}
            >
              Guardar Preferências
            </button>
          </div>
          
          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
