import { useCookieConsent } from '@/components/cookie-consent/CookieConsentProvider'

const FooterContent = () => {
  const { setIsSettingsOpen } = useCookieConsent()

  return (
    <>
      <span>© {new Date().getFullYear()} ecoBairro</span>
      <div className='hidden md:flex items-center gap-4'>
        <a href='#' className='text-[var(--primary)] hover:underline'>Licença</a>
        <a href='#' className='text-[var(--primary)] hover:underline'>Suporte</a>
        <a href='#' className='text-[var(--primary)] hover:underline'>Documentação</a>
        <button 
          onClick={() => setIsSettingsOpen(true)} 
          className='text-[var(--primary)] hover:underline cursor-pointer'
        >
          Gerir Cookies
        </button>
      </div>
    </>
  )
}

export default FooterContent
