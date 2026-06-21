interface VerticalLayoutProps {
  navigation?: React.ReactNode
  navbar?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}

const VerticalLayout = ({ navigation, navbar, footer, children }: VerticalLayoutProps) => {
  return (
    <div className='flex h-svh overflow-hidden'>
      {navigation ?? null}

      <div className='flex flex-col flex-1 min-w-0 relative'>
        {navbar ?? null}

        <main
          id='layout-main'
          className='flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col'
        >
          <div className='flex-1 w-full max-w-[1440px] mx-auto p-[var(--layout-padding)]'>
            {children}
          </div>

          <div className='w-full max-w-[1440px] mx-auto'>
            {footer ?? null}
          </div>
        </main>
      </div>
    </div>
  )
}

export default VerticalLayout
