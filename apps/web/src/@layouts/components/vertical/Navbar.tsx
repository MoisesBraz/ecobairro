import { useEffect, useRef, useState } from 'react'

interface LayoutNavbarProps {
  children: React.ReactNode
}

const LayoutNavbar = ({ children }: LayoutNavbarProps) => {
  const [scrolled, setScrolled] = useState(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const el = document.getElementById('layout-main')
    if (!el) return
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => setScrolled(el.scrollTop > 0))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div className='sticky top-0 z-40 flex justify-center w-full pointer-events-none shrink-0 pt-4'>
      <div
        style={{ width: 'calc(100% - 48px)', maxWidth: 'calc(1440px - 48px)' }}
        className={[
          'pointer-events-auto flex items-center min-h-16 py-3 px-6',
          'rounded-[var(--radius-lg)]',
          'transition-[box-shadow,backdrop-filter,background-color] duration-200',
          scrolled
            ? 'shadow-lg backdrop-blur-[9px] bg-[var(--card)]/85'
            : 'bg-[var(--card)] shadow-xs',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}

export default LayoutNavbar
