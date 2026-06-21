import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoProps {
  collapsed?: boolean
}

const Logo = ({ collapsed }: LogoProps) => {
  return (
    <div className='flex items-center min-h-[24px]'>
      <div className='flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--primary)]/10 shrink-0'>
        <Leaf className='w-5 h-5 text-[var(--primary)]' />
      </div>
      <span className={cn(
        'text-[1.25rem] font-semibold tracking-[0.15px] transition-[max-width,margin,opacity] duration-300 ease-in-out whitespace-nowrap overflow-hidden block',
        collapsed ? 'opacity-0 ml-0 max-w-0' : 'opacity-100 ml-2 max-w-[150px]',
      )}>
        <span className="text-[var(--foreground)]">eco</span>
        <span className="text-[var(--primary)]">Bairro</span>
      </span>
    </div>
  )
}

export default Logo
