import * as React from 'react';
import { useCookieConsent } from './CookieConsentProvider';
import { ShieldAlert } from 'lucide-react';

interface CookieIframeProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {
  fallbackText?: string;
}

export function CookieIframe({ src, fallbackText = "Conteúdo bloqueado", className, ...props }: CookieIframeProps) {
  const { preferences, setIsSettingsOpen } = useCookieConsent();
  const hasConsent = preferences?.marketing === true;

  if (hasConsent && src) {
    return <iframe src={src} className={className} {...props} />;
  }

  return (
    <div className={`flex flex-col items-center justify-center bg-muted text-muted-foreground border rounded-md p-6 text-center space-y-4 ${className}`}>
      <ShieldAlert className="w-8 h-8 opacity-50" />
      <div>
        <p className="font-medium">{fallbackText}</p>
        <p className="text-sm mt-1">Para visualizar este conteúdo, precisa de aceitar os cookies de Marketing & Redes Sociais.</p>
      </div>
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
      >
        Gerir Cookies
      </button>
    </div>
  );
}
