import { describe, it, expect, beforeEach } from 'vitest'
import {
  getUser,
  setAuthSession,
  clearAuthSession,
  getAccessToken,
} from '@/lib/auth'
import type { User } from '@/types'

const sampleUser: User = {
  id: 'u-1',
  name: 'Pedro Teste',
  email: 'pedro@test.pt',
  role: 'cidadao',
}

describe('auth — sessionStorage helpers', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  describe('getUser', () => {
    it('devolve null quando nao ha sessao', () => {
      expect(getUser()).toBeNull()
    })

    it('devolve o utilizador guardado', () => {
      sessionStorage.setItem('user', JSON.stringify(sampleUser))
      expect(getUser()).toEqual(sampleUser)
    })

    it('devolve null se o JSON estiver corrompido (sem crashar)', () => {
      sessionStorage.setItem('user', '{not valid json')
      expect(getUser()).toBeNull()
    })
  })

  describe('getAccessToken', () => {
    it('devolve null quando nao ha token', () => {
      expect(getAccessToken()).toBeNull()
    })

    it('devolve o token guardado', () => {
      sessionStorage.setItem('access_token', 'jwt.abc.123')
      expect(getAccessToken()).toBe('jwt.abc.123')
    })
  })

  describe('setAuthSession', () => {
    it('grava user + access_token + refresh_token em sessionStorage', () => {
      setAuthSession({
        user: sampleUser,
        accessToken: 'acc-1',
        refreshToken: 'ref-1',
      })
      expect(sessionStorage.getItem('access_token')).toBe('acc-1')
      expect(sessionStorage.getItem('refresh_token')).toBe('ref-1')
      expect(JSON.parse(sessionStorage.getItem('user')!)).toEqual(sampleUser)
    })
  })

  describe('clearAuthSession', () => {
    it('remove os 3 itens (user, access_token, refresh_token)', () => {
      sessionStorage.setItem('user', JSON.stringify(sampleUser))
      sessionStorage.setItem('access_token', 'acc')
      sessionStorage.setItem('refresh_token', 'ref')
      sessionStorage.setItem('outro_qualquer', 'fica')

      clearAuthSession()

      expect(sessionStorage.getItem('user')).toBeNull()
      expect(sessionStorage.getItem('access_token')).toBeNull()
      expect(sessionStorage.getItem('refresh_token')).toBeNull()
      // nao limpa items nao-auth (defesa contra side effects)
      expect(sessionStorage.getItem('outro_qualquer')).toBe('fica')
    })

    it('e idempotente (chamar 2x nao crasha)', () => {
      clearAuthSession()
      expect(() => clearAuthSession()).not.toThrow()
    })
  })
})
