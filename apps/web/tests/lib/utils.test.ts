import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn (class merger)', () => {
  it('junta strings simples com espacos', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('ignora valores falsy (null, undefined, false)', () => {
    expect(cn('a', null, undefined, false, 'b')).toBe('a b')
  })

  it('expande arrays e objectos (clsx)', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c')
  })

  it('faz dedupe de classes Tailwind conflituantes (twMerge)', () => {
    // px-2 e px-4 conflitam — twMerge mantem a ultima
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('preserva variantes nao conflituantes', () => {
    const result = cn('p-4', 'hover:bg-red-500', 'p-2')
    // p-4 e p-2 conflitam, hover:bg-red-500 fica
    expect(result).toContain('p-2')
    expect(result).toContain('hover:bg-red-500')
    expect(result).not.toContain('p-4 ')
  })
})
