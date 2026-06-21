import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Inputs/selects/textareas — preferidos para auto-focus inicial em vez do
// botão "Fechar" (que seria o primeiro focável só por ordem do DOM).
const PREFERRED_AUTOFOCUS_SELECTOR =
  'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])'

/**
 * Accessibility hook for custom (non-Radix) modals.
 *
 * When `open` is true:
 *  - Focuses the first input/select/textarea (or first focusable as fallback)
 *  - Traps Tab / Shift+Tab inside the modal
 *  - Closes the modal on Esc (calls `onClose`)
 *  - Restores focus to the previously focused element when closing
 *
 * The effect intentionally runs **only when `open` flips** (mount/unmount),
 * not on every render — caller pode passar uma função inline `() => setX(false)`
 * sem provocar reset do foco a cada keystroke.
 *
 * Usage:
 *   const modalRef = useRef<HTMLDivElement>(null)
 *   useModalA11y(open, modalRef, () => setOpen(false))
 *   return open && <div ref={modalRef} role="dialog" ...>...</div>
 */
export function useModalA11y(
  open: boolean,
  modalRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null)
  // Mantém a callback estável dentro do effect — sem isto, cada keystroke
  // num input do modal re-criava onClose, o effect re-corria, o cleanup
  // mexia no foco e o setTimeout puxava o foco de volta para o botão X.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    const focusFirst = window.setTimeout(() => {
      const node = modalRef.current
      if (!node) return
      const preferred = node.querySelector<HTMLElement>(PREFERRED_AUTOFOCUS_SELECTOR)
      if (preferred) {
        preferred.focus()
        return
      }
      const first = node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      if (first) first.focus()
      else node.focus()
    }, 0)

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const node = modalRef.current
      if (!node) return
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusFirst)
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [open, modalRef])
}
