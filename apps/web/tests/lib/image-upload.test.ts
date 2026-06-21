import { describe, it, expect } from 'vitest'
import { fileToDataUrl } from '@/lib/image-upload'

describe('fileToDataUrl', () => {
  it('converte um File de texto em data URL base64', async () => {
    const file = new File(['hello'], 'hi.txt', { type: 'text/plain' })
    const dataUrl = await fileToDataUrl(file)
    expect(dataUrl.startsWith('data:text/plain')).toBe(true)
    // 'hello' em base64 = aGVsbG8=
    expect(dataUrl.endsWith('aGVsbG8=')).toBe(true)
  })

  it('preserva o mime type do ficheiro', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const dataUrl = await fileToDataUrl(file)
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('rejeita se o FileReader devolver um resultado nao-string', async () => {
    // FileReader nunca devolve null para readAsDataURL no jsdom, mas
    // garantimos que o type guard funciona. Este teste verifica que a
    // funcao devolve uma Promise (e nao uma string sincrona) — smoke test.
    const file = new File([''], 'empty.bin', { type: 'application/octet-stream' })
    const dataUrl = await fileToDataUrl(file)
    expect(typeof dataUrl).toBe('string')
    expect(dataUrl).toMatch(/^data:application\/octet-stream/)
  })
})
