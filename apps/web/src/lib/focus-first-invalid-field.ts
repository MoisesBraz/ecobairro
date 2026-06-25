const FOCUSABLE_CONTROL =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusFirstInvalidField(
  container: HTMLElement | null,
  orderedFieldNames: readonly string[],
) {
  window.requestAnimationFrame(() => {
    for (const fieldName of orderedFieldNames) {
      const field = container?.querySelector<HTMLElement>(`[data-field="${fieldName}"]`)
      if (!field) continue

      field.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const control = field.matches(FOCUSABLE_CONTROL)
        ? field
        : field.querySelector<HTMLElement>(FOCUSABLE_CONTROL)

      // Safari/Chromium podem deixar o controlo nativo de data sem conteúdo
      // quando recebe foco programático dentro de um modal com scroll.
      // O campo continua visível e acessível; neste caso fazemos apenas scroll.
      if (control instanceof HTMLInputElement && control.type === 'date') return

      control?.focus({ preventScroll: true })
      return
    }
  })
}
