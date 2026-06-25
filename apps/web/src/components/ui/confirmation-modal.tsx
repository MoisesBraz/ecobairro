import { useRef } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useModalA11y } from '@/lib/use-modal-a11y'

interface ConfirmationModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  loading?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Voltar',
  loading = false,
  error,
  onConfirm,
  onClose,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeIfIdle = () => {
    if (!loading) onClose()
  }

  useModalA11y(open, modalRef, closeIfIdle)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={closeIfIdle} aria-hidden="true" />
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
        tabIndex={-1}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Fechar modal"
          disabled={loading}
          onClick={closeIfIdle}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4 pr-7">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 id="confirmation-modal-title" className="font-bold text-foreground">{title}</h2>
            <p id="confirmation-modal-description" className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={loading} onClick={closeIfIdle}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
