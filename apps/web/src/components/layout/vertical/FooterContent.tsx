import { useState } from 'react'
import { useCookieConsent } from '@/components/cookie-consent/CookieConsentProvider'
import { LegalInfoModal } from '@/components/legal/LegalInfoModal'
import type { LegalDocument } from '@/components/legal/LegalInfoModal'

const FooterContent = () => {
  const { setIsSettingsOpen } = useCookieConsent()
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null)

  return (
    <>
      <span>© {new Date().getFullYear()} ecoBairro</span>
      <div className='hidden md:flex items-center gap-4'>
        <button onClick={() => setLegalDocument('terms')} className='text-[var(--primary)] hover:underline cursor-pointer'>Termos de Uso</button>
        <button onClick={() => setLegalDocument('privacy')} className='text-[var(--primary)] hover:underline cursor-pointer'>Privacidade</button>
        <button 
          onClick={() => setIsSettingsOpen(true)} 
          className='text-[var(--primary)] hover:underline cursor-pointer'
        >
          Cookies
        </button>
        <button onClick={() => setLegalDocument('accessibility')} className='text-[var(--primary)] hover:underline cursor-pointer'>Acessibilidade</button>
      </div>
      <LegalInfoModal
        document={legalDocument}
        onOpenChange={(open) => {
          if (!open) setLegalDocument(null)
        }}
      />
    </>
  )
}

export default FooterContent
