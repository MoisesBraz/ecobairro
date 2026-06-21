import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { useRef } from 'react'
import { useModalA11y } from '@/lib/use-modal-a11y'

function ModalHarness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useModalA11y(open, ref, onClose)
  if (!open) return null
  return (
    <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>
      <button aria-label="Fechar">X</button>
      <input placeholder="primeiro input" />
      <input placeholder="segundo input" />
      <button>Submeter</button>
    </div>
  )
}

describe('useModalA11y', () => {
  it('foca o primeiro input quando o modal abre (nao o botao Fechar)', async () => {
    render(<ModalHarness open onClose={() => {}} />)
    // o hook usa setTimeout(..., 0); avancar o relogio
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    expect(document.activeElement).toBe(
      screen.getByPlaceholderText('primeiro input'),
    )
  })

  it('chama onClose ao premir Esc', async () => {
    const onClose = vi.fn()
    render(<ModalHarness open onClose={onClose} />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('nao re-foca em cada keystroke (regressao do bug do flash no X)', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<ModalHarness open onClose={onClose} />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    const firstInput = screen.getByPlaceholderText('primeiro input') as HTMLInputElement
    firstInput.focus()

    // Simula re-renders consecutivos com onClose diferente cada vez
    // (era o que partia antes — cada keystroke criava novo onClose inline)
    for (let i = 0; i < 5; i++) {
      rerender(<ModalHarness open onClose={() => onClose()} />)
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })

    // O foco DEVE estar ainda no input, nunca saltou para o botao
    expect(document.activeElement).toBe(firstInput)
  })

  it('nao adiciona listeners quando open=false', () => {
    const onClose = vi.fn()
    render(<ModalHarness open={false} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
