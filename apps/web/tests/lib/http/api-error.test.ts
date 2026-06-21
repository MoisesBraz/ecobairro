import { describe, it, expect } from 'vitest'
import { getApiErrorMessage } from '@/lib/http/api-error'
import { HttpError } from '@/lib/http/fetch-json'

describe('getApiErrorMessage', () => {
  const fallback = 'erro generico'

  describe('errores nao-HTTP', () => {
    it('devolve o fallback para Error normal', () => {
      expect(getApiErrorMessage(new Error('boom'), fallback)).toBe(fallback)
    })

    it('devolve o fallback para string / null / undefined', () => {
      expect(getApiErrorMessage('x', fallback)).toBe(fallback)
      expect(getApiErrorMessage(null, fallback)).toBe(fallback)
      expect(getApiErrorMessage(undefined, fallback)).toBe(fallback)
    })
  })

  describe('mapeamento por status', () => {
    it('5xx ignora o body e devolve mensagem generica', () => {
      const err = new HttpError(500, 'Internal', { message: 'detalhe tecnico' })
      expect(getApiErrorMessage(err, fallback)).toMatch(/Serviço indisponível/i)
    })

    it('401 devolve mensagem de sessao expirada', () => {
      const err = new HttpError(401, 'Unauthorized', {})
      expect(getApiErrorMessage(err, fallback)).toMatch(/sessão|inválida|expirada/i)
    })

    it('403 devolve mensagem de permissao', () => {
      const err = new HttpError(403, 'Forbidden', {})
      expect(getApiErrorMessage(err, fallback)).toMatch(/permissão/i)
    })

    it('404 devolve mensagem de recurso nao encontrado', () => {
      const err = new HttpError(404, 'Not Found', 'plain text body')
      expect(getApiErrorMessage(err, fallback)).toMatch(/não foi encontrado/i)
    })

    it('409 devolve mensagem de conflito', () => {
      const err = new HttpError(409, 'Conflict', {})
      expect(getApiErrorMessage(err, fallback)).toMatch(/já existe/i)
    })
  })

  describe('extracao do body.message', () => {
    it('4xx com mensagem limpa do dominio passa para o utilizador', () => {
      const err = new HttpError(400, 'Bad Request', {
        message: 'O email já está registado.',
      })
      expect(getApiErrorMessage(err, fallback)).toBe('O email já está registado.')
    })

    it('4xx com array de mensagens (ValidationPipe) usa a primeira', () => {
      const err = new HttpError(422, 'Unprocessable', {
        message: ['campo obrigatorio', 'tamanho invalido'],
      })
      expect(getApiErrorMessage(err, fallback)).toBe('campo obrigatorio')
    })

    it('ignora mensagens tecnicas (Cannot POST /...) e cai para status', () => {
      const err = new HttpError(404, 'Not Found', {
        message: 'Cannot POST /v1/foo/bar',
      })
      // Devia mapear para o fallback de 404, nao mostrar a string tecnica
      expect(getApiErrorMessage(err, fallback)).toMatch(/não foi encontrado/i)
    })

    it('ignora "Internal server error" como mensagem do body', () => {
      const err = new HttpError(400, 'Bad Request', {
        message: 'Internal server error',
      })
      expect(getApiErrorMessage(err, fallback)).toBe(fallback)
    })

    it('ignora mensagens muito longas (>200 chars)', () => {
      const longMsg = 'a'.repeat(250)
      const err = new HttpError(400, 'Bad Request', { message: longMsg })
      expect(getApiErrorMessage(err, fallback)).toBe(fallback)
    })

    it('devolve fallback se body nao tem campo message', () => {
      const err = new HttpError(400, 'Bad Request', { foo: 'bar' })
      expect(getApiErrorMessage(err, fallback)).toBe(fallback)
    })
  })
})
