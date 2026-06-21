interface LayoutFooterProps {
  children: React.ReactNode
}

const LayoutFooter = ({ children }: LayoutFooterProps) => {
  return (
    <div className='pointer-events-none w-full flex justify-center shrink-0'>
      <div
        style={{ width: 'calc(100% - 48px)' }}
        className='pointer-events-auto py-3 flex items-center justify-between flex-wrap gap-4 text-xs text-[var(--muted-foreground)]'
      >
        {children}
      </div>
    </div>
  )
}

export default LayoutFooter
