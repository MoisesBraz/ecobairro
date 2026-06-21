import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  defaultPreferences, 
  getCookiePreferences, 
  saveCookiePreferences, 
  initializeGoogleConsentMode 
} from '../../lib/cookie-consent';
import type { CookiePreferences } from '../../lib/cookie-consent';

interface CookieConsentContextType {
  preferences: CookiePreferences | null; // null means not answered yet
  hasAnswered: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (prefs: CookiePreferences) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Run on mount
    initializeGoogleConsentMode();
    const stored = getCookiePreferences();
    if (stored) {
      setPreferences(stored);
      setHasAnswered(true);
    }
  }, []);

  const acceptAll = () => {
    const all = { necessary: true, analytics: true, marketing: true, preferences: true };
    setPreferences(all);
    saveCookiePreferences(all);
    setHasAnswered(true);
    setIsSettingsOpen(false);
  };

  const rejectAll = () => {
    const min = { ...defaultPreferences };
    setPreferences(min);
    saveCookiePreferences(min);
    setHasAnswered(true);
    setIsSettingsOpen(false);
  };

  const saveCustomPreferences = (prefs: CookiePreferences) => {
    setPreferences(prefs);
    saveCookiePreferences(prefs);
    setHasAnswered(true);
    setIsSettingsOpen(false);
  };

  return (
    <CookieConsentContext.Provider value={{
      preferences,
      hasAnswered,
      acceptAll,
      rejectAll,
      savePreferences: saveCustomPreferences,
      isSettingsOpen,
      setIsSettingsOpen
    }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
}
