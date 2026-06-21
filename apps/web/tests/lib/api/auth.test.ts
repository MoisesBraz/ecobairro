import { describe, it, expect } from 'vitest'
import { toUiRole } from '@/lib/api/auth'

describe('toUiRole (backend → frontend role mapping)', () => {
  it('CIDADAO → cidadao', () => {
    expect(toUiRole('CIDADAO')).toBe('cidadao')
  })

  it('OPERADOR → operador', () => {
    expect(toUiRole('OPERADOR')).toBe('operador')
  })
  it('GESTOR → gestor', () => {
    expect(toUiRole('GESTOR')).toBe('gestor')
  })

  it('ADMIN → admin', () => {
    expect(toUiRole('ADMIN')).toBe('admin')
  })

  it('role desconhecido cai para guest (defesa)', () => {
    expect(toUiRole('UNKNOWN_ROLE' as never)).toBe('guest')
  })
})
